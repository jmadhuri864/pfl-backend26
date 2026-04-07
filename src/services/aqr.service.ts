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
import { SelectQueryBuilder, DataSource } from "typeorm";
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
    private approvalFlowService: ApprovalFlowService,
    @inject(TYPES.DataSource)
    private readonly dataSource: DataSource,
  ) { }
  private async generateSerialNo(): Promise<string> {
    const now = new Date();
    const yyyy = now.getFullYear().toString();
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const datePrefix = `AQR${yyyy}${mm}${dd}`;

    const result = await this.aqrRepo
      .createQueryBuilder("aqr")
      .select("MAX(aqr.aqrNo)", "maxNo")
      .where("aqr.aqrNo LIKE :prefix", { prefix: `${datePrefix}%` })
      .getRawOne();

    let nextSeq = 1;
    if (result?.maxNo) {
      const lastSeq = parseInt(result.maxNo.replace(datePrefix, ''), 10);
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }

    return `${datePrefix}${nextSeq.toString().padStart(5, '0')}`;
  }





  public async createAqr(data: any): Promise<any> {
    const requestedBy = data.requestedBy;

    // 1. Validate approval flow before starting transaction
    const approvalFlow = await this.approvalFlowService.findApprovalFlowForLoggedUser(requestedBy, DocDefEnum.OPERATION);
    if (!approvalFlow) {
      throw new AppError(400, 'No approval flow configured for this user. Please contact the admin to create an approval flow before creating a AQR.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. Generate serial number
      const serialNO = await this.generateSerialNo();
      data.aqrNo = serialNO;

      // 3. Sanitize optional date fields
      if (!data.dcDate || data.dcDate === '') data.dcDate = null;
      if (!data.arrivalDate || data.arrivalDate === '') data.arrivalDate = null;

      if(data.source === 'vendor' && data.selectedParty){
        data.selectedVendor = data.selectedParty;
        data.selectedFarmer = null;
      }else if(data.source === 'farmer' && data.selectedParty){
        data.selectedFarmer = data.selectedParty;
        data.selectedVendor = null;
      }

      console.log("Select  party "+ data.selectedFarmer);
      console.log("Select  party "+ data.selectedVendor);

      // 4. Create and save AQR
      const aqr = queryRunner.manager.create(this.aqrRepo.target, data);
      const savedAqr = await queryRunner.manager.save(aqr);

      // 5. Create document
      const actualAqr = Array.isArray(savedAqr) ? (savedAqr[0] as Aqr) : (savedAqr as Aqr);
      const document = await this.documentbService.createDocument({
        type: DocumentTypeEnum.AQR,
        docDef: DocDefEnum.OPERATION,
        status: DocumentStatus.HOLD,
        remarks: 'Document auto-created with AQR',
        lastActionBy: { id: requestedBy },
        document_type_id: actualAqr.id,
      });

      await queryRunner.commitTransaction();

      // 6. Start approval flow after commit
      await this.documentbService.startApprovalFlow(document.id);

      return savedAqr;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof AppError) throw error;
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

    public async getAqrById(id: string): Promise<any> {
    const result = await this.aqrRepo
      .createQueryBuilder("aqr")
      .leftJoinAndSelect("aqr.deliveryChallanNo", "deliveryChallanNo")
      .leftJoinAndSelect("aqr.companyName", "companyName")
      .leftJoinAndSelect("aqr.location", "location")
      .leftJoinAndSelect("aqr.selectedVendor", "selectedVendor")
      .leftJoinAndSelect("aqr.selectedFarmer", "selectedFarmer")
      .leftJoinAndSelect("aqr.fromLocation", "fromLocation")
      .leftJoinAndSelect("aqr.product", "product")
      .leftJoinAndSelect("aqr.variant", "variant")
      .leftJoinAndSelect("aqr.parameters", "parameters")
      .where("aqr.id = :id", { id })
      .getOne();

    if (!result) {
      return null;
    }

    const { createdDate, createdTime } = formatDateTime(result.createdAt);

    return {
      id: result.id,
      aqrFor: result.aqrFor,
      companyName: result.companyName?.id || null,
      location: result.location?.id || null,
      source: result.source,
      selectedParty: result.source === 'vendor'
        ? result.selectedVendor?.id || null
        : result.selectedFarmer?.id || null,
      deliveryChallanNo: result.deliveryChallanNo?.id || null,
      fromLocation: result.fromLocation?.id || null,
      product: result.product?.id || null,
      variant: result.variant?.id || null,
      arrivalDate: result.arrivalDate,
      arrivedQty: result.arrivedQty,
      samplingQty: result.samplingQty,
      purchaseBy: result.purchaseBy,
      receivedBy: result.receivedBy,
      qcCheckBy: result.qcCheckBy,
      verifiedBy: result.verifiedBy,
      totalQty: result.totalQty,
      totalpercent: result.totalpercent,
      remark: result.remark,
      createdDate,
      createdTime,
      parameters: result.parameters.map(param => ({
        id: param.id,
        qualityParameterId: param.qualityParameterId,
        qualityParameterName: param.qualityParameterName,
        qualityParameterType: param.qualityParameterType,
        quantity: param.quantity,
        percentage: param.percentage,
      })),
    };
  }

  public async getAqrByIdForUpdate(id: string): Promise<any> {
    const result = await this.aqrRepo
      .createQueryBuilder("aqr")
      .leftJoinAndSelect("aqr.deliveryChallanNo", "deliveryChallanNo")
      .leftJoinAndSelect("aqr.companyName", "companyName")
      .leftJoinAndSelect("aqr.location", "location")
      .leftJoinAndSelect("aqr.selectedVendor", "selectedVendor")
      .leftJoinAndSelect("aqr.selectedFarmer", "selectedFarmer")
      .leftJoinAndSelect("aqr.fromLocation", "fromLocation")
      .leftJoinAndSelect("aqr.product", "product")
      .leftJoinAndSelect("aqr.variant", "variant")
      .leftJoinAndSelect("aqr.verifiedBy", "verifiedBy")
      .leftJoinAndSelect("aqr.qcCheckBy", "qcCheckBy")
      .leftJoinAndSelect("aqr.receivedBy", "receivedBy")
      .leftJoinAndSelect("aqr.purchaseBy", "purchaseBy")
      .leftJoinAndSelect("aqr.parameters", "parameters")
      .where("aqr.id = :id", { id })
      .getOne();

    if (!result) {
      return null;
    }

    const { createdDate, createdTime } = formatDateTime(result.createdAt);

    const toIsoDate = (val: string | null) => {
      if (!val) return null;
      const parts = val.split('-');
      if (parts.length !== 3) return null;
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    };

    return {
      id: result.id,
      aqrFor: result.aqrFor,
      companyName: result.companyName?.id || null,
      location: result.location?.id || null,
      source: result.source,
      selectedParty: result.source === 'vendor'
        ? result.selectedVendor?.id || null
        : result.selectedFarmer?.id || null,
      deliveryChallanNo: result.deliveryChallanNo?.id || null,
      fromLocation: result.fromLocation?.id || null,
      product: result.product?.id || null,
      variant: result.variant?.id || null,
      arrivalDate: toIsoDate(result.arrivalDate as any),
      arrivedQty: result.arrivedQty,
      samplingQty: result.samplingQty,
      purchaseBy: result.purchaseBy?.id || null,
      receivedBy: result.receivedBy?.id || null,
      qcCheckBy: result.qcCheckBy?.id || null,
      verifiedBy: result.verifiedBy?.id || null,
      totalQty: result.totalQty,
      totalpercent: result.totalpercent,
      remark: result.remark,
      createdDate,
      createdTime,
      parameters: result.parameters.map(param => ({
        id: param.id,
        qualityParameterId: param.qualityParameterId,
        qualityParameterName: param.qualityParameterName,
        qualityParameterType: param.qualityParameterType,
        quantity: param.quantity !== null && param.quantity !== undefined ? Number(param.quantity) : null,
        percentage: param.percentage !== null && param.percentage !== undefined ? Number(param.percentage) : null,
      })),
    };
  }

  public async getAqrByIdForView(id: string): Promise<any> {
    const result = await this.aqrRepo
      .createQueryBuilder("aqr")
      .leftJoinAndSelect("aqr.deliveryChallanNo", "deliveryChallanNo")
      .leftJoinAndSelect("aqr.companyName", "companyName")
      .leftJoinAndSelect("aqr.location", "location")
      .leftJoinAndSelect("aqr.selectedVendor", "selectedVendor")
      .leftJoinAndSelect("aqr.selectedFarmer", "selectedFarmer")
      .leftJoinAndSelect("aqr.fromLocation", "fromLocation")
      .leftJoinAndSelect("aqr.product", "product")
      .leftJoinAndSelect("aqr.variant", "variant")
      .leftJoinAndSelect("aqr.verifiedBy", "verifiedBy")
      .leftJoinAndSelect("aqr.qcCheckBy", "qcCheckBy")
      .leftJoinAndSelect("aqr.receivedBy", "receivedBy")
      .leftJoinAndSelect("aqr.purchaseBy", "purchaseBy")
      .leftJoinAndSelect("aqr.parameters", "parameters")
      .where("aqr.id = :id", { id })
      .getOne();

    if (!result) {
      return null;
    }

    const { createdDate, createdTime } = formatDateTime(result.createdAt);

    const selectedParty = result.source === 'vendor'
      ? result.selectedVendor?.companyName || null
      : result.selectedFarmer
        ? `${result.selectedFarmer.farmerfName} ${result.selectedFarmer.farmermName} ${result.selectedFarmer.farmerlName}`.trim()
        : null;

    return {
      id: result.id,
      aqrFor: result.aqrFor,
      companyName: result.companyName?.name || null,
      location: result.location?.name || null,
      source: result.source,
      selectedParty,
      deliveryChallanNo: result.deliveryChallanNo?.challanNo || null,
      fromLocation: result.fromLocation?.name || null,
      product: result.product?.name || null,
      variant: result.variant?.variantName|| null,
      arrivalDate: result.arrivalDate,
      arrivedQty: result.arrivedQty,
      samplingQty: result.samplingQty,
      purchaseBy: result.purchaseBy ? `${result.purchaseBy.firstName} ${result.purchaseBy.lastName}`.trim() : null,
      receivedBy: result.receivedBy ? `${result.receivedBy.firstName} ${result.receivedBy.lastName}`.trim() : null,
      qcCheckBy: result.qcCheckBy ? `${result.qcCheckBy.firstName} ${result.qcCheckBy.lastName}`.trim() : null,
      verifiedBy: result.verifiedBy ? `${result.verifiedBy.firstName} ${result.verifiedBy.lastName}`.trim() : null,
      totalQty: result.totalQty,
      totalpercent: result.totalpercent,
      remark: result.remark,
      createdDate,
      createdTime,
      parameters: result.parameters.map(param => ({
        id: param.id,
        qualityParameterId: param.qualityParameterId,
        qualityParameterName: param.qualityParameterName,
        qualityParameterType: param.qualityParameterType,
        quantity: param.quantity,
        percentage: param.percentage,
      })),
    };
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

    // Sanitize optional date fields â€” empty string from frontend causes type errors
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

  // // ðŸ”„ Sorting
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
const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === false)
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
          relations: [
            'deliveryChallanNo',
            'companyName',
            'location',
            'selectedVendor',
            'selectedFarmer',
            'fromLocation',
            'product',
            'variant',
            'parameters',
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
      const selectedParty = rd.source === 'vendor'
        ? rd.selectedVendor?.companyName || null
        : rd.selectedFarmer?.farmerfName+" "+rd.selectedFarmer?.farmerlName || null;
      return {
        documentId: doc.id,
        overAllStatus: doc.status,
        createdBy:`${doc.lastActionBy.firstName || null}  ${doc.lastActionBy.lastName || null}`,
        createdDate: formatDateTime(doc.createdAt).createdDate,
        createdTime: formatDateTime(doc.createdAt).createdTime,

        id: rd.id || null,
        aqrFor: rd.aqrFor || null,
        aqrNo: rd.aqrNo || null,
        companyName: rd.companyName?.name || null,
        location: rd.location?.name || null,
        source: rd.source || null,
        selectedParty,
        deliveryChallanNo: rd.deliveryChallanNo?.challanNo || null,
        fromLocation: rd.fromLocation?.name || null,
        
        product: rd.product?.name || null,
              
        variant: rd.variant?.variantName || null,
        arrivalDate: rd.arrivalDate || null,
        arrivedQty: Number(rd.arrivedQty).toFixed(2) || null,
        samplingQty: Number(rd.samplingQty).toFixed(2) || null,
        totalQty: Number(rd.totalQty).toFixed(2) || null,
        totalpercent: rd.totalpercent || null,
        remark: rd.remark || null,
        purchaseBy: rd.purchaseBy?.firstName+" "+rd.purchaseBy?.lastName || null,
        receivedBy: rd.receivedBy?.firstName+" "+rd.receivedBy?.lastName || null,
        qcCheckBy: rd.qcCheckBy?.firstName+" "+rd.qcCheckBy?.lastName || null,
        verifiedBy: rd.verifiedBy?.firstName+" "+rd.verifiedBy?.lastName || null,
        
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

  // ðŸ”„ Sorting
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
          relations: [
            'deliveryChallanNo',
            'companyName',
            'location',
            'selectedVendor',
            'selectedFarmer',
            'fromLocation',
            'product',
            'variant',
            'parameters',
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
      const selectedParty = rd.source === 'vendor'
        ? rd.selectedVendor?.id || null
        : rd.selectedFarmer?.id || null;
      return {
        documentId: doc.id,
        overAllStatus: doc.status,
        createdBy:`${doc.lastActionBy.firstName || null}  ${doc.lastActionBy.lastName || null}`,
        createdDate: formatDateTime(doc.createdAt).createdDate,
        createdTime: formatDateTime(doc.createdAt).createdTime,

        id: rd.id || null,
        aqrFor: rd.aqrFor || null,
        companyName: rd.companyName?.id || null,
        location: rd.location?.id || null,
        source: rd.source || null,
        selectedParty,
        deliveryChallanNo: rd.deliveryChallanNo?.challanNo || null,
        fromLocation: rd.fromLocation?.id || null,
        product: rd.product?.id || null,
        productName: rd.product?.name || null,
        productCode: rd.product?.productCode || null,
        packingType: rd.product?.packingType || null,
        variant: rd.variant?.id || null,
        arrivalDate: rd.arrivalDate || null,
        arrivedQty: rd.arrivedQty || null,
        samplingQty: rd.samplingQty || null,
        totalQty: rd.totalQty || null,
        totalpercent: rd.totalpercent || null,
        remark: rd.remark || null,
        purchaseBy: rd.purchaseBy?.firstName || null,
        receivedBy: rd.receivedBy?.firstName || null,
        qcCheckBy: rd.qcCheckBy?.firstName || null,
        verifiedBy: rd.verifiedBy?.firstName || null,
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

  // ðŸ”„ Sorting
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
          'deliveryChallanNo',
          'companyName',
          'location',
          'selectedVendor',
          'selectedVendor.officeAddress',
          'selectedVendor.vendorSaleInfo',
          'selectedFarmer',
          'selectedFarmer.residensialAddress',
          'selectedFarmer.farmAddress',
          'fromLocation',
          'product',
          'variant',
          'parameters',
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

      const selectedParty = aqr.source === 'vendor'
        ? aqr.selectedVendor ? {
            id: aqr.selectedVendor.id,
            companyName: aqr.selectedVendor.companyName || null,
            vendorCode: aqr.selectedVendor.vendorCode || null,
            officeContactNo: aqr.selectedVendor.officeContactNo || null,
            officeEmail: aqr.selectedVendor.officeEmail || null,
            officeAddress: aqr.selectedVendor.officeAddress || null,
            contactPersonName: aqr.selectedVendor.vendorSaleInfo.contactFName+" "+aqr.selectedVendor.vendorSaleInfo.contactLName,

          } : null
        : aqr.selectedFarmer ? {
            id: aqr.selectedFarmer.id,
            fullName: `${aqr.selectedFarmer.farmerfName || ''} ${aqr.selectedFarmer.farmerlName || ''}`.trim(),
            farmerCode: aqr.selectedFarmer.farmerCode || null,
            primaryMobileNo: aqr.selectedFarmer.primaryMobileNo || null,
            email: aqr.selectedFarmer.email || null,
            residensialAddress:
            aqr.selectedFarmer.residensialAddress || null,
            farmAddress: aqr.selectedFarmer.farmAddress || null,
          } : null;
          

      return {
        documentId: document.documentId,
        overAllStatus: document.status,
        createdBy: document.createdBy,
        createdDate,
        createdTime,
        approvalSummary: document.approvalSummary,

        id: aqr.id,
        aqrFor: aqr.aqrFor,
        companyName: aqr.companyName?.id || null,
        location: aqr.location?.name || null,
        source: aqr.source,
        selectedParty,
        deliveryChallanNo: aqr.deliveryChallanNo?.challanNo || null,
        fromLocation: aqr.fromLocation?.name || null,
        product: aqr.product?.name || null,
        productCode: aqr.product?.productCode || null,
        packingType: aqr.product?.packingType || null,
        variant: aqr.variant?.variantName || null,
        arrivalDate: aqr.arrivalDate || null,
        arrivedQty: aqr.arrivedQty || null,
        samplingQty: aqr.samplingQty || null,
        totalQty: aqr.totalQty || null,
        totalpercent: aqr.totalpercent || null,
        remark: aqr.remark || null,
        purchaseBy: aqr.purchaseBy ? `${aqr.purchaseBy.firstName || ''} ${aqr.purchaseBy.lastName || ''}`.trim() : null,
        receivedBy: aqr.receivedBy ? `${aqr.receivedBy.firstName || ''} ${aqr.receivedBy.lastName || ''}`.trim() : null,
        qcCheckBy: aqr.qcCheckBy ? `${aqr.qcCheckBy.firstName || ''} ${aqr.qcCheckBy.lastName || ''}`.trim() : null,
        verifiedBy: aqr.verifiedBy ? `${aqr.verifiedBy.firstName || ''} ${aqr.verifiedBy.lastName || ''}`.trim() : null,
        parameters: aqr.parameters?.map(param => ({
          id: param.id || null,
          qualityParameterId: param.qualityParameterId || null,
          qualityParameterName: param.qualityParameterName || null,
          qualityParameterType: param.qualityParameterType || null,
          quantity: param.quantity || null,
          percentage: param.percentage || null,
        })) || [],
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

  // âœ… Select all fields from Aqr
  queryBuilder.select("aqr");

  // âœ… Join relations but select only specific fields
  queryBuilder
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

  // âœ… Apply dynamic filters (including related fields)
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

  // âœ… Pagination
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
