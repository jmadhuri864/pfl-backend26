import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { StockTransferDeliveryChallanRepository } from '../repositories/stockTransferDeliveryChallan.repository';
import logger from '../utils/logger';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import { formatDateTime } from '../utils/dateUtils';
import { DocumentTypeEnum } from '../entities/docuemnt.entity';
import { DocumentStatus } from '../entities/docuemnt.entity';
import { DocumentTypeEnum as DocDefEnum } from '../entities/documentdef.entity';
import { DocumentbService, DocumentWithRelatedData } from './documentb.service';
import { StockTransferDeliveryChallan } from '../entities/stockTransferdeliveryChallan.entity';
import { DocDoubleApproverService } from './docDoubleApprover.service';
import { DeliveryChallanService } from './deliveryChallan.service';
import { ApprovalFlowService } from './approvalFlow.service';
import { ProductVarientsRepository } from '../repositories/productVarients.repository';
import { ProductVarientService } from './productVarient.service';
import { ProductRepository } from '../repositories/product.repository';
import { InventoryStockRepository } from '../repositories/inventoryStock.repository';
import { DitemRepository } from '../repositories/dItem.repository';
import { custom } from 'zod';
import { DocumentbRepository } from '../repositories/documentb.repository';
import { DataSource, In } from 'typeorm';
import { CustomerDeliveryChallanService } from './customerDeliveryChallan.service';
import { CacheService } from './cache.service';


@injectable()
export class StockTransferDeliveryChallanService {
  constructor(
    @inject(TYPES.StockTransferDeliveryChallanRepository)
    private readonly challanRepository: StockTransferDeliveryChallanRepository,
    @inject(TYPES.DocumentbService)
            private readonly documentbService: DocumentbService,
            @inject(TYPES.DocDoubleApproverService)
                private readonly docDoubleApproverService: DocDoubleApproverService,
                @inject(TYPES.DeliveryChallanService)
                private readonly deliveryChallanService: DeliveryChallanService,
                @inject(TYPES.ApprovalFlowService)
    private approvalFlowService: ApprovalFlowService,
    @inject(TYPES.ProductVarientsRepository)
        private readonly variantRepository: ProductVarientsRepository,
        @inject(TYPES.ProductVarientService)
        private readonly productVarientService: ProductVarientService,
          @inject(TYPES.InventoryStockRepository)
            private readonly inventoryStockRepository: InventoryStockRepository,
            @inject(TYPES.DitemRepository)
            private readonly deliveryChallanProductRepository: DitemRepository,
            @inject(TYPES.DocumentbRepository)
            private readonly documentbRepository: DocumentbRepository,
        @inject(TYPES.CustomerDeliveryChallanService)
    private readonly customerDeliveryChallanService:CustomerDeliveryChallanService,
        @inject(TYPES.ProductRepository)
        private readonly productRepository: ProductRepository,
        @inject(TYPES.DataSource)
        private readonly dataSource: DataSource,
        @inject(TYPES.CacheService)
        private readonly cacheService: CacheService,
  ) {}

  private readonly CACHE_PREFIX = 'stockTransferChallan';
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

 async create(data: any, requestedBy: any): Promise<any> {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 1. Approval flow check
    // const approvalFlowExit =
    //   await this.approvalFlowService.findApprovalFlowForLoggedUser(
    //     requestedBy,
    //     'DC_TYPE_STOCK_TRANSFER'
    //   );

    // if (!approvalFlowExit) {
    //   throw new Error('Approval flow not found for user');
    // }

    data.challanNo = await this.customerDeliveryChallanService.generateVoucherNo(data.type || 'S');

    // 3. Save challan
    const challan = queryRunner.manager.create(this.challanRepository.target, data);
    const savedChallanArr = await queryRunner.manager.save(challan);
    const savedChallan = Array.isArray(savedChallanArr)
      ? savedChallanArr[0]
      : savedChallanArr;

    // 4. Create document
    const document = await this.documentbService.createDocument({
      type: DocumentTypeEnum.DC_TYPE_STOCK_TRANSFER,
      docDef: DocDefEnum.OPERATION,
      status: DocumentStatus.HOLD,
      remarks: 'Document auto-created with Stock Transfer Challan',
      lastActionBy: { id: requestedBy },
      document_type_id: savedChallan.id,
    });

    // 5. Reload challan with full relations
    const challanFull = await queryRunner.manager.findOne(this.challanRepository.target, {
      where: { id: savedChallan.id },
      relations: [
        'deliveryChallanProducts',
        'fromLocation',
        'toLocation',
        'companyName',
      ],
    });

    if (!challanFull) return null;

    // -------------------------------------------------------------------
    // 6. STOCK OUT (ONLY FROM LOCATION)
    // -------------------------------------------------------------------

    for (const item of challanFull.deliveryChallanProducts) {
      const { netWeight, amount, variant } = item;

      const deliveredQty = Number(netWeight ?? 0);
      const deliveredAmt = Number(amount ?? 0);

      const variantId = typeof variant === 'object' ? variant.id : variant;

      // Fetch variant + product (CORRECT ENTITY RELATION)
      const foundVariant = await queryRunner.manager.findOne(this.variantRepository.target, {
        where: { id: variantId },
        relations: ['product'], // VALID RELATION
      });

      if (!foundVariant) {
        throw new Error(`Variant not found: ${variantId}`);
      }

      const productId = foundVariant.product?.id;

      if (!productId) {
        throw new Error(`Product not found for variant: ${variantId}`);
      }

      // -------------------------------------------------------------------
      // OUTWARD STOCK (reduce from FROM location)
      // -------------------------------------------------------------------
      let fromStock = await queryRunner.manager.findOne(this.inventoryStockRepository.target, {
        where: {
          company: { id: challanFull.companyName.id },
          location: { id: challanFull.fromLocation.id },
          product: { id: productId },
          variant: { id: variantId },
        },
      });

      if (fromStock) {
        // Reduce stock
        fromStock.inwardQty = Number(fromStock.inwardQty) - deliveredQty;
        fromStock.inwardAmt = Number(fromStock.inwardAmt) - deliveredAmt;

        await queryRunner.manager.save(fromStock);
      } else {
        // No stock exists → create negative (outward movement)
        fromStock = queryRunner.manager.create(this.inventoryStockRepository.target, {
          company: { id: challanFull.companyName.id },
          location: { id: challanFull.fromLocation.id },
          product: { id: productId },
          variant: { id: variantId },
          inwardQty: -deliveredQty,
          inwardAmt: -deliveredAmt,
        });

        await queryRunner.manager.save(fromStock);
      }

      // ----------------------------------------------------------
      // ❌ TO-LOCATION STOCK INCREASE REMOVED (As per your code)
      // ----------------------------------------------------------
    }

    // Commit transaction - all operations succeeded
    await queryRunner.commitTransaction();

    // Start approval flow after commit so challan is visible to other DB connections
    await this.documentbService.startApprovalFlow(document.id);

    await this.invalidateCache();
    return savedChallan;
  } catch (error) {
    // Rollback transaction - undo all changes
    await queryRunner.rollbackTransaction();
    console.error('Error creating Stock Transfer:', error);
    throw error;
  } finally {
    // Release query runner
    await queryRunner.release();
  }
}

  async getById(id: string): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}:id:${id}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.challanRepository.findOne({
        where: { id },
        relations: [
          'deliveryChallanProducts',
          'deliveryChallanProducts.productName',
          'deliveryChallanProducts.packagingMaterial',
          'deliveryChallanProducts.packagingMaterialUoM',
          'deliveryChallanProducts.saleUoM',
          'companyName',
          'offices',
          'grnNo',
          'fromLocation',
          'toLocation',
        ],
      });
      if (result) await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (err) {
      logger.error(`Error fetching stock transfer challan by ID: ${id}`, { error: err });
      return null;
    }
  }
  async getByIdChallanforUpdate(id: string): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}:update:${id}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    try {
      const challan = await this.challanRepository
        .createQueryBuilder('challan')
        .leftJoinAndSelect('challan.deliveryChallanProducts', 'products')
        .leftJoinAndSelect('products.productName', 'productName')
        .leftJoinAndSelect('products.variant', 'variant')
        .leftJoinAndSelect('products.uom', 'uom')
        .leftJoinAndSelect('products.packagingMaterial', 'packagingMaterial')
        .leftJoinAndSelect(
          'products.packagingMaterialUoM',
          'packagingMaterialUoM',
        )
        .leftJoinAndSelect('products.saleUoM', 'saleUoM')
        .leftJoinAndSelect('challan.companyName', 'company')
        .leftJoinAndSelect('challan.offices', 'office')
        .leftJoinAndSelect('challan.grnNo', 'grn')
        .leftJoinAndSelect('challan.fromLocation', 'fromLocation')
        .leftJoinAndSelect('challan.toLocation', 'toLocation')
        .where('challan.id = :id', { id })
        .getOne();

      if (!challan) {
        logger.warn(`No stock transfer challan found with ID: ${id}`);
        return null;
      }
      const { createdDate, createdTime } = formatDateTime(challan.createdAt);

      const formattedChallan = {
        id: challan.id,
        challanNo: challan.challanNo,
        stockTransferType: challan.stockTransferType,
        companyName: challan.companyName?.id || null,
        office: challan.offices?.id || null,
        grnNo: challan.grnNo?.id || null,
        fromLocation: challan.fromLocation?.id || null,
        toLocation: challan.toLocation?.id || null,
        driverName: challan.driverName,
        contactNo: challan.contactNo,
        altContactNo: challan.altContactNo,
        vehicleNo: challan.vehicleNo,
        licenseNo: challan.licenseNo,
        receiverName: challan.receiverName,
        totalProductAmount: challan.totalProductAmount,
        netProductWeight: challan.netProductWeight,
        netPackagingMaterialWeight: challan.netPackagingMaterialWeight,
        totalPackagingMaterialAmount: challan.totalPackagingMaterialAmount,
        totalAmtInWords: challan.totalAmtInWords,
        transitInsuranceNo:challan.transitInsuranceNo,
        rmn: challan.rmn || null,
        createdDate,
        createdTime,
        requestingDepartment: challan.requestingDepartment,
        approvalStatus: challan.approvalStatus,
        remark: challan.remark,
        anyAttachment: challan.anyAttachment,
        deliveryChallanProducts: challan.deliveryChallanProducts.map(
          (product) => ({
            id: product.id,
            productName: product.productName?.id,
            variant: product.variant?.id || null,
            uom: product.uom?.id || null,
            quantity: product.quantity,
            unitPrice: product.unitPrice,
            amount: product.amount,
            grossWeight: product.grossWeight,
            packingMaterialWeight: product.packingMaterialWeight,
            netWeight: product.netWeight,
            saleUoM: product.saleUoM?.id || null,
            packagingMaterialp: product.packagingMaterial?.id || null,
            packagingMaterialUoM: product.packagingMaterialUoM?.id || null,
            packagingMaterialAmount: product.packagingMaterialAmount,
            packagingMaterialUnitPrice: product.packagingMaterialUnitPrice,
            packagingMaterialQuantity: product.packagingMaterialQuantity,
            packagingMaterialTotalWeight: product.packagingMaterialTotalWeight,
          }),
        ),
      };
      await this.cacheService.set(cacheKey, formattedChallan, this.CACHE_TTL);
      return formattedChallan;
    } catch (err) {
      logger.error(
        `Error fetching stock transfer challan for update by ID: ${id}`,
        { error: err },
      );
      return null;
    }
  }
public async deleteMultipleDCForStockTransfer(ids: string[]): Promise<{ success: string[]; failed: { id: string; reason: string }[]; message: string }> {
  const success: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      const dcForStockTransfer = await this.challanRepository.findOne({
        where: { id },
      });
      if (!dcForStockTransfer) {
        failed.push({ id, reason: 'DC for Stock Transfer not found' });
        continue;
      }
      const relatedDocument = await this.documentbRepository.findOne({
        where: { document_type_id: dcForStockTransfer.id }
      });

      if (relatedDocument) {
        await this.documentbRepository.softDelete(relatedDocument.id);
        await this.documentbRepository.update(relatedDocument.id, { isDeleted: true } as any);
      }

      await this.challanRepository.softDelete(dcForStockTransfer.id);
      await this.challanRepository.update(dcForStockTransfer.id, { isDeleted: true } as any);
      await this.invalidateCache(id);
      success.push(id);
    } catch (error: any) {
      failed.push({ id, reason: error.message || 'Unknown error' });
    }
  }
  const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
  await this.invalidateCache();
  return { success, failed, message };
}
  async getByIdChallanforView(docId: string): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}:view:${docId}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    try {
       const document = await this.docDoubleApproverService.getDocumentById(docId);
      const id = document.documentTypeId;

      if(id) {
      const challan = await this.challanRepository
        .createQueryBuilder('challan')
        .leftJoinAndSelect('challan.deliveryChallanProducts', 'products')
        .leftJoinAndSelect('products.productName', 'productName')
        .leftJoinAndSelect('products.variant', 'variant')
        .leftJoinAndSelect('products.packagingMaterial', 'packagingMaterial')
        .leftJoinAndSelect(
          'products.packagingMaterialUoM',
          'packagingMaterialUoM',
        )
        // .leftJoinAndSelect('challan.documentApproval', 'documentApproval')
        // .leftJoinAndSelect('documentApproval.documentdef', 'documentdef')
        .leftJoinAndSelect('products.saleUoM', 'saleUoM')
        .leftJoinAndSelect('challan.companyName', 'company')
        .leftJoinAndSelect('challan.offices', 'office')
        .leftJoinAndSelect('challan.grnNo', 'grn')
        .leftJoinAndSelect('challan.fromLocation', 'fromLocation')
        .leftJoinAndSelect('challan.toLocation', 'toLocation')
        .where('challan.id = :id', { id })
        .getOne();

      if (!challan) {
        logger.warn(`No stock transfer challan found with ID: ${id}`);
        return null;
      }
      const { createdDate, createdTime } = formatDateTime(challan.createdAt);

      const formattedChallan = {
        id: challan.id,
        challanNo: challan.challanNo,
        stockTransferType: challan.stockTransferType,
        companyName: challan.companyName?.name || null,
        transitInsuranceNo:challan.transitInsuranceNo,
        office: challan.offices?.name || null,
        grnNo: challan.grnNo?.grnNo || null,
        fromLocation: challan.fromLocation?.name || null,
        toLocation: challan.toLocation?.name || null,
        driverName: challan.driverName,
        contactNo: challan.contactNo,
        altContactNo: challan.altContactNo,
        vehicleNo: challan.vehicleNo,
        licenseNo: challan.licenseNo,
        receiverName: challan.receiverName,
        totalProductAmount: challan.totalProductAmount,
        netProductWeight: challan.netProductWeight,
        netPackagingMaterialWeight: challan.netPackagingMaterialWeight,
        totalPackagingMaterialAmount: challan.totalPackagingMaterialAmount,
        totalAmtInWords: challan.totalAmtInWords,
        createdDate,
        createdTime,
        
        requestingDepartment: challan.requestingDepartment,
        //approvalStatus: challan.approvalStatus,
        remark: challan.remark,
        anyAttachment: challan.anyAttachment,
        deliveryChallanProducts: challan.deliveryChallanProducts.map(
          (product) => ({
            id: product.id,
            productName: product.productName?.name,
            variant:product.variant?.variantName,
            quantity: product.quantity,
            unitPrice: product.unitPrice,
            amount: product.amount,
            grossWeight:product.grossWeight,
            netWeight:product.netWeight,
             packingMaterialWeight: product.packingMaterialWeight,
            saleUoM: product.saleUoM?.unit || null,
            packingMaterial:
              product.packagingMaterial?.packagingMaterialName || null,
            packagingMaterialUoM: product.packagingMaterialUoM?.unit || null,
            packagingMaterialAmount: product.packagingMaterialAmount,
            packagingMaterialUnitPrice: product.packagingMaterialUnitPrice,
            packagingMaterialQuantity: product.packagingMaterialQuantity,
            packagingMaterialTotalWeight: product.packagingMaterialTotalWeight,
          }),
        ),

        overAllStatus: document.overAllStatus,
        createdBy: document.createdBy,
        approvalSummary: document.approvalSummary,
        documentId: document.id,
      };
      await this.cacheService.set(cacheKey, formattedChallan, this.CACHE_TTL);
      return formattedChallan;
      }
    } catch (err) {
      logger.error(
        `Error fetching stock transfer challan for update by ID: ${docId}`,
        { error: err },
      );
      return null;
    }
  }

  async getAll(queryOptions: PaginationOptions, userId: any): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}:list:${userId}:${JSON.stringify(queryOptions)}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const { data, meta } = await this.docDoubleApproverService.getAllDocumentByUserIdForDoubleApprover(
      userId,
      DocumentTypeEnum.DC_TYPE_STOCK_TRANSFER,
      queryOptions,
    );

    const typedDocuments = data as DocumentWithRelatedData[];
    const activeDocuments = typedDocuments
      .filter(doc => doc.isDeleted === false)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // ---- Batch fetch: one query instead of N+1 ----
    const challanIds = activeDocuments
      .map(doc => doc.document_type_id)
      .filter(Boolean) as string[];

    const challans = challanIds.length
      ? await this.challanRepository
          .createQueryBuilder('challan')
          .leftJoinAndSelect('challan.companyName', 'companyName')
          .leftJoinAndSelect('challan.fromLocation', 'fromLocation')
          .leftJoinAndSelect('challan.toLocation', 'toLocation')
          .where('challan.id IN (:...ids)', { ids: challanIds })
          .andWhere('challan.isDeleted = false')
          .andWhere('challan.deletedAt IS NULL')
          .getMany()
      : [];

    const challanMap = new Map(challans.map(c => [c.id, c]));

    const relatedDataOnly = activeDocuments
      .filter(doc => doc.document_type_id && challanMap.has(doc.document_type_id))
      .map((doc) => {
        const rd: any = challanMap.get(doc.document_type_id!)!;
        return {
          documentId: doc.id,
          overAllStatus: doc.status,
          createdBy: doc.lastActionBy?.firstName + ' ' + doc.lastActionBy?.lastName,
          createdDate: formatDateTime(doc.createdAt).createdDate,
          createdTime: formatDateTime(doc.createdAt).createdTime,
          id: rd.id,
          challanNo: rd.challanNo,
          transitInsuranceNo: rd.transitInsuranceNo || null,
          totalProductAmount: rd.totalProductAmount,
          netProductWeight: rd.netProductWeight,
          netPackagingMaterialWeight: rd.netPackagingMaterialWeight,
          totalPackagingMaterialAmount: rd.totalPackagingMaterialAmount,
          totalAmtInWords: rd.totalAmtInWords,
          driverName: rd.driverName,
          contactNo: rd.contactNo,
          altContactNo: rd.altContactNo || null,
          vehicleNo: rd.vehicleNo,
          licenseNo: rd.licenseNo,
          rmn: rd.rmn || null,
          receiverName: rd.receiverName,
          anyAttachment: rd.anyAttachment || null,
          remark: rd.remark || null,
          requestingDepartment: rd.requestingDepartment || null,
          approvalStatus: rd.approvalStatus || null,
          stockTransferType: rd.stockTransferType || null,
          companyName: rd.companyName?.name || null,
          fromLocation: rd.fromLocation?.name || null,
          toLocation: rd.toLocation?.name || null,
        };
      });

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
        totalPages: meta.pages,
      },
    };

    await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  async update(id: string, data: any): Promise<any> {
    try {
      const challan = await this.challanRepository.findOne({ where: { id } });
      if (!challan) return null;

      Object.assign(challan, data);
      const saved = await this.challanRepository.save(challan);
      await this.invalidateCache(id);
      return saved;
    } catch (err) {
      logger.error(`Error updating stock transfer challan with ID: ${id}`, {
        error: err,
      });
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.challanRepository.delete(id);
      if (result.affected !== 0) await this.invalidateCache(id);
      return result.affected !== 0;
    } catch (err) {
      logger.error(`Error deleting stock transfer challan with ID: ${id}`, {
        error: err,
      });
      return false;
    }
  }
}
