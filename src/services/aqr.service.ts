import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { AqrRepository } from "../repositories/aqr.repository";
import { Aqr } from "../entities/aqr.entity";
import { AuditLogService } from "./auditLog.service";
import AppError from "../utils/appError";
import { format } from "date-fns";
import { buildQuery, PaginationOptions } from "../utils/pagination";
import { formatDateTime } from "../utils/dateUtils";
import { DocSingalApproverService } from "./DocSingalApproverService.service";
import { DocumentStatus, DocumentTypeEnum } from "../entities/docuemnt.entity";
import { DocumentbService, DocumentWithRelatedData } from "./documentb.service";
import { DocumentTypeEnum as DocDefEnum } from "../entities/documentdef.entity";
import { ApprovalFlowService } from "./approvalFlow.service";
import { ILike, SelectQueryBuilder } from "typeorm";
import { DocumentbRepository } from "../repositories/documentb.repository";


@injectable()
export class AqrService {
  constructor(
    @inject(TYPES.AqrRepository)
    private readonly aqrRepo: AqrRepository,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService,
    @inject(TYPES.DocSingalApproverService)
    private readonly docSingalApproverService: DocSingalApproverService,
    @inject(TYPES.DocumentbService)
    private readonly documentbService: DocumentbService,
    @inject(TYPES.DocumentbRepository)
    private readonly documentbRepository: DocumentbRepository,
    @inject(TYPES.ApprovalFlowService)
    private approvalFlowService: ApprovalFlowService
  ) { }
  private async generateSerialNo(): Promise<string> {
    const now = new Date();
    const yyyy = now.getFullYear().toString();
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const datePrefix = `AQR${yyyy}${mm}${dd}`;

    const count = await this.aqrRepo.count({
      where: { aqrNo: ILike(`${datePrefix}%`) },
    });

    return `${datePrefix}${(count + 1).toString().padStart(5, '0')}`;
  }





  public async createAqr(data: any): Promise<any> {
  
    //TODO: Check approval flow is exit or not for logged user

    //  const approvalFlowExit = this.approvalFlowService.findApprovalFlowForLoggedUser(data.requestedBy, 'aqr')

    // if (!approvalFlowExit) {
    //   throw new Error('Approval flow not found');
    // }

const serialNO = await this.generateSerialNo()
 data.aqrNo = serialNO;

    // Sanitize optional date fields — empty string from frontend causes type errors
    if (!data.dcDate || data.dcDate === '') data.dcDate = null;
    if (!data.arrivalDate || data.arrivalDate === '') data.arrivalDate = null;

    console.log("in create aqr service ",data)
    const aqr = this.aqrRepo.create(data);
    console.log("it will create aqr");
    const savedAqr=await this.aqrRepo.save(aqr);

    //Todo:By Vaishali
      const document = await this.documentbService.createDocument({
       type: DocumentTypeEnum.AQR,
       docDef: DocDefEnum.OPERATION,
       // totalAmt: rfpaData.totalAmt,
         status: DocumentStatus.HOLD,
          remarks: 'Document auto-created with AQR',
          lastActionBy: { id: data.requestedBy },
         document_type_id: Array.isArray(savedAqr) ? (savedAqr[0] as Aqr)?.id : (savedAqr as Aqr).id
        }, /*approvalFlowExit*/);
       await this.documentbService.startApprovalFlow(document.id);
       return savedAqr;
  }


  public async getAqrById(id: string): Promise<any> {
    const result = await this.aqrRepo
      .createQueryBuilder("aqr")
      .leftJoinAndSelect("aqr.dcNo", " dcNo")
      .leftJoinAndSelect("aqr.product", "product")
      .leftJoinAndSelect("aqr.parameters", "parameters")
      .where("aqr.id = :id", { id })
      .getOne();

    if (!result) {
      return null;
    }

    // Extract and format createdAt
    const { createdDate, createdTime } = formatDateTime(result.createdAt);

    // Format arrivalDate to remove time
    //const arrivalDate = result.arrivalDate ? formatDateTime(result.arrivalDate).createdDate : null;

    return {
      id: result.id,
      dcNo: result.dcNo.id,
      dcDate: result.dcDate,
      arrivedQty: result.arrivedQty,
      samplingQty: result.samplingQty,
      purchaseBy: result.purchaseBy,

      receivedBy: result.receivedBy,
      qcCheckBy: result.qcCheckBy,
      verifiedBy: result.verifiedBy,
      totalQty: result.totalQty,
      totalpercent: result.totalpercent,
      supplierName: result.supplierName,
      supplierLocation: result.supplierLocation,
      remark: result.remark,
      arrivalDate: result.arrivalDate, // Only date part
      createdDate: createdDate,
      createdTime: createdTime,
      product: result.product ? result.product.id : null, // Only send product ID
      parameters: result.parameters.map(param => ({
        id: param.id,
        qualityParameterId: param.qualityParameterId,
        qualityParameterName: param.qualityParameterName,
        qualityParameterType: param.qualityParameterType,
        quantity: param.quantity,
        percentage: param.percentage
      }))
    };
  }

  public async getAqrByIdForUpdate(id: string): Promise<any> {
    const result = await this.aqrRepo
      .createQueryBuilder("aqr")
      .leftJoinAndSelect("aqr.dcNo", " dcNo")
      .leftJoinAndSelect("aqr.product", "product")
      .leftJoinAndSelect("aqr.verifiedBy", "verifiedBy")
      .leftJoinAndSelect("aqr.qcCheckBy", "qcCheckBy")
      .leftJoinAndSelect("aqr.receivedBy", "receivedBy")
      .leftJoinAndSelect("aqr.purchaseBy", "purchaseBy")
      //.leftJoinAndSelect("aqr.sendBy", "sendBy")
      .leftJoinAndSelect("aqr.parameters", "parameters")
      .where("aqr.id = :id", { id })
      .getOne();

    if (!result) {
      return null;
    }

   ;

   const { createdDate, createdTime } = formatDateTime(result.createdAt);

    // Entity transformer returns "DD-MM-YYYY", convert to "YYYY-MM-DD" for the update form
    const toIsoDate = (val: string | null) => {
      if (!val) return null;
      const parts = val.split('-');
      if (parts.length !== 3) return null;
      return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY → YYYY-MM-DD
    };
    const dcDate = toIsoDate(result.dcDate as any);
    const arrivalDate = toIsoDate(result.arrivalDate as any);

    return {
      id: result.id,
      dcNo: result.dcNo?.id || null,
      //dcDate: result.dcDate,
      arrivedQty: result.arrivedQty,
      samplingQty: result.samplingQty,
      purchaseBy: result.purchaseBy?.id,
      receivedBy: result.receivedBy?.id,
      qcCheckBy: result.qcCheckBy?.id,
      verifiedBy: result.verifiedBy?.id,
      //sentBy: result.sendBy?.id,
      totalQty: result.totalQty,
      totalpercent: result.totalpercent,
      supplierName: result.supplierName,
      supplierLocation: result.supplierLocation,
      remark: result.remark,
      //arrivalDate: result.arrivalDate,
      //arrivalDate: formatDateTime(result.arrivalDate || '').createdDate,
      // dcDate: formatDateTime(result.dcDate ).createdDate,
      // arrivalDate: formatDateTime(result.arrivalDate ).createdDate,
      dcDate,
      arrivalDate,
      createdDate: createdDate,
      createdTime: createdTime,
      product: result.product?.id || null,
      parameters: result.parameters.map(param => ({
        id: param.id,
        qualityParameterId: param.qualityParameterId,
        qualityParameterName: param.qualityParameterName,
        qualityParameterType: param.qualityParameterType,
        quantity: param.quantity !== null && param.quantity !== undefined ? Number(param.quantity) : null,
        percentage: param.percentage !== null && param.percentage !== undefined ? Number(param.percentage) : null,
      }))
    };
  }

  public async getAqrByIdForView(id: string): Promise<any> {
    console.log("in service layer: ", id);

    const result = await this.aqrRepo
      .createQueryBuilder("aqr")
      .leftJoinAndSelect("aqr.dcNo", "dcNo")
      .leftJoinAndSelect("aqr.product", "product")
      .leftJoinAndSelect("aqr.verifiedBy", "verifiedBy")
      .leftJoinAndSelect("aqr.qcCheckBy", "qcCheckBy")
      .leftJoinAndSelect("aqr.receivedBy", "receivedBy")
      .leftJoinAndSelect("aqr.purchaseBy", "purchaseBy")
      //.leftJoinAndSelect("aqr.sendBy", "sendBy")
      .leftJoinAndSelect("aqr.parameters", "parameters")
      .where("aqr.id = :id", { id })
      .getOne();

    console.log("Data", result);


    if (!result) {
      return null;
    }
    const aqrViewData = {
      ...result,
      dcNo: result.dcNo?.challanNo || "",
      product: result.product.name,
      verifiedBy: `${result.verifiedBy.firstName} ${result.verifiedBy.lastName}`,
      qcCheckBy: `${result.qcCheckBy.firstName} ${result.qcCheckBy.lastName}`,
      receivedBy: `${result.receivedBy.firstName} ${result.receivedBy.lastName}`,
      purchaseBy: `${result.purchaseBy.firstName} ${result.purchaseBy.lastName}`,
    }
    // Extract and format createdAt
    const { createdDate, createdTime } = formatDateTime(result.createdAt);

    // Format arrivalDate to remove time
    //const arrivalDate = result.arrivalDate ? formatDateTime(result.arrivalDate).createdDate : null;

    // return {
    //     id: result.id,
    //     dcNo:result.dcNo.id,
    //     dcDate: result.dcDate,
    //     arrivedQty: result.arrivedQty,
    //     samplingQty: result.samplingQty,
    //     purchaseBy: result.purchaseBy?.firstName+' '+result.purchaseBy?.middleName+' '+result.purchaseBy?.lastName||null,
    //    receivedBy: result.receivedBy?.firstName+' '+result.receivedBy?.middleName+' '+result.receivedBy?.lastName || null,
    //     qcCheckBy: result.qcCheckBy?.firstName+' '+result.qcCheckBy?.middleName+' '+result.qcCheckBy?.lastName || null,
    //     verifiedBy: result.verifiedBy?.firstName+' '+result.verifiedBy?.middleName+' '+result.verifiedBy?.lastName || null ,
    //     sentBy:result.sendBy?.firstName+' '+result.sendBy?.middleName+' '+result.sendBy?.lastName || null,
    //     totalQty: result.totalQty,
    //     totalpercent: result.totalpercent,
    //     supplierName: result.supplierName,
    //     supplierLocation: result.supplierLocation,
    //     remark: result.remark,
    //     arrivalDate: result.arrivalDate, 
    //     createdDate: createdDate,
    //     createdTime: createdTime,
    //     product: result.product ? result.product.name : null,
    //     parameters: result.parameters.map(param => ({
    //         id: param.id,
    //         qualityParameterId: param.qualityParameterId,
    //         qualityParameterName: param.qualityParameterName,
    //         qualityParameterType: param.qualityParameterType,
    //         quantity: param.quantity,
    //         percentage: param.percentage
    //     }))
    // };

    return { data: aqrViewData }
  }
  public async getAllAqr(queryOptions: PaginationOptions): Promise<any> {
    const queryBuilder = this.aqrRepo
      .createQueryBuilder("aqr")
      .leftJoinAndSelect("aqr.product", "product")
      .leftJoinAndSelect("aqr.parameters", "parameters")
      .orderBy("aqr.createdAt", "DESC");

    const result = await buildQuery(queryBuilder, queryOptions, "aqr");

    return {
      data: result.data.map(aqr => {
        const rawDate = aqr.createdAt;
        const { createdDate, createdTime } = formatDateTime(rawDate);

        return {
          ...aqr,
          createdDate: createdDate,
          createdTime: createdTime,
          arrivalDate: formatDateTime(aqr.arrivalDate || ''),
          dcDate: formatDateTime(aqr.dcDate || ''),
        };
      }),
      meta: result.meta,
    };
  }



  public async updateAqr(id: string, data:any , updatedBy: string): Promise<any> {
    console.log(updatedBy)
    const existingAqr = await this.aqrRepo.findOne({ where: { id } });

    if (!existingAqr) {
      return null;
    }

    // Sanitize optional date fields — empty string from frontend causes type errors
    if (!data.dcDate || data.dcDate === '') data.dcDate = null;
    if (!data.arrivalDate || data.arrivalDate === '') data.arrivalDate = null;

    const oldData = { ...existingAqr };


    Object.assign(existingAqr, data);


    const updatedAqr = await this.aqrRepo.save(existingAqr);


    await this.auditLogService.logChange(
      'AQR',
      id,
      oldData,
      updatedAqr,
      updatedBy
    );

    return updatedAqr;
  }


  public async deleteAqr(id: string): Promise<boolean> {
    const aqr = await this.aqrRepo.findOne({
      where: { id },
    });

    if (!aqr) {
      throw new AppError(404, `AQR with ID ${id} not found`);
    }

    const now = new Date();


    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6);
    sixMonthsFromNow.setHours(0, 0, 0, 0);

    console.log(sixMonthsFromNow);


    aqr.deletionScheduledAt = sixMonthsFromNow;

    console.log("In delete service for AQR", aqr.deletionScheduledAt);


    await this.aqrRepo.save(aqr);

    console.log(`AQR with ID ${id} marked for deletion in 6 months.`);
    return true
  }

  public async searchAqr(search: string): Promise<Aqr[]> {
    const aqrs = this.aqrRepo.find({
      where: [
        { id: search },
        // { status: search },
        // { type: search },
      ],
    });
    return aqrs;

  }


  //Todo:Get All AQR..By Vaishali
  //  public async getAllAqrs(queryOptions: PaginationOptions, userId: string): Promise<{
  //   data: any[];
  //   meta: { total: number; page: number; pages: number };
  // }> {
  //   const data = await this.docSingalApproverService.getAllSingleApprovalDocumentsByUserId(
  //     userId,
  //     DocumentTypeEnum.AQR,
  //   );
  //  const { search } = queryOptions;
  //   console.log('Fetched documents:', data);
  
  //   const typedDocuments = data as DocumentWithRelatedData[];
  
  //   if (typedDocuments.length > 0) {
  //     console.log("doc.relatedData", typedDocuments[0].relatedData);
  //   } else {
  //     console.log("No documents found for user.");
  //   }
  
  //   for (const doc of typedDocuments) {
  //     if (!doc.document_type_id) {
  //       console.log('Missing document_type_id for doc', doc.id);
  //       continue;
  //     }
  
  //     try {
  //       doc.relatedData = await this.aqrRepo.findOne({
  //         where: { id: doc.document_type_id },
  //         relations: ['dcNo',
  //         'product',
  //         'parameters',
  //         'sendBy',
  //         'purchaseBy',
  //         'receivedBy',
  //         'qcCheckBy',
  //         'verifiedBy',
  //       ]
  //       });
  //     } catch (e) {
  //       console.log("in catch block", e);
  //       doc.relatedData = null;
  //     }
  //   }
  
  //   let relatedDataOnly = typedDocuments.map((doc) => {
  //     const rd = doc.relatedData || {};
  //     return {
  //       documentId: doc.id,
  //       overAllStatus: doc.status,
  //       createdBy:`${doc.lastActionBy.firstName || null}  ${doc.lastActionBy.lastName || null}`,
  //       createdDate: formatDateTime(doc.createdAt).createdDate,
  //       createdTime: formatDateTime(doc.createdAt).createdTime,

  //       // From AQR entity
  //     id: rd.id || null,
  //     dcNo: rd.dcNo?.challanNo || null,
  //     dcDate: rd.dcDate || null,
  //     arrivedQty: rd.arrivedQty || null,
  //     samplingQty: rd.samplingQty || null,
  //     totalQty: rd.totalQty || null,
  //     totalpercent: rd.totalpercent || null,
  //     supplierName: rd.supplierName || null,
  //     arrivalDate: rd.arrivalDate || null,
  //     supplierLocation: rd.supplierLocation || null,
  //     remark: rd.remark || null,

  //     // product info
  //     productName: rd.product?.name || null,
  //     productCode: rd.product?.productCode || null,
  //     brand: rd.product?.brand || null,
  //     packingType: rd.product?.packingType || null,

  //     // users
  //     sendBy: rd.sendBy?.firstName || null,
  //     purchaseBy: rd.purchaseBy?.firstName || null,
  //     receivedBy: rd.receivedBy?.firstName || null,
  //     qcCheckBy: rd.qcCheckBy?.firstName || null,
  //     verifiedBy: rd.verifiedBy?.firstName || null,

  //     // parameters
  //     parameters: rd.parameters
  //       ? rd.parameters.map((param: any) => ({
  //           id: param.id || null,
  //           qualityParameterId: param.qualityParameterId || null,
  //           qualityParameterName: param.qualityParameterName || null,
  //           qualityParameterType: param.qualityParameterType || null,
  //           quantity: param.quantity || null,
  //           percentage: param.percentage || null,
  //         }))
  //       : [],
  //     };
  //   });
 
  // const objectToString = (obj: any): string => {
  //   if (obj == null) return '';
  //   if (typeof obj === 'object') {
  //     return Object.values(obj)
  //       .map((v) => objectToString(v))
  //       .join(' ');
  //   }
  //   return String(obj);
  // };

  
  // if (search && search.trim()) {
  //   const term = search.toLowerCase();
  //   relatedDataOnly = relatedDataOnly.filter((item) =>
  //     objectToString(item).toLowerCase().includes(term)
  //   );
  // }

  // // 🔄 Sorting
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

  //   return {
  //     data: relatedDataOnly,
  //     meta: {
  //       total: relatedDataOnly.length,
  //       page: queryOptions.page || 1,
  //       pages: Math.ceil(relatedDataOnly.length / (queryOptions.limit || 10)),
  //     }
  //   };
  // }
  public async getAllAqrs(queryOptions: PaginationOptions, userId: string): Promise<{
    data: any[];
    meta: { total: number; page: number; pages: number };
  }> {
    const data = await this.docSingalApproverService.getAllSingleApprovalDocumentsByUserId(
      userId,
      DocumentTypeEnum.AQR,
    );
   const { search } = queryOptions;
    console.log('Fetched documents:', data);
  
    const typedDocuments = data as DocumentWithRelatedData[];
    // Exclude soft-deleted documents
const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === false);
console.log('Active documents:', activeDocuments);
  
    if (activeDocuments.length > 0) {
      console.log("doc.relatedData", typedDocuments[0].relatedData);
    } else {
      console.log("No documents found for user.");
    }
  
    for (const doc of activeDocuments) {
      if (!doc.document_type_id) {
        console.log('Missing document_type_id for doc', doc.id);
        continue;
      }
  
      try {
        doc.relatedData = await this.aqrRepo.findOne({
          where: { id: doc.document_type_id , isDeleted: false },
          relations: ['dcNo',
          'product',
          'parameters',
         // 'sendBy',
          'purchaseBy',
          'receivedBy',
          'qcCheckBy',
          'verifiedBy',
        ]
        });
      } catch (e) {
        console.log("in catch block", e);
        doc.relatedData = null;
      }
    }
  
    let relatedDataOnly = activeDocuments.map((doc) => {
      const rd = doc.relatedData || {};
      return {
        documentId: doc.id,
        overAllStatus: doc.status,
        createdBy:`${doc.lastActionBy.firstName || null}  ${doc.lastActionBy.lastName || null}`,
        createdDate: formatDateTime(doc.createdAt).createdDate,
        createdTime: formatDateTime(doc.createdAt).createdTime,

        // From AQR entity
      id: rd.id || null,
      dcNo: rd.dcNo?.challanNo || null,
      dcDate: rd.dcDate || null,
      arrivedQty: rd.arrivedQty || null,
      samplingQty: rd.samplingQty || null,
      totalQty: rd.totalQty || null,
      totalpercent: rd.totalpercent || null,
      supplierName: rd.supplierName || null,
      arrivalDate: rd.arrivalDate || null,
      supplierLocation: rd.supplierLocation || null,
      remark: rd.remark || null,

      // product info
      productName: rd.product?.name || null,
      productCode: rd.product?.productCode || null,
      brand: rd.product?.brand || null,
      packingType: rd.product?.packingType || null,

      // users
      //sendBy: rd.sendBy?.firstName || null,
      purchaseBy: rd.purchaseBy?.firstName || null,
      receivedBy: rd.receivedBy?.firstName || null,
      qcCheckBy: rd.qcCheckBy?.firstName || null,
      verifiedBy: rd.verifiedBy?.firstName || null,

      // parameters
      parameters: rd.parameters
        ? rd.parameters.map((param: any) => ({
            id: param.id || null,
            qualityParameterId: param.qualityParameterId || null,
            qualityParameterName: param.qualityParameterName || null,
            qualityParameterType: param.qualityParameterType || null,
            quantity: param.quantity || null,
            percentage: param.percentage || null,
          }))
        : [],
      };
    });
 
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
        total: relatedDataOnly.length,
        page: queryOptions.page || 1,
        pages: Math.ceil(relatedDataOnly.length / (queryOptions.limit || 10)),
      }
    };
  } 

  public async getAllRecycleBinAqrs(queryOptions: PaginationOptions, userId: string): Promise<{
    data: any[];
    meta: { total: number; page: number; pages: number };
  }> {
    const data = await this.docSingalApproverService.getAllSingleApprovalDocumentsByUserId(
      userId,
      DocumentTypeEnum.AQR,
    );
   const { search } = queryOptions;
    console.log('Fetched documents:', data);
  
    const typedDocuments = data as DocumentWithRelatedData[];
    // only  soft-deleted documents
const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === true);
console.log('Active documents:', activeDocuments);
  
    if (activeDocuments.length > 0) {
      console.log("doc.relatedData", typedDocuments[0].relatedData);
    } else {
      console.log("No documents found for user.");
    }
  
    for (const doc of activeDocuments) {
      if (!doc.document_type_id) {
        console.log('Missing document_type_id for doc', doc.id);
        continue;
      }
  
      try {
        doc.relatedData = await this.aqrRepo.findOne({
          where: { id: doc.document_type_id , isDeleted: true },
          relations: ['dcNo',
          'product',
          'parameters',
          //'sendBy',
          'purchaseBy',
          'receivedBy',
          'qcCheckBy',
          'verifiedBy',
        ]
        });
      } catch (e) {
        console.log("in catch block", e);
        doc.relatedData = null;
      }
    }
  
    let relatedDataOnly = activeDocuments.map((doc) => {
      const rd = doc.relatedData || {};
      return {
        documentId: doc.id,
        overAllStatus: doc.status,
        createdBy:`${doc.lastActionBy.firstName || null}  ${doc.lastActionBy.lastName || null}`,
        createdDate: formatDateTime(doc.createdAt).createdDate,
        createdTime: formatDateTime(doc.createdAt).createdTime,

        // From AQR entity
      id: rd.id || null,
      dcNo: rd.dcNo?.challanNo || null,
      dcDate: rd.dcDate || null,
      arrivedQty: rd.arrivedQty || null,
      samplingQty: rd.samplingQty || null,
      totalQty: rd.totalQty || null,
      totalpercent: rd.totalpercent || null,
      supplierName: rd.supplierName || null,
      arrivalDate: rd.arrivalDate || null,
      supplierLocation: rd.supplierLocation || null,
      remark: rd.remark || null,

      // product info
      productName: rd.product?.name || null,
      productCode: rd.product?.productCode || null,
      brand: rd.product?.brand || null,
      packingType: rd.product?.packingType || null,

      // users
     // sendBy: rd.sendBy?.firstName || null,
      purchaseBy: rd.purchaseBy?.firstName || null,
      receivedBy: rd.receivedBy?.firstName || null,
      qcCheckBy: rd.qcCheckBy?.firstName || null,
      verifiedBy: rd.verifiedBy?.firstName || null,

      // parameters
      parameters: rd.parameters
        ? rd.parameters.map((param: any) => ({
            id: param.id || null,
            qualityParameterId: param.qualityParameterId || null,
            qualityParameterName: param.qualityParameterName || null,
            qualityParameterType: param.qualityParameterType || null,
            quantity: param.quantity || null,
            percentage: param.percentage || null,
          }))
        : [],
      };
    });
 
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
        total: relatedDataOnly.length,
        page: queryOptions.page || 1,
        pages: Math.ceil(relatedDataOnly.length / (queryOptions.limit || 10)),
      }
    };
  }
  //TODO:Get AQR By Id For View..By Vaishali
public async getAQRByIdForView(docid: string, userId:string): Promise<any> {
    const document = await this.docSingalApproverService.getSingleApprovalDocumentById(docid,userId)
    if(!document)
    {
      return null;
    }
    const id = document.documentTypeId;
    console.log('id in getAQRByIdForView', id);
    
    if (id) {
      //console.log("Hiiiiiiiiiiiiiiiiiiiiiii");
      //console.log('Document type ID not found for document:', id);
      
      const aqr = await this.aqrRepo.findOne({
        where: { id },
        relations: [
          'dcNo',
      'product',
      'parameters',
      //'sendBy',
      'purchaseBy',
      'receivedBy',
      'qcCheckBy',
      'verifiedBy',
        ],
      });

      console.log('AQR in getAQRByIdForView', aqr);
      

      if (!aqr) { 
        throw new Error('AQR not found');
      }

      // let selectedPartyId: string | null = null;
      // if (grn.source === 'vendor' && grn.selectedVendor) {
      //   selectedPartyId = grn.selectedVendor.companyName;
      // } else if (grn.source === 'farmer' && grn.selectedFarmer) {
      //   selectedPartyId =
      //     grn.selectedFarmer.farmerfName +
      //     ' ' +
      //     grn.selectedFarmer.farmermName +
      //     ' ' +
      //     grn.selectedFarmer.farmerlName;
      // }
      const rawDate = aqr.createdAt;
      const { createdDate, createdTime } = formatDateTime(rawDate);
      return {
    documentId: document.documentId,
    overAllStatus: document.status,
    createdBy: document.createdBy ,
    createdDate,
    createdTime,
    approvalSummary: document.approvalSummary,

    
      // From AQR
    id: aqr.id,
    dcNo: aqr.dcNo?.challanNo || null,
    dcDate: aqr.dcDate || null,
    arrivedQty: aqr.arrivedQty || null,
    samplingQty: aqr.samplingQty || null,
    totalQty: aqr.totalQty || null,
    totalpercent: aqr.totalpercent || null,
    supplierName: aqr.supplierName || null,
    arrivalDate: aqr.arrivalDate || null,
    supplierLocation: aqr.supplierLocation || null,
    remark: aqr.remark || null,

    // product info
    product: aqr.product?.name || null,
    productCode: aqr.product?.productCode || null,
    //brand: aqr.product?.brand || null,
    packingType: aqr.product?.packingType || null,

    
//sendBy: aqr.sendBy ? `${aqr.sendBy.firstName || ''} ${aqr.sendBy.lastName || ''}`.trim() : null,
    purchaseBy: aqr.purchaseBy ? `${aqr.purchaseBy.firstName || ''} ${aqr.purchaseBy.lastName || ''}`.trim() : null,
    receivedBy: aqr.receivedBy ? `${aqr.receivedBy.firstName || ''} ${aqr.receivedBy.lastName || ''}`.trim() : null,
    qcCheckBy: aqr.qcCheckBy ? `${aqr.qcCheckBy.firstName || ''} ${aqr.qcCheckBy.lastName || ''}`.trim() : null,
    verifiedBy: aqr.verifiedBy ? `${aqr.verifiedBy.firstName || ''} ${aqr.verifiedBy.lastName || ''}`.trim() : null,


    // parameters
    parameters: aqr.parameters?.map(param => ({
      id: param.id || null,
      qualityParameterId: param.qualityParameterId || null,
      qualityParameterName: param.qualityParameterName || null,
      qualityParameterType: param.qualityParameterType || null,
      quantity: param.quantity || null,
      percentage: param.percentage || null,
    })) || [],
  };
  }
}



//TODO:Filterd AQR By Vaishali...20/08/2025
 async filterAqrs(
  page: number,
  limit: number,
  filters: Record<string, any>
) {
  const queryBuilder: SelectQueryBuilder<Aqr> =
    this.aqrRepo.createQueryBuilder("aqr");

  // ✅ Select all fields from Aqr
  queryBuilder.select("aqr");

  // ✅ Join relations but select only specific fields
  queryBuilder
    //.leftJoin("aqr.sendBy", "sendedBy")
    .addSelect(["sendedBy.id", "sendedBy.firstName", "sendedBy.lastName"])
    .leftJoin("aqr.purchaseBy", "purchasedBy")
    .addSelect(["purchasedBy.id", "purchasedBy.firstName", "purchasedBy.lastName"])
    .leftJoin("aqr.receivedBy", "receivedBy")
    .addSelect(["receivedBy.id", "receivedBy.firstName", "receivedBy.lastName"])
    .leftJoin("aqr.qcCheckBy", "qcCheckedBy")
    .addSelect(["qcCheckedBy.id", "qcCheckedBy.firstName", "qcCheckedBy.lastName"])
    .leftJoin("aqr.verifiedBy", "verifiedBy")
    .addSelect(["verifiedBy.id", "verifiedBy.firstName", "verifiedBy.lastName"])
    .leftJoin("aqr.product", "product")
    .addSelect(["product.id", "product.name"]);

  // ✅ Apply dynamic filters (including related fields)
  Object.entries(filters).forEach(([key, value]) => {
    if (key.includes(".")) {
      // Example: filters = { "sendedBy.firstName": "John" }
      const [alias, field] = key.split(".");
      queryBuilder.andWhere(`${alias}.${field} ILIKE :${field}`, {
        [field]: `%${value}%`,
      });
    } else {
      // Normal Aqr field filter
      if (typeof value === "string" && isNaN(Number(value))) {
        queryBuilder.andWhere(`aqr.${key} ILIKE :${key}`, {
          [key]: `%${value}%`,
        });
      } else {
        queryBuilder.andWhere(`aqr.${key} = :${key}`, { [key]: value });
      }
    }
  });

  // ✅ Pagination
  queryBuilder.skip((page - 1) * limit).take(limit);

  const [data, total] = await queryBuilder.getManyAndCount();

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}


public async deleteMultipleAqrs(ids: string[]): Promise<{ success: string[]; failed: { id: string; reason: string }[]; message: string }> {
  const success: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      const aqr = await this.aqrRepo.findOne({
        where: { id },
      });
      if (!aqr) {
        failed.push({ id, reason: 'AQR not found' });
        continue;
      }
      const relatedDocument = await this.documentbRepository.findOne({
        where: { document_type_id: aqr.id }
      });

      if (!relatedDocument) {
        throw new Error(`Something went wrong`);
      }

      const deleteDocument = await this.documentbRepository.delete(relatedDocument.id);
      if (!deleteDocument) {
        throw new Error(`Failed to delete related document with ID ${relatedDocument.id}`);
      }

      const deleteAqr = await this.aqrRepo.delete(aqr.id);
      if (!deleteAqr) {
        throw new Error(`Failed to delete AQR with ID ${id}`);
      }
      success.push(id);
    } catch (error: any) {
      failed.push({ id, reason: error.message || 'Unknown error' });
    }
  }
  const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
  return { success, failed, message };
}


}
