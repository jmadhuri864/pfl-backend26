import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { AqrRepository } from "../repositories/aqr.repository";
import { Aqr } from "../entities/aqr.entity";
import { AuditLogService } from "./auditLog.service";
import AppError from "../utils/appError";
import { buildQuery, PaginationOptions } from "../utils/pagination";
import { formatDateTime } from "../utils/dateUtils";
import { DocSingalApproverService } from "./DocSingalApproverService.service";
import { DocumentStatus, DocumentTypeEnum } from "../entities/docuemnt.entity";
import { DocumentbService, DocumentWithRelatedData } from "./documentb.service";
import { DocumentTypeEnum as DocDefEnum } from "../entities/documentdef.entity";
import { ApprovalFlowService } from "./approvalFlow.service";
import { SelectQueryBuilder, DataSource, In } from "typeorm";
import { DocumentbRepository } from "../repositories/documentb.repository";
import { CacheService } from "./cache.service";

const CACHE_PREFIX = "aqr";
const CACHE_TTL = 120; // 2 minutes for list data
const CACHE_TTL_DETAIL = 300; // 5 minutes for detail views

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
    @inject(TYPES.CacheService)
    private readonly cacheService: CacheService,
  ) {}

  // ─── Cache Helpers ────────────────────────────────────────────────────────

  private cacheKey(...parts: string[]): string {
    return this.cacheService.generateKey(CACHE_PREFIX, ...parts);
  }

  private async invalidateAqrCache(id?: string): Promise<void> {
    const tasks: Promise<any>[] = [
      this.cacheService.invalidatePattern(`${CACHE_PREFIX}:list:*`),
      this.cacheService.invalidatePattern(`${CACHE_PREFIX}:recycle:*`),
      this.cacheService.invalidatePattern(`${CACHE_PREFIX}:filter:*`),
    ];
    if (id) {
      tasks.push(
        this.cacheService.del(this.cacheKey("id", id)),
        this.cacheService.del(this.cacheKey("update", id)),
        this.cacheService.del(this.cacheKey("view", id)),
      );
    }
    await Promise.all(tasks);
  }

  // ─── Serial Number ────────────────────────────────────────────────────────

  private async generateSerialNo(): Promise<string> {
    const now = new Date();
    const datePrefix = `AQR${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

    const result = await this.aqrRepo
      .createQueryBuilder("aqr")
      .select("MAX(aqr.aqrNo)", "maxNo")
      .where("aqr.aqrNo LIKE :prefix", { prefix: `${datePrefix}%` })
      .getRawOne();

    let nextSeq = 1;
    if (result?.maxNo) {
      const lastSeq = parseInt(result.maxNo.replace(datePrefix, ""), 10);
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
    }
    return `${datePrefix}${nextSeq.toString().padStart(5, "0")}`;
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  public async createAqr(data: any): Promise<any> {
    const requestedBy = data.requestedBy;

    const approvalFlow = await this.approvalFlowService.findApprovalFlowForLoggedUser(requestedBy, DocDefEnum.OPERATION);
    if (!approvalFlow) {
      throw new AppError(400, "No approval flow configured for this user. Please contact the admin to create an approval flow before creating a AQR.");
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      data.aqrNo = await this.generateSerialNo();

      if (!data.dcDate || data.dcDate === "") data.dcDate = null;
      if (!data.arrivalDate || data.arrivalDate === "") data.arrivalDate = null;

      if (data.source === "vendor" && data.selectedParty) {
        data.selectedVendor = data.selectedParty;
        data.selectedFarmer = null;
      } else if (data.source === "farmer" && data.selectedParty) {
        data.selectedFarmer = data.selectedParty;
        data.selectedVendor = null;
      }

      const aqr = queryRunner.manager.create(this.aqrRepo.target, data);
      const savedAqr = await queryRunner.manager.save(aqr);

      const actualAqr = Array.isArray(savedAqr) ? (savedAqr[0] as Aqr) : (savedAqr as Aqr);
      const document = await this.documentbService.createDocument({
        type: DocumentTypeEnum.AQR,
        docDef: DocDefEnum.OPERATION,
        status: DocumentStatus.HOLD,
        remarks: "Document auto-created with AQR",
        lastActionBy: { id: requestedBy },
        document_type_id: actualAqr.id,
      });

      await queryRunner.commitTransaction();
      await this.documentbService.startApprovalFlow(document.id);
      await this.invalidateAqrCache();

      return savedAqr;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── Get By ID (for edit form) ────────────────────────────────────────────

  public async getAqrById(id: string): Promise<any> {
    const key = this.cacheKey("id", id);
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const result = await this.aqrRepo
      .createQueryBuilder("aqr")
      .leftJoin("aqr.deliveryChallanNo", "deliveryChallanNo")
      .leftJoin("aqr.companyName", "companyName")
      .leftJoin("aqr.location", "location")
      .leftJoin("aqr.selectedVendor", "selectedVendor")
      .leftJoin("aqr.selectedFarmer", "selectedFarmer")
      .leftJoin("aqr.fromLocation", "fromLocation")
      .leftJoin("aqr.product", "product")
      .leftJoin("aqr.variant", "variant")
      .leftJoinAndSelect("aqr.parameters", "parameters")
      .select([
        "aqr.id", "aqr.aqrFor", "aqr.source", "aqr.arrivalDate",
        "aqr.arrivedQty", "aqr.samplingQty", "aqr.purchaseBy",
        "aqr.receivedBy", "aqr.qcCheckBy", "aqr.verifiedBy",
        "aqr.totalQty", "aqr.totalpercent", "aqr.remark", "aqr.createdAt",
        "deliveryChallanNo.id", "companyName.id", "location.id",
        "selectedVendor.id", "selectedFarmer.id", "fromLocation.id",
        "product.id", "variant.id",
        "parameters.id", "parameters.qualityParameterId", "parameters.qualityParameterName",
        "parameters.qualityParameterType", "parameters.quantity", "parameters.percentage",
      ])
      .where("aqr.id = :id", { id })
      .getOne();

    if (!result) return null;

    const { createdDate, createdTime } = formatDateTime(result.createdAt);
    const response = {
      id: result.id,
      aqrFor: result.aqrFor,
      companyName: result.companyName?.id || null,
      location: result.location?.id || null,
      source: result.source,
      selectedParty: result.source === "vendor"
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
      parameters: (result.parameters ?? []).map((param) => ({
        id: param.id,
        qualityParameterId: param.qualityParameterId,
        qualityParameterName: param.qualityParameterName,
        qualityParameterType: param.qualityParameterType,
        quantity: param.quantity,
        percentage: param.percentage,
      })),
    };

    await this.cacheService.set(key, response, CACHE_TTL_DETAIL);
    return response;
  }

  // ─── Get By ID For Update ─────────────────────────────────────────────────

  public async getAqrByIdForUpdate(id: string): Promise<any> {
    const key = this.cacheKey("update", id);
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const result = await this.aqrRepo
      .createQueryBuilder("aqr")
      .leftJoin("aqr.deliveryChallanNo", "deliveryChallanNo")
      .leftJoin("aqr.companyName", "companyName")
      .leftJoin("aqr.location", "location")
      .leftJoin("aqr.selectedVendor", "selectedVendor")
      .leftJoin("aqr.selectedFarmer", "selectedFarmer")
      .leftJoin("aqr.fromLocation", "fromLocation")
      .leftJoin("aqr.product", "product")
      .leftJoin("aqr.variant", "variant")
      .leftJoin("aqr.verifiedBy", "verifiedBy")
      .leftJoin("aqr.qcCheckBy", "qcCheckBy")
      .leftJoin("aqr.receivedBy", "receivedBy")
      .leftJoin("aqr.purchaseBy", "purchaseBy")
      .leftJoin("aqr.parameters", "parameters")
      .select([
        "aqr.id", "aqr.aqrFor", "aqr.source", "aqr.arrivalDate",
        "aqr.arrivedQty", "aqr.samplingQty", "aqr.totalQty",
        "aqr.totalpercent", "aqr.remark", "aqr.createdAt",
        "deliveryChallanNo.id", "companyName.id", "location.id",
        "selectedVendor.id", "selectedFarmer.id", "fromLocation.id",
        "product.id", "variant.id",
        "verifiedBy.id", "qcCheckBy.id", "receivedBy.id", "purchaseBy.id",
        "parameters.id", "parameters.qualityParameterId", "parameters.qualityParameterName",
        "parameters.qualityParameterType", "parameters.quantity", "parameters.percentage",
      ])
      .where("aqr.id = :id", { id })
      .getOne();

    if (!result) return null;

    const { createdDate, createdTime } = formatDateTime(result.createdAt);
    const toIsoDate = (val: string | null) => {
      if (!val) return null;
      const parts = val.split("-");
      if (parts.length !== 3) return null;
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    };

    const response = {
      id: result.id,
      aqrFor: result.aqrFor,
      companyName: result.companyName?.id || null,
      location: result.location?.id || null,
      source: result.source,
      selectedParty: result.source === "vendor"
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
      parameters: (result.parameters ?? []).map((param) => ({
        id: param.id,
        qualityParameterId: param.qualityParameterId,
        qualityParameterName: param.qualityParameterName,
        qualityParameterType: param.qualityParameterType,
        quantity: param.quantity != null ? Number(param.quantity) : null,
        percentage: param.percentage != null ? Number(param.percentage) : null,
      })),
    };

    await this.cacheService.set(key, response, CACHE_TTL_DETAIL);
    return response;
  }

  // ─── Get By ID For View (simple) ──────────────────────────────────────────

  public async getAqrByIdForView(id: string): Promise<any> {
    const key = this.cacheKey("simple-view", id);
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const result = await this.aqrRepo
      .createQueryBuilder("aqr")
      .leftJoin("aqr.deliveryChallanNo", "deliveryChallanNo")
      .leftJoin("aqr.companyName", "companyName")
      .leftJoin("aqr.location", "location")
      .leftJoin("aqr.selectedVendor", "selectedVendor")
      .leftJoin("aqr.selectedFarmer", "selectedFarmer")
      .leftJoin("aqr.fromLocation", "fromLocation")
      .leftJoin("aqr.product", "product")
      .leftJoin("aqr.variant", "variant")
      .leftJoin("aqr.verifiedBy", "verifiedBy")
      .leftJoin("aqr.qcCheckBy", "qcCheckBy")
      .leftJoin("aqr.receivedBy", "receivedBy")
      .leftJoin("aqr.purchaseBy", "purchaseBy")
      .leftJoinAndSelect("aqr.parameters", "parameters")
      .select([
        "aqr.id", "aqr.aqrFor", "aqr.source", "aqr.arrivalDate",
        "aqr.arrivedQty", "aqr.samplingQty", "aqr.totalQty",
        "aqr.totalpercent", "aqr.remark", "aqr.createdAt",
        "deliveryChallanNo.challanNo", "companyName.name", "location.name",
        "selectedVendor.companyName", "selectedFarmer.farmerfName",
        "selectedFarmer.farmermName", "selectedFarmer.farmerlName",
        "fromLocation.name", "product.name", "variant.variantName",
        "verifiedBy.firstName", "verifiedBy.lastName",
        "qcCheckBy.firstName", "qcCheckBy.lastName",
        "receivedBy.firstName", "receivedBy.lastName",
        "purchaseBy.firstName", "purchaseBy.lastName",
      ])
      .where("aqr.id = :id", { id })
      .getOne();

    if (!result) return null;

    const { createdDate, createdTime } = formatDateTime(result.createdAt);
    const selectedParty = result.source === "vendor"
      ? result.selectedVendor?.companyName || null
      : result.selectedFarmer
        ? `${result.selectedFarmer.farmerfName} ${result.selectedFarmer.farmermName} ${result.selectedFarmer.farmerlName}`.trim()
        : null;

    const response = {
      id: result.id,
      aqrFor: result.aqrFor,
      companyName: result.companyName?.name || null,
      location: result.location?.name || null,
      source: result.source,
      selectedParty,
      deliveryChallanNo: result.deliveryChallanNo?.challanNo || null,
      fromLocation: result.fromLocation?.name || null,
      product: result.product?.name || null,
      variant: result.variant?.variantName || null,
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
      parameters: result.parameters.map((param) => ({
        id: param.id,
        qualityParameterId: param.qualityParameterId,
        qualityParameterName: param.qualityParameterName,
        qualityParameterType: param.qualityParameterType,
        quantity: param.quantity,
        percentage: param.percentage,
      })),
    };

    await this.cacheService.set(key, response, CACHE_TTL_DETAIL);
    return response;
  }

  // ─── Get All AQRs (optimized: batch fetch instead of N+1) ─────────────────

  public async getAllAqrs(queryOptions: PaginationOptions, userId: string): Promise<{
    data: any[];
    meta: { total: number; page: number; pages: number };
  }> {
    const key = this.cacheKey("list", userId, JSON.stringify(queryOptions));
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const documents = await this.docSingalApproverService.getAllSingleApprovalDocumentsByUserId(userId, DocumentTypeEnum.AQR) as DocumentWithRelatedData[];
    const activeDocs = documents
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (activeDocs.length === 0) {
      return { data: [], meta: { total: 0, page: queryOptions.page || 1, pages: 0 } };
    }

    // Batch fetch all AQRs in one query instead of N+1
    const aqrIds = activeDocs.map((d) => d.document_type_id).filter(Boolean);
    const aqrs = await this.aqrRepo
      .createQueryBuilder("aqr")
      .leftJoin("aqr.deliveryChallanNo", "dc").addSelect(["dc.challanNo"])
      .leftJoin("aqr.companyName", "company").addSelect(["company.name"])
      .leftJoin("aqr.location", "location").addSelect(["location.name"])
      .leftJoin("aqr.selectedVendor", "vendor").addSelect(["vendor.companyName"])
      .leftJoin("aqr.selectedFarmer", "farmer").addSelect(["farmer.farmerfName", "farmer.farmerlName"])
      .leftJoin("aqr.fromLocation", "fromLoc").addSelect(["fromLoc.name"])
      .leftJoin("aqr.product", "product").addSelect(["product.name"])
      .leftJoin("aqr.variant", "variant").addSelect(["variant.variantName"])
      .leftJoin("aqr.purchaseBy", "purchaseBy").addSelect(["purchaseBy.firstName", "purchaseBy.lastName"])
      .leftJoin("aqr.receivedBy", "receivedBy").addSelect(["receivedBy.firstName", "receivedBy.lastName"])
      .leftJoin("aqr.qcCheckBy", "qcCheckBy").addSelect(["qcCheckBy.firstName", "qcCheckBy.lastName"])
      .leftJoin("aqr.verifiedBy", "verifiedBy").addSelect(["verifiedBy.firstName", "verifiedBy.lastName"])
      .where("aqr.id IN (:...ids)", { ids: aqrIds })
      .andWhere("aqr.isDeleted = false")
      .andWhere("aqr.deletedAt IS NULL")
      .getMany();

    const aqrMap = new Map(aqrs.map((a) => [a.id, a]));

    let relatedDataOnly = activeDocs.map((doc) => {
      const rd = aqrMap.get(doc.document_type_id) as any;
      if (!rd) return null;
      const selectedParty = rd.source === "vendor"
        ? rd.selectedVendor?.companyName || null
        : rd.selectedFarmer
          ? `${rd.selectedFarmer.farmerfName} ${rd.selectedFarmer.farmerlName}`.trim()
          : null;
      return {
        documentId: doc.id,
        overAllStatus: doc.status,
        createdBy: `${doc.lastActionBy?.firstName || ""} ${doc.lastActionBy?.lastName || ""}`.trim(),
        createdDate: formatDateTime(doc.createdAt).createdDate,
        createdTime: formatDateTime(doc.createdAt).createdTime,
        id: rd.id,
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
        arrivedQty: rd.arrivedQty != null ? Number(rd.arrivedQty).toFixed(2) : null,
        samplingQty: rd.samplingQty != null ? Number(rd.samplingQty).toFixed(2) : null,
        totalQty: rd.totalQty != null ? Number(rd.totalQty).toFixed(2) : null,
        totalpercent: rd.totalpercent || null,
        remark: rd.remark || null,
        purchaseBy: rd.purchaseBy ? `${rd.purchaseBy.firstName} ${rd.purchaseBy.lastName}`.trim() : null,
        receivedBy: rd.receivedBy ? `${rd.receivedBy.firstName} ${rd.receivedBy.lastName}`.trim() : null,
        qcCheckBy: rd.qcCheckBy ? `${rd.qcCheckBy.firstName} ${rd.qcCheckBy.lastName}`.trim() : null,
        verifiedBy: rd.verifiedBy ? `${rd.verifiedBy.firstName} ${rd.verifiedBy.lastName}`.trim() : null,
      };
    }).filter(Boolean);

    // Search
    const { search } = queryOptions;
    if (search?.trim()) {
      const term = search.toLowerCase();
      const stringify = (obj: any): string => {
        if (obj == null) return "";
        if (typeof obj === "object") return Object.values(obj).map(stringify).join(" ");
        return String(obj);
      };
      relatedDataOnly = relatedDataOnly.filter((item) => stringify(item).toLowerCase().includes(term));
    }

    // Sort
    if (queryOptions.sort) {
      const [field, direction] = queryOptions.sort.split(":");
      const sortOrder = direction?.toUpperCase() === "DESC" ? -1 : 1;
      const getVal = (obj: any, path: string) => path.split(".").reduce((o, k) => o?.[k], obj);
      relatedDataOnly.sort((a, b) => {
        const valA = getVal(a, field);
        const valB = getVal(b, field);
        if (valA == null && valB == null) return 0;
        if (valA == null) return -1 * sortOrder;
        if (valB == null) return 1 * sortOrder;
        if (!isNaN(valA) && !isNaN(valB)) return (Number(valA) - Number(valB)) * sortOrder;
        return String(valA).localeCompare(String(valB)) * sortOrder;
      });
    }

    const response = {
      data: relatedDataOnly,
      meta: {
        total: relatedDataOnly.length,
        page: queryOptions.page || 1,
        pages: Math.ceil(relatedDataOnly.length / (queryOptions.limit || 10)),
      },
    };

    await this.cacheService.set(key, response, CACHE_TTL);
    return response;
  }

  // ─── Get Recycle Bin (optimized: batch fetch) ─────────────────────────────

  public async getAllRecycleBinAqrs(queryOptions: PaginationOptions, userId: string): Promise<{
    data: any[];
    meta: { total: number; page: number; pages: number };
  }> {
    const key = this.cacheKey("recycle", userId, JSON.stringify(queryOptions));
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const documents = await this.docSingalApproverService.getAllSingleApprovalDocumentsByUserId(userId, DocumentTypeEnum.AQR, true) as DocumentWithRelatedData[];
    const deletedDocs = documents;

    if (deletedDocs.length === 0) {
      return { data: [], meta: { total: 0, page: queryOptions.page || 1, pages: 0 } };
    }

    const aqrIds = deletedDocs.map((d) => d.document_type_id).filter(Boolean);
    const aqrs = await this.aqrRepo
      .createQueryBuilder("aqr")
      .leftJoin("aqr.deliveryChallanNo", "dc").addSelect(["dc.challanNo"])
      .leftJoin("aqr.companyName", "company").addSelect(["company.id", "company.name"])
      .leftJoin("aqr.location", "location").addSelect(["location.id", "location.name"])
      .leftJoin("aqr.selectedVendor", "vendor").addSelect(["vendor.id"])
      .leftJoin("aqr.selectedFarmer", "farmer").addSelect(["farmer.id"])
      .leftJoin("aqr.fromLocation", "fromLoc").addSelect(["fromLoc.id"])
      .leftJoin("aqr.product", "product").addSelect(["product.id", "product.name", "product.productCode", "product.packingType"])
      .leftJoin("aqr.variant", "variant").addSelect(["variant.id"])
      .leftJoin("aqr.purchaseBy", "purchaseBy").addSelect(["purchaseBy.firstName"])
      .leftJoin("aqr.receivedBy", "receivedBy").addSelect(["receivedBy.firstName"])
      .leftJoin("aqr.qcCheckBy", "qcCheckBy").addSelect(["qcCheckBy.firstName"])
      .leftJoin("aqr.verifiedBy", "verifiedBy").addSelect(["verifiedBy.firstName"])
      .leftJoinAndSelect("aqr.parameters", "parameters")
      .where("aqr.id IN (:...ids)", { ids: aqrIds })
      .andWhere("aqr.isDeleted = true")
      .getMany();

    const aqrMap = new Map(aqrs.map((a) => [a.id, a]));

    let relatedDataOnly = deletedDocs.map((doc) => {
      const rd = aqrMap.get(doc.document_type_id) as any;
      if (!rd) return null;
      const selectedParty = rd.source === "vendor"
        ? rd.selectedVendor?.id || null
        : rd.selectedFarmer?.id || null;
      return {
        documentId: doc.id,
        overAllStatus: doc.status,
        createdBy: `${doc.lastActionBy?.firstName || ""} ${doc.lastActionBy?.lastName || ""}`.trim(),
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
        parameters: rd.parameters?.map((param: any) => ({
          id: param.id || null,
          qualityParameterId: param.qualityParameterId || null,
          qualityParameterName: param.qualityParameterName || null,
          qualityParameterType: param.qualityParameterType || null,
          quantity: param.quantity || null,
          percentage: param.percentage || null,
        })) || [],
      };
    }).filter(Boolean);

    const { search } = queryOptions;
    if (search?.trim()) {
      const term = search.toLowerCase();
      const stringify = (obj: any): string => {
        if (obj == null) return "";
        if (typeof obj === "object") return Object.values(obj).map(stringify).join(" ");
        return String(obj);
      };
      relatedDataOnly = relatedDataOnly.filter((item) => stringify(item).toLowerCase().includes(term));
    }

    if (queryOptions.sort) {
      const [field, direction] = queryOptions.sort.split(":");
      const sortOrder = direction?.toUpperCase() === "DESC" ? -1 : 1;
      const getVal = (obj: any, path: string) => path.split(".").reduce((o, k) => o?.[k], obj);
      relatedDataOnly.sort((a, b) => {
        const valA = getVal(a, field);
        const valB = getVal(b, field);
        if (valA == null && valB == null) return 0;
        if (valA == null) return -1 * sortOrder;
        if (valB == null) return 1 * sortOrder;
        if (!isNaN(valA) && !isNaN(valB)) return (Number(valA) - Number(valB)) * sortOrder;
        return String(valA).localeCompare(String(valB)) * sortOrder;
      });
    }

    const response = {
      data: relatedDataOnly,
      meta: {
        total: relatedDataOnly.length,
        page: queryOptions.page || 1,
        pages: Math.ceil(relatedDataOnly.length / (queryOptions.limit || 10)),
      },
    };

    await this.cacheService.set(key, response, CACHE_TTL);
    return response;
  }

  // ─── Get AQR By ID For View (with document approval info) ─────────────────

  public async getAQRByIdForView(docid: string, userId: string): Promise<any> {
    const key = this.cacheKey("view", docid, userId);
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const document = await this.docSingalApproverService.getSingleApprovalDocumentById(docid, userId);
    if (!document) return null;

    const id = document.documentTypeId;
    if (!id) return null;

    const aqr = await this.aqrRepo
      .createQueryBuilder('aqr')
      .leftJoin('aqr.deliveryChallanNo', 'deliveryChallanNo')
      .leftJoin('aqr.companyName', 'companyName')
      .leftJoin('aqr.location', 'location')
      .leftJoin('aqr.selectedVendor', 'selectedVendor')
      .leftJoin('selectedVendor.vendorSaleInfo', 'vendorSaleInfo')
      .leftJoin('selectedVendor.officeAddress', 'vendorOfficeAddress')
      .leftJoin('aqr.selectedFarmer', 'selectedFarmer')
      .leftJoin('selectedFarmer.residensialAddress', 'residensialAddress')
      .leftJoin('selectedFarmer.farmAddress', 'farmAddress')
      .leftJoin('aqr.fromLocation', 'fromLocation')
      .leftJoin('aqr.product', 'product')
      .leftJoin('aqr.variant', 'variant')
      .leftJoin('aqr.parameters', 'parameters')
      .leftJoin('aqr.purchaseBy', 'purchaseBy')
      .leftJoin('aqr.receivedBy', 'receivedBy')
      .leftJoin('aqr.qcCheckBy', 'qcCheckBy')
      .leftJoin('aqr.verifiedBy', 'verifiedBy')
      .select([
        'aqr.id', 'aqr.aqrFor', 'aqr.source', 'aqr.arrivalDate',
        'aqr.arrivedQty', 'aqr.samplingQty', 'aqr.totalQty',
        'aqr.totalpercent', 'aqr.remark', 'aqr.createdAt',
        'deliveryChallanNo.challanNo',
        'companyName.id',
        'location.name',
        'selectedVendor.id', 'selectedVendor.companyName', 'selectedVendor.vendorCode',
        'selectedVendor.officeContactNo', 'selectedVendor.officeEmail',
        'vendorOfficeAddress.id', 'vendorOfficeAddress.address1', 'vendorOfficeAddress.address2',
        'vendorOfficeAddress.location', 'vendorOfficeAddress.city', 'vendorOfficeAddress.state', 'vendorOfficeAddress.pincode',
        'vendorSaleInfo.contactFName', 'vendorSaleInfo.contactLName',
        'selectedFarmer.id', 'selectedFarmer.farmerfName', 'selectedFarmer.farmerlName',
        'selectedFarmer.farmerCode', 'selectedFarmer.primaryMobileNo', 'selectedFarmer.email',
        'residensialAddress.id', 'residensialAddress.address1', 'residensialAddress.address2',
        'residensialAddress.location', 'residensialAddress.city', 'residensialAddress.state', 'residensialAddress.pincode',
        'farmAddress.id', 'farmAddress.address1', 'farmAddress.address2',
        'farmAddress.location', 'farmAddress.city', 'farmAddress.state', 'farmAddress.pincode',
        'fromLocation.name',
        'product.name', 'product.productCode', 'product.packingType',
        'variant.variantName',
        'parameters.id', 'parameters.qualityParameterId', 'parameters.qualityParameterName',
        'parameters.qualityParameterType', 'parameters.quantity', 'parameters.percentage',
        'purchaseBy.firstName', 'purchaseBy.lastName',
        'receivedBy.firstName', 'receivedBy.lastName',
        'qcCheckBy.firstName', 'qcCheckBy.lastName',
        'verifiedBy.firstName', 'verifiedBy.lastName',
      ])
      .where('aqr.id = :id', { id })
      .getOne();

    if (!aqr) throw new Error('AQR not found');

    const { createdDate, createdTime } = formatDateTime(aqr.createdAt);
    const mapUser = (u: any) => u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : null;

    const selectedParty = aqr.source === 'vendor'
      ? aqr.selectedVendor ? {
          id: aqr.selectedVendor.id,
          companyName: aqr.selectedVendor.companyName ?? null,
          vendorCode: aqr.selectedVendor.vendorCode ?? null,
          officeContactNo: aqr.selectedVendor.officeContactNo ?? null,
          officeEmail: aqr.selectedVendor.officeEmail ?? null,
          officeAddress: aqr.selectedVendor.officeAddress ?? null,
          contactPersonName: aqr.selectedVendor.vendorSaleInfo
            ? `${aqr.selectedVendor.vendorSaleInfo.contactFName} ${aqr.selectedVendor.vendorSaleInfo.contactLName}`
            : null,
        } : null
      : aqr.selectedFarmer ? {
          id: aqr.selectedFarmer.id,
          fullName: `${aqr.selectedFarmer.farmerfName ?? ''} ${aqr.selectedFarmer.farmerlName ?? ''}`.trim(),
          farmerCode: aqr.selectedFarmer.farmerCode ?? null,
          primaryMobileNo: aqr.selectedFarmer.primaryMobileNo ?? null,
          email: aqr.selectedFarmer.email ?? null,
          residensialAddress: aqr.selectedFarmer.residensialAddress ?? null,
          farmAddress: aqr.selectedFarmer.farmAddress ?? null,
        } : null;

    const response = {
      documentId: document.documentId,
      overAllStatus: document.status,
      createdBy: document.createdBy,
      createdDate,
      createdTime,
      approvalSummary: document.approvalSummary,
      id: aqr.id,
      aqrFor: aqr.aqrFor,
      companyName: aqr.companyName?.id ?? null,
      location: aqr.location?.name ?? null,
      source: aqr.source,
      selectedParty,
      deliveryChallanNo: aqr.deliveryChallanNo?.challanNo ?? null,
      fromLocation: aqr.fromLocation?.name ?? null,
      product: aqr.product?.name ?? null,
      productCode: aqr.product?.productCode ?? null,
      packingType: aqr.product?.packingType ?? null,
      variant: aqr.variant?.variantName ?? null,
      arrivalDate: aqr.arrivalDate ?? null,
      arrivedQty: aqr.arrivedQty ?? null,
      samplingQty: aqr.samplingQty ?? null,
      totalQty: aqr.totalQty ?? null,
      totalpercent: aqr.totalpercent ?? null,
      remark: aqr.remark ?? null,
      purchaseBy: mapUser(aqr.purchaseBy),
      receivedBy: mapUser(aqr.receivedBy),
      qcCheckBy: mapUser(aqr.qcCheckBy),
      verifiedBy: mapUser(aqr.verifiedBy),
      parameters: (aqr.parameters ?? []).map((param) => ({
        id: param.id ?? null,
        qualityParameterId: param.qualityParameterId ?? null,
        qualityParameterName: param.qualityParameterName ?? null,
        qualityParameterType: param.qualityParameterType ?? null,
        quantity: param.quantity ?? null,
        percentage: param.percentage ?? null,
      })),
    };

    await this.cacheService.set(key, response, CACHE_TTL_DETAIL);
    return response;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  public async updateAqr(id: string, data: any, updatedBy: string): Promise<any> {
    const existingAqr = await this.aqrRepo.findOne({ where: { id } });
    if (!existingAqr) return null;

  //  console.log("Data ", data);
    

    if (!data.dcDate || data.dcDate === "") data.dcDate = null;
    if (!data.arrivalDate || data.arrivalDate === "") data.arrivalDate = null;

    const oldData = { ...existingAqr };
    Object.assign(existingAqr, data);
    const updatedAqr = await this.aqrRepo.save(existingAqr);

    await this.auditLogService.logChange("AQR", id, oldData, updatedAqr, updatedBy);
    await this.invalidateAqrCache(id);

    return updatedAqr;
  }

  // ─── Delete (schedule) ────────────────────────────────────────────────────

  public async deleteAqr(id: string): Promise<boolean> {
    const aqr = await this.aqrRepo.findOne({ where: { id } });
    if (!aqr) throw new AppError(404, `AQR with ID ${id} not found`);

    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    sixMonthsFromNow.setHours(0, 0, 0, 0);

    aqr.deletionScheduledAt = sixMonthsFromNow;
    await this.aqrRepo.save(aqr);
    await this.invalidateAqrCache(id);

    return true;
  }

  // ─── Search ───────────────────────────────────────────────────────────────

  public async searchAqr(search: string): Promise<Aqr[]> {
    return this.aqrRepo.find({ where: [{ id: search }] });
  }

  // ─── Filter ───────────────────────────────────────────────────────────────

  async filterAqrs(page: number, limit: number, filters: Record<string, any>) {
    const key = this.cacheKey("filter", JSON.stringify({ page, limit, filters }));
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const qb: SelectQueryBuilder<Aqr> = this.aqrRepo.createQueryBuilder("aqr");
    qb.select("aqr")
      .leftJoin("aqr.purchaseBy", "purchasedBy").addSelect(["purchasedBy.id", "purchasedBy.firstName", "purchasedBy.lastName"])
      .leftJoin("aqr.receivedBy", "receivedBy").addSelect(["receivedBy.id", "receivedBy.firstName", "receivedBy.lastName"])
      .leftJoin("aqr.qcCheckBy", "qcCheckedBy").addSelect(["qcCheckedBy.id", "qcCheckedBy.firstName", "qcCheckedBy.lastName"])
      .leftJoin("aqr.verifiedBy", "verifiedBy").addSelect(["verifiedBy.id", "verifiedBy.firstName", "verifiedBy.lastName"])
      .leftJoin("aqr.product", "product").addSelect(["product.id", "product.name"]);

    Object.entries(filters).forEach(([key, value]) => {
      if (key.includes(".")) {
        const [alias, field] = key.split(".");
        qb.andWhere(`${alias}.${field} ILIKE :${field}`, { [field]: `%${value}%` });
      } else if (typeof value === "string" && isNaN(Number(value))) {
        qb.andWhere(`aqr.${key} ILIKE :${key}`, { [key]: `%${value}%` });
      } else {
        qb.andWhere(`aqr.${key} = :${key}`, { [key]: value });
      }
    });

    qb.skip((page - 1) * limit).take(limit);
    const [data, total] = await qb.getManyAndCount();

    const result = { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    await this.cacheService.set(key, result, CACHE_TTL);
    return result;
  }

  // ─── Delete Multiple ──────────────────────────────────────────────────────

  public async deleteMultipleAqrs(ids: string[]): Promise<{ success: string[]; failed: { id: string; reason: string }[]; message: string }> {
    const success: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    for (const id of ids) {
      try {
        const aqr = await this.aqrRepo.findOne({ where: { id } });
        if (!aqr) { failed.push({ id, reason: "AQR not found" }); continue; }

        const relatedDocument = await this.documentbRepository.findOne({ where: { document_type_id: aqr.id } });
        if (relatedDocument) {
          await this.documentbRepository.softDelete(relatedDocument.id);
          await this.documentbRepository.update(relatedDocument.id, { isDeleted: true } as any);
        }

        await this.aqrRepo.softDelete(aqr.id);
        await this.aqrRepo.update(aqr.id, { isDeleted: true } as any);
        success.push(id);
      } catch (error: any) {
        failed.push({ id, reason: error.message || "Unknown error" });
      }
    }

    await this.invalidateAqrCache();
    return { success, failed, message: `Deletion completed. Success: ${success.length}, Failed: ${failed.length}` };
  }

  // ─── Legacy (kept for compatibility) ─────────────────────────────────────

  public async getAllAqr(queryOptions: PaginationOptions): Promise<any> {
    const key = this.cacheKey("all", JSON.stringify(queryOptions));
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const qb = this.aqrRepo
      .createQueryBuilder("aqr")
      .leftJoinAndSelect("aqr.product", "product")
      .leftJoinAndSelect("aqr.parameters", "parameters")
       .andWhere("aqr.isDeleted = false")
      .orderBy("aqr.createdAt", "DESC");

    const result = await buildQuery(qb, queryOptions, "aqr");
    const response = {
      data: result.data.map((aqr) => {
        const { createdDate, createdTime } = formatDateTime(aqr.createdAt);
        return { ...aqr, createdDate, createdTime, arrivalDate: formatDateTime(aqr.arrivalDate || "") };
      }),
      meta: result.meta,
    };
    await this.cacheService.set(key, response, CACHE_TTL);
    return response;
  }
}
