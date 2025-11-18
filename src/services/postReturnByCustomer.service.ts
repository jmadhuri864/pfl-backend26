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
//   async createReturn(returnData: any, requestedBy: any): Promise<any> {
//     if (!returnData.deliveryChallanNo) {
//       throw new Error('Delivery Challan number is required');
//     }

//     const deliveryChallan = await this.deliveryChallanRepository.findOne({
//       where: {
//         id: returnData.deliveryChallanNo,
//       },
//       relations: [
//         'deliveryChallanProducts',
//         'deliveryChallanProducts.productName',
//       ],
//     });

//     if (!deliveryChallan) {
//       throw new Error('Delivery Challan not found');
//     }

//     //   await this.deliveryChallanProductRepository.save(product);
//     // }
//  // 3. Normalize variants input
//     let variantIds: string[] = [];
//     if (Array.isArray(returnData.variants)) {
//       variantIds = returnData.variants;
//     } else if (returnData.variants) {
//       variantIds = [returnData.variants];
//     }
    
//     // 4. Fetch variants
//     const variants = await this.productVarientsRepository.find({
//       where: { id: In(variantIds) },
//       relations: ['product'],
//     });
//      // 5. Extract product IDs
//     const productIds = variants.map(v => v.product?.id).filter(Boolean);
//     // Create the PostReturnByCustomer entity
//     const newReturn = this.postReturnByCustomerRepository.create({
//       ...returnData,
//         variants: variants.map(v => ({ id: v.id })),
//       products: productIds.map(id => ({ id })),
//     });

//     //TODO: Check approval flow is exit or not for logged user

//     const approvalFlowExit =
//       this.approvalFlowService.findApprovalFlowForLoggedUser(
//         requestedBy,
//         'return-by-customer',
//       );

//     if (!approvalFlowExit) {
//       throw new Error('Approval flow not found');
//     }

//     // Save Delivery Challan & Post Return
//     await this.deliveryChallanRepository.save(deliveryChallan);
//     const savedNewReturn = await this.postReturnByCustomerRepository.save(
//       newReturn,
//     );
//     const savedreturn1 = Array.isArray(savedNewReturn)
//       ? savedNewReturn[0]
//       : savedNewReturn;
//     const document = await this.documentbService.createDocument({
//       type: DocumentTypeEnum.RETURN_BY_CUSTOMER,
//       // totalAmt: rfpaData.totalAmt,
//       docDef: DocDefEnum.SALE,
//       status: DocumentStatus.HOLD,
//       remarks: 'Document auto-created with RBC',
//       lastActionBy: { id: requestedBy },
//       document_type_id: Array.isArray(savedNewReturn)
//         ? (savedNewReturn[0] as PostReturnByCustomer)?.id
//         : (savedNewReturn as PostReturnByCustomer).id,
//     });

//     await this.documentbService.startApprovalFlow(document.id);

//     for (const product of deliveryChallan.deliveryChallanProducts) {
//       //console.log('Product ID:', product);

//       for (const item of savedreturn1.returnedProducts) {
//   const {
//     unitPrice,
//     productName,
//     returnedNetWt,
//     returnedQtyAmt,
//     variant, // make sure ReturnedProducts entity has relation with ProductVarient
//   } = item;

//   const productId = typeof productName === 'object' ? productName.id : productName;
//   const variantId = typeof variant === 'object' ? variant.id : variant;

//   let productVariant = await this.productVarientsRepository.findOne({
//     where: { id: variantId },
//     relations: ['product'],
//   });

//  if (!productVariant) {
//   const product = await this.productRepository.findOne({ where: { id: productId } });
//   if (!product) throw new Error('Product not found');

//    const existingStock = await this.inventoryStockRepository.findOne({
//     where: {
//       companyName: { id: savedreturn1.companyName.id },
//       location: { id: savedreturn1.location.id },
//       product: { id: product.id },
//       varients: { id: productVariant.id },
//     },
//     relations: ['product', 'varients', 'location', 'companyName'],
//   });

//   const returnedNetWt1 = Number(returnedNetWt ?? 0);
//   const returnedQtyAmt1 = Number(returnedQtyAmt ?? 0);

//   if (existingStock) {
//     existingStock.onHandQty = Number(existingStock.onHandQty ?? 0) + returnedNetWt1;
//     existingStock.amount = Number(existingStock.amount ?? 0) + returnedQtyAmt1;

//     await this.inventoryStockRepository.save(existingStock);
//   } else {
//     const newStock = this.inventoryStockRepository.create({
//       companyName: { id: savedreturn1.companyName.id },
//       location: { id: savedreturn1.location.id },
//       product: { id: product.id },
//       varients: { id: productVariant.id },
//       onHandQty: returnedNetWt1,
//       amount: returnedQtyAmt1,
//     });

//     await this.inventoryStockRepository.save(newStock);
//   }

// }
//     }
  
//   }
// }

async createReturn(returnData: any, requestedBy: any): Promise<any> {
  if (!returnData.deliveryChallanNo) {
    throw new Error('Delivery Challan number is required');
  }

  const deliveryChallan = await this.deliveryChallanRepository.findOne({
    where: { id: returnData.deliveryChallanNo },
    relations: ['deliveryChallanProducts', 'deliveryChallanProducts.productName'],
  });

  if (!deliveryChallan) {
    throw new Error('Delivery Challan not found');
  }

  // Normalize variants
  let variantIds: string[] = [];
  if (Array.isArray(returnData.variants)) {
    variantIds = returnData.variants;
  } else if (returnData.variants) {
    variantIds = [returnData.variants];
  }

  // Fetch variants
  const variants = await this.productVarientsRepository.find({
    where: { id: In(variantIds) },
    relations: ['product'],
  });

  // Extract product IDs
  const productIds = variants.map(v => v.product?.id).filter(Boolean);

  // Create PostReturnByCustomer entity
  const newReturn = this.postReturnByCustomerRepository.create({
    ...returnData,
    variants: variants.map(v => ({ id: v.id })),
    products: productIds.map(id => ({ id })),
  });

  // // Check approval flow
  // const approvalFlowExit =
  //   await this.approvalFlowService.findApprovalFlowForLoggedUser(
  //     requestedBy,
  //     'return-by-customer',
  //   );

  // if (!approvalFlowExit) {
  //   throw new Error('Approval flow not found');
  // }

  // Save Delivery Challan & Post Return
  await this.deliveryChallanRepository.save(deliveryChallan);
  const savedNewReturn = await this.postReturnByCustomerRepository.save(newReturn);

  const savedReturnEntity = Array.isArray(savedNewReturn)
    ? savedNewReturn[0]
    : savedNewReturn;

  // Create document
  const document = await this.documentbService.createDocument({
    type: DocumentTypeEnum.RETURN_BY_CUSTOMER,
    docDef: DocDefEnum.OPERATION,  // ✅ FIXED: Changed from SALE to OPERATION
    status: DocumentStatus.HOLD,
    remarks: 'Document auto-created with RBC',
    lastActionBy: { id: requestedBy },
    document_type_id: savedReturnEntity.id,
  });

  await this.documentbService.startApprovalFlow(document.id);

  // ✅ Update inventory stock based on returned products
  for (const item of savedReturnEntity.returnedProducts || []) {
    const {
      unitPrice,
      productName,
      returnedNetWt,
      returnedQtyAmt,
      variant,
    } = item;

    const productId = typeof productName === 'object' ? productName.id : productName;
    const variantId = typeof variant === 'object' ? variant.id : variant;

    // Ensure product exists
    const product = await this.productRepository.findOne({ where: { id: productId } });
    if (!product) throw new Error(`Product not found: ${productId}`);

    // Ensure variant exists
    let productVariant = null;
    if (variantId) {
      productVariant = await this.productVarientsRepository.findOne({
        where: { id: variantId },
        relations: ['product'],
      });
    }

    const returnedNetWtVal = Number(returnedNetWt ?? 0);
    const returnedQtyAmtVal = Number(returnedQtyAmt ?? 0);

    // Find existing stock
    const existingStock = await this.inventoryStockRepository.findOne({
      where: {
        companyName: { id: savedReturnEntity.companyName.id },
        location: { id: savedReturnEntity.location.id },
        product: { id: product.id },
        ...(productVariant ? { varients: { id: productVariant.id } } : {}),
      },
      relations: ['product', 'varients', 'location', 'companyName'],
    });

    if (existingStock) {
      existingStock.onHandQty = Number(existingStock.onHandQty ?? 0) + returnedNetWtVal;
      existingStock.amount = Number(existingStock.amount ?? 0) + returnedQtyAmtVal;
      await this.inventoryStockRepository.save(existingStock);
    } else {
      const newStock = this.inventoryStockRepository.create({
        companyName: { id: savedReturnEntity.companyName.id },
        location: { id: savedReturnEntity.location.id },
        product: { id: product.id },
        varients: productVariant ? { id: productVariant.id } : undefined,
        onHandQty: returnedNetWtVal,
        amount: returnedQtyAmtVal,
      });
      await this.inventoryStockRepository.save(newStock);
    }
  }

  // ✅ NEW: Mark the linked Delivery Challan as returned
  if (returnData.deliveryChallanNo) {
    const deliveryChallan = await this.deliveryChallanRepository.findOne({
      where: { id: returnData.deliveryChallanNo }
    });

    if (deliveryChallan && !deliveryChallan.isReturned) {
      deliveryChallan.isReturned = true;
      await this.deliveryChallanRepository.save(deliveryChallan);
      console.log(`✅ DC ${deliveryChallan.challanNo} marked as returned (isReturned = true)`);
    }
  }

  return savedReturnEntity;
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

    // let queryBuilder= await this.postReturnByCustomerRepository.createQueryBuilder('postReturn')
    //     .leftJoinAndSelect('postReturn.companyName', 'company')
    //     .leftJoinAndSelect('postReturn.deliveryChallanNo','deliveryChallanNo')
    //     .leftJoinAndSelect('postReturn.proformaInvNo','proformaInvNo')

    //     .leftJoinAndSelect('postReturn.returnedProducts', 'returnedProduct')
    //     .leftJoinAndSelect('returnedProduct.productName', 'product')
    //     .leftJoinAndSelect('returnedProduct.returnedUOM', 'returnedUOM')
    //     .orderBy('postReturn.createdAt','DESC')
    //     const result = await buildQuery(queryBuilder, queryOptions, 'postReturn');

    //   const formattedResponse = result.data.map(postReturn => {
    //     const rawDate = postReturn.createdAt;
    //     const { createdDate, createdTime } = formatDateTime(rawDate);
    //     const  date= formatDateTime(postReturn.date);
    //     return {
    //       id: postReturn.id, // Post Return ID
    //       companyName: postReturn.companyName.name || null,
    //       date: date.createdDate,
    //       createdTime,
    //       createdDate,
    //       deliveryChallanNo: postReturn.deliveryChallanNo?.challanNo || null,
    //       proformaInvNo: postReturn.proformaInvNo?.invoiceNo || null,
    //       remark: postReturn.remark,

    //       returnedProducts: postReturn.returnedProducts.map(returnedProduct => ({
    //         productName: returnedProduct.productName?.name || null,
    //         returnedUOM: returnedProduct.returnedUOM?.unit || null,
    //         amount: returnedProduct.amount,
    //         netWeight: returnedProduct.netWeight,
    //         packingMaterialWeight: returnedProduct.packingMaterialWeight,
    //         grossWeight: returnedProduct.grossWeight,
    //         unitPrice: returnedProduct.unitPrice,
    //         quantity: returnedProduct.quantity
    //       }))
    //     };
    //   });
    //   formattedResponse.forEach(postReturn => {
    //     console.log(postReturn.returnedProducts.map(returnedProduct => ({
    //       productName: returnedProduct.productName || null,
    //       returnedUOM: returnedProduct.returnedUOM || null,
    //       amount: returnedProduct.amount,
    //       netWeight: returnedProduct.netWeight,
    //       packingMaterialWeight: returnedProduct.packingMaterialWeight,
    //       grossWeight: returnedProduct.grossWeight,
    //       unitPrice: returnedProduct.unitPrice,
    //       quantity: returnedProduct.quantity
    //     })));
    //   });
    //   return {
    //     data: formattedResponse,
    //     meta: result.meta
    // };
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
        //  ? {
        //   id: returnedProduct.productName.id,
        //   productName: returnedProduct.productName?.name
        // } : null,
        // size: returnedProduct.size,
        // variety: returnedProduct.variety,
        // origin: returnedProduct.origin,
        saleUoM: returnedProduct.saleUoM?.unit || null,
        // rejectedUoM: returnedProduct.rejectedUoM?.unit || null,
        // returnedUOM: returnedProduct.returnedUOM?.unit || null,
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
        //  ? {
        //   id: returnedProduct.productName.id,
        //   productName: returnedProduct.productName?.name
        // } : null,
        // size: returnedProduct.size,
        // variety: returnedProduct.variety,
        // origin: returnedProduct.origin,
        saleUoM: returnedProduct.saleUoM?.id || null,
        // rejectedUoM: returnedProduct.rejectedUoM?.id || null,
        // returnedUOM: returnedProduct.returnedUOM?.id || null,
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
        //  ? {
        //   id: returnedProduct.productName.id,
        //   productName: returnedProduct.productName?.name
        // } : null,
        // size: returnedProduct.size,
        // variety: returnedProduct.variety,
        // origin: returnedProduct.origin,
        saleUoM: returnedProduct.saleUoM?.unit || null,
        // rejectedUoM: returnedProduct.rejectedUoM?.unit || null,
        // returnedUOM: returnedProduct.returnedUOM?.unit || null,
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

    // Log changes
    await this.auditLogService.logChange(
      'PostReturnByCustomer',
      id,
      oldData,
      updatedPostReturn,
      updatedBy,
    );

    return updatedPostReturn;
  }
}
