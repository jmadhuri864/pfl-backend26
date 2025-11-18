import { inject, injectable } from 'inversify';
import { PMPVoucherRepository } from '../repositories/pmpvoucher.repository';
import { PMPVoucher } from '../entities/packingMaterialVoucher.entity';
import { TYPES } from '../types';
import { format } from 'date-fns';
import { GrnRepository } from '../repositories/grn.repository';
import { AuditLogService } from './auditLog.service';
import AppError from '../utils/appError';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import { formatDateTime } from '../utils/dateUtils';
import { DocumentbService, DocumentWithRelatedData } from './documentb.service';
import { DocumentStatus, DocumentTypeEnum } from '../entities/docuemnt.entity';
import { log } from 'console';
import { DocumentTypeEnum as DocDefEnum } from '../entities/documentdef.entity';
import { ApprovalFlowService } from './approvalFlow.service';
import { DocumentbRepository } from '../repositories/documentb.repository';


@injectable()
export class PMPVoucherService {
  constructor(
    @inject(TYPES.PMPVoucherRepository)
    private pmpVoucherRepository: PMPVoucherRepository,
    @inject(TYPES.GrnRepository) private grnRepository: GrnRepository,
    @inject(TYPES.AuditLogService) private auditLogService: AuditLogService,
        @inject(TYPES.DocumentbService) private documentbService: DocumentbService, // Assuming DocumentbService is defined elsewhere
        @inject(TYPES.DocumentbRepository) private documentbRepository : DocumentbRepository,
        @inject(TYPES.ApprovalFlowService)
    private approvalFlowService: ApprovalFlowService
    
  ) {}

  public async getAllVouchers(queryOptions: PaginationOptions, userId: string): Promise<any> {
 const { search } = queryOptions;
    const {data, meta} = await this.documentbService.getAllDocumentByUserId(
                  userId,
                  DocumentTypeEnum.PACKAGING_MATERIAL_VOUCHER,
                  queryOptions
                );
              
               // console.log('data in grn service', documentData);
                
                  const typedDocuments = data as DocumentWithRelatedData[];
                  const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === false);


                for (const doc of activeDocuments) {
                    if (!doc.document_type_id) continue;
              
                    try {
                        doc.relatedData = await this.pmpVoucherRepository.findOne({
                          where: { id: doc.document_type_id, isDeleted: false },
                          relations: ['companyName', 'grnNo','materials', 'materials.itemUom', 'address', 'requestedBy'],
                        });
                      
                    } catch {
                      doc.relatedData = null;
                    }
                  }
        
                  let relatedDataOnly = activeDocuments
             //  .filter((d) => d)
                .map((doc) => ({
                  documentId: doc.id,
                  // documentType: doc.type,
                  // documentTypeId: doc.document_type_id,
                  overAllStatus: doc.status,
                  createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
                  createdDate: formatDateTime(doc.createdAt).createdDate,
                  createdTime: formatDateTime(doc.createdAt).createdTime,
                  ...doc.relatedData,
                 id: doc.relatedData.id,
                companyName: doc.relatedData.companyName?.name || null,
                grnNo: doc.relatedData.grnNo?.grnNo || null     
                }))
          // ✅ Helper: Convert object to searchable string (deep flatten)
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj).map((v) => objectToString(v)).join(' ');
    }
    return String(obj);
  };

  // ✅ Apply deep search if search term is provided
  if (search && search.trim()) {
    const term = search.toLowerCase();
    relatedDataOnly = relatedDataOnly.filter((item) =>
      objectToString(item).toLowerCase().includes(term)
    );
  }
    // 🔄 Sorting (supports nested fields like companyName or grnNo)
  if (queryOptions.sort) {
    const [field, direction] = queryOptions.sort.split(':');
    const sortOrder = direction?.toUpperCase() === 'DESC' ? -1 : 1;

    const getNestedValue = (obj: any, path: string) =>
      path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);

    relatedDataOnly.sort((a, b) => {
      const valA = getNestedValue(a, field);
      const valB = getNestedValue(b, field);

      if (valA == null && valB == null) return 0;
      if (valA == null) return -1 * sortOrder;
      if (valB == null) return 1 * sortOrder;

      if (!isNaN(valA) && !isNaN(valB)) {
        return (Number(valA) - Number(valB)) * sortOrder;
      }
      return String(valA).localeCompare(String(valB)) * sortOrder;
    });
  }
          return {
  data: relatedDataOnly,
  meta: {
    total: meta.total,
    page: meta.page,
    pages: meta.pages
  }  
            };
  }

//   public async getAllVouchers(queryOptions: PaginationOptions, userId: string): Promise<any> {
//  const { search } = queryOptions;
//     const {data, meta} = await this.documentbService.getAllDocumentByUserId(
//                   userId,
//                   DocumentTypeEnum.PACKAGING_MATERIAL_VOUCHER,
//                   queryOptions
//                 );
              
//                // console.log('data in grn service', documentData);
                
//                   const typedDocuments = data as DocumentWithRelatedData[];
//                 for (const doc of typedDocuments) {
//                     if (!doc.document_type_id) continue;
              
//                     try {
//                         doc.relatedData = await this.pmpVoucherRepository.findOne({
//                           where: { id: doc.document_type_id },
//                           relations: ['companyName', 'grnNo','materials', 'materials.itemUom'],
//                         });
                      
//                     } catch {
//                       doc.relatedData = null;
//                     }
//                   }
        
//                   let relatedDataOnly = typedDocuments
//              //  .filter((d) => d)
//                 .map((doc) => ({
//                   documentId: doc.id,
//                   // documentType: doc.type,
//                   // documentTypeId: doc.document_type_id,
//                   overAllStatus: doc.status,
//                   createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
//                   createdDate: formatDateTime(doc.createdAt).createdDate,
//                   createdTime: formatDateTime(doc.createdAt).createdTime,
//                   ...doc.relatedData,
//                  id: doc.relatedData.id,
//                 companyName: doc.relatedData.companyName?.name || null,
//                 grnNo: doc.relatedData.grnNo?.grnNo || null     
//                 }))
//           // ✅ Helper: Convert object to searchable string (deep flatten)
//   const objectToString = (obj: any): string => {
//     if (obj == null) return '';
//     if (typeof obj === 'object') {
//       return Object.values(obj).map((v) => objectToString(v)).join(' ');
//     }
//     return String(obj);
//   };

//   // ✅ Apply deep search if search term is provided
//   if (search && search.trim()) {
//     const term = search.toLowerCase();
//     relatedDataOnly = relatedDataOnly.filter((item) =>
//       objectToString(item).toLowerCase().includes(term)
//     );
//   }
//     // 🔄 Sorting (supports nested fields like companyName or grnNo)
//   if (queryOptions.sort) {
//     const [field, direction] = queryOptions.sort.split(':');
//     const sortOrder = direction?.toUpperCase() === 'DESC' ? -1 : 1;

//     const getNestedValue = (obj: any, path: string) =>
//       path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);

//     relatedDataOnly.sort((a, b) => {
//       const valA = getNestedValue(a, field);
//       const valB = getNestedValue(b, field);

//       if (valA == null && valB == null) return 0;
//       if (valA == null) return -1 * sortOrder;
//       if (valB == null) return 1 * sortOrder;

//       if (!isNaN(valA) && !isNaN(valB)) {
//         return (Number(valA) - Number(valB)) * sortOrder;
//       }
//       return String(valA).localeCompare(String(valB)) * sortOrder;
//     });
//   }
//           return {
//   data: relatedDataOnly,
//   meta: {
//     total: meta.total,
//     page: meta.page,
//     pages: meta.pages
//   }  
//             };
    

//     // let queryBuilder = await this.pmpVoucherRepository
//     //   .createQueryBuilder('pmpVoucher')
//     //   .leftJoinAndSelect('pmpVoucher.materials', 'materials')
//     //   .leftJoinAndSelect('materials.itemUom', 'itemUom')
//     //   .leftJoinAndSelect('pmpVoucher.address', 'address')
//     //   .leftJoinAndSelect('pmpVoucher.requestedBy', 'requestedBy')
//     //   .leftJoinAndSelect('pmpVoucher.companyName', 'companyName')
//     //   .leftJoinAndSelect('pmpVoucher.grnNo', 'grn')
//     //   .select([
//     //     'pmpVoucher.id',
//     //     'pmpVoucher.voucherNo',
//     //     'pmpVoucher.approvalStatus',
//     //     'pmpVoucher.debitCreditTo',
//     //     'pmpVoucher.payReceivedFrom',
//     //     'pmpVoucher.location',
//     //     'pmpVoucher.sellerName',
//     //     'pmpVoucher.contactNo',
//     //     'pmpVoucher.altContactNo',
//     //     'pmpVoucher.purpose',
//     //     'pmpVoucher.paymentMode',
//     //     'pmpVoucher.totalAmt',
//     //     'pmpVoucher.amtWords',
//     //     'pmpVoucher.createdAt',

//     //     'pmpVoucher.kyc',

//     //     'pmpVoucher.receiverName',
//     //     'pmpVoucher.anyAttachment',
//     //     'pmpVoucher.requestingDepartment',
//     //     'pmpVoucher.companyName',
//     //     'materials.id',
//     //     'materials.itemName',
//     //     'materials.itemQty',
//     //     'materials.rate',
//     //     'materials.amt',
//     //     'itemUom.id',
//     //     'itemUom.unit',
//     //     'address',
//     //     'requestedBy.id',
//     //     'requestedBy.firstName',
//     //     'requestedBy.lastName',
//     //     'companyName.name',
//     //     'grn.grnNo',
//     //   ])
//     //   .orderBy('pmpVoucher.createdAt', 'DESC');

//     // const { data, meta } = await buildQuery(
//     //   queryBuilder,
//     //   queryOptions,
//     //   'pmpVoucher',
//     // );

//     // const formatResponse = data.map((voucher) => {
//     //   const rawDate = voucher.createdAt;
//     //   const { createdDate, createdTime } = formatDateTime(rawDate);
//     //   return {
//     //     ...voucher,
//     //     grnNo: voucher.grnNo?.grnNo || null,
//     //     companyName: voucher.companyName?.name || null,
//     //     createdTime: createdTime,
//     //     createdDate: createdDate,
//     //   };
//     // });
//     // return {
//     //   data: formatResponse,
//     //   meta,
//     // };
//   }
public async getAllRecycleBinVouchers(queryOptions: PaginationOptions, userId: string): Promise<any> {
 const { search } = queryOptions;
    const {data, meta} = await this.documentbService.getAllDocumentByUserId(
                  userId,
                  DocumentTypeEnum.PACKAGING_MATERIAL_VOUCHER,
                  queryOptions
                );
              
               // console.log('data in grn service', documentData);
                
                  const typedDocuments = data as DocumentWithRelatedData[];
                  const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === true);


                for (const doc of activeDocuments) {
                    if (!doc.document_type_id) continue;
              
                    try {
                        doc.relatedData = await this.pmpVoucherRepository.findOne({
                          where: { id: doc.document_type_id, isDeleted: true },
                          relations: ['companyName', 'grnNo','materials', 'materials.itemUom', 'address', 'requestedBy'],
                        });
                      
                    } catch {
                      doc.relatedData = null;
                    }
                  }
        
                  let relatedDataOnly = activeDocuments
             //  .filter((d) => d)
                .map((doc) => ({
                  documentId: doc.id,
                  // documentType: doc.type,
                  // documentTypeId: doc.document_type_id,
                  overAllStatus: doc.status,
                  createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
                  createdDate: formatDateTime(doc.createdAt).createdDate,
                  createdTime: formatDateTime(doc.createdAt).createdTime,
                  ...doc.relatedData,
                 id: doc.relatedData.id,
                companyName: doc.relatedData.companyName?.name || null,
                grnNo: doc.relatedData.grnNo?.grnNo || null     
                }))
          // ✅ Helper: Convert object to searchable string (deep flatten)
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj).map((v) => objectToString(v)).join(' ');
    }
    return String(obj);
  };

  // ✅ Apply deep search if search term is provided
  if (search && search.trim()) {
    const term = search.toLowerCase();
    relatedDataOnly = relatedDataOnly.filter((item) =>
      objectToString(item).toLowerCase().includes(term)
    );
  }
    // 🔄 Sorting (supports nested fields like companyName or grnNo)
  if (queryOptions.sort) {
    const [field, direction] = queryOptions.sort.split(':');
    const sortOrder = direction?.toUpperCase() === 'DESC' ? -1 : 1;

    const getNestedValue = (obj: any, path: string) =>
      path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);

    relatedDataOnly.sort((a, b) => {
      const valA = getNestedValue(a, field);
      const valB = getNestedValue(b, field);

      if (valA == null && valB == null) return 0;
      if (valA == null) return -1 * sortOrder;
      if (valB == null) return 1 * sortOrder;

      if (!isNaN(valA) && !isNaN(valB)) {
        return (Number(valA) - Number(valB)) * sortOrder;
      }
      return String(valA).localeCompare(String(valB)) * sortOrder;
    });
  }
          return {
  data: relatedDataOnly,
  meta: {
    total: meta.total,
    page: meta.page,
    pages: meta.pages
  }  
            };
  }

  public async getVoucherById(id: string): Promise<any> {
    const voucher = await this.pmpVoucherRepository
      .createQueryBuilder('pmpVoucher')
      .leftJoinAndSelect('pmpVoucher.materials', 'materials')
      .leftJoinAndSelect('materials.itemUom', 'itemUom')
      .leftJoinAndSelect('pmpVoucher.address', 'address')
      .leftJoinAndSelect('pmpVoucher.requestedBy', 'requestedBy')
      .leftJoinAndSelect('pmpVoucher.companyName', 'company') // Renamed alias to "company"
      .leftJoinAndSelect('pmpVoucher.grnNo', 'grn') // Join with GRN entity
      .select([
        'pmpVoucher.id',
        'pmpVoucher.voucherNo',
        'pmpVoucher.approvalStatus',
        'pmpVoucher.debitCreditTo',
        'pmpVoucher.payReceivedFrom',
        'pmpVoucher.location',
        'pmpVoucher.sellerName',
        'pmpVoucher.contactNo',
        'pmpVoucher.altContactNo',
        'pmpVoucher.purpose',
        'pmpVoucher.paymentMode',
        'pmpVoucher.totalAmt',
        'pmpVoucher.amtWords',
        'pmpVoucher.createdAt',

        'pmpVoucher.receiverName',
        'pmpVoucher.anyAttachment',
        'pmpVoucher.requestingDepartment',
        'pmpVoucher.kyc',

        'materials.id',
        'materials.itemName',
        'materials.itemQty',
        'materials.rate',
        'materials.amt',
        'itemUom.id',
        'itemUom.unit',

        'company.id',
        'company.name',

        'address',

        'requestedBy.id',
        'requestedBy.firstName',
        'requestedBy.lastName',

        'grn.id',
        'grn.grnNo',
      ])
      .where('pmpVoucher.id = :id', { id })
      .getOne();
    if (!voucher) return null;
    const rawDate = voucher.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);
    if (voucher) {
      return {
        ...voucher,

        grnNo: voucher.grnNo
          ? {
              id: voucher.grnNo.id || null,
              grnNo: voucher.grnNo.grnNo || null,
            }
          : null,

        companyName: voucher.companyName
          ? {
              id: voucher.companyName.id || null,
              companyName: voucher.companyName.name || null,
            }
          : null,

        createdTime: createdTime,
        createdDate: createdDate,
      };
    }

    return voucher;
  }

  public async getVoucherByIdforView(docid: string): Promise<any> {

    log("docid is ", docid);
    const document = await this.documentbService.getDocumentById(docid);
    const id = document.documentTypeId;
    console.log("docuemnt id is ", id);
    
    if (!id) throw new AppError(404, 'Document not found');
    const voucher = await this.pmpVoucherRepository
      .createQueryBuilder('pmpVoucher')
      .leftJoinAndSelect('pmpVoucher.materials', 'materials')
      .leftJoinAndSelect('materials.itemUom', 'itemUom')
      .leftJoinAndSelect('pmpVoucher.address', 'address')
      .leftJoinAndSelect('pmpVoucher.requestedBy', 'requestedBy')
      .leftJoinAndSelect('pmpVoucher.companyName', 'company')
      .leftJoinAndSelect('pmpVoucher.grnNo', 'grn')
     
      .where('pmpVoucher.id = :id', { id })
      .getOne();
    if (!voucher) return null;
    const rawDate = voucher.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);
   const formatResponse = {
      id: voucher.id,
      voucherNo: voucher.voucherNo,
      approvalStatus: voucher.approvalStatus,
      debitCreditTo: voucher.debitCreditTo,
      payReceivedFrom: voucher.payReceivedFrom,
      location: voucher.location,
      sellerName: voucher.sellerName,

       address:{
      address1: voucher?.address?.address1,
      address2: voucher?.address?.address2,
      location:voucher?.address?.location,
      city:voucher?.address?.city,
      state:voucher?.address?.state,
      pincode:voucher?.address?.pincode,

      } ,
      contactNo: voucher.contactNo,
      altContactNo: voucher.altContactNo,
      purpose: voucher.purpose,
      paymentMode: voucher.paymentMode,
      totalAmt: voucher.totalAmt,
      amtWords: voucher.amtWords,
      //createdAt: voucher.createdAt,
companyName: voucher.companyName?.id ?? null,
requestedBy: (voucher.requestedBy?.firstName && voucher.requestedBy?.lastName)
  ? voucher.requestedBy.firstName + ' ' + voucher.requestedBy.lastName
  : null,

      grnNo:voucher.grnNo?.grnNo ?? null,
      createdTime: createdTime,
      remark: voucher.remark,
      createdDate: createdDate,
      receiverName: voucher.receiverName,
      anyAttachment: voucher.anyAttachment,
      requestingDepartment: voucher.requestingDepartment,
      kyc: voucher.kyc,
      materials: voucher.materials.map((material) => ({
        id: material.id,
        itemName: material.itemName,
        itemQty: material.itemQty,
        rate: material.rate,
        amt: material.amt,
        itemUom: material.itemUom?.unit ?? null,

      })),
      overAllStatus: document.overAllStatus,
        createdBy: document.createdBy,
        approvalSummary: document.approvalSummary,
        documentId: document.id,

    }
    
 

    return formatResponse;

   
  }

  public async getVoucherByIdForUpdate(id: string): Promise<any> {
    const voucher = await this.pmpVoucherRepository
      .createQueryBuilder('pmpVoucher')
      .leftJoinAndSelect('pmpVoucher.materials', 'materials')
      .leftJoinAndSelect('materials.itemUom', 'itemUom')
      .leftJoinAndSelect('pmpVoucher.address', 'address')
      .leftJoinAndSelect('pmpVoucher.requestedBy', 'requestedBy')
      .leftJoinAndSelect('pmpVoucher.companyName', 'company') 
      .leftJoinAndSelect('pmpVoucher.grnNo', 'grn') 
    
      .where('pmpVoucher.id = :id', { id })
      .getOne();
    if (!voucher) return null;
    const rawDate = voucher.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);

    const formatResponse = {
      id: voucher.id,
      voucherNo: voucher.voucherNo,
      approvalStatus: voucher.approvalStatus,
      debitCreditTo: voucher.debitCreditTo,
      payReceivedFrom: voucher.payReceivedFrom,
      location: voucher.location,
      sellerName: voucher.sellerName,
      contactNo: voucher.contactNo,
      altContactNo: voucher.altContactNo,
      purpose: voucher.purpose,
      paymentMode: voucher.paymentMode,
      totalAmt: voucher.totalAmt,
         remark: voucher.remark,
      amtWords: voucher.amtWords,
      //createdAt: voucher.createdAt,
      address:{
      address1: voucher?.address?.address1,
      address2: voucher?.address?.address2,
      location:voucher?.address?.location,
      city:voucher?.address?.city,
      state:voucher?.address?.state,
      pincode:voucher?.address?.pincode,

      } ,


companyName: voucher.companyName?.id ?? null,
requestedBy: voucher.requestedBy?.id ?? null,

      grnNo:voucher.grnNo?.id ?? null,
      createdTime: createdTime,
      createdDate: createdDate,
      receiverName: voucher.receiverName,
      anyAttachment: voucher.anyAttachment,
      requestingDepartment: voucher.requestingDepartment,
      kyc: voucher.kyc,
      materials: voucher.materials.map((material) => ({
        id: material.id,
        itemName: material.itemName,
        itemQty: material.itemQty,
        rate: material.rate,
        amt: material.amt,
        itemUom: material.itemUom?.id ?? null,
      })),


    }
    
if(!voucher)
{
  return null;
}
 

    return formatResponse;
  }

  public async createVoucher(voucherData: any): Promise<any> {

    //TODO: Check approval flow is exit or not for logged user

     const approvalFlowExit = this.approvalFlowService.findApprovalFlowForLoggedUser(voucherData.requestedBy, 'packaging-material-voucher')

    if (!approvalFlowExit) {
      throw new Error('Approval flow not found');
    }


    voucherData.voucherNo = await this.generatePMPVoucherNo();

    const pmpvoucher = this.pmpVoucherRepository.create(voucherData);
    const savePmpVoucher =  await this.pmpVoucherRepository.save(pmpvoucher);

    const document = await this.documentbService.createDocument({
            type: DocumentTypeEnum.PACKAGING_MATERIAL_VOUCHER,
            docDef: DocDefEnum.PROCUREMENT,
            totalAmt: Array.isArray(savePmpVoucher) ? (savePmpVoucher[0] as PMPVoucher)?.totalAmt : (savePmpVoucher as PMPVoucher).totalAmt,
            status: DocumentStatus.HOLD,
            remarks: 'Document auto-created with GRN',
            lastActionBy: { id: voucherData.requestedBy },
            document_type_id: Array.isArray(savePmpVoucher) ? (savePmpVoucher[0] as PMPVoucher)?.id : (savePmpVoucher as PMPVoucher).id
          }, );
          //console.log('Document created:', docuemnt);
          //const saved = await this.grnRepository.save(savedGrn);
    
          await this.documentbService.startApprovalFlow(document.id);
    

    return savePmpVoucher;
  }

  public async updateVoucher(
    id: string,
    updatedData: any,
    updatedBy: string,
  ): Promise<PMPVoucher | null> {
    const voucher = await this.pmpVoucherRepository.findOne({
      where: { id },
    });

    if (!voucher) {
      return null;
    }

    const originalVoucher = { ...voucher };

    const grnNo = updatedData.grnNo;
    console.log(grnNo);
    const grn = await this.grnRepository.findOne({
      where: { grnNo },
    });

    if (grn) {
      updatedData.grnNo = grn;
    }

    Object.assign(voucher, updatedData);

    const savedVoucher = await this.pmpVoucherRepository.save(voucher);

    await this.auditLogService.logChange(
      'PMPVoucher',
      id,
      originalVoucher,
      voucher,
      updatedBy,
    );

    return savedVoucher;
  }

  async deleteVoucher(id: string): Promise<boolean> {
    // Find the voucher by ID
    const voucher = await this.pmpVoucherRepository.findOne({ where: { id } });

    if (!voucher) {
      throw new AppError(404, `Voucher with ID ${id} not found`);
    }

    // Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

    // Log the scheduled deletion
    console.log(
      `Voucher with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`,
    );

    // Set the deletionScheduledAt field for the voucher
    voucher.deletionScheduledAt = sixMonthsFromNow;

    // Save the updated voucher with the scheduled deletion date
    await this.pmpVoucherRepository.save(voucher);

    console.log(`Voucher with ID ${id} marked for deletion in 6 months.`);
    return true;
  }

  public async generatePMPVoucherNo(): Promise<string> {
    const today = new Date();
    const formattedDate = format(today, 'yyyyMMdd'); // e.g., 20241017

    // Query to get the last packing material payment voucher for the current date
    const lastVoucher = await this.pmpVoucherRepository
      .createQueryBuilder('pmpVoucher')
      .where('pmpVoucher.voucherNo LIKE :datePattern', {
        datePattern: `PMPV-${formattedDate}-%`,
      })
      .orderBy('pmpVoucher.voucherNo', 'DESC')
      .getOne();

    let newSerialNumber = 1; // Default to 1 if no vouchers exist for the current date

    if (lastVoucher) {
      // Extract the serial number from the last voucher
      const lastSerialNumber = parseInt(
        lastVoucher.voucherNo.split('-')[2],
        10,
      );
      newSerialNumber = lastSerialNumber + 1; // Increment the serial number
    }

    // Create the voucher number in the format PMPV-yyyyMMdd-serialNumber
    const voucherNo = `PMPV-${formattedDate}`;
    return voucherNo;
  }

  public async deleteMultiplePMPVoucher(ids: string[]): Promise<{ success: string[]; failed: { id: string; reason: string }[]; message: string }> {
  const success: string[] = [];
  const failed: { id: string; reason: string }[] = [];  
  for (const id of ids) {
      const pmpVoucher = await this.pmpVoucherRepository.findOne({
        where: { id },
      });

      if (!pmpVoucher) {
        failed.push({ id, reason: 'pmpVoucher not found' });
        continue;
      }

      const relatedDocument = await this.documentbRepository.findOne({
        where: { document_type_id: pmpVoucher.id }
      });

      if (!relatedDocument) {
        throw new Error(`Something went wrong`);
      }

      const deleteDocument = await this.documentbRepository.delete(relatedDocument.id);
      if (!deleteDocument) {
        throw new Error(`Failed to delete related document with ID ${relatedDocument.id}`);
      }


      const deleteGrn = await this.pmpVoucherRepository.delete(pmpVoucher.id);

      if (!deleteGrn) {
        throw new Error(`Failed to delete pmpVoucher with ID ${id}`);
      }

    }
    const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
    return { success, failed, message};

  }


}
