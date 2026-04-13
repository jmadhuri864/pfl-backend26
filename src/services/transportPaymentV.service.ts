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
import { CacheService } from './cache.service';

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
    private readonly dataSource: DataSource,
    @inject(TYPES.CacheService)
    private readonly cacheService: CacheService,
  ) {}

  private readonly CACHE_PREFIX = 'tpVoucher';
  private readonly CACHE_TTL = 180;

  private async invalidateCache(id?: string): Promise<void> {
    const tasks: Promise<any>[] = [
      this.cacheService.invalidatePattern(`${this.CACHE_PREFIX}:list:*`),
      this.cacheService.invalidatePattern(`${this.CACHE_PREFIX}:recycle:*`),
    ];
    if (id) {
      tasks.push(
        this.cacheService.del(`${this.CACHE_PREFIX}:id:${id}`),
        this.cacheService.del(`${this.CACHE_PREFIX}:view:${id}`),
        this.cacheService.del(`${this.CACHE_PREFIX}:update:${id}`),
      );
    }
    await Promise.all(tasks);
  }

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

      await this.invalidateCache();
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
    queryOptions: PaginationOptions, userId: string,
  ): Promise<{ data: any[]; meta: any }> {
    const cacheKey = `${this.CACHE_PREFIX}:recycle:${userId}:${JSON.stringify(queryOptions)}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const { search } = queryOptions;

    const { data, meta } = await this.documentbService.getAllDocumentByUserId(
      userId,
      DocumentTypeEnum.TRANSPORT_PAYMENT_VOUCHER,
      queryOptions,
      false,
      true // includeDeleted for recycle bin
    );

    const typedDocuments = data as DocumentWithRelatedData[];
    const activeDocuments = typedDocuments;

    // ---- Batch fetch instead of N+1 ----
    const voucherIds = activeDocuments
      .map(doc => doc.document_type_id)
      .filter(Boolean) as string[];

    const vouchers = voucherIds.length
      ? await this.tpVoucherRepository
          .createQueryBuilder('tpv')
          .leftJoinAndSelect('tpv.grnNo', 'grnNo')
          .leftJoinAndSelect('tpv.companyName', 'companyName')
          .where('tpv.id IN (:...ids)', { ids: voucherIds })
          .andWhere('tpv.isDeleted = true')
          .getMany()
      : [];

    const voucherMap = new Map(vouchers.map(v => [v.id, v]));

    let relatedDataOnly = activeDocuments
      .filter(doc => doc.document_type_id && voucherMap.has(doc.document_type_id))
      .map((doc) => {
        const rd: any = voucherMap.get(doc.document_type_id!)!;
        return {
          documentId: doc.id,
          overAllStatus: doc.status,
          createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
          createdDate: formatDateTime(doc.createdAt).createdDate,
          createdTime: formatDateTime(doc.createdAt).createdTime,
          ...rd,
          id: rd.id,
          companyName: rd.companyName?.name || null,
          grnNo: rd.grnNo?.grnNo || null,
        };
      });

    const objectToString = (obj: any): string => {
      if (obj == null) return '';
      if (typeof obj === 'object') return Object.values(obj).map((v) => objectToString(v)).join(' ');
      return String(obj);
    };

    if (search && search.trim()) {
      const term = search.toLowerCase();
      relatedDataOnly = relatedDataOnly.filter((item) =>
        objectToString(item).toLowerCase().includes(term)
      );
    }

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
        if (!isNaN(valA) && !isNaN(valB)) return (Number(valA) - Number(valB)) * sortOrder;
        return String(valA).localeCompare(String(valB)) * sortOrder;
      });
    }

    const result = {
      data: relatedDataOnly,
      meta: { total: meta.total, page: meta.page, pages: meta.pages },
    };
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    return result;
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
    queryOptions: PaginationOptions, userId: string,
  ): Promise<{ data: any[]; meta: any }> {
    const cacheKey = `${this.CACHE_PREFIX}:list:${userId}:${JSON.stringify(queryOptions)}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const { search } = queryOptions;

    const { data, meta } = await this.documentbService.getAllDocumentByUserId(
      userId,
      DocumentTypeEnum.TRANSPORT_PAYMENT_VOUCHER,
      queryOptions,
    );

    const typedDocuments = data as DocumentWithRelatedData[];
    const activeDocuments = typedDocuments;

    // ---- Batch fetch: one query instead of N+1 ----
    const voucherIds = activeDocuments
      .map(doc => doc.document_type_id)
      .filter(Boolean) as string[];

    const vouchers = voucherIds.length
      ? await this.tpVoucherRepository
          .createQueryBuilder('tpv')
          .leftJoinAndSelect('tpv.grnNo', 'grnNo')
          .leftJoinAndSelect('tpv.companyName', 'companyName')
          .where('tpv.id IN (:...ids)', { ids: voucherIds })
          .andWhere('tpv.isDeleted = false')
          .andWhere('tpv.deletedAt IS NULL')
          .getMany()
      : [];

    const voucherMap = new Map(vouchers.map(v => [v.id, v]));

    let relatedDataOnly = activeDocuments.map((doc) => {
      const rd: any = doc.document_type_id ? (voucherMap.get(doc.document_type_id) || {}) : {};
      return {
        documentId: doc.id,
        overAllStatus: doc.status,
        createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
        createdDate: formatDateTime(doc.createdAt).createdDate,
        createdTime: formatDateTime(doc.createdAt).createdTime,
        id: rd.id || null,
        companyName: rd.companyName?.name || null,
        grnNo: rd.grnNo?.grnNo || null,
        altContactNo: rd.altContactNo || null,
        amtWords: rd.amtWords || null,
        contactNo: rd.contactNo || null,
        debitCreditTo: rd.debitCreditTo || null,
        destinationLocation: rd.destinationLocation || null,
        dispatchLocation: rd.dispatchLocation || null,
        driverName: rd.driverName || null,
        kyc: rd.kyc || null,
        location: rd.location || null,
        payReceivedFrom: rd.payReceivedFrom || null,
        paymentMode: rd.paymentMode || null,
        receiverName: rd.receiverName || null,
        remark: rd.remark || null,
        totalAmt: rd.totalPayableAmt || null,
        vehicleNo: rd.vehicleNo || null,
        voucherNo: rd.voucherNo || null,
        freightAmt: rd.freightAmt || null,
      };
    });

    // 🔍 Deep Search
    const objectToString = (obj: any): string => {
      if (obj == null) return '';
      if (typeof obj === 'object') return Object.values(obj).map((v) => objectToString(v)).join(' ');
      return String(obj);
    };

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
        if (!isNaN(valA) && !isNaN(valB)) return (Number(valA) - Number(valB)) * sortOrder;
        return String(valA).localeCompare(String(valB)) * sortOrder;
      });
    }

    const result = {
      data: relatedDataOnly,
      meta: {
        total: meta.total,
        page: meta.page,
        pages: meta.pages,
      },
    };

    await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }


  public async getTPVoucherById(id: string): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}:id:${id}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

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
      const result = {
        ...voucher,
        grnNo: { id: voucher.grnNo?.id, grnNo: voucher.grnNo?.grnNo },
        companyName: { id: voucher.companyName?.id || null, companyName: voucher.companyName?.name || null },
        createdTime: createdTime,
        createdDate: createdDate,
      };
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
      return result;
    }

    await this.cacheService.set(cacheKey, voucher, this.CACHE_TTL);
    return voucher;
  }

  public async getTPVoucherByIdForView(docid: string): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}:view:${docid}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const document = await this.documentbService.getDocumentById(docid);
    const id = document.documentTypeId;
    if (!id) throw new Error(`Document type ID not found for document: ${docid}`);


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
      paymentMode: voucher.paymentMode,
      freightAmt: voucher.freightAmt,
      totalPayableAmt: voucher.totalPayableAmt,
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

    await this.cacheService.set(cacheKey, formatResponse, this.CACHE_TTL);
    return formatResponse;
  }

  public async getTPVoucherByIdForUpdate(id: string): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}:update:${id}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

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

    await this.cacheService.set(cacheKey, formatResponse, this.CACHE_TTL);
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

  await this.invalidateCache(id);
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
    await this.invalidateCache(id);
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
    try {
      const tpVoucher = await this.tpVoucherRepository.findOne({ where: { id } });
      if (!tpVoucher) {
        failed.push({ id, reason: 'Transport Payment Voucher not found' });
        continue;
      }

      // Soft delete related document
      const relatedDocument = await this.documentbRepository.findOne({
        where: { document_type_id: tpVoucher.id },
      });
      if (relatedDocument) {
        await this.documentbRepository.softDelete(relatedDocument.id);
        await this.documentbRepository.update(relatedDocument.id, { isDeleted: true } as any);
      }

      // Soft delete TP Voucher
      await this.tpVoucherRepository.softDelete(tpVoucher.id);
      await this.tpVoucherRepository.update(tpVoucher.id, { isDeleted: true } as any);

      // Invalidate cache for this specific voucher
      await this.invalidateCache(id);

      success.push(id);
    } catch (error: any) {
      failed.push({ id, reason: error.message || 'Unknown error' });
    }
  }

  const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
  return { success, failed, message };
}
}
