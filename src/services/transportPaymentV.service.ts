import { inject, injectable } from 'inversify';

import { TPVoucher } from '../entities/transportPaymentvoucher.entity';
import { TPVoucherRepository } from '../repositories/transportPaymentV.repository';
import { TYPES } from '../types';
import { GrnRepository } from '../repositories/grn.repository';
import { format } from 'date-fns';
import { AuditLogService } from './auditLog.service';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import { formatDateTime } from '../utils/dateUtils';
import { DocumentbService, DocumentWithRelatedData } from './documentb.service';
import { DocumentTypeEnum } from '../entities/docuemnt.entity';
import { DocumentStatus } from '../entities/docuemnt.entity';
import { DocumentTypeEnum as DocDefEnum } from '../entities/documentdef.entity';
import { ApprovalFlowService } from './approvalFlow.service';
import { ProductRepository } from '../repositories/product.repository';
import { In, DataSource } from 'typeorm';
import { DocumentbRepository } from '../repositories/documentb.repository';

@injectable()
export class TPVoucherService {
  constructor(
    @inject(TYPES.TPVoucherRepository)
    private readonly tpVoucherRepository: TPVoucherRepository,
    @inject(TYPES.GrnRepository) private grnRepository: GrnRepository,
    @inject(TYPES.AuditLogService) private auditLogService: AuditLogService,
    @inject(TYPES.ProductRepository) private productRepository: ProductRepository,
    @inject(TYPES.DocumentbRepository) private documentbRepository: DocumentbRepository,
    @inject(TYPES.DocumentbService)
        private readonly documentbService: DocumentbService,
        @inject(TYPES.ApprovalFlowService)
    private approvalFlowService: ApprovalFlowService,
    @inject(TYPES.DataSource)
    private readonly dataSource: DataSource
  ) {}

  async createTPVoucher(tpvoucherData: any): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      //TODO: Check approval flow is exit or not for logged user

       const approvalFlowExit = this.approvalFlowService.findApprovalFlowForLoggedUser(tpvoucherData.requestedBy, 'transport-payment-voucher')

      if (!approvalFlowExit) {
        throw new Error('Approval flow not found');
      }


      tpvoucherData.voucherNo = await this.generateTransportPaymentVoucherNo();

      const currentDate = new Date();
      tpvoucherData.createdDate = currentDate;
      tpvoucherData.createdTime = currentDate.toLocaleTimeString();
      console.log(tpvoucherData.createdTime);
  console.log(tpvoucherData.products.length);
  if (tpvoucherData.products && Array.isArray(tpvoucherData.products)) {
      const products = await queryRunner.manager.findBy(this.productRepository.target, {
        id: In(tpvoucherData.products),
      });
      tpvoucherData.products = products; // ✅ replace IDs with actual entities
    }

      const newVoucher = queryRunner.manager.create(this.tpVoucherRepository.target, tpvoucherData);
      console.log(newVoucher);
      const saveVoucher= await queryRunner.manager.save(newVoucher);
      const document = await this.documentbService.createDocument({
              type: DocumentTypeEnum.TRANSPORT_PAYMENT_VOUCHER,
              docDef: DocDefEnum.PROCUREMENT,
              totalAmt: tpvoucherData.totalAmt,
              status: DocumentStatus.HOLD,
              remarks: 'Document auto-created with GRN',
              lastActionBy: { id: tpvoucherData.requestedBy },
              document_type_id : Array.isArray(saveVoucher) ? (saveVoucher[0] as TPVoucher)?.id : (saveVoucher as TPVoucher).id
            }, );
            //console.log('Document created:', docuemnt);
            //const saved = await this.grnRepository.save(savedGrn);
      
      // Commit transaction - all operations succeeded
      await queryRunner.commitTransaction();

      // Start approval flow after commit so voucher is visible to other DB connections
      await this.documentbService.startApprovalFlow(document.id);

      return saveVoucher;
    } catch (error: any) {
      // Rollback transaction - undo all changes
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }
 public async getAllRecycleBinTPVouchers(
    queryOptions: PaginationOptions,userId: string,
  ): Promise<{ data: any[]; meta: any }> {
    const { search } = queryOptions;

    const {data, meta} = await this.documentbService.getAllDocumentByUserId(
              userId,
              DocumentTypeEnum.TRANSPORT_PAYMENT_VOUCHER,
              queryOptions
            );
          
           // console.log('data in grn service', documentData);
            
              const typedDocuments = data as DocumentWithRelatedData[];
              //exclude deleted documents
              const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === true);
            for (const doc of activeDocuments) {
                if (!doc.document_type_id) continue;
          
                try {
                    doc.relatedData = await this.tpVoucherRepository.findOne({
                      where: { id: doc.document_type_id, isDeleted: true },
                      relations: ['grnNo', 'companyName'],
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
    // ✅ Helper to flatten objects into a searchable string
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj).map((v) => objectToString(v)).join(' ');
    }
    return String(obj);
  };

  // ✅ Apply search filter (deep search across all fields)
  if (search && search.trim()) {
    const term = search.toLowerCase();
    relatedDataOnly = relatedDataOnly.filter((item) =>
      objectToString(item).toLowerCase().includes(term)
    );
  }

    // 🔄 Sorting
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
  // public async getAllTPVouchers(
  //   queryOptions: PaginationOptions,userId: string,
  // ): Promise<{ data: any[]; meta: any }> {
  //   const { search } = queryOptions;

  //   const {data, meta} = await this.documentbService.getAllDocumentByUserId(
  //             userId,
  //             DocumentTypeEnum.TRANSPORT_PAYMENT_VOUCHER,
  //             queryOptions
  //           );
          
  //          // console.log('data in grn service', documentData);
            
  //             const typedDocuments = data as DocumentWithRelatedData[];
  //           for (const doc of typedDocuments) {
  //               if (!doc.document_type_id) continue;
          
  //               try {
  //                   doc.relatedData = await this.tpVoucherRepository.findOne({
  //                     where: { id: doc.document_type_id },
  //                     relations: ['grnNo', 'companyName'],
  //                   });
                  
  //               } catch {
  //                 doc.relatedData = null;
  //               }
  //             }
    
  //             let relatedDataOnly = typedDocuments
  //        //  .filter((d) => d)
  //           .map((doc) => ({
  //             documentId: doc.id,
  //             // documentType: doc.type,
  //             // documentTypeId: doc.document_type_id,
  //             overAllStatus: doc.status,
  //             createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
  //             createdDate: formatDateTime(doc.createdAt).createdDate,
  //             createdTime: formatDateTime(doc.createdAt).createdTime,
  //             ...doc.relatedData,
  //            id: doc.relatedData.id,
  //           companyName: doc.relatedData.companyName?.name || null,
  //           grnNo: doc.relatedData.grnNo?.grnNo || null    
  //           }))
  //   // ✅ Helper to flatten objects into a searchable string
  // const objectToString = (obj: any): string => {
  //   if (obj == null) return '';
  //   if (typeof obj === 'object') {
  //     return Object.values(obj).map((v) => objectToString(v)).join(' ');
  //   }
  //   return String(obj);
  // };

  // // ✅ Apply search filter (deep search across all fields)
  // if (search && search.trim()) {
  //   const term = search.toLowerCase();
  //   relatedDataOnly = relatedDataOnly.filter((item) =>
  //     objectToString(item).toLowerCase().includes(term)
  //   );
  // }

  //   // 🔄 Sorting
  // if (queryOptions.sort) {
  //   const [field, direction] = queryOptions.sort.split(':');
  //   const sortOrder = direction?.toUpperCase() === 'DESC' ? -1 : 1;

  //   const getNestedValue = (obj: any, path: string) =>
  //     path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);

  //   relatedDataOnly.sort((a, b) => {
  //     const valA = getNestedValue(a, field);
  //     const valB = getNestedValue(b, field);

  //     if (valA == null && valB == null) return 0;
  //     if (valA == null) return -1 * sortOrder;
  //     if (valB == null) return 1 * sortOrder;

  //     if (!isNaN(valA) && !isNaN(valB)) {
  //       return (Number(valA) - Number(valB)) * sortOrder;
  //     }
  //     return String(valA).localeCompare(String(valB)) * sortOrder;
  //   });
  // }
  //     return {
  // data: relatedDataOnly,
  // meta: {
  //   total: meta.total,
  //   page: meta.page,
  //   pages: meta.pages
  // } 
  //       };

    // let queryBuilder = await this.tpVoucherRepository
    //   .createQueryBuilder('tpVoucher')
    //   .leftJoinAndSelect('tpVoucher.grnNo', 'grn')
    //   .leftJoinAndSelect('tpVoucher.requestedBy', 'requestedBy')
    //   .leftJoinAndSelect('tpVoucher.companyName', 'companyName')
    //   .select([
    //     'tpVoucher.id',
    //     'tpVoucher.debitCreditTo',
    //     'tpVoucher.payReceivedFrom',
    //     'tpVoucher.location',
    //     'tpVoucher.driverName',
    //     'tpVoucher.contactNo',
    //     'tpVoucher.altContactNo',
    //     'tpVoucher.vehicleNo',
    //     'tpVoucher.dispatchLocation',
    //     'tpVoucher.destinationLocation',
    //     'tpVoucher.remark',
    //     'tpVoucher.requestingDepartment',
    //     'tpVoucher.products',
    //     'tpVoucher.paymentMode',
    //     'tpVoucher.freightAmt',
    //     'tpVoucher.totalAmt',
    //     'tpVoucher.amtWords',
    //     'tpVoucher.kyc',
    //     'tpVoucher.voucherNo',
    //     'tpVoucher.createdAt',

    //     'tpVoucher.approvalStatus',
    //     'tpVoucher.receiverName',
    //     'tpVoucher.anyAttachment',

    //     'companyName.name',

    //     'grn.grnNo',
    //     'requestedBy.id',
    //     'requestedBy.firstName',
    //     'requestedBy.lastName',
    //   ])
    //   .orderBy('tpVoucher.createdAt', 'DESC');

    // const { data, meta } = await buildQuery(
    //   queryBuilder,
    //   queryOptions,
    //   'tpVoucher',
    // );
    // const vouchers = data;
    // const formatResponse = vouchers.map((voucher) => {
    //   const rawDate = voucher.createdAt;
    //   const { createdDate, createdTime } = formatDateTime(rawDate);
    //   return {
    //     ...voucher,
    //     grnNo: voucher.grnNo ? voucher.grnNo.grnNo : null,
    //     companyName: voucher.companyName?.name || null,
    //     createdTime: createdTime,
    //     createdDate: createdDate,
    //   };
    // });
    // return {
    //   data: formatResponse,
    //   meta,
    // };
 // }
public async getAllTPVouchers(
    queryOptions: PaginationOptions,userId: string,
  ): Promise<{ data: any[]; meta: any }> {
    const { search } = queryOptions;

    const {data, meta} = await this.documentbService.getAllDocumentByUserId(
              userId,
              DocumentTypeEnum.TRANSPORT_PAYMENT_VOUCHER,
              queryOptions
            );
          
           // console.log('data in grn service', documentData);
            
              const typedDocuments = data as DocumentWithRelatedData[];
              //exclude deleted documents
              const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === false);
            for (const doc of activeDocuments) {
                if (!doc.document_type_id) continue;
          
                try {
                    doc.relatedData = await this.tpVoucherRepository.findOne({
                      where: { id: doc.document_type_id, isDeleted: false },
                      relations: ['grnNo', 'companyName'],
                    });
                  
                } catch {
                  doc.relatedData = null;
                }
              }

              let relatedDataOnly = activeDocuments
         //  .filter((d) => d)
            .map((doc) => ({
              documentId: doc.id,
              overAllStatus: doc.status,
              createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
              createdDate: formatDateTime(doc.createdAt).createdDate,
              createdTime: formatDateTime(doc.createdAt).createdTime,
             id: doc.relatedData.id,
            companyName: doc.relatedData.companyName?.name || null,
            grnNo: doc.relatedData.grnNo?.grnNo || null , 
            altContactNo:doc.relatedData.altContactNo,
            amtWords:doc.relatedData.amtWords,
            contactNo:doc.relatedData.contactNo,
            debitCreditTo:doc.relatedData.debitCreditTo,
            destinationLocation:doc.relatedData.destinationLocation,
            dispatchLocation:doc.relatedData.dispatchLocation,
            driverName:doc.relatedData.driverName,
            kyc:doc.relatedData.kyc,
            location:doc.relatedData.location,
            payReceivedFrom:doc.relatedData.payReceivedFrom,
            paymentMode:doc.relatedData.paymentMode,
            receiverName:doc.relatedData.receiverName,
            remark:doc.relatedData.remark,
            totalAmt:doc.relatedData.totalPayableAmt,
            vehicleNo:doc.relatedData.vehicleNo,
            voucherNo:doc.relatedData.voucherNo,
            freightAmt:doc.relatedData.freightAmt
            
            }))
    // ✅ Helper to flatten objects into a searchable string
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj).map((v) => objectToString(v)).join(' ');
    }
    return String(obj);
  };

  // ✅ Apply search filter (deep search across all fields)
  if (search && search.trim()) {
    const term = search.toLowerCase();
    relatedDataOnly = relatedDataOnly.filter((item) =>
      objectToString(item).toLowerCase().includes(term)
    );
  }

    // 🔄 Sorting
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


  public async getTPVoucherById(id: string): Promise<any> {
    const voucher = await this.tpVoucherRepository
      .createQueryBuilder('tpVoucher')
      .leftJoinAndSelect('tpVoucher.grnNo', 'grn')
      .leftJoinAndSelect('tpVoucher.requestedBy', 'requestedBy')
      .leftJoinAndSelect('tpVoucher.companyName', 'companyName')

      .select([
  'tpVoucher.id',
  'tpVoucher.debitCreditTo',
  'tpVoucher.payReceivedFrom',
  'tpVoucher.location',
  'tpVoucher.voucherNo',
  'companyName.id',
  'companyName.name',
  'tpVoucher.requestingDepartment',
  'tpVoucher.driverName',
  'tpVoucher.contactNo',
  'tpVoucher.altContactNo',
  'tpVoucher.vehicleNo',
  'tpVoucher.dispatchLocation',
  'tpVoucher.destinationLocation',
  'tpVoucher.products',
  'tpVoucher.paymentMode',
  'tpVoucher.freightAmt',
  'tpVoucher.totalPayableAmt',   // ✅ or finalPayableAmt
  'tpVoucher.kyc',
  'tpVoucher.remark',
  'tpVoucher.amtWords',
  'tpVoucher.approvalStatus',
  'tpVoucher.receiverName',
  'tpVoucher.anyAttachment',
  'tpVoucher.createdAt',
  'grn.id',
  'grn.grnNo',
  'requestedBy.id',
  'requestedBy.firstName',
  'requestedBy.lastName',
])

      .where('tpVoucher.id = :id', { id })
      .getOne();
    if (!voucher) return null;
    const rawDate = voucher.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);
    if (voucher && voucher.grnNo) {
      return {
        ...voucher,
        grnNo: {
          id: voucher.grnNo?.id,
          grnNo: voucher.grnNo?.grnNo,
        },
        companyName: {
          id: voucher.companyName?.id || null,
          companyName: voucher.companyName?.name || null,
        },
        createdTime: createdTime,
        createdDate: createdDate,
      };
    }

    return voucher;
  }

  public async getTPVoucherByIdForView(docid: string): Promise<any> {
console.log("docid in getTPVoucherByIdForView", docid);

    const document = await this.documentbService.getDocumentById(docid);
    console.log("document in getTPVoucherByIdForView", document);
    const id = document.documentTypeId;
    if (!id) {
      throw new Error(`Document type ID not found for document: ${docid}`);
    }


    const voucher = await this.tpVoucherRepository
      .createQueryBuilder('tpVoucher')
      .leftJoinAndSelect('tpVoucher.grnNo', 'grn')
      .leftJoinAndSelect('tpVoucher.requestedBy', 'requestedBy')
      .leftJoinAndSelect('tpVoucher.products', 'products')
      .leftJoinAndSelect('tpVoucher.companyName', 'companyName')
      .where('tpVoucher.id = :id', { id })
      .getOne();
    if (!voucher) return null;
    console.log("voucher in getTPVoucherByIdForView", voucher);
    const rawDate = voucher.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);
    const formatResponse = {
      id: voucher.id,

      debitCreditTo: voucher.debitCreditTo,
      payReceivedFrom: voucher.payReceivedFrom,
      location: voucher.location,
      voucherNo: voucher.voucherNo,
      companyName: voucher.companyName?.name || null,
      remark: voucher.remark || null,
      requestingDepartment: voucher.requestingDepartment,
      driverName: voucher.driverName,
      contactNo: voucher.contactNo,
      altContactNo: voucher.altContactNo,
      vehicleNo: voucher.vehicleNo,
      products: voucher.products?.map(product => product?.name) || null,
      dispatchLocation: voucher.dispatchLocation,
      destinationLocation: voucher.destinationLocation,
      //products: voucher.products,
      paymentMode: voucher.paymentMode,
      freightAmt: voucher.freightAmt,
      //totalAmt: voucher.totalAmt,
      totalPayableAmt: voucher.totalPayableAmt,   // ✅ or finalPayableAmt
       extraAmt: voucher.extraAmt,
     deductionAmt: voucher.deductionAmt,
     finalPayableAmt: voucher.finalPayableAmt,
     advanceAmt: voucher.advanceAmt,  
     actualAmt: voucher.actualAmt,
     decidedAmt: voucher.decidedAmt,
      kyc: voucher.kyc,
      createdTime: createdTime,
      createdDate: createdDate,
      amtWords: voucher.amtWords,
      approvalStatus: voucher.approvalStatus,
      receiverName: voucher.receiverName,

      anyAttachment: voucher.anyAttachment,
      grnNo: voucher.grnNo?.grnNo || null,
      requestedBy: voucher.requestedBy
        ? voucher.requestedBy?.firstName + ' ' + voucher.requestedBy?.lastName
        : null,
       overAllStatus: document.overAllStatus,
        createdBy: document.createdBy,
        approvalSummary: document.approvalSummary,
        documentId: document.id, 
    };

    return formatResponse;
  }

  public async getTPVoucherByIdForUpdate(id: string): Promise<any> {
    const voucher = await this.tpVoucherRepository
      .createQueryBuilder('tpVoucher')
      .leftJoinAndSelect('tpVoucher.grnNo', 'grn')
      .leftJoinAndSelect('tpVoucher.requestedBy', 'requestedBy')
      .leftJoinAndSelect('tpVoucher.products', 'products')
      .leftJoinAndSelect('tpVoucher.companyName', 'companyName')
      .where('tpVoucher.id = :id', { id })
      .getOne();
    if (!voucher) return null;
    const rawDate = voucher.createdAt;
    console.log("rawDate in getTPVoucherByIdForUpdate", voucher);
    const { createdDate, createdTime } = formatDateTime(rawDate);
    const formatResponse = {
      id: voucher.id,

      debitCreditTo: voucher.debitCreditTo,
      payReceivedFrom: voucher.payReceivedFrom,
      location: voucher.location,
      voucherNo: voucher.voucherNo,
      companyName: voucher.companyName?.id || null,
      remark: voucher.remark || null,
      requestingDepartment: voucher.requestingDepartment,
      driverName: voucher.driverName,
      contactNo: voucher.contactNo,
      altContactNo: voucher.altContactNo,
      vehicleNo: voucher.vehicleNo,
      dispatchLocation: voucher.dispatchLocation,
      destinationLocation: voucher.destinationLocation,
      //products: voucher.products,
       products: voucher.products?.map(product => product?.id) || null,
      paymentMode: voucher.paymentMode,
      freightAmt: voucher.freightAmt,
      //totalAmt: voucher.totalAmt,
      totalPayableAmt: voucher.totalPayableAmt,   // ✅ or finalPayableAmt
     extraAmt: voucher.extraAmt,
     deductionAmt: voucher.deductionAmt,
     finalPayableAmt: voucher.finalPayableAmt,
     advanceAmt: voucher.advanceAmt,  
     actualAmt: voucher.actualAmt,
     decidedAmt: voucher.decidedAmt,
      kyc: voucher.kyc,
      createdTime: createdTime,
      createdDate: createdDate,
      amtWords: voucher.amtWords,
      approvalStatus: voucher.approvalStatus,
      receiverName: voucher.receiverName,
      anyAttachment: voucher.anyAttachment,
      grnNo: voucher.grnNo?.id || null,
      requestedBy: voucher.requestedBy?.id || null,
    };

    return formatResponse;
  }

  public async updateTPVoucher(
  id: string,
  updatedData: any,
  updatedBy: string,
): Promise<TPVoucher | null> {
  const voucher = await this.tpVoucherRepository.findOne({
    where: { id },
    relations: ['products'], // load current products
  });

  if (!voucher) return null;

  const originalVoucher = { ...voucher, products: [...(voucher.products || [])] };

  // ✅ Handle GRN Relation
  const grnNo = updatedData.grnNo;
  if (grnNo) {
    const grn = await this.grnRepository.findOne({ where: { grnNo } });
    if (grn) voucher.grnNo = grn;
  }

  // ✅ Handle Products Relation explicitly
  if (updatedData.products && Array.isArray(updatedData.products)) {
    const productEntities = await this.productRepository.findByIds(updatedData.products);
    voucher.products = productEntities;
  }

  // ✅ Merge other non-relational fields
  Object.assign(voucher, {
    ...updatedData,
    products: voucher.products, // keep updated relation
  });

  // ✅ Save the updated entity
  const savedVoucher = await this.tpVoucherRepository.save(voucher);

  // ✅ Log changes
  await this.auditLogService.logChange(
    'TPVoucher',
    id,
    originalVoucher,
    voucher,
    updatedBy,
  );

  return savedVoucher;
}

  public async deleteTPVoucher(id: string): Promise<boolean> {
    const tpVoucher = await this.tpVoucherRepository.findOne({
      where: { id },
    });

    if (!tpVoucher) {
      return false;
    }

    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6);
    sixMonthsFromNow.setHours(0, 0, 0, 0);

    console.log(
      `TP Voucher with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`,
    );

    tpVoucher.deletionScheduledAt = sixMonthsFromNow;

    await this.tpVoucherRepository.save(tpVoucher);

    console.log(`TP Voucher with ID ${id} marked for deletion in 6 months.`);
    return true;
  }

  public async generateTransportPaymentVoucherNo(): Promise<string> {
    const today = new Date();
    const formattedDate = format(today, 'yyyyMMdd');

    const lastVoucher = await this.tpVoucherRepository
      .createQueryBuilder('tpVoucher')
      .where('tpVoucher.voucherNo LIKE :datePattern', {
        datePattern: `TPV-${formattedDate}-%`,
      })
      .orderBy('tpVoucher.voucherNo', 'DESC')
      .getOne();

    let newSerialNumber = 1;

    if (lastVoucher) {
      const lastSerialNumber = parseInt(
        lastVoucher.voucherNo.split('-')[2],
        10,
      );
      newSerialNumber = lastSerialNumber + 1;
    }

    const voucherNo = `TPV-${formattedDate}`;
    return voucherNo;
  }
  public async deleteMultipleTransportPaymentVoucher(ids: string[]): Promise<{ success: string[]; failed: { id: string; reason: string }[]; message: string }> {
  const success: string[] = [];
  const failed: { id: string; reason: string }[] = [];  
  for (const id of ids) {
      const tpVoucher = await this.tpVoucherRepository.findOne({
        where: { id },
      });

      if (!tpVoucher) {
        failed.push({ id, reason: 'Transport Payment Voucher not found' });
        continue;
      }

      const relatedDocument = await this.documentbRepository.findOne({
        where: { document_type_id: tpVoucher.id }
      });

      if (!relatedDocument) {
        throw new Error(`Something went wrong`);
      }

      const deleteDocument = await this.documentbRepository.delete(relatedDocument.id);
      if (!deleteDocument) {
        throw new Error(`Failed to delete related document with ID ${relatedDocument.id}`);
      }


      const deleteGrn = await this.tpVoucherRepository.delete(tpVoucher.id);

      if (!deleteGrn) {
        throw new Error(`Failed to delete Transport Payment Voucher with ID ${id}`);
      }

    }
    const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
    return { success, failed, message};

  }
}
