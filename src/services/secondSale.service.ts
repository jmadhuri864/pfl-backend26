import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { SecondSaleRepository } from "../repositories/secondSale.repository";

import { SecondSale } from "../entities/secondSale.entity";
import AppError from "../utils/appError";
import { AuditLogService } from "./auditLog.service";
import { DataSource, ILike, In } from "typeorm";
import { SecondSaleProduct } from "../entities/secondSaleProduct.entity";

import logger from "../utils/logger";
import { SecondSaleProductRepository } from "../repositories/secondSaleProduct.repository";
import { buildQuery, PaginationOptions } from "../utils/pagination";
import { formatDateTime } from "../utils/dateUtils";

import { DocumentTypeEnum } from '../entities/docuemnt.entity';
import { DocumentStatus } from '../entities/docuemnt.entity';
import { DocumentTypeEnum as DocDefEnum } from '../entities/documentdef.entity';
import { DocumentbService, DocumentWithRelatedData } from "./documentb.service";
import { DocDoubleApproverService } from "./docDoubleApprover.service";
import { ApprovalFlowService } from "./approvalFlow.service";
import { ProductVarientRepository } from "../repositories/varients.repository";
import { DocumentbRepository } from "../repositories/documentb.repository";
import { CacheService } from "./cache.service";


@injectable()
export class SecondSaleService {
  constructor(
    @inject(TYPES.SecondSaleRepository)
    private readonly secondSaleRepository: SecondSaleRepository,
    @inject(TYPES.SecondSaleProductRepository)
    private readonly secondSaleProductRepository: SecondSaleProductRepository,
    @inject(TYPES.AuditLogService) private auditLogService: AuditLogService,
    @inject(TYPES.DocumentbRepository) private documentbRepository: DocumentbRepository,
    @inject(TYPES.ProductVarientRepository)
    private productVarientsRepository: ProductVarientRepository,
    @inject(TYPES.DataSource)
    private readonly AppDataSource: DataSource,
    @inject(TYPES.DocumentbService)
    private readonly documentbService: DocumentbService,
    @inject(TYPES.DocDoubleApproverService) private readonly docDoubleApproverService: DocDoubleApproverService, // Assuming you have a service for double approval
    @inject(TYPES.ApprovalFlowService)
    private approvalFlowService: ApprovalFlowService,
    @inject(TYPES.CacheService)
    private readonly cacheService: CacheService,
  ) { }

  private readonly CACHE_PREFIX = 'secondSale';
  private readonly CACHE_TTL = 180;

  private async invalidateCache(id?: string): Promise<void> {
    const tasks: Promise<any>[] = [
      this.cacheService.invalidatePattern(`${this.CACHE_PREFIX}:list:*`),
    ];
    if (id) {
      tasks.push(
        this.cacheService.del(`${this.CACHE_PREFIX}:id:${id}`),
        this.cacheService.del(`${this.CACHE_PREFIX}:update:${id}`),
        this.cacheService.del(`${this.CACHE_PREFIX}:view:${id}`),
      );
    }
    await Promise.all(tasks);
  }

  private async generateSerialNo(): Promise<string> {
    const now = new Date();
    const yyyy = now.getFullYear().toString();
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const datePrefix = `SSR${yyyy}${mm}${dd}`;

    const count = await this.secondSaleRepository.count({
      where: { secondSaleNo: ILike(`${datePrefix}%`) },
    });

    return `${datePrefix}${(count + 1).toString().padStart(5, '0')}`;
  }





  public async createSecondSale(secondSaleData: any, requestedBy: any): Promise<any> {
    const queryRunner = this.AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      //TODO: Check approval flow is exit or not for logged user

      const approvalFlowExit = this.approvalFlowService.findApprovalFlowForLoggedUser(requestedBy, 'second-sale')

      if (!approvalFlowExit) {
        throw new Error('Approval flow not found');
      }
      // 1. Normalize variant IDs
      let variantIds: string[] = [];
      if (Array.isArray(secondSaleData.variants)) {
        variantIds = secondSaleData.variants;
      } else if (secondSaleData.variants) {
        variantIds = [secondSaleData.variants];
      }

      // 2. Fetch variants with product relation
      const variants = await queryRunner.manager.find(this.productVarientsRepository.target, {
        where: { id: In(variantIds) },
        relations: ['product'],
      });

      // 3. Extract product IDs from variants
      const productIds = variants.map(v => v.product?.id).filter(Boolean);
      const serialNo = await this.generateSerialNo();
      secondSaleData.secondSaleNo = serialNo;
      const secondSale = queryRunner.manager.create(this.secondSaleRepository.target, {
        ...secondSaleData,
        variants: variants.map(v => ({ id: v.id })), // only IDs
        products: productIds.map(id => ({ id })),   // only IDs
      });
      const savedSecondSale = await queryRunner.manager.save(secondSale);

      const document = await this.documentbService.createDocument({
        type: DocumentTypeEnum.SECOND_SALE,
        docDef: DocDefEnum.SALE,
        // totalAmt: rfpaData.totalAmt,
        status: DocumentStatus.HOLD,
        remarks: 'Document auto-created with SecondSale',
        lastActionBy: { id: requestedBy },
        document_type_id: Array.isArray(savedSecondSale) ? (savedSecondSale[0] as SecondSale)?.id : (savedSecondSale as SecondSale).id
      },);

      // Commit transaction - all operations succeeded
      await queryRunner.commitTransaction();

      // Start approval flow after commit so second sale is visible to other DB connections
      await this.documentbService.startApprovalFlow(document.id);

      await this.invalidateCache();
      return savedSecondSale;
    } catch (error: any) {
      // Rollback transaction - undo all changes
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }





  public async getAllSecondSales(queryOptions: PaginationOptions, userId: string): Promise<any> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}:list:${userId}:${JSON.stringify(queryOptions)}`;
      const cached = await this.cacheService.get<any>(cacheKey);
      if (cached) return cached;

      const { data, meta } = await this.docDoubleApproverService.getAllDocumentByUserIdForDoubleApprover(
        userId,
        DocumentTypeEnum.SECOND_SALE,
        queryOptions,
      );
      const { search } = queryOptions;

      const typedDocuments = data as DocumentWithRelatedData[];
      const activeDocuments = typedDocuments;

      // ---- Batch fetch: one query instead of N+1 ----
      const saleIds = activeDocuments
        .map(doc => doc.document_type_id)
        .filter(Boolean) as string[];

      const sales = saleIds.length
        ? await this.secondSaleRepository
            .createQueryBuilder('ss')
            .leftJoinAndSelect('ss.companyName', 'companyName')
            .leftJoinAndSelect('ss.location', 'location')
            .where('ss.id IN (:...ids)', { ids: saleIds })
            .andWhere('ss.isDeleted = false')
            .andWhere('ss.deletedAt IS NULL')
            .getMany()
        : [];

      const saleMap = new Map(sales.map(s => [s.id, s]));

      let relatedDataOnly = activeDocuments
        .filter(doc => doc.document_type_id && saleMap.has(doc.document_type_id))
        .map((doc) => {
          const rd: any = saleMap.get(doc.document_type_id!)!;
          return {
            documentId: doc.id,
            overAllStatus: doc.status,
            createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
            createdDate: formatDateTime(doc.createdAt).createdDate,
            createdTime: formatDateTime(doc.createdAt).createdTime,
            ...rd,
            companyName: rd.companyName?.name || null,
            location: rd.location?.name || null,
          };
        });

      // 🔍 Deep search
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
    } catch (error) {
      console.error("Error fetching SecondSale:", error);
      throw error;
    }
  }

  public async getSecondSaleById(id: string): Promise<SecondSale | null> {
    const cacheKey = `${this.CACHE_PREFIX}:id:${id}`;
    const cached = await this.cacheService.get<SecondSale>(cacheKey);
    if (cached) return cached;

    try {
      const secondSale = await this.secondSaleRepository
        .createQueryBuilder("secondSale")
        .leftJoinAndSelect("secondSale.secondSaleProducts", "secondSaleProducts")
        .leftJoinAndSelect("secondSale.companyName", "companyName")
        .leftJoinAndSelect("secondSale.deliveryChallanNo", "deliveryChallanNo")
        .leftJoinAndSelect("secondSale.location", "location")
        .leftJoinAndSelect("secondSale.customerAddress", "customerAddress")
        .leftJoinAndSelect("secondSaleProducts.productName", "product")
        .leftJoinAndSelect("secondSaleProducts.variant", "variant")
        .leftJoinAndSelect("secondSaleProducts.saleUoM", "saleUoM")
        .leftJoinAndSelect("secondSaleProducts.packagingMaterial", "packagingMaterial")
        .select([
          "secondSale",
          "secondSaleProducts.id",
          "secondSaleProducts.quantity",
          "secondSaleProducts.unitPrice",
          "secondSaleProducts.amount",
          "secondSaleProducts.grossWeight",
          "secondSaleProducts.packingMaterialWeight",
          "secondSaleProducts.netWeight",
          "secondSaleProducts.packagingMaterialQuantity",
          "secondSaleProducts.packagingMaterialUnitPrice",
          "secondSaleProducts.packagingMaterialAmount",
          "location.id",
          "location.name",
          "companyName.id",
          "companyName.name",
          "deliveryChallanNo.id",
          "deliveryChallanNo.challanNo",
          "customerAddress.id",
          "product.id",
          "product.name",
          "variant.id",
          "variant.name",
          "saleUoM.id",
          "saleUoM.unit",
          "packagingMaterial.id",
          "packagingMaterial.name",
        ])
        .where("secondSale.id = :id", { id })
        .getOne();
      if (secondSale) await this.cacheService.set(cacheKey, secondSale, this.CACHE_TTL);
      return secondSale || null;
    } catch (error) {
      console.error("Error fetching SecondSale by ID:", error);
      throw error;
    }
  }

  public async getSecondSaleByIdForView(docId: string): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}:view:${docId}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const document = await this.docDoubleApproverService.getDocumentById(docId);
    const id = document.documentTypeId;

    if (id) {
      const secondSale = await this.secondSaleRepository
        .createQueryBuilder("secondSale")
        .leftJoinAndSelect("secondSale.secondSaleProducts", "secondSaleProducts")
        .leftJoinAndSelect("secondSale.companyName", "companyName")
        .leftJoinAndSelect("secondSale.deliveryChallanNo", "deliveryChallanNo")
        .leftJoinAndSelect("secondSale.location", "location")
        .leftJoinAndSelect("secondSale.customerAddress", "customerAddress")
        .leftJoinAndSelect("secondSaleProducts.productName", "product")
        .leftJoinAndSelect("secondSaleProducts.variant", "variant")
        .leftJoinAndSelect("secondSaleProducts.saleUoM", "saleUoM")
        .leftJoinAndSelect("secondSaleProducts.packagingMaterialUoM", "packagingMaterialUoM")
        .leftJoinAndSelect("secondSaleProducts.packagingMaterial", "packagingMaterial")
        .where("secondSale.id = :id", { id })
        .getOne();
      if (!secondSale) throw new AppError(404, "Second Sale not found");

      const rawDate = secondSale.createdAt;
      const { createdDate, createdTime } = formatDateTime(rawDate);

      const result = {
        id: secondSale?.id,
        companyName: secondSale?.companyName?.name || null,
        location: secondSale?.location?.name || null,
        deliveryChallanNo: secondSale?.deliveryChallanNo?.challanNo || null,
        saleDate: secondSale?.saleDate || null,
        createdDate,
        createdTime,
        customerName: secondSale?.customerName || null,
        customerContactNo: secondSale?.customerContactNo || null,
        customerEmail: secondSale?.customerEmail || null,
        customerAddress: secondSale?.customerAddress ? {
          id: secondSale.customerAddress.id,
          address1: secondSale.customerAddress.address1,
          address2: secondSale.customerAddress.address2,
          city: secondSale.customerAddress.city,
          state: secondSale.customerAddress.state,
          location: secondSale.customerAddress.location,
          pincode: secondSale.customerAddress.pincode,
        } : null,
        reasonForSale: secondSale?.reasonForSale || null,
        secondSaleNo: secondSale?.secondSaleNo || null,
        secondSaleProducts: secondSale?.secondSaleProducts?.map((product: any) => ({
          id: product.id,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          amount: product.amount,
          grossWeight: product.grossWeight,
          packagingMaterialWeight: product.packagingMaterialWeight,
          netWeight: product.netWeight,
          packagingMaterialQuantity: product.packagingMaterialQuantity,
          packagingMaterialUnitPrice: product.packagingMaterialUnitPrice,
          packagingMaterialAmount: product.packagingMaterialAmount,
          productName: product.productName?.name || null,
          variant: product.variant?.variantName || null,
          saleUoM: product.saleUoM?.unit || null,
          packagingMaterialUoM: product.packagingMaterialUoM?.unit || null,
          packagingMaterial: product.packagingMaterial?.packagingMaterialName || null,
        })) || [],
        totalNetWeight: secondSale?.totalNetWeight || null,
        totalGrossWeight: secondSale?.totalGrossWeight || null,
        totalAmt: secondSale?.totalAmt || null,
        totalAmtInWords: secondSale?.totalAmtInWords || null,
        paidAmount: secondSale?.paidAmount || null,
        paymentMode: secondSale?.paymentMode || null,
        pendingAmt: secondSale?.pendingAmt || null,
        remarks: secondSale?.remarks || null,
        overAllStatus: document.overAllStatus,
        createdBy: document.createdBy,
        approvalSummary: document.approvalSummary,
        documentId: document.id,
      };
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
      return result;
    }
  }



  public async getSecondSaleByIdForUpdate(id: string): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}:update:${id}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    try {
      const secondSale = await this.secondSaleRepository
        .createQueryBuilder("secondSale")
        .leftJoinAndSelect(
          "secondSale.secondSaleProducts",
          "secondSaleProducts"
        )
        .leftJoinAndSelect("secondSale.companyName", "companyName")
        .leftJoinAndSelect("secondSale.deliveryChallanNo", "deliveryChallanNo")
        .leftJoinAndSelect("secondSale.location", "location")
        .leftJoinAndSelect("secondSale.customerAddress", "customerAddress")
        .leftJoinAndSelect("secondSaleProducts.productName", "product")
        .leftJoinAndSelect("secondSaleProducts.variant", "variant")
        .leftJoinAndSelect("secondSaleProducts.saleUoM", "saleUoM")
        .leftJoinAndSelect("secondSaleProducts.packagingMaterialUoM","packagingMaterialUoM")
        .leftJoinAndSelect("secondSaleProducts.packagingMaterial", "packagingMaterial")
        .where("secondSale.id = :id", { id })
        .getOne();
      if (!secondSale) {
        throw new AppError(404, "Second Sale not found");
      }
      console.log(secondSale)
      const rawDate = secondSale.createdAt;
      const { createdDate, createdTime } = formatDateTime(rawDate);
      const formatResponse = {
        id: secondSale?.id,
        companyName: secondSale?.companyName?.id || null,
        location: secondSale?.location?.id || null,
        deliveryChallanNo: secondSale?.deliveryChallanNo?.id || null,
        saleDate: secondSale?.saleDate || null,
        createdDate,
        createdTime,
        customerName: secondSale?.customerName || null,
        customerContactNo: secondSale?.customerContactNo || null,
        customerEmail: secondSale?.customerEmail || null,
        reasonForSale: secondSale?.reasonForSale || null,
        secondSaleNo: secondSale?.secondSaleNo || null,
        customerAddress: secondSale?.customerAddress ? {
          id: secondSale.customerAddress.id,
          address1: secondSale.customerAddress.address1,
          address2: secondSale.customerAddress.address2,
          city: secondSale.customerAddress.city,
          state: secondSale.customerAddress.state,
          location: secondSale.customerAddress.location,
          pincode: secondSale.customerAddress.pincode,
          
        } : null,
        secondSaleProducts: secondSale?.secondSaleProducts?.map((product: any) => ({
          id: product.id,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          amount: product.amount,
          grossWeight: product.grossWeight,
         packagingMaterialWeight: product.packagingMaterialWeight,
          netWeight: product.netWeight,
          packagingMaterialQuantity: product.packagingMaterialQuantity,
          packagingMaterialUnitPrice: product.packagingMaterialUnitPrice,
          packagingMaterialAmount: product.packagingMaterialAmount,
          productName: product.productName?.id || null,
          variant: product.variant?.id || null,
          saleUoM: product.saleUoM?.id || null,
          packagingMaterialTotalWeight:product.packagingMaterialTotalWeight,
          packagingMaterialUoM: product.packagingMaterialUoM?.id || null,
          packagingMaterial: product.packagingMaterial?.id || null,
        })) || [],
        totalNetWeight: secondSale?.totalNetWeight || null,
        totalGrossWeight: secondSale?.totalGrossWeight || null,
        totalAmt: secondSale?.totalAmt || null,
        totalAmtInWords: secondSale?.totalAmtInWords || null,
        paidAmount: secondSale?.paidAmount || null,
        paymentMode: secondSale?.paymentMode || null,
        pendingAmt: secondSale?.pendingAmt || null,
        remarks: secondSale?.remarks || null,
      }
      console.log(secondSale)
      await this.cacheService.set(cacheKey, formatResponse, this.CACHE_TTL);
      return formatResponse || null;
    } catch (error) {
      console.error("Error fetching SecondSale by ID:", error);
      throw error;
    }
  }


  public async updateSecondSale(
    id: string,
    secondSaleData: any,
    updatedBy: string
  ): Promise<any> {

    const secondSale = await this.secondSaleRepository.findOne({
      where: { id },
    });
    console.log(secondSaleData);
    if (!secondSale) {
      return null;
    }
 
    const oldData = { ...secondSale }; // Save old data for audit log

    // Update the Second Sale entity
    Object.assign(secondSale, secondSaleData);
    const updatedSecondSale = await this.secondSaleRepository.save(secondSale);

    await this.auditLogService.logChange(
      "SecondSale",
      id,
      oldData,
      updatedSecondSale,
      updatedBy,
    );

    await this.invalidateCache(id);
    return updatedSecondSale;
  }

  // Method to delete a Second Sale document (schedule deletion 6 months later)
  public async deleteSecondSale(id: string): Promise<boolean> {
    // Step 1: Find the Second Sale by ID
    const secondSale = await this.secondSaleRepository.findOne({
      where: { id },
    });

    // Step 2: If the Second Sale doesn't exist, return false
    if (!secondSale) {
      return false;
    }

    // Step 3: Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

    // Log the scheduled deletion
    console.log(
      `Second Sale with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`
    );

    secondSale.deletionScheduledAt = sixMonthsFromNow;
    await this.secondSaleRepository.save(secondSale);
    await this.invalidateCache(id);
    return true;
  }

  public async deleteMultipleSecondSale(ids: string[]): Promise<{ success: string[]; failed: { id: string; reason: string }[]; message: string }> {
    const success: string[] = [];
    const failed: { id: string; reason: string }[] = [];
    for (const id of ids) {
      const secondSale = await this.secondSaleRepository.findOne({
        where: { id },
      });

      if (!secondSale) {
        failed.push({ id, reason: 'Second Sale not found' });
        continue;
      }

      const relatedDocument = await this.documentbRepository.findOne({
        where: { document_type_id: secondSale.id }
      });

      if (!relatedDocument) {
        throw new Error(`Something went wrong`);
      }

      await this.documentbRepository.softDelete(relatedDocument.id);
      await this.documentbRepository.update(relatedDocument.id, { isDeleted: true } as any);

      await this.secondSaleRepository.softDelete(secondSale.id);
      await this.secondSaleRepository.update(secondSale.id, { isDeleted: true } as any);

    }
    const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
    await this.invalidateCache();
    return { success, failed, message };

  }
}
