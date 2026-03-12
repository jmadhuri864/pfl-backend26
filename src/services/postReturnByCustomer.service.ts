import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { PostReturnByCustomerRepository } from '../repositories/postReturnByCustomer.repository';
import { DeliveryChallanRepository } from '../repositories/deliveryChallan.repository';
import { AuditLogService } from './auditLog.service';
import { PaginationOptions } from '../utils/pagination';
import { formatDateTime } from '../utils/dateUtils';
import { DocumentTypeEnum } from '../entities/docuemnt.entity';
import { UserLogger } from '../utils/logger';
import { DocumentStatus } from '../entities/docuemnt.entity';
import { DocumentTypeEnum as DocDefEnum } from '../entities/documentdef.entity';
import { DocumentbService, DocumentWithRelatedData } from './documentb.service';
import { DocDoubleApproverService } from './docDoubleApprover.service';
import { DataSource } from 'typeorm';

@injectable()
export class PostReturnByCustomerService {
  constructor(
    @inject(TYPES.PostReturnByCustomerRepository)
    private readonly postReturnByCustomerRepository: PostReturnByCustomerRepository,
    @inject(TYPES.DeliveryChallanRepository)
    private readonly deliveryChallanRepository: DeliveryChallanRepository,
    @inject(TYPES.AuditLogService) 
    private readonly auditLogService: AuditLogService,
    @inject(TYPES.DocumentbService)
    private readonly documentbService: DocumentbService,
    @inject(TYPES.DocDoubleApproverService)
    private readonly docDoubleApproverService: DocDoubleApproverService,
    @inject(TYPES.DataSource)
    private readonly dataSource: DataSource
  ) {}

  /**
   * Creates a customer return record with optimized transaction handling
   * 
   * LOGIC FLOW:
   * 1. Validates delivery challan exists and checks if return already created
   * 2. Validates that returned products match delivery challan products
   * 3. Creates return record with returned products (cascade saves products automatically)
   * 4. Marks delivery challan as returned and sets isReturnByCustomerCreated flag
   * 5. Updates delivery challan items with return/reject/accept quantities
   * 6. Creates approval document and starts workflow
   * 7. Logs the creation event
   * 
   * BUSINESS RULES:
   * - Only ONE return can be created per delivery challan
   * - Returned products must match delivery challan products
   * - AcceptedQty = DeliveryChallanQty - ReturnedQty - RejectedQty
   * 
   * OPTIMIZATIONS:
   * - Uses single transaction for data consistency
   * - Cascade save for returnedProducts (no manual save needed)
   * - Efficient SQL aggregation for quantity updates
   */
  async createReturn(returnData: any, requestedBy: any, clientIp?: string): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1️⃣ Validate required input
      if (!returnData.deliveryChallanNo) {
        throw new Error('Delivery Challan number is required');
      }

      // 2️⃣ Fetch and validate delivery challan with products
      const deliveryChallan = await queryRunner.manager.findOne(
        this.deliveryChallanRepository.target, 
        { 
          where: { id: returnData.deliveryChallanNo },
          relations: ['deliveryChallanProducts', 'deliveryChallanProducts.productName', 'deliveryChallanProducts.variant']
        }
      );

      if (!deliveryChallan) {
        throw new Error('Delivery Challan not found');
      }

      // 3️⃣ Check if return already created for this delivery challan
      if ((deliveryChallan as any).isReturnByCustomerCreated) {
        throw new Error('Return By Customer has already been created for this Delivery Challan');
      }

      // 4️⃣ Validate that returned products match delivery challan products
      if (returnData.returnedProducts && returnData.returnedProducts.length > 0) {
        for (const returnProduct of returnData.returnedProducts) {
          const productId = typeof returnProduct.productName === 'object' 
            ? returnProduct.productName.id 
            : returnProduct.productName;
          const variantId = returnProduct.variant 
            ? (typeof returnProduct.variant === 'object' ? returnProduct.variant.id : returnProduct.variant)
            : null;

          // Find matching product in delivery challan
          const matchingProduct = deliveryChallan.deliveryChallanProducts.find(dcProduct => {
            const dcProductId = dcProduct.productName?.id;
            const dcVariantId = dcProduct.variant?.id || null;
            
            return dcProductId === productId && dcVariantId === variantId;
          });

          if (!matchingProduct) {
            throw new Error(
              `Product ${productId}${variantId ? ` with variant ${variantId}` : ''} does not exist in the Delivery Challan`
            );
          }

          // Validate quantities
          const originalQty = Number(matchingProduct.quantity || 0);
          const returnedQty = Number(returnProduct.returnedQty || 0);
          const rejectedQty = Number(returnProduct.rejectedQty || 0);

          if (returnedQty + rejectedQty > originalQty) {
            throw new Error(
              `Total returned (${returnedQty}) and rejected (${rejectedQty}) quantity cannot exceed original quantity (${originalQty}) for product ${productId}`
            );
          }
        }
      }

      // 5️⃣ Create return entity with returnedProducts (cascade will auto-save products)
      const newReturn = queryRunner.manager.create(
        this.postReturnByCustomerRepository.target, 
        {
          deliveryChallanNo: returnData.deliveryChallanNo,
          companyName: returnData.companyName,
          location: returnData.location,
          customerName: returnData.customerName,
          date: returnData.date,
          remark: returnData.remark,
          returnedProducts: returnData.returnedProducts?.map((product: any) => ({
            productName: product.productName,
            variant: product.variant || null,
            saleUoM: product.saleUoM,
            unitPrice: product.unitPrice,
            returnedQty: product.returnedQty,
            returnedQtyAmt: product.returnedQtyAmt,
            returnedPackingMaterialWt: product.returnedPackingMaterialWt,
            returnedGrossWt: product.returnedGrossWt,
            returnedNetWt: product.returnedNetWt,
            rejectedQty: product.rejectedQty,
            rejectedQtyAmt: product.rejectedQtyAmt,
            rejectedPackingMaterialWt: product.rejectedPackingMaterialWt,
            rejectedGrossWt: product.rejectedGrossWt,
            rejectedNetWt: product.rejectedNetWt,
          })) || [],
        } as any
      );

      // 6️⃣ Mark challan as returned and set isReturnByCustomerCreated flag
      deliveryChallan.isReturned = true;
      (deliveryChallan as any).isReturnByCustomerCreated = true;
      
      const [, savedReturn] = await Promise.all([
        queryRunner.manager.save(deliveryChallan),
        queryRunner.manager.save(newReturn)
      ]);

      const savedReturnEntity = Array.isArray(savedReturn) ? savedReturn[0] : savedReturn;

      // 7️⃣ Update delivery challan items with aggregated return quantities
      await this.updateDeliveryChallanItemsWithReturns(returnData.deliveryChallanNo, queryRunner);

      // 8️⃣ Create document and start approval flow
      const document = await this.documentbService.createDocument({
        type: DocumentTypeEnum.RETURN_BY_CUSTOMER,
        docDef: DocDefEnum.OPERATION,
        status: DocumentStatus.HOLD,
        remarks: 'Document auto-created with RBC',
        lastActionBy: { id: requestedBy },
        document_type_id: savedReturnEntity.id,
      });

      await this.documentbService.startApprovalFlow(document.id);

      // 9️⃣ Log creation
      UserLogger.logRfpaCreated(savedReturnEntity.id, requestedBy, clientIp);

      await queryRunner.commitTransaction();
      return savedReturnEntity;

    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Updates delivery challan items with aggregated return quantities
   * 
   * LOGIC FLOW:
   * 1. Aggregates all returned/rejected quantities per product+variant using SQL GROUP BY
   * 2. Bulk updates all delivery challan items with calculated quantities
   * 3. Calculates acceptedQty = originalQty - returnedQty - rejectedQty
   * 
   * OPTIMIZATIONS:
   * - Single SQL query for aggregation (vs N queries)
   * - Handles NULL variants correctly
   * - Uses parameterized queries to prevent SQL injection
   * - Efficient DECIMAL casting for accurate calculations
   * 
   * @param deliveryChallanId - The delivery challan ID to update items for
   * @param queryRunner - Optional query runner for transaction support
   */
  private async updateDeliveryChallanItemsWithReturns(
    deliveryChallanId: string,
    queryRunner?: any
  ): Promise<void> {
    // Define aggregation result type
    interface AggregatedReturn {
      productId: string;
      variantId: string | null;
      totalReturnedQty: string;
      totalRejectedQty: string;
    }

    const manager = queryRunner ? queryRunner.manager : this.dataSource;

    // 1️⃣ Aggregate return quantities using raw SQL for performance
    const aggregatedReturns = await (queryRunner ? queryRunner.query : this.dataSource.query).call(
      queryRunner || this.dataSource,
      `
      SELECT 
        rp."product_id" as "productId",
        rp."varient_id" as "variantId",
        SUM(CAST(COALESCE(rp."returnedQty", 0) AS DECIMAL)) as "totalReturnedQty",
        SUM(CAST(COALESCE(rp."rejectedQty", 0) AS DECIMAL)) as "totalRejectedQty"
      FROM "returned_products_by_customer" rp
      INNER JOIN "return_by_customer" prc ON rp."postReturnId" = prc."id"
      WHERE prc."delivery_challan_id" = $1
      GROUP BY rp."product_id", rp."varient_id"
    `, [deliveryChallanId]);

    if (!aggregatedReturns || aggregatedReturns.length === 0) {
      return; // No returns to process
    }

    // 2️⃣ Execute bulk update for each product/variant combination
    for (const agg of aggregatedReturns) {
      const returnedQty = Number(agg.totalReturnedQty || 0);
      const rejectedQty = Number(agg.totalRejectedQty || 0);

      const queryBuilder = queryRunner 
        ? queryRunner.manager.createQueryBuilder()
        : this.dataSource.createQueryBuilder();

      await queryBuilder
        .update('item')
        .set({
          returnedQty,
          rejectedQty,
          acceptedQty: () => `CAST(COALESCE(quantity, 0) AS DECIMAL) - ${returnedQty} - ${rejectedQty}`,
        })
        .where('product_id = :productId', { productId: agg.productId })
        .andWhere(
          agg.variantId 
            ? 'varient_id = :variantId' 
            : 'varient_id IS NULL',
          agg.variantId ? { variantId: agg.variantId } : {}
        )
        .andWhere('deliveryChallanId = :challanId', { challanId: deliveryChallanId })
        .execute();
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
        postReturn.deliveryChallanNo.id
      );
    }

    // Log the update
    UserLogger.logRfpaUpdated(id, updatedBy, clientIp);

    return updatedPostReturn;
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
