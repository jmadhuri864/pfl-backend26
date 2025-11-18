import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { EodRepository } from '../repositories/eodstockreport.repository';
import AppError from '../utils/appError';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import { formatDateTime } from '../utils/dateUtils';
import { CompanyName } from '../utils/status.enum';
import { AuditLogService } from './auditLog.service';
import { DocumentbService, DocumentWithRelatedData } from './documentb.service';
import { DocumentStatus, DocumentTypeEnum } from '../entities/docuemnt.entity';
import { DocumentTypeEnum as DocDefEnum } from '../entities/documentdef.entity';
import { StockReportEod } from '../entities/eodReportforinvendtory.entity';
import { DocDoubleApproverService } from './docDoubleApprover.service';
import { ApprovalFlowService } from './approvalFlow.service';

@injectable() // Ensure this decorator is applied
export class EodStockService {
  constructor(
    @inject(TYPES.EodRepository) private readonly eodRepository: EodRepository,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService,
    @inject(TYPES.DocumentbService)
    private readonly documentbService: DocumentbService,
    @inject(TYPES.DocDoubleApproverService)
    private readonly docDoubleApproverService: DocDoubleApproverService,
    @inject(TYPES.ApprovalFlowService)
    private approvalFlowService: ApprovalFlowService
  ) {}

  async createEodStock(data: any): Promise<any> {

    //TODO: Check approval flow is exit or not for logged user

     const approvalFlowExit = this.approvalFlowService.findApprovalFlowForLoggedUser(data.requestedBy, 'eod-report')

    if (!approvalFlowExit) {
      throw new Error('Approval flow not found');
    }


    const stock = this.eodRepository.create(data);
    const savedStock = await this.eodRepository.save(stock);

    const document = await this.documentbService.createDocument({
            type: DocumentTypeEnum.EOD_REPORT,
            docDef: DocDefEnum.OPERATION,
            status: DocumentStatus.HOLD,
            remarks: 'Document auto-created with GRN',
            lastActionBy: { id: Array.isArray(savedStock) ? (savedStock[0] as StockReportEod)?.submittedBy : (savedStock as StockReportEod).submittedBy },
            document_type_id: Array.isArray(savedStock) ? (savedStock[0] as StockReportEod)?.id : (savedStock as StockReportEod).id
          }, );

      await this.documentbService.startApprovalFlow(document.id);

    return savedStock;
  }

//   async getAllEodStocks(queryOptions: PaginationOptions, userId: string): Promise<any> {

//    const {data, meta} = await this.docDoubleApproverService.getAllDocumentByUserIdForDoubleApprover(
//       userId,
//       DocumentTypeEnum.EOD_REPORT,
//       queryOptions
//     );

//      const { search } = queryOptions;
//     // let query = await this.eodRepository
//     //   .createQueryBuilder('eodstockreport')
//     //   .leftJoinAndSelect('eodstockreport.eodProducts', 'eodProducts')
//     //   .leftJoinAndSelect('eodProducts.sku', 'sku')
//     //   .leftJoinAndSelect('eodProducts.uom', 'uom')
//     //   .leftJoinAndSelect('eodstockreport.companyName', 'companyName')
//     //   .leftJoinAndSelect('eodstockreport.location', 'location')
//     //   .orderBy('eodstockreport.createdAt', 'DESC');
//     // const { data, meta } = await buildQuery(
//     //   query,
//     //   queryOptions,
//     //   'eodstockreport',
//     // );
// const typedDocuments = data as DocumentWithRelatedData[];
//     for (const doc of typedDocuments) {
//       if (!doc.document_type_id) continue;
//       try {
//         doc.relatedData = await this.eodRepository.findOne({
//           where: { id: doc.document_type_id },
//           relations: ['eodProducts', 'companyName', 'location', 'eodProducts.sku', 'eodProducts.uom'],
//         });

//       } catch {
//         doc.relatedData = null;
//       }
//     }

//     let relatedDataOnly = typedDocuments
//       .filter((doc) => doc.relatedData)
//       .map((doc) => ({
//         documentId: doc.id,
//         overAllStatus: doc.status, 
//         createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
//         createdDate: formatDateTime(doc.createdAt).createdDate,
//         createdTime: formatDateTime(doc.createdAt).createdTime,
//         ...doc.relatedData,
//         companyName: doc.relatedData.companyName.name || null,
//         location: doc.relatedData.location.name || null,
//       })
//       );

//        // 🔍 Deep search logic
//   const objectToString = (obj: any): string => {
//     if (obj == null) return '';
//     if (typeof obj === 'object') {
//       return Object.values(obj)
//         .map((v) => objectToString(v))
//         .join(' ');
//     }
//     return String(obj);
//   };

//   if (search && search.trim()) {
//     const term = search.toLowerCase();
//     relatedDataOnly = relatedDataOnly.filter((item) =>
//       objectToString(item).toLowerCase().includes(term)
//     );
//   }

//     // 🔄 Sorting logic
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
//        return {
//   data: relatedDataOnly,
//   meta: {
//     total: meta.total,
//     page: meta.page,
//     pages: meta.pages
//   }
// };

//     // return {
//     //   data: data.map((result) => {
//     //     const rawDate = result.createdAt;
//     //     const { createdDate, createdTime } = formatDateTime(rawDate);
//     //     return {
//     //       id: result.id,
//     //       createdDate: createdDate,
//     //       createdTime: createdTime,

//     //       stockDate: result.stockDate,
//     //       submission: result.submission,
//     //       comments: result.comments,
//     //       submittedBy: result.submittedBy,

//     //       companyName: result.companyName?.name || null,
//     //       location: result.location?.name || null,
//     //       eodProducts: result.eodProducts?.map((product) => ({
//     //         id: product.id,
//     //         qty: product.qty,
//     //         totalWeightInKg: product.totalWeightInKg,
//     //         sku: product.sku?.name || null,
//     //         uom: product.uom?.unit || null,
//     //       })),
//     //     };
//     //   }),
//     //   meta,
//     // };
//   }


//update service for get all EOD 
async getAllEodStocks(queryOptions: PaginationOptions, userId: string): Promise<any> {

   const {data, meta} = await this.docDoubleApproverService.getAllDocumentByUserIdForDoubleApprover(
      userId,
      DocumentTypeEnum.EOD_REPORT,
      queryOptions
    );

     const { search } = queryOptions;
    // let query = await this.eodRepository
    //   .createQueryBuilder('eodstockreport')
    //   .leftJoinAndSelect('eodstockreport.eodProducts', 'eodProducts')
    //   .leftJoinAndSelect('eodProducts.sku', 'sku')
    //   .leftJoinAndSelect('eodProducts.uom', 'uom')
    //   .leftJoinAndSelect('eodstockreport.companyName', 'companyName')
    //   .leftJoinAndSelect('eodstockreport.location', 'location')
    //   .orderBy('eodstockreport.createdAt', 'DESC');
    // const { data, meta } = await buildQuery(
    //   query,
    //   queryOptions,
    //   'eodstockreport',
    // );
const typedDocuments = data as DocumentWithRelatedData[];
const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === false);

    for (const doc of activeDocuments) {
      if (!doc.document_type_id) continue;
      try {
        doc.relatedData = await this.eodRepository.findOne({
          where: { id: doc.document_type_id, isDeleted: false },
          relations: ['eodProducts', 'companyName', 'location', 'eodProducts.sku', 'eodProducts.uom'],
        });

      } catch {
        doc.relatedData = null;
      }
    }

    let relatedDataOnly = activeDocuments
      .filter((doc) => doc.relatedData)
      .map((doc) => ({
        documentId: doc.id,
        overAllStatus: doc.status, 
        createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
        createdDate: formatDateTime(doc.createdAt).createdDate,
        createdTime: formatDateTime(doc.createdAt).createdTime,
        ...doc.relatedData,
        companyName: doc.relatedData.companyName.name || null,
        location: doc.relatedData.location.name || null,
      })
      );

       // 🔍 Deep search logic
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj)
        .map((v) => objectToString(v))
        .join(' ');
    }
    return String(obj);
  };

  if (search && search.trim()) {
    const term = search.toLowerCase();
    relatedDataOnly = relatedDataOnly.filter((item) =>
      objectToString(item).toLowerCase().includes(term)
    );
  }

    // 🔄 Sorting logic
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


    async getAllRecycleBinEodStocks(queryOptions: PaginationOptions, userId: string): Promise<any> {

   const {data, meta} = await this.docDoubleApproverService.getAllDocumentByUserIdForDoubleApprover(
      userId,
      DocumentTypeEnum.EOD_REPORT,
      queryOptions
    );

     const { search } = queryOptions;
    // let query = await this.eodRepository
    //   .createQueryBuilder('eodstockreport')
    //   .leftJoinAndSelect('eodstockreport.eodProducts', 'eodProducts')
    //   .leftJoinAndSelect('eodProducts.sku', 'sku')
    //   .leftJoinAndSelect('eodProducts.uom', 'uom')
    //   .leftJoinAndSelect('eodstockreport.companyName', 'companyName')
    //   .leftJoinAndSelect('eodstockreport.location', 'location')
    //   .orderBy('eodstockreport.createdAt', 'DESC');
    // const { data, meta } = await buildQuery(
    //   query,
    //   queryOptions,
    //   'eodstockreport',
    // );
const typedDocuments = data as DocumentWithRelatedData[];
const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === true);

    for (const doc of activeDocuments) {
      if (!doc.document_type_id) continue;
      try {
        doc.relatedData = await this.eodRepository.findOne({
          where: { id: doc.document_type_id, isDeleted: true },
          relations: ['eodProducts', 'companyName', 'location', 'eodProducts.sku', 'eodProducts.uom'],
        });

      } catch {
        doc.relatedData = null;
      }
    }

    let relatedDataOnly = activeDocuments
      .filter((doc) => doc.relatedData)
      .map((doc) => ({
        documentId: doc.id,
        overAllStatus: doc.status, 
        createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
        createdDate: formatDateTime(doc.createdAt).createdDate,
        createdTime: formatDateTime(doc.createdAt).createdTime,
        ...doc.relatedData,
        companyName: doc.relatedData.companyName.name || null,
        location: doc.relatedData.location.name || null,
      })
      );

       // 🔍 Deep search logic
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj)
        .map((v) => objectToString(v))
        .join(' ');
    }
    return String(obj);
  };

  if (search && search.trim()) {
    const term = search.toLowerCase();
    relatedDataOnly = relatedDataOnly.filter((item) =>
      objectToString(item).toLowerCase().includes(term)
    );
  }

    // 🔄 Sorting logic
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

  async getEodStockById(id: string): Promise<any> {
    const result = await this.eodRepository.findOne({
      where: { id },
      relations: [
        'eodProducts',
        'companyName',
        'location',
        'eodProducts.sku',
        'eodProducts.uom',
      ],
    });

    if (!result) {
      throw new Error('EOD Stock Report not found');
    }

    const rawDate = result.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);
    const formattedResponse = {
      id: result.id,
      createdDate: createdDate,
      createdTime: createdTime,

      stockDate: result.stockDate,
      submission: result.submission,
      comments: result.comments,
      submittedBy: result.submittedBy,

      companyName: result.companyName
        ? {
            id: result.companyName.id,
            companyName: result.companyName.name,
          }
        : null,
      location: result.location
        ? {
            id: result.location.id,
            name: result.location.name,
          }
        : null,
      eodProducts: result.eodProducts.map((product) => ({
        id: product.id,
        qty: product.qty,
        totalWeightInKg: product.totalWeightInKg,
        sku: product.sku
          ? {
              id: product.sku.id,
              name: product.sku.name,
            }
          : null,
        uom: product.uom
          ? {
              id: product.uom.id,
              name: product.uom.unit,
            }
          : null,
      })),
    };

    return formattedResponse;
  }

  async getEodStockByIdForView(docId: string): Promise<any> {

    const document = await this.docDoubleApproverService.getDocumentById(
      docId
    )

    const id = document.documentTypeId;

    if(id){
    const result = await this.eodRepository.findOne({
      where: { id },
      relations: [
        'eodProducts',
        'companyName',
        'location',
        'eodProducts.sku',
        'eodProducts.uom',
      ],
    });

    if (!result) {
      throw new Error('EOD Stock Report not found');
    }

    const rawDate = result.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);
    const formattedResponse = {
      id: result.id,
      createdDate: createdDate,
      createdTime: createdTime,

      stockDate: result.stockDate,
      submission: result.submission,
      comments: result.comments,
      submittedBy: result.submittedBy,

      companyName: result.companyName.name,

      location: result.location.name,

      eodProducts: result.eodProducts.map((product) => ({
        id: product.id,
        qty: product.qty,
        totalWeightInKg: product.totalWeightInKg,
        sku: product.sku?.name,

        uom: product.uom?.unit,
      })),
      overAllStatus: document.overAllStatus,
        createdBy: document.createdBy,
        approvalSummary: document.approvalSummary,
        documentId: document.id,
    };

    return formattedResponse;
    }
  }

  async getEodStockByIdForUpdate(id: string): Promise<any> {
    const result = await this.eodRepository.findOne({
      where: { id },
      relations: [
        'eodProducts',
        'companyName',
        'location',
        'eodProducts.sku',
        'eodProducts.uom',
      ],
    });

    if (!result) {
      throw new Error('EOD Stock Report not found');
    }

    const rawDate = result.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);
    const formattedResponse = {
      id: result.id,
      createdDate: createdDate,
      createdTime: createdTime,

      stockDate: result.stockDate,
      submission: result.submission,
      comments: result.comments,
      submittedBy: result.submittedBy,

      companyName: result.companyName?.id,

      location: result.location?.id,

      eodProducts: result.eodProducts.map((product) => ({
        id: product.id,
        qty: product.qty,
        totalWeightInKg: product.totalWeightInKg,
        sku: product.sku?.id,

        uom: product.uom?.id,
      })),
    };

    return formattedResponse;
  }

  async updateEodStock(id: string, data: any, updatedBy: string): Promise<any> {
    const stock = await this.eodRepository.findOne({
      where: { id },
      relations: [
        'eodProducts',
        'companyName',
        'location',
        'eodProducts.sku',
        'eodProducts.uom',
      ],
    });

    if (!stock) {
      throw new Error('Stock report not found');
    }

    const originalStock = { ...stock };

    Object.assign(stock, data);

    await this.eodRepository.save(stock);

    await this.auditLogService.logChange(
      'EOD_Stock',
      stock.id,
      originalStock,
      data,
      updatedBy,
    );

    return stock;
  }

  async deleteEodStock(id: string): Promise<boolean> {
    const stock = await this.eodRepository.findOne({
      where: { id },
    });

    if (!stock) {
      throw new AppError(404, `EOD Stock report with ID ${id} not found`);
    }

    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6);
    sixMonthsFromNow.setHours(0, 0, 0, 0);

    console.log(
      `EOD Stock report with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`,
    );

    stock.deletionScheduledAt = sixMonthsFromNow;

    await this.eodRepository.save(stock);

    console.log(
      `EOD Stock report with ID ${id} marked for deletion in 6 months.`,
    );
    return true;
  }

  
}
