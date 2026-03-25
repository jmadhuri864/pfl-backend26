import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { CashVoucher } from '../entities/mCashVoucher.entity';
import { MultiCashVoucherRepository } from '../repositories/multicashVoucher.repository';
import { format } from 'date-fns';
import { GrnRepository } from '../repositories/grn.repository';
import { DeliveryChallanRepository } from '../repositories/deliveryChallan.repository';
import { AuditLogService } from './auditLog.service';
import AppError from '../utils/appError';
import { instanceToPlain } from 'class-transformer';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import { formatDateTime } from '../utils/dateUtils';
import { UserRepository } from '../repositories/user.repository';
import { request } from 'http';
import { NotificationService } from './notification.service';
import { set } from 'lodash';
import { PdfGeneratorService } from '../utils/pdfGenerator';
import { DocumentbService, DocumentWithRelatedData } from './documentb.service';
import { DocumentTypeEnum } from '../entities/docuemnt.entity';
import { DocumentStatus } from '../entities/docuemnt.entity';
import { DocumentTypeEnum as DocDefEnum } from '../entities/documentdef.entity';
import { ApprovalFlowService } from './approvalFlow.service';
import { LessThan, DataSource } from 'typeorm';
import { DocumentbRepository } from '../repositories/documentb.repository';



@injectable()
export class MultiCashVoucherService {
  constructor(
    @inject(TYPES.MultiCashVoucherRepository)
    private cashVoucherRepository: MultiCashVoucherRepository,
    @inject(TYPES.GrnRepository) private grnRepository: GrnRepository,
    @inject(TYPES.UserRepository) private userRepository: UserRepository,
    @inject(TYPES.NotificationService)
    private readonly notificationService: NotificationService,
    @inject(TYPES.DeliveryChallanRepository)
    private deliverychllanRepository: DeliveryChallanRepository,
    @inject(TYPES.DocumentbRepository) private documentbRepository: DocumentbRepository,
    @inject(TYPES.PdfGeneratorService)
    private readonly pdfGeneratorService: PdfGeneratorService,
    @inject(TYPES.AuditLogService) private auditLogService: AuditLogService,
    @inject(TYPES.DocumentbService) private documentbService: DocumentbService, // Assuming DocumentbService is defined elsewhere
    @inject(TYPES.ApprovalFlowService)
    private approvalFlowService: ApprovalFlowService,
    @inject(TYPES.DataSource)
    private readonly dataSource: DataSource
  ) {}
public async getAllVouchers(
    queryOptions: PaginationOptions, userId: string
  ): Promise<{ data: any[]; meta: any }> {
    const { search } = queryOptions;
    const {data, meta} = await this.documentbService.getAllDocumentByUserId(
          userId,
          DocumentTypeEnum.MULTI_CASH_VOUCHER,
          queryOptions,
        );
      
       // console.log('data in grn service', documentData);
        
          const typedDocuments = data as DocumentWithRelatedData[];
          const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === false);
        for (const doc of activeDocuments) {
            if (!doc.document_type_id) continue;
      
            try {
                doc.relatedData = await this.cashVoucherRepository.findOne({
                  where: { id: doc.document_type_id , isDeleted: false},
                  relations: ['particulars', 'grnNo', 'challanNo', 'companyName'],
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
          //...doc.relatedData,
         id: doc.relatedData.id,
        companyName: doc.relatedData.companyName?.name || null,
        grnNo: doc.relatedData.grnNo?.grnNo || null,
        challanNo: doc.relatedData.challanNo?.challanNo || null,  
            debitCreditTo:doc.relatedData.debitCreditTo,
            voucherNo:doc.relatedData.voucherNo,
            payReceivedFrom:doc.relatedData.payReceivedFrom,
            location:doc.relatedData.location,
            totalAmt:doc.relatedData.totalAmt,
            amtWords:doc.relatedData.amtWords,
            paymentMode:doc.relatedData.paymentMode,
            receiverName:doc.relatedData.receiverName,
            remark:doc.relatedData.remark,
        
        }))
// ✅ Helper to flatten objects into a searchable string
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj).map((v) => objectToString(v)).join(' ');
    }
    return String(obj);
  };

  // ✅ Apply deep search across all fields
  if (search && search.trim()) {
    const term = search.toLowerCase();
    relatedDataOnly = relatedDataOnly.filter((item) =>
      objectToString(item).toLowerCase().includes(term)
    );
  }
   // 🔄 Sorting (optional, for consistency)
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
//   public async getAllVouchers(
//     queryOptions: PaginationOptions, userId: string
//   ): Promise<{ data: any[]; meta: any }> {
//     const { search } = queryOptions;
//     const {data, meta} = await this.documentbService.getAllDocumentByUserId(
//           userId,
//           DocumentTypeEnum.MULTI_CASH_VOUCHER,
//           queryOptions,
//         );
      
//        // console.log('data in grn service', documentData);
        
//           const typedDocuments = data as DocumentWithRelatedData[];
//         for (const doc of typedDocuments) {
//             if (!doc.document_type_id) continue;
      
//             try {
//                 doc.relatedData = await this.cashVoucherRepository.findOne({
//                   where: { id: doc.document_type_id },
//                   relations: ['particulars', 'grnNo', 'challanNo', 'companyName'],
//                 });
              
//             } catch {
//               doc.relatedData = null;
//             }
//           }

//           let relatedDataOnly = typedDocuments
//      //  .filter((d) => d)
//         .map((doc) => ({
//           documentId: doc.id,
//           // documentType: doc.type,
//           // documentTypeId: doc.document_type_id,
//           overAllStatus: doc.status,
//           createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
//           createdDate: formatDateTime(doc.createdAt).createdDate,
//           createdTime: formatDateTime(doc.createdAt).createdTime,
//           ...doc.relatedData,
//          id: doc.relatedData.id,
//         companyName: doc.relatedData.companyName?.name || null,
//         grnNo: doc.relatedData.grnNo?.grnNo || null,
//         challanNo: doc.relatedData.challanNo?.challanNo || null,       
//         }))
// // ✅ Helper to flatten objects into a searchable string
//   const objectToString = (obj: any): string => {
//     if (obj == null) return '';
//     if (typeof obj === 'object') {
//       return Object.values(obj).map((v) => objectToString(v)).join(' ');
//     }
//     return String(obj);
//   };

//   // ✅ Apply deep search across all fields
//   if (search && search.trim()) {
//     const term = search.toLowerCase();
//     relatedDataOnly = relatedDataOnly.filter((item) =>
//       objectToString(item).toLowerCase().includes(term)
//     );
//   }
//    // 🔄 Sorting (optional, for consistency)
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
//   return {
//   data: relatedDataOnly,
//   meta: {
//     total: meta.total,
//     page: meta.page,
//     pages: meta.pages
//   }
//     };
    // let queryBuilder = this.cashVoucherRepository
    //   .createQueryBuilder('voucher')
    //   .leftJoinAndSelect('voucher.particulars', 'particulars')
    //   .leftJoinAndSelect('voucher.grnNo', 'grn')
    //   .leftJoinAndSelect('voucher.companyName', 'companyName')
    //   .leftJoinAndSelect('voucher.challanNo', 'challan')
    //   .leftJoinAndSelect('voucher.requestedBy', 'requestedBy')
    //   .select([
    //     'voucher.id',
    //     'voucher.requestingDepartment',
    //     'voucher.debitCreditTo',
    //     'voucher.voucherNo',
    //     'voucher.payReceivedFrom',
    //     'voucher.location',
    //     'voucher.totalAmt',
    //     'voucher.createdAt',
    //     'voucher.amtWords',
    //     'voucher.paymentMode',
    //     'voucher.anyAttachment',
    //     'voucher.approvalStatus',
    //     'voucher.receiverName',
    //     'voucher.remark',
    //     'particulars.id',
    //     'particulars.description',
    //     'particulars.amt',
    //     'requestedBy.id',
    //     'requestedBy.firstName',
    //     'requestedBy.lastName',
    //     'companyName.name',
    //     'grn.id',
    //     'grn.grnNo',
    //     'challan.id',
    //     'challan.challanNo',
    //   ])
    //   .orderBy('voucher.createdAt', 'DESC');

    // //const data =await buildQuery(queryBuilder, queryOptions, "voucher");
    // const { data, meta } = await buildQuery(
    //   queryBuilder,
    //   queryOptions,
    //   'voucher',
    // );

    // const formattedVouchers = data.map((voucher) => {
    //   const rawDate = voucher.createdAt;
    //   const { createdDate, createdTime } = formatDateTime(rawDate);
    //   return {
    //     ...voucher,
    //     grnNo: voucher.grnNo?.grnNo || null,
    //     challanNo: voucher.challanNo?.challanNo || null,
    //     companyName: voucher.companyName?.name || null,
    //     createdTime: createdTime,
    //     createdDate: createdDate,
    //   };
    // });

    // return {
    //   data: formattedVouchers,
    //   meta,
    // };
  //}

  public async getVoucherById(id: string): Promise<any> {
    const voucher = await this.cashVoucherRepository
      .createQueryBuilder('voucher')
      .leftJoinAndSelect('voucher.particulars', 'particulars')

      .leftJoinAndSelect('voucher.companyName', 'companyName')
      .leftJoinAndSelect('voucher.passBy', 'passBy')
      .leftJoinAndSelect('voucher.approveBy', 'approveBy')
      .leftJoinAndSelect('voucher.grnNo', 'grn')
      .leftJoinAndSelect('voucher.requestedBy', 'requestedBy')
      .leftJoinAndSelect('voucher.challanNo', 'deliveryChallan')
      .select([
        'voucher.id',
        'voucher.requestingDepartment',
        'companyName.id',
        'companyName.name',
        'voucher.debitCreditTo',
        'voucher.voucherNo',
        'voucher.payReceivedFrom',
        'voucher.location',
        'voucher.totalAmt',
        'voucher.amtWords',
        'voucher.paymentMode',
        'voucher.anyAttachment',
        'voucher.approvalStatus',
        'voucher.createdAt',
        'voucher.receiverName',
        'voucher.remark',

        'particulars.id',
        'particulars.description',
        'particulars.amt',
        'requestedBy.id',
        'requestedBy.firstName',
        'requestedBy.lastName',
        'grn.id',
        'grn.grnNo',
        'deliveryChallan.id',
        'deliveryChallan.challanNo',
      ])
      .where('voucher.id = :id', { id })
      .getOne();

    if (!voucher) {
      return null;
    }
    const rawDate = voucher.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);

    return {
      ...voucher,
      grnNo: { id: voucher.grnNo?.id, grnNo: voucher.grnNo?.grnNo },
      challanNo: {
        id: voucher.challanNo?.id || null,
        challanNo: voucher.challanNo || null,
      },
      companyName: {
        id: voucher.companyName?.id || null,
        companyName: voucher.companyName?.name || null,
      },
      createdTime: createdTime,
      createdDate: createdDate,
    };
  }

  public async getVoucherByIdForUpdate(id: string): Promise<any> {
    const voucher = await this.cashVoucherRepository
      .createQueryBuilder('voucher')
      .leftJoinAndSelect('voucher.particulars', 'particulars')

      .leftJoinAndSelect('voucher.companyName', 'companyName')
      .leftJoinAndSelect('voucher.passBy', 'passBy')
      .leftJoinAndSelect('voucher.approveBy', 'approveBy')
      .leftJoinAndSelect('voucher.grnNo', 'grn')
      .leftJoinAndSelect('voucher.requestedBy', 'requestedBy')
      .leftJoinAndSelect('voucher.challanNo', 'deliveryChallan')
      .select([
        'voucher.id',
        'voucher.requestingDepartment',
        'companyName.id',
        'companyName.name',
        'voucher.debitCreditTo',
        'voucher.voucherNo',
        'voucher.payReceivedFrom',
        'voucher.location',
        'voucher.totalAmt',
        'voucher.remark',
        'voucher.amtWords',
        'voucher.paymentMode',
        'voucher.anyAttachment',
        'voucher.approvalStatus',
        'voucher.createdAt',
        'voucher.receiverName',

        'particulars.id',
        'particulars.description',
        'particulars.amt',
        'requestedBy.id',
        'requestedBy.firstName',
        'requestedBy.lastName',
        'grn.id',
        'grn.grnNo',
        'deliveryChallan.id',
        'deliveryChallan.challanNo',
      ])
      .where('voucher.id = :id', { id })
      .getOne();

    if (!voucher) {
      return null;
    }
    const rawDate = voucher.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);

    return {
      ...voucher,
      grnNo: voucher.grnNo?.id,
      challanNo: voucher.challanNo?.id || null,
      requestedBy: voucher.requestedBy?.id || null,
      companyName: voucher.companyName?.id || null,

      createdTime: createdTime,
      createdDate: createdDate,
    };
  }

  public async getVoucherByIdForView(docid: string): Promise<any> {

    
    const document = await this.documentbService.getDocumentById(
      docid
    );

    console.log("docuemnt is ", document);
    

    const id =  document.documentTypeId;
    console.log("id is ", id);
    
    if (!id) {
      throw new AppError(404, `Voucher with ID ${id} not found`);
    }

    const voucher = await this.cashVoucherRepository
      .createQueryBuilder('voucher')
      .leftJoinAndSelect('voucher.particulars', 'particulars')

      .leftJoinAndSelect('voucher.companyName', 'companyName')
      .leftJoinAndSelect('voucher.passBy', 'passBy')
      .leftJoinAndSelect('voucher.approveBy', 'approveBy')
      .leftJoinAndSelect('voucher.grnNo', 'grn')
      .leftJoinAndSelect('voucher.requestedBy', 'requestedBy')
      .leftJoinAndSelect('voucher.challanNo', 'deliveryChallan')
      .select([
        'voucher.id',
        'voucher.requestingDepartment',
        'companyName.id',
        'companyName.name',
        'voucher.debitCreditTo',
        'voucher.voucherNo',
        'voucher.payReceivedFrom',
        'voucher.location',
        'voucher.totalAmt',
        'voucher.amtWords',
        'voucher.paymentMode',
        'voucher.anyAttachment',
        'voucher.approvalStatus',
        'voucher.createdAt',
        'voucher.receiverName',
        'voucher.remark',
        'particulars.id',
        'particulars.description',
        'particulars.amt',

        'requestedBy.id',
        'requestedBy.firstName',
        'requestedBy.lastName',
        'grn.id',
        'grn.grnNo',
        'deliveryChallan.id',
        'deliveryChallan.challanNo',
      ])
      .where('voucher.id = :id', { id })
      .getOne();

    if (!voucher) {
      return null;
    }
    const rawDate = voucher.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);

    return {
      ...voucher,
      grnNo: voucher.grnNo?.grnNo || null,
      challanNo: voucher.challanNo?.challanNo || null,
      requestedBy:
        voucher.requestedBy?.firstName||null +
          ' ' +
          voucher.requestedBy?.middleName|| null+
          ' ' +
          voucher.requestedBy?.lastName || null,
      companyName: voucher.companyName?.name || null,

      createdTime: createdTime,
      createdDate: createdDate,
      overAllStatus: document.overAllStatus,
        createdBy: document.createdBy,
        approvalSummary: document.approvalSummary,
        documentId: document.id,
    };
  }

  //TODO: Create Voucher (Correction By Shri)
  public async createVoucher(voucherData: any): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      //TODO: Check approval flow is exit or not for logged user

       const approvalFlowExit = this.approvalFlowService.findApprovalFlowForLoggedUser(voucherData.requestedBy, 'multi-cash-voucher')

      if (!approvalFlowExit) {
        throw new Error('Approval flow not found');
      }


      console.log('voucherData is ', voucherData.requestedBy);
      const voucherNo = await this.generateVoucherNo();
      voucherData.voucherNo = voucherNo;

      if (voucherData.grnNo) {
        const grn = await queryRunner.manager.findOne(this.grnRepository.target, {
          where: { id: voucherData.grnNo },
        });
        if (!grn) {
          throw new Error(`GRN with ID ${voucherData.grnNo} not found.`);
        }
        voucherData.grnNo = grn;
      } else {
        voucherData.grnNo = null;
      }

      if (voucherData.challanNo) {
        const challan = await queryRunner.manager.findOne(this.deliverychllanRepository.target, {
          where: { id: voucherData.challanNo },
        });
        if (!challan) {
          throw new Error(`Challan with ID ${voucherData.challanNo} not found.`);
        }
        voucherData.challanNo = challan;
      } else {
        voucherData.challanNo = null;
      }

      const cashVoucher = queryRunner.manager.create(this.cashVoucherRepository.target, voucherData);

      const voucher = await queryRunner.manager.save(cashVoucher) as CashVoucher | CashVoucher[];

    //  console.log("Voucher created:", voucher);

      // const manager = await this.userRepository.findOne({
      //   where: { id: voucherData.requestedBy },
      //   relations: ['reportingManagers', 'reportingManagers.reportingTo'],
      // });

      // if (!manager) {
      //   throw new Error(`User with ID ${voucherData.requestedBy} not found`);
      // }

      // const reportingManagers = manager.reportingManagers.flatMap(
      //   (rm) => rm.reportingTo,
      // );
      // setTimeout(async () => {
      //   for (const reportingManager of reportingManagers) {
      //     const message = `A new Multi Cash Voucher has been created by ${manager.firstName} ${manager.lastName}.`;
      //     console.log('message is ', message);
      //     console.log('reportingManager is ', reportingManager.id);
      //     await this.notificationService.createNoti(message, reportingManager.id);
      //   }
      // }, 1000);

    //  console.log("Log ID", Array.isArray(voucher) ? (voucher[0] as CashVoucher)?.id : (voucher as CashVoucher).id);


      const document = await this.documentbService.createDocument({
              type: 'multi-cash-voucher',
              docDef: DocDefEnum.PROCUREMENT,
              totalAmt: Array.isArray(voucher) ? (voucher[0] as CashVoucher)?.totalAmt : (voucher as CashVoucher).totalAmt,
              status: DocumentStatus.HOLD,
              remarks: 'Document auto-created with GRN',
              lastActionBy: { id: voucherData.requestedBy },
              document_type_id : Array.isArray(voucher) ? (voucher[0] as CashVoucher)?.id : (voucher as CashVoucher).id
            }, );
            //console.log('Document created:', docuemnt);
            //const saved = await this.grnRepository.save(savedGrn);

            await this.documentbService.startApprovalFlow(document.id);

      // Commit transaction - all operations succeeded
      await queryRunner.commitTransaction();

      return voucher;
    } catch (error: any) {
      // Rollback transaction - undo all changes
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

public async getAllRecycleBinVouchers(
    queryOptions: PaginationOptions, userId: string
  ): Promise<{ data: any[]; meta: any }> {
    const { search } = queryOptions;
    const {data, meta} = await this.documentbService.getAllDocumentByUserId(
          userId,
          DocumentTypeEnum.MULTI_CASH_VOUCHER,
          queryOptions,
        );
      
       // console.log('data in grn service', documentData);
        
          const typedDocuments = data as DocumentWithRelatedData[];
          const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === true);
        for (const doc of activeDocuments) {
            if (!doc.document_type_id) continue;
      
            try {
                doc.relatedData = await this.cashVoucherRepository.findOne({
                  where: { id: doc.document_type_id, isDeleted: true },
                  relations: ['particulars', 'grnNo', 'challanNo', 'companyName'],
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
        grnNo: doc.relatedData.grnNo?.grnNo || null,
        challanNo: doc.relatedData.challanNo?.challanNo || null,       
        }))
// ✅ Helper to flatten objects into a searchable string
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj).map((v) => objectToString(v)).join(' ');
    }
    return String(obj);
  };

  // ✅ Apply deep search across all fields
  if (search && search.trim()) {
    const term = search.toLowerCase();
    relatedDataOnly = relatedDataOnly.filter((item) =>
      objectToString(item).toLowerCase().includes(term)
    );
  }
   // 🔄 Sorting (optional, for consistency)
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

  public async updateVoucher(
    id: string,
    updatedData: any,
    updatedBy: string,
  ): Promise<CashVoucher | null> {
    const voucher = await this.cashVoucherRepository.findOne({ where: { id } });
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
    await this.cashVoucherRepository.save(voucher);

    await this.auditLogService.logChange(
      'CashVoucher',
      voucher.id,
      originalVoucher,
      voucher,
      updatedBy,
    );
    return voucher;
  }

  async deleteVoucher(id: string): Promise<boolean> {
    const voucher = await this.cashVoucherRepository.findOne({ where: { id } });

    if (!voucher) {
      throw new AppError(404, `Voucher with ID ${id} not found`);
    }

    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6);
    sixMonthsFromNow.setHours(0, 0, 0, 0);

    console.log(
      `Voucher with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`,
    );

    voucher.deletionScheduledAt = sixMonthsFromNow;

    await this.cashVoucherRepository.save(voucher);

    console.log(`Voucher with ID ${id} marked for deletion in 6 months.`);
    return true;
  }

  public async generateVoucherNo(): Promise<string> {
    const today = new Date();
    const formattedDate = format(today, 'yyyyMMdd');

    const lastVoucher = await this.cashVoucherRepository
      .createQueryBuilder('cashVoucher')
      .where('cashVoucher.voucherNo LIKE :datePattern', {
        datePattern: `CV-${formattedDate}-%`,
      })
      .orderBy('cashVoucher.voucherNo', 'DESC')
      .getOne();

    let newSerialNumber = 1;

    if (lastVoucher) {
      const lastSerialNumber = parseInt(
        lastVoucher.voucherNo.split('-')[2],
        10,
      );
      newSerialNumber = lastSerialNumber + 1;
    }

    const voucherNo = `CV-${formattedDate}`;
    return voucherNo;
  }

  async generateMultiCashVoucherPdf(id: string): Promise<string> {
    const voucher = await this.getVoucherByIdForView(id);

    console.log('voucher is ', voucher);
    if (!voucher) throw new Error('Voucher not found');

    const s3Key = `multi-cash-vouchers/voucher-${voucher.voucherNo}.pdf`;

    console.log('Voucher data passed to EJS:', voucher.companyName);

    const pdfUrl = await this.pdfGeneratorService.generatePdfFromTemplate(
      'multiCashVoucher',
      { voucher },
      s3Key,
    );

    return pdfUrl;
  }
  public async deleteMultipleMultiCashVoucher(ids: string[]): Promise<{ success: string[]; failed: { id: string; reason: string }[]; message: string }> {
  const success: string[] = [];
  const failed: { id: string; reason: string }[] = [];  
  for (const id of ids) {
      const multiCashVoucher = await this.cashVoucherRepository.findOne({
        where: { id },
      });

      if (!multiCashVoucher) {
        failed.push({ id, reason: 'multiCashVoucher not found' });
        continue;
      }

      const relatedDocument = await this.documentbRepository.findOne({
        where: { document_type_id: multiCashVoucher.id }
      });

      if (!relatedDocument) {
        throw new Error(`Something went wrong`);
      }

      const deleteDocument = await this.documentbRepository.delete(relatedDocument.id);
      if (!deleteDocument) {
        throw new Error(`Failed to delete related document with ID ${relatedDocument.id}`);
      }


      const deleteGrn = await this.cashVoucherRepository.delete(multiCashVoucher.id);

      if (!deleteGrn) {
        throw new Error(`Failed to delete multiCashVoucher with ID ${id}`);
      }

    }
    const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
    return { success, failed, message};

  }


}
