import { inject, injectable } from 'inversify';
import { LPVoucher } from '../entities/labourPaymentVoucher.entity';
import { LabourPaymentVoucherRepository } from '../repositories/labourPaymentVoucher.repository';
import { TYPES } from '../types';
import { format } from 'date-fns';
import { GrnRepository } from '../repositories/grn.repository';
import { AuditLogService } from './auditLog.service';
import AppError from '../utils/appError';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import { formatDateTime } from '../utils/dateUtils';
import { DocumentbService, DocumentWithRelatedData } from './documentb.service';
import { DocumentStatus, DocumentTypeEnum } from '../entities/docuemnt.entity';
import { DocumentTypeEnum as DocDefEnum } from '../entities/documentdef.entity';
import { ApprovalFlowService } from './approvalFlow.service';
import { LessThan } from 'typeorm';
import { DocumentbRepository } from '../repositories/documentb.repository';


@injectable()
export class LabourPaymentVoucherService {
  constructor(
    @inject(TYPES.LabourPaymentVoucherRepository)
    private lpVoucherRepository: LabourPaymentVoucherRepository,
    @inject(TYPES.GrnRepository) private grnRepository: GrnRepository,
    @inject(TYPES.AuditLogService) private auditLogService: AuditLogService,
    @inject(TYPES.DocumentbService) private documentbService: DocumentbService, // Assuming DocumentbService is defined elsewhere
    @inject(TYPES.DocumentbRepository) private documentbRepository: DocumentbRepository,
    @inject(TYPES.ApprovalFlowService)
    private approvalFlowService: ApprovalFlowService
  ) {}

  async createLPVoucher(data: any): Promise<LPVoucher[]> {

    //TODO: Check approval flow is exit or not for logged user

    //  const approvalFlowExit = this.approvalFlowService.findApprovalFlowForLoggedUser(data.requestedBy, 'labor-payment-voucher')

    // if (!approvalFlowExit) {
    //   throw new Error('Approval flow not found');
    // }


    const voucherNo = await this.generateVoucherNo();
    data.voucherNo = voucherNo;

    const newLPVoucher = this.lpVoucherRepository.create(data);

    const saveLPVoucher = await this.lpVoucherRepository.save(newLPVoucher) //as LPVoucher | LPVoucher[];

    const document = await this.documentbService.createDocument({
            type: DocumentTypeEnum.LABOR_PAYMENT_VOUCHER,
            docDef: DocDefEnum.PROCUREMENT,
            totalAmt: Array.isArray(saveLPVoucher) ? (saveLPVoucher[0] as LPVoucher)?.totalAmt : (saveLPVoucher as LPVoucher).totalAmt,
            status: DocumentStatus.HOLD,
            remarks: 'Document auto-created with GRN',
            lastActionBy: { id: data.requestedBy },
            document_type_id: Array.isArray(saveLPVoucher) ? (saveLPVoucher[0] as LPVoucher)?.id : (saveLPVoucher as LPVoucher).id
          });
    
    //console.log('Document created:', docuemnt);
      //const saved = await this.grnRepository.save(savedGrn);

      await this.documentbService.startApprovalFlow(document.id);
          
    return saveLPVoucher;
  }

  // public async getLPVouchers(queryOptions: PaginationOptions, userId: string): Promise<any> {

  //   const {data, meta} = await this.documentbService.getAllDocumentByUserId(
  //             userId,
  //             DocumentTypeEnum.LABOR_PAYMENT_VOUCHER,
  //             queryOptions
  //           );
  //            const { search } = queryOptions;
          
  //          // console.log('data in grn service', documentData);
            
  //             const typedDocuments = data as DocumentWithRelatedData[];
  //           for (const doc of typedDocuments) {
  //               if (!doc.document_type_id) continue;
          
  //               try {
  //                   doc.relatedData = await this.lpVoucherRepository.findOne({
  //                     where: { id: doc.document_type_id },
  //                     relations: ['companyName', 'grnNo'],
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
  //             // ✅ Helper to flatten object into a searchable string
  // const objectToString = (obj: any): string => {
  //   if (obj == null) return '';
  //   if (typeof obj === 'object') {
  //     return Object.values(obj).map((v) => objectToString(v)).join(' ');
  //   }
  //   return String(obj);
  // };

  // // ✅ Apply deep search filtering
  // if (search && search.trim()) {
  //   const term = search.toLowerCase();
  //   relatedDataOnly = relatedDataOnly.filter((item) =>
  //     objectToString(item).toLowerCase().includes(term)
  //   );
  // }

  // // 🔄 Sorting support
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

    // let queryBuilder = await this.lpVoucherRepository
    //   .createQueryBuilder('lpVoucher')
    //   .leftJoinAndSelect('lpVoucher.companyName', 'companyName')
    //   .leftJoinAndSelect('lpVoucher.grnNo', 'grn')
    //   .leftJoinAndSelect('lpVoucher.requestedBy', 'requestedBy')

    //   .select([
    //     'lpVoucher.id',
    //     'lpVoucher.voucherNo',
    //     'lpVoucher.approvalStatus',
    //     'lpVoucher.debitCreditTo',
    //     'lpVoucher.payReceivedFrom',
    //     'lpVoucher.location',
    //     'lpVoucher.noOfLabours',
    //     'lpVoucher.loadingDate',
    //     'lpVoucher.contactNo',
    //     'lpVoucher.altContactNo',
    //     'lpVoucher.products',
    //     'lpVoucher.paymentMode',
    //     'lpVoucher.ratePerLabour',
    //     'lpVoucher.totalAmt',
    //     'lpVoucher.createdAt',

    //     'lpVoucher.kyc',

    //     'lpVoucher.receiverName',
    //     'lpVoucher.amtWords',
    //     'lpVoucher.anyAttachment',
    //     'lpVoucher.requestingDepartment',

    //     'companyName.id',
    //     'companyName.name',
    //     'grn.grnNo',
    //     'requestedBy.id',
    //     'requestedBy.firstName',
    //     'requestedBy.lastName',
    //   ])
    //   .orderBy('lpVoucher.createdAt', 'DESC');
    // const { data, meta } = await buildQuery(
    //   queryBuilder,
    //   queryOptions,
    //   'lpVoucher',
    // );
    // const formatResponse = data.map((voucher) => {
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
  //}

  public async getLPVouchers(queryOptions: PaginationOptions, userId: string): Promise<any> {

    const {data, meta} = await this.documentbService.getAllDocumentByUserId(
              userId,
              DocumentTypeEnum.LABOR_PAYMENT_VOUCHER,
              queryOptions
            );
             const { search } = queryOptions;
          
           // console.log('data in grn service', documentData);
            
              const typedDocuments = data as DocumentWithRelatedData[];
const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === false);

            for (const doc of activeDocuments) {
                if (!doc.document_type_id) continue;
          
                try {
                    doc.relatedData = await this.lpVoucherRepository.findOne({
                      where: { id: doc.document_type_id, isDeleted: false },
                      relations: ['companyName', 'grnNo'],
                    });
                } catch {
                  doc.relatedData = null;
                }
              }

              let relatedDataOnly = activeDocuments
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
              // ✅ Helper to flatten object into a searchable string
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj).map((v) => objectToString(v)).join(' ');
    }
    return String(obj);
  };

  // ✅ Apply deep search filtering
  if (search && search.trim()) {
    const term = search.toLowerCase();
    relatedDataOnly = relatedDataOnly.filter((item) =>
      objectToString(item).toLowerCase().includes(term)
    );
  }

  // 🔄 Sorting support
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

  public async getLPVoucherById(id: string): Promise<any> {
    const voucher = await this.lpVoucherRepository
      .createQueryBuilder('lpVoucher')
      .leftJoinAndSelect('lpVoucher.grnNo', 'grn')
      .leftJoinAndSelect('lpVoucher.companyName', 'companyName')
      .leftJoinAndSelect('lpVoucher.requestedBy', 'requestedBy')

      .select([
        'lpVoucher.id',
        'lpVoucher.voucherNo',
        'lpVoucher.approvalStatus',
        'lpVoucher.debitCreditTo',
        'lpVoucher.payReceivedFrom',
        'lpVoucher.receiverName',
        'lpVoucher.location',
        'lpVoucher.noOfLabours',
        'lpVoucher.loadingDate',

        'lpVoucher.contactNo',
        'lpVoucher.altContactNo',
        'lpVoucher.products',
        'lpVoucher.kyc',

        'lpVoucher.paymentMode',
        'lpVoucher.ratePerLabour',
        'lpVoucher.totalAmt',
        'lpVoucher.createdAt',

        'lpVoucher.amtWords',
        'lpVoucher.anyAttachment',
        'lpVoucher.requestingDepartment',
        'companyName.id',
        'companyName.name',
        'grn.grnNo',
        'grn.id',
        'requestedBy.id',
        'requestedBy.firstName',
        'requestedBy.lastName',
      ])
      .where('lpVoucher.id = :id', { id })
      .getOne();
    if (!voucher) {
      return null;
    }
    const rawDate = voucher.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);
    if (voucher && voucher.grnNo) {
      return {
        ...voucher,
        grnNo: {
          id: voucher.grnNo?.id || null,
          grnNo: voucher.grnNo?.grnNo || null,
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

  public async getLPVoucherByIdForView(docid: string): Promise<any> {

    const document = await this.documentbService.getDocumentById(docid);
    const id = document.documentTypeId;
    if (!id) throw new AppError(404, 'Document not found');

    const voucher = await this.lpVoucherRepository
      .createQueryBuilder('lpVoucher')
      .leftJoinAndSelect('lpVoucher.grnNo', 'grn')
      .leftJoinAndSelect('lpVoucher.companyName', 'companyName')
      .leftJoinAndSelect('lpVoucher.requestedBy', 'requestedBy')

      .where('lpVoucher.id = :id', { id })
      .getOne();
    if (!voucher) {
      return null;
    }
    const rawDate = voucher.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);
    const formatResponse = {
      id: voucher.id,
      voucherNo: voucher.voucherNo,
      approvalStatus: voucher.approvalStatus,
      debitCreditTo: voucher.debitCreditTo,
      payReceivedFrom: voucher.payReceivedFrom,
      receiverName: voucher.receiverName,
      location: voucher.location,
      noOfLabours: voucher.noOfLabours,
      loadingDate: voucher.loadingDate,

      contactNo: voucher.contactNo,
      altContactNo: voucher.altContactNo,
      products: voucher.products,
      kyc: voucher.kyc,

      paymentMode: voucher.paymentMode,
      ratePerLabour: voucher.ratePerLabour,
      totalAmt: voucher.totalAmt,
      createdAt: voucher.createdAt,

      amtWords: voucher.amtWords,
      anyAttachment: voucher.anyAttachment,
      requestingDepartment: voucher.requestingDepartment,
      grnNo: voucher.grnNo?.grnNo || null,
      companyName: voucher.companyName?.name || null,
remark:voucher.remark || null,
      createdTime: createdTime,
      createdDate: createdDate,
      overAllStatus: document.overAllStatus,
        createdBy: document.createdBy,
        approvalSummary: document.approvalSummary,
        documentId: document.id,
    };

    return formatResponse;
  }

public async getLPRecycleBinVouchers(queryOptions: PaginationOptions, userId: string): Promise<any> {

    const {data, meta} = await this.documentbService.getAllDocumentByUserId(
              userId,
              DocumentTypeEnum.LABOR_PAYMENT_VOUCHER,
              queryOptions
            );
             const { search } = queryOptions;
          
           // console.log('data in grn service', documentData);
            
              const typedDocuments = data as DocumentWithRelatedData[];
const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === true);

            for (const doc of activeDocuments) {
                if (!doc.document_type_id) continue;
          
                try {
                    doc.relatedData = await this.lpVoucherRepository.findOne({
                      where: { id: doc.document_type_id, isDeleted: true },
                      relations: ['companyName', 'grnNo'],
                    });
                } catch {
                  doc.relatedData = null;
                }
              }

              let relatedDataOnly = activeDocuments
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
              // ✅ Helper to flatten object into a searchable string
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj).map((v) => objectToString(v)).join(' ');
    }
    return String(obj);
  };

  // ✅ Apply deep search filtering
  if (search && search.trim()) {
    const term = search.toLowerCase();
    relatedDataOnly = relatedDataOnly.filter((item) =>
      objectToString(item).toLowerCase().includes(term)
    );
  }

  // 🔄 Sorting support
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

   public async getLPVoucherByIdForUpdate(id: string): Promise<any> {
    const voucher = await this.lpVoucherRepository
      .createQueryBuilder('lpVoucher')
      .leftJoinAndSelect('lpVoucher.grnNo', 'grn')
      .leftJoinAndSelect('lpVoucher.companyName', 'companyName')
      .leftJoinAndSelect('lpVoucher.requestedBy', 'requestedBy')

      .where('lpVoucher.id = :id', { id })
      .getOne();
    if (!voucher) {
      return null;
    }
    const rawDate = voucher.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);
    const formatResponse = {
      id: voucher.id,
      voucherNo: voucher.voucherNo,
      approvalStatus: voucher.approvalStatus,
      debitCreditTo: voucher.debitCreditTo,
      payReceivedFrom: voucher.payReceivedFrom,
      receiverName: voucher.receiverName,
      location: voucher.location,
      noOfLabours: voucher.noOfLabours,
      loadingDate: voucher.loadingDate,

      contactNo: voucher.contactNo,
      altContactNo: voucher.altContactNo,
      products: voucher.products,
      kyc: voucher.kyc,
remark : voucher.remark || null,
      paymentMode: voucher.paymentMode,
      ratePerLabour: voucher.ratePerLabour,
      totalAmt: voucher.totalAmt,
      createdAt: voucher.createdAt,

      amtWords: voucher.amtWords,
      anyAttachment: voucher.anyAttachment,
      requestingDepartment: voucher.requestingDepartment,
      grnNo: voucher.grnNo?.id || null,
      companyName: voucher.companyName?.id || null,

      createdTime: createdTime,
      createdDate: createdDate,
    };

    return formatResponse;
  }

  public async updateLPVoucher(
    id: string,
    updatedData: any,
    updatedBy: string,
  ): Promise<LPVoucher | null> {
    const voucher = await this.lpVoucherRepository.findOne({ where: { id } });
    if (!voucher) return null;

    const originalVoucher = { ...voucher };

    console.log(updatedData.grnNo);
    console.log(typeof updatedData.grnNo);
    const grnNo = updatedData.grnNo;
    console.log(grnNo);
    const grn = await this.grnRepository.findOne({
      where: { grnNo },
    });

    if (grn) {
      updatedData.grnNo = grn;
    }

    Object.assign(voucher, updatedData);

    const updatedVoucher = await this.lpVoucherRepository.save(voucher);

    await this.auditLogService.logChange(
      'LPVoucher',
      voucher.id, // Entity ID
      originalVoucher, // Original state
      updatedVoucher, // Updated state
      updatedBy, // Updated by (you may replace this with the actual user making the update)
    );

    // Return the updated voucher
    return updatedVoucher;
  }

  // Delete an LP Voucher with scheduled deletion (6 months)
  async deleteLPVoucher(id: string): Promise<boolean> {
    const lpVoucher = await this.lpVoucherRepository.findOne({ where: { id } });

    if (!lpVoucher) {
      throw new AppError(404, `LP Voucher with ID ${id} not found`);
    }

    // Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

    // Log the scheduled deletion
    console.log(
      `LP Voucher with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`,
    );

    // Set the deletionScheduledAt field for the LP Voucher
    lpVoucher.deletionScheduledAt = sixMonthsFromNow;

    // Save the updated LP Voucher with the scheduled deletion date
    await this.lpVoucherRepository.save(lpVoucher);

    console.log(`LP Voucher with ID ${id} marked for deletion in 6 months.`);
    return true;
  }

  public async generateVoucherNo(): Promise<string> {
    const today = new Date();
    const formattedDate = format(today, 'yyyyMMdd'); // e.g., 20241017

    // Query to get the last cash voucher for the current date
    const lastVoucher = await this.lpVoucherRepository
      .createQueryBuilder('cashVoucher')
      .where('cashVoucher.voucherNo LIKE :datePattern', {
        datePattern: `CV-${formattedDate}-%`,
      })
      .orderBy('cashVoucher.voucherNo', 'DESC')
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

    // Create the voucher number in the format CV-yyyyMMdd-serialNumber
    const voucherNo = `LV-${formattedDate}`;
    return voucherNo;
  }
  public async deleteMultipleLPVoucher(ids: string[]): Promise<{ success: string[]; failed: { id: string; reason: string }[]; message: string }> {
  const success: string[] = [];
  const failed: { id: string; reason: string }[] = [];  
  for (const id of ids) {
      const lpVoucher = await this.lpVoucherRepository.findOne({
        where: { id },
      });

      if (!lpVoucher) {
        failed.push({ id, reason: 'Inward Register not found' });
        continue;
      }

      const relatedDocument = await this.documentbRepository.findOne({
        where: { document_type_id: lpVoucher.id }
      });

      if (!relatedDocument) {
        throw new Error(`Something went wrong`);
      }

      const deleteDocument = await this.documentbRepository.delete(relatedDocument.id);
      if (!deleteDocument) {
        throw new Error(`Failed to delete related document with ID ${relatedDocument.id}`);
      }


      const deleteGrn = await this.lpVoucherRepository.delete(lpVoucher.id);

      if (!deleteGrn) {
        throw new Error(`Failed to delete Inward Register with ID ${id}`);
      }

    }
    const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
    return { success, failed, message};

  }

}
