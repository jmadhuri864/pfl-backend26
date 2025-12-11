import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { PostReturnByCustomerRepository } from '../repositories/postReturnByCustomer.repository';
import { DeliveryChallanRepository } from '../repositories/deliveryChallan.repository';
import { PostReturnByCustomer } from '../entities/postReturnByCustomer.entity';
import { AppDataSource } from '../utils/data-source';
import { DeliveryChallanPurchase } from '../entities/deliveryChallan.entity';
import { ReturnedProducts } from '../entities/returnProduct.entity';
import { AuditLogService } from './auditLog.service';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import { formatDateTime } from '../utils/dateUtils';
import { DocumentTypeEnum } from '../entities/docuemnt.entity';
import { UserLogger } from '../utils/logger';
import { DocumentStatus } from '../entities/docuemnt.entity';
import { DocumentTypeEnum as DocDefEnum } from '../entities/documentdef.entity';
import { DocumentbService, DocumentWithRelatedData } from './documentb.service';
import { DocDoubleApproverService } from './docDoubleApprover.service';
import { ApprovalFlowRepository } from '../repositories/approvalFlow.repository';
import { ApprovalFlowService } from './approvalFlow.service';
import { reject } from 'lodash';
import { InventoryStockRepository } from '../repositories/inventoryStock.repository';
import { ProductVarientsRepository } from '../repositories/productVarients.repository';
import { ProductRepository } from '../repositories/product.repository';
import { ProductVarientService } from './productVarient.service';
import { DitemRepository } from '../repositories/dItem.repository';
import { ProductVarientRepository } from '../repositories/varients.repository';
import { In } from 'typeorm';

@injectable()
export class PostReturnByCustomerService {
  constructor(
    @inject(TYPES.PostReturnByCustomerRepository)
    private readonly postReturnByCustomerRepository: PostReturnByCustomerRepository,

    @inject(TYPES.DeliveryChallanRepository)
    private readonly deliveryChallanRepository: DeliveryChallanRepository,
    @inject(TYPES.AuditLogService) private auditLogService: AuditLogService,
    @inject(TYPES.DocumentbService)
    private readonly documentbService: DocumentbService,
    @inject(TYPES.ProductVarientService)
    private readonly productVarientService: ProductVarientService,
    @inject(TYPES.DocDoubleApproverService)
    private readonly docDoubleApproverService: DocDoubleApproverService,
    @inject(TYPES.ProductRepository)
    private readonly productRepository: ProductRepository,
    // @inject(TYPES.ProductVarientsRepository)
    // private readonly variantRepository: ProductVarientsRepository,
     @inject(TYPES.ProductVarientRepository)
                private productVarientsRepository: ProductVarientRepository,
    // @inject(TYPES.ApprovalFlowRepository)
    //     private approvalFlowRepo: ApprovalFlowRepository,
    @inject(TYPES.ApprovalFlowService)
    private approvalFlowService: ApprovalFlowService,
    @inject(TYPES.InventoryStockRepository)
    private readonly inventoryStockRepository: InventoryStockRepository,
    @inject(TYPES.DitemRepository)
    private readonly deliveryChallanProductRepository: DitemRepository,
  ) {}

  //TODO: Create

async createReturn(returnData: any, requestedBy: any, clientIp?: string): Promise<any> {

  // 1️⃣ Validate required input
  if (!returnData.deliveryChallanNo) {
    throw new Error('Delivery Challan number is required');
  }
returnData.isChanged=true;
  // 2️⃣ Fetch challan
  const deliveryChallan = await this.deliveryChallanRepository.findOne({
    where: { id: returnData.deliveryChallanNo },
    relations: ['deliveryChallanProducts', 'deliveryChallanProducts.variant'],
  });

  if (!deliveryChallan) {
    throw new Error('Delivery Challan not found');
  }

  // 3️⃣ Normalize variants input
  let variantIds: string[] = [];

  if (Array.isArray(returnData.variants)) {
    variantIds = returnData.variants;
  } else if (returnData.variants) {
    variantIds = [returnData.variants];
  }

  // 4️⃣ Fetch variant entities
  const variants = await this.productVarientsRepository.find({
    where: { id: In(variantIds) },
    relations: ['product'],
  });

  // 5️⃣ Extract product IDs
  const productIds = variants.map(v => v.product?.id).filter(Boolean);

  // 6️⃣ Create return entity
  const newReturn = this.postReturnByCustomerRepository.create({
    ...returnData,
    variants: variants.map(v => ({ id: v.id })),
    products: productIds.map(id => ({ id })),
  });

  // 7️⃣ Save challan & mark as returned
  deliveryChallan.isReturned = true;
  await this.deliveryChallanRepository.save(deliveryChallan);

  // 8️⃣ Save return record
  const savedNewReturn = await this.postReturnByCustomerRepository.save(newReturn);
  const savedReturnEntity = Array.isArray(savedNewReturn)
    ? savedNewReturn[0]
    : savedNewReturn;

  // 9️⃣ Create approval document
  const document = await this.documentbService.createDocument({
    type: DocumentTypeEnum.RETURN_BY_CUSTOMER,
    docDef: DocDefEnum.OPERATION,
    status: DocumentStatus.HOLD,
    remarks: 'Document auto-created with RBC',
    lastActionBy: { id: requestedBy },
    document_type_id: savedReturnEntity.id,
  });

  // 🔟 Start approval flow
  await this.documentbService.startApprovalFlow(document.id);

  // 1️⃣1️⃣ Update original challan product rows with returned & rejected qty
  await this.updateDeliveryChallanItemsWithReturns(
    returnData.deliveryChallanNo,
    savedReturnEntity.returnedProducts
  );

  // 1️⃣2️⃣ Log the creation
  UserLogger.logRfpaCreated(savedReturnEntity.id, requestedBy, clientIp);

  // 1️⃣3️⃣ Return final saved entity
  return savedReturnEntity;
}

/**
 * Update delivery challan items with return data
 * This updates the returnedQty, rejectedQty, and acceptedQty fields
 */
private async updateDeliveryChallanItemsWithReturns(
  deliveryChallanId: string,
  returnedProducts: any[]
): Promise<void> {
  const deliveryChallan = await this.deliveryChallanRepository.findOne({
    where: { id: deliveryChallanId },
    relations: [
      'deliveryChallanProducts',
      'deliveryChallanProducts.productName',
      'deliveryChallanProducts.variant',
    ],
  });

  if (!deliveryChallan) {
    console.warn(`Delivery challan ${deliveryChallanId} not found for return update`);
    return;
  }

  // Reset all return/reject quantities first for this challan
  for (const dcProduct of deliveryChallan.deliveryChallanProducts) {
    dcProduct.returnedQty = 0;
    dcProduct.rejectedQty = 0;
    dcProduct.acceptedQty = Number(dcProduct.quantity || 0);
  }

  // Update each delivery challan product with return data
  for (const dcProduct of deliveryChallan.deliveryChallanProducts) {
    // Find matching returned products
    const matchingReturns = returnedProducts.filter(rp => {
      const rpProductId = typeof rp.productName === 'object' ? rp.productName.id : rp.productName;
      const rpVariantId = typeof rp.variant === 'object' ? rp.variant?.id : rp.variant;
      
      return (
        rpProductId === dcProduct.productName?.id &&
        (rpVariantId === dcProduct.variant?.id || (!rpVariantId && !dcProduct.variant))
      );
    });

    if (matchingReturns.length > 0) {
      // Aggregate return values
      const totalReturnedQty = matchingReturns.reduce(
        (sum, rp) => sum + Number(rp.returnedQty || 0), 0
      );
      const totalRejectedQty = matchingReturns.reduce(
        (sum, rp) => sum + Number(rp.rejectedQty || 0), 0
      );

      // Update the delivery challan product
      dcProduct.returnedQty = totalReturnedQty;
      dcProduct.rejectedQty = totalRejectedQty;
      
      // Calculate accepted quantity (original quantity - returned - rejected)
      const originalQty = Number(dcProduct.quantity || 0);
      dcProduct.acceptedQty = originalQty - totalReturnedQty - totalRejectedQty;

      console.log(`✅ Updated DC product ${dcProduct.productName?.name}: ${totalReturnedQty} returned, ${totalRejectedQty} rejected`);
    }

    // Save the updated product
    await this.deliveryChallanProductRepository.save(dcProduct);
  }
}


  //TODO: Get all RBC
  async getAllPostReturnByCustomer(
    queryOptions: PaginationOptions,
    userId: any,
  ): Promise<any> {
    const { data, meta } =
      await this.docDoubleApproverService.getAllDocumentByUserIdForDoubleApprover(
        userId,
        DocumentTypeEnum.RETURN_BY_CUSTOMER,
        queryOptions,
      );

        const { search } = queryOptions;
    //console.log("Fetched documents:", data);
    const typedDocuments = data as DocumentWithRelatedData[];

    // for (const doc of typedDocuments) {
    //   if (!doc.document_type_id) continue;
    //   try {
    //     doc.relatedData = await this.postReturnByCustomerRepository.findOne({
    //       where: { id: doc.relatedData.id },
    //     })
    //     //console.log("Related data for document ID", doc.id, ":", doc.relatedData);
    //   } catch (error) {
    //     doc.relatedData = null;
    //   }
    // }
    //console.log("Typed documents with related data:", typedDocuments);

    for (const doc of typedDocuments) {
      if (!doc.document_type_id) continue;
      // console.log(doc.document_type_id)
      //   const relatedId = typeof doc.relatedData === 'object' ? doc.relatedData?.id : doc.relatedData;

      //   if (!relatedId) {
      //     doc.relatedData = null;
      //     continue;
      //   }

      try {
        doc.relatedData = await this.postReturnByCustomerRepository.findOne({
          where: { id: doc.document_type_id },
          relations: [
            'companyName',
            'returnedProducts',
            'deliveryChallanNo',
            'returnedProducts.productName',
            'returnedProducts.saleUoM',
          ], // Include if you need nested fields
        });
      } catch (error) {
        console.error(
          `Error fetching relatedData for document ${doc.id}:`,
          error,
        );
        doc.relatedData = null;
      }
    }

    let relatedDataOnly = typedDocuments
      .filter((doc) => doc.relatedData)
      .map((doc) => ({
        documentId: doc.id,
        overAllStatus: doc.status,
        createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
        createdDate: formatDateTime(doc.createdAt).createdDate,
        createdTime: formatDateTime(doc.createdAt).createdTime,
        ...doc.relatedData,
        date: formatDateTime(doc.relatedData.date).createdDate,
        companyName: doc.relatedData.companyName.name || null,
        //location: doc.relatedData.location.name || null,
        deliveryChallanNo: doc.relatedData.deliveryChallanNo?.challanNo || null,
      }));
    //console.log("filtered related data:", relatedDataOnly);
     // 🔍 Deep search across nested values
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj).map((v) => objectToString(v)).join(' ');
    }
    return String(obj);
  };

  if (search && search.trim()) {
    const term = search.toLowerCase();
    relatedDataOnly = relatedDataOnly.filter((item) =>
      objectToString(item).toLowerCase().includes(term)
    );
  }

    return {
      data: relatedDataOnly,
      meta: {
        total: meta.total,
        page: meta.page,
        pages: meta.pages,
      },
    };




  }

  async getByIdPostReturnByCustomerforView(docid: string): Promise<any> {
    const document1 = await this.docDoubleApproverService.getDocumentById(
      docid,
    );
    if (!document1) {
      throw new Error(`Document with ID ${docid} not found`);
    }
    console.log('document....', document1);
    const relatedId = document1.documentTypeId;
    console.log('relatedId:', relatedId);
    const id = relatedId;
    const result = await this.postReturnByCustomerRepository
      .createQueryBuilder('postReturn')
      .leftJoinAndSelect('postReturn.companyName', 'company')
      .leftJoinAndSelect('postReturn.location', 'location')
      .leftJoinAndSelect('postReturn.deliveryChallanNo', 'deliveryChallanNo')
      .leftJoinAndSelect('postReturn.returnedProducts', 'returnedProduct')
      .leftJoinAndSelect('returnedProduct.productName', 'product')
      .leftJoinAndSelect('returnedProduct.variant','variant')
      .leftJoinAndSelect('returnedProduct.saleUoM', 'saleUoM')
      .leftJoinAndSelect('postReturn.customerName', 'customerName')

      .where('postReturn.id = :id', { id })
      .getOne();

    if (!result) {
      throw new Error(`PostReturnByCustomer with ID ${id} not found`);
    }
    const rawDate = result.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);
    const date = formatDateTime(result.date);
    return {
      id: result.id,

      companyName: result.companyName?.name,
      customerName: result.customerName?.organisationName,
      location: result.location?.name || null,
      //  ? {
      //   id: result.companyName.id,
      //   companyName: result.companyName.name,
      // } : null,
      date: date.createdDate,
      createdDate,
      createdTime,

      deliveryChallanNo: result.deliveryChallanNo?.challanNo,
      // ? {
      //   id: result.deliveryChallanNo.id,
      //   deliveryChallanNo: result.deliveryChallanNo.challanNo
      // } : null,

      remark: result.remark,

      returnedProducts: result.returnedProducts.map((returnedProduct) => ({
        productName: returnedProduct.productName?.name,
        variant:returnedProduct.variant?.variantName,
        saleUoM: returnedProduct.saleUoM?.unit || null,
        returnedQty: returnedProduct.returnedQty,
        returnedQtyAmt: returnedProduct.returnedQtyAmt,
        rejectedQty: returnedProduct.rejectedQty,
        rejectedQtyAmt: returnedProduct.rejectedQtyAmt,
        returnedNetWt: returnedProduct.returnedNetWt,
        returnedPackingMaterialWt: returnedProduct.returnedPackingMaterialWt,
        returnedGrossWt: returnedProduct.returnedGrossWt,
        rejectedNetWt: returnedProduct.rejectedNetWt,
        rejectedGrossWt: returnedProduct.rejectedGrossWt,
        rejectedPackingMaterialWt: returnedProduct.rejectedPackingMaterialWt,
        unitPrice: returnedProduct.unitPrice,
        documentId: document1.documentId,
        overAllStatus: document1.status,
        createdBy: document1.createdBy,
        createdDate: formatDateTime(document1.createdAt).createdDate,
        createdTime: formatDateTime(document1.createdAt).createdTime,
        approvalSummary: document1.approvalSummary,
      })),
    };
  }

  async getByIdPostReturnByCustomerforupdate(docid: string): Promise<any> {
    const document1 = await this.docDoubleApproverService.getDocumentById(
      docid,
    );
    if (!document1) {
      throw new Error(`Document with ID ${docid} not found`);
    }
    console.log('document....', document1);
    const relatedId = document1.documentTypeId;
    console.log('relatedId:', relatedId);
    const id = relatedId;
    const result = await this.postReturnByCustomerRepository
      .createQueryBuilder('postReturn')
      .leftJoinAndSelect('postReturn.companyName', 'company')
      .leftJoinAndSelect('postReturn.location', 'location')
      .leftJoinAndSelect('postReturn.deliveryChallanNo', 'deliveryChallanNo')
      .leftJoinAndSelect('postReturn.returnedProducts', 'returnedProduct')
      .leftJoinAndSelect('returnedProduct.productName', 'product')
      .leftJoinAndSelect('returnedProduct.variant','variant')
      .leftJoinAndSelect('returnedProduct.saleUoM', 'saleUoM')
      .leftJoinAndSelect('postReturn.customerName', 'customerName')

      .where('postReturn.id = :id', { id })
      .getOne();

    if (!result) {
      throw new Error(`PostReturnByCustomer with ID ${id} not found`);
    }
    const rawDate = result.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);
    const date = formatDateTime(result.date);
    return {
      id: result.id,

      companyName: result.companyName?.id,
      //  ? {
      //   id: result.companyName.id,
      //   companyName: result.companyName.name,
      // } : null,
      customerName: result.customerName?.id,
      date: date.createdDate,
      createdDate,
      createdTime,
      location: result.location?.id,
      deliveryChallanNo: result.deliveryChallanNo?.id,
      // ? {
      //   id: result.deliveryChallanNo.id,
      //   deliveryChallanNo: result.deliveryChallanNo.challanNo
      // } : null,

      remark: result.remark,

      returnedProducts: result.returnedProducts.map((returnedProduct) => ({
        productName: returnedProduct.productName?.id,
        variant:returnedProduct.variant?.id,
        saleUoM: returnedProduct.saleUoM?.id || null,
        returnedQty: returnedProduct.returnedQty,
        returnedQtyAmt: returnedProduct.returnedQtyAmt,
        rejectedQty: returnedProduct.rejectedQty,
        rejectedQtyAmt: returnedProduct.rejectedQtyAmt,
        returnedNetWt: returnedProduct.returnedNetWt,
        returnedPackingMaterialWt: returnedProduct.returnedPackingMaterialWt,
        returnedGrossWt: returnedProduct.returnedGrossWt,
        rejectedNetWt: returnedProduct.rejectedNetWt,
        rejectedGrossWt: returnedProduct.rejectedGrossWt,
        rejectedPackingMaterialWt: returnedProduct.rejectedPackingMaterialWt,
        unitPrice: returnedProduct.unitPrice,
        documentId: document1.documentId,
        overAllStatus: document1.status,
        createdBy: document1.createdBy,
        createdDate: formatDateTime(document1.createdAt).createdDate,
        createdTime: formatDateTime(document1.createdAt).createdTime,
        approvalSummary: document1.approvalSummary,
      })),
    };
  }

  async getByIdPostReturnByCustomer(id: string): Promise<any> {
    const result = await this.postReturnByCustomerRepository
      .createQueryBuilder('postReturn')
      .leftJoinAndSelect('postReturn.companyName', 'company')
      .leftJoinAndSelect('postReturn.deliveryChallanNo', 'deliveryChallanNo')
      .leftJoinAndSelect('postReturn.returnedProducts', 'returnedProduct')
      .leftJoinAndSelect('returnedProduct.productName', 'product')
      .leftJoinAndSelect('returnedProduct.variant','variant')
      .leftJoinAndSelect('returnedProduct.saleUoM', 'saleUoM')

      .where('postReturn.id = :id', { id })
      .getOne();

    if (!result) {
      throw new Error(`PostReturnByCustomer with ID ${id} not found`);
    }
    const rawDate = result.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);
    const date = formatDateTime(result.date);
    return {
      id: result.id,

      companyName: result.companyName?.name,
      //  ? {
      //   id: result.companyName.id,
      //   companyName: result.companyName.name,
      // } : null,
      date: date.createdDate,
      createdDate,
      createdTime,

      deliveryChallanNo: result.deliveryChallanNo?.challanNo,
      // ? {
      //   id: result.deliveryChallanNo.id,
      //   deliveryChallanNo: result.deliveryChallanNo.challanNo
      // } : null,

      remark: result.remark,

      returnedProducts: result.returnedProducts.map((returnedProduct) => ({
        productName: returnedProduct.productName?.name,
        saleUoM: returnedProduct.saleUoM?.unit || null,
        returnedQty: returnedProduct.returnedQty,
        returnedQtyAmt: returnedProduct.returnedQtyAmt,
        rejectedQty: returnedProduct.rejectedQty,
        rejectedQtyAmt: returnedProduct.rejectedQtyAmt,
        returnedNetWt: returnedProduct.returnedNetWt,
        returnedPackingMaterialWt: returnedProduct.returnedPackingMaterialWt,
        returnedGrossWt: returnedProduct.returnedGrossWt,
        rejectedNetWt: returnedProduct.rejectedNetWt,
        rejectedGrossWt: returnedProduct.rejectedGrossWt,
        rejectedPackingMaterialWt: returnedProduct.rejectedPackingMaterialWt,

        unitPrice: returnedProduct.unitPrice,
      })),
    };
  }
  async updatePostReturnByCustomer(
    id: string,
    returnData: any,
    updatedBy: string,
    clientIp?: string,
  ): Promise<any> {
    const postReturn = await this.postReturnByCustomerRepository.findOne({
      where: { id },
      relations: [
        'companyName',
        'deliveryChallanNo',
        'proformaInvNo',
        'returnedProducts',
        'returnedProducts.productName',
        'returnedProducts.returnedUOM',
      ],
    });

    if (!postReturn) {
      throw new Error(`PostReturnByCustomer with ID ${id} not found`);
    }

    const oldData = { ...postReturn };

    if (returnData?.returnedProducts) {
      for (const updatedProduct of returnData.returnedProducts) {
        const existingProduct = postReturn.returnedProducts.find(
          (p) => p.id === updatedProduct.id,
        );
        if (existingProduct) {
          Object.assign(existingProduct, updatedProduct);
        }
      }
    }

    // Update main entity fields
    Object.assign(postReturn, returnData);

    // Save updated entity
    const updatedPostReturn = await this.postReturnByCustomerRepository.save(
      postReturn,
    );

    // Update delivery challan items with new return/reject quantities
    if (postReturn.deliveryChallanNo?.id) {
      await this.updateDeliveryChallanItemsWithReturns(
        postReturn.deliveryChallanNo.id,
        updatedPostReturn.returnedProducts
      );
    }

    // Log the update
    UserLogger.logRfpaUpdated(id, updatedBy, clientIp);

    return updatedPostReturn;
  }

  // Helper method to extract user ID consistently
  private extractUserId(user: any): string {
    if (typeof user === 'string') {
      return user;
    }
    if (user && typeof user === 'object') {
      return user.id || user.userId || 'System';
    }
    return 'System';
  }

  // Admin functionality: Get audit logs for a specific user
  async getAuditLogsForUser(
    userId: string,
    options?: {
      entityName?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    }
  ): Promise<any> {
    if (options?.entityName && options?.startDate && options?.endDate) {
      // Filter by entity and date range
      return this.auditLogService.getLogsByUserAndDateRange(
        userId,
        options.startDate,
        options.endDate
      );
    } else if (options?.entityName) {
      // Filter by entity type
      return this.auditLogService.getLogsByUserAndEntity(userId, options.entityName);
    } else if (options?.page && options?.limit) {
      // Paginated results
      return this.auditLogService.getLogsByUserWithPagination(
        userId,
        options.page,
        options.limit
      );
    } else {
      // All logs for user
      return this.auditLogService.getLogsByUser(userId);
    }
  }

  // Admin functionality: Get comprehensive user activity report
  async getUserActivityReport(userId: string): Promise<any> {
    return this.auditLogService.getUserActivityReport(userId);
  }

  // Admin functionality: Get all users who have made changes to PostReturnByCustomer
  async getUsersWithReturnChanges(): Promise<{ userId: string; changeCount: number }[]> {
    const allLogs = await this.auditLogService.getAllLogs();
    
    // Filter logs for PostReturnByCustomer entity
    const returnLogs = allLogs.filter(log => log.entityName === 'PostReturnByCustomer');
    
    // Group by user and count changes
    const userChanges: Record<string, number> = {};
    returnLogs.forEach(log => {
      userChanges[log.updatedBy] = (userChanges[log.updatedBy] || 0) + 1;
    });

    return Object.entries(userChanges).map(([userId, changeCount]) => ({
      userId,
      changeCount
    })).sort((a, b) => b.changeCount - a.changeCount); // Sort by most active users
  }
}
