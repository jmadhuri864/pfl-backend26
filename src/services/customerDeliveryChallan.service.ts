import { inject, injectable } from 'inversify';
import { CustomerDeliveryChallanRepository } from '../repositories/customerDeliveryChallan.repository';
import { TYPES } from '../types';
import logger from '../utils/logger';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import { formatDateTime } from '../utils/dateUtils';
import AppError from '../utils/appError';
import { CustomerRepository } from '../repositories/customer.repository';
import { DocumentbService, DocumentWithRelatedData } from './documentb.service';
import { DocumentTypeEnum } from '../entities/docuemnt.entity';
import { DocumentStatus } from '../entities/docuemnt.entity';
import { CustomerDeliveryChallan } from '../entities/customerDeliveryChallan.entity';
import { DocumentTypeEnum as DocDefEnum } from '../entities/documentdef.entity';
import { DocDoubleApproverService } from './docDoubleApprover.service';
import { DeliveryChallanService } from './deliveryChallan.service';
import { ApprovalFlowService } from './approvalFlow.service';
import { InventoryStock } from '../entities/inventoryStock.entity';
import { LessThanOrEqual, DataSource, In } from 'typeorm';
import { InventoryStockRepository } from '../repositories/inventoryStock.repository';
import { DitemRepository } from '../repositories/dItem.repository';
import { ProductVarientsRepository } from '../repositories/productVarients.repository';
import { ProductRepository } from '../repositories/product.repository';
import { ProductVarientService } from './productVarient.service';
import { ProductVarientRepository } from '../repositories/varients.repository';

@injectable()
export class CustomerDeliveryChallanService {
  constructor(
    @inject(TYPES.CustomerDeliveryChallanRepository)
    private challanRepository: CustomerDeliveryChallanRepository,
    @inject(TYPES.CustomerRepository) private customerRepo: CustomerRepository,
    @inject(TYPES.DocumentbService)
    private readonly documentbService: DocumentbService,
      @inject(TYPES.ProductVarientRepository)
            private productVarientsRepository: ProductVarientRepository,
    @inject(TYPES.DocDoubleApproverService)
    private readonly docDoubleApproverService: DocDoubleApproverService,
    @inject(TYPES.DeliveryChallanService)
    private readonly deliveryChallanService: DeliveryChallanService,
    @inject(TYPES.ProductVarientsRepository)
    private readonly variantRepository: ProductVarientsRepository,
    @inject(TYPES.ProductVarientService)
    private readonly productVarientService: ProductVarientService,

    @inject(TYPES.ProductRepository)
    private readonly productRepository: ProductRepository,
    @inject(TYPES.DataSource)
    private readonly dataSource: DataSource,
    @inject(TYPES.ApprovalFlowService)
    private approvalFlowService: ApprovalFlowService,
    @inject(TYPES.InventoryStockRepository)
    private readonly inventoryStockRepository: InventoryStockRepository,
    @inject(TYPES.DitemRepository)
    private readonly deliveryChallanProductRepository: DitemRepository,
  ) {}
 async create(data: any, requestedBy: any): Promise<any> {
  try {
    // 1️⃣ Find customer and attach address info
    const cus = await this.customerRepo.findOne({
      where: { id: data.partyName },
      relations: [
        'billingDetails.billingAddress',
        'deliveryDetails.deliveryAddress',
      ],
    });

    if (!cus) {
      throw new AppError(400, `Customer with id ${data.partyName} not found`);
    }

    if (!data.billingDetails || !data.deliveryDetails) {
      data.billingAddress = cus.billingDetails.billingAddress;
      data.deliveryAddress = cus.deliveryDetails.deliveryAddress;
    } else {
      data.billingAddress = data.billingDetails.billingAddress;
      data.deliveryAddress = data.deliveryDetails.deliveryAddress;
    }

    // 2️⃣ Generate challan number
    data.challanNo = await this.deliveryChallanService.generateVoucherNo();
    console.log('Generated challan no:', data.challanNo);

    // 3️⃣ Normalize variants
    let variantIds: string[] = [];
    if (Array.isArray(data.variants)) {
      variantIds = data.variants;
    } else if (data.variants) {
      variantIds = [data.variants];
    }

    // 4️⃣ Fetch variant & product info
    const variants = await this.productVarientsRepository.find({
      where: { id: In(variantIds) },
      relations: ['product'],
    });

    const productIds = variants.map(v => v.product?.id).filter(Boolean);

    // 5️⃣ Create and save challan
    const challan = this.challanRepository.create({
      ...data,
      variants: variants.map(v => ({ id: v.id })),
      products: productIds.map(id => ({ id })),
    });

    const savedChallan = await this.challanRepository.save(challan);
    console.log('✅ Saved Challan:', savedChallan);

    // 6️⃣ Create corresponding document
    const document = await this.documentbService.createDocument({
      type: DocumentTypeEnum.DC_TYPE_CUSTOMER,
      docDef: DocDefEnum.SALE,
      status: DocumentStatus.HOLD,
      remarks: 'Document auto-created with Customer Delivery Challan',
      lastActionBy: { id: requestedBy },
      document_type_id: Array.isArray(savedChallan)
        ? (savedChallan[0] as CustomerDeliveryChallan)?.id
        : (savedChallan as CustomerDeliveryChallan).id,
    });

    await this.documentbService.startApprovalFlow(document.id);

    // 7️⃣ Adjust Inventory Stock (Outward movement)
    const challanEntity = Array.isArray(savedChallan)
      ? savedChallan[0]
      : savedChallan;

    for (const item of challanEntity.deliveryChallanProducts ?? []) {
      const { productName, netWeight, amount, variant } = item;

      const productId =
        typeof productName === 'object' ? productName.id : productName;
      const variantId = typeof variant === 'object' ? variant.id : variant;

      if (!variantId || !productId) {
        console.warn('⚠ Missing variant or product for challan item:', item);
        continue;
      }

      const variantEntity = await this.productVarientsRepository.findOne({
        where: { id: variantId },
        relations: ['product'],
      });

      if (!variantEntity) {
        console.warn(`⚠ Variant with id ${variantId} not found.`);
        continue;
      }

      const existingStock = await this.inventoryStockRepository.findOne({
        where: {
          companyName: { id: challanEntity.companyName.id },
          location: { id: challanEntity.fromLocation.id },
          product: { id: variantEntity.product.id },
          varients: { id: variantEntity.id },
        },
        relations: ['product', 'varients', 'location', 'companyName'],
      });

      const deliveredQty = Number(netWeight ?? 0);
      const deliveredAmt = Number(amount ?? 0);

      if (existingStock) {
        // Stock OUT → Reduce quantity & amount
        existingStock.onHandQty = Number(existingStock.onHandQty) - deliveredQty;
        existingStock.amount = Number(existingStock.amount) - deliveredAmt;

        await this.inventoryStockRepository.save(existingStock);
        console.log(
          `📦 Updated Stock: ${existingStock.varients.id} → ${existingStock.onHandQty}`
        );
      } else {
        // If no stock exists, record as negative (outward)
        const newStock = this.inventoryStockRepository.create({
          companyName: { id: challanEntity.companyName.id },
          location: { id: challanEntity.fromLocation.id },
          product: { id: variantEntity.product.id },
          varients: { id: variantEntity.id },
          onHandQty: -deliveredQty,
          amount: -deliveredAmt,
        });

        await this.inventoryStockRepository.save(newStock);
        console.log('🚚 Created negative stock entry:', newStock);
      }
    }

    // 8️⃣ Return result
    return savedChallan;
  } catch (err: any) {
    console.error('❌ Error creating delivery challan:', err);
    logger.error('Error creating delivery challan', { error: err });
    throw new AppError(500, 'Failed to create Delivery Challan');
  }
}

  // async create(data: any, requestedBy: any): Promise<any> {
  //   const queryRunner = this.dataSource.createQueryRunner();
  //   await queryRunner.connect();
  //   await queryRunner.startTransaction();

  //   try {
  //     const approvalFlowExit = this.approvalFlowService.findApprovalFlowForLoggedUser(requestedBy, 'DC_TYPE_CUSTOMER');
  //     if (!approvalFlowExit) throw new Error('Approval flow not found');

  //     const cus = await this.customerRepo.findOne({
  //       where: { id: data.partyName },
  //       relations: [
  //         'billingDetails.billingAddress',
  //         'deliveryDetails.deliveryAddress',
  //       ],
  //     });

  //     if (!cus) throw new AppError(400, `Customer with id ${data.partyName} not found`);

  //     data.billingAddress = data.billingDetails?.billingAddress ?? cus.billingDetails.billingAddress;
  //     data.deliveryAddress = data.deliveryDetails?.deliveryAddress ?? cus.deliveryDetails.deliveryAddress;

  //     data.challanNo = await this.deliveryChallanService.generateVoucherNo();
  //     const challan = this.challanRepository.create(data);
  //     const savedchallan = await queryRunner.manager.save(challan);

  //     // 🧠 Subtract stock for each product line item in challan
  //     for (const productItem of data.products) {
  //       const { companyNameId, varientId, productId, locationId, quantity } = productItem;

  //       const stock = await queryRunner.manager.findOne(InventoryStock, {
  //         where: {
  //           companyName: { id: data.companyName },
  //           varients: { id: varientId },
  //           product: { id: productId },
  //           location: { id: location },
  //         },
  //         relations: ['companyName', 'varients', 'product', 'location']
  //       });

  //       if (!stock) {
  //         throw new AppError(404, `Stock not found for product variant ${varientId} at location ${locationId}`);
  //       }

  //       // Subtract quantity
  //       stock.onHandQty = Number(stock.onHandQty) - Number(quantity);
  //       if (stock.onHandQty < 0) {
  //         throw new AppError(400, `Insufficient stock for product variant ${varientId}`);
  //       }

  //       await queryRunner.manager.save(stock);
  //     }

  //     const document = await this.documentbService.createDocument({
  //       type: DocumentTypeEnum.DC_TYPE_CUSTOMER,
  //       docDef: DocDefEnum.OPERATION,
  //       status: DocumentStatus.HOLD,
  //       remarks: 'Document auto-created with Customer-DC',
  //       lastActionBy: { id: requestedBy },
  //       document_type_id: Array.isArray(savedchallan) ? (savedchallan[0] as CustomerDeliveryChallan)?.id : (savedchallan as CustomerDeliveryChallan)?.id,
  //     });

  //     await this.documentbService.startApprovalFlow(document.id);

  //     await queryRunner.commitTransaction();
  //     return savedchallan;

  //   } catch (error) {
  //     await queryRunner.rollbackTransaction();
  //     console.error('Error creating Delivery Challan:', error);
  //     logger.error('Error creating delivery challan', { error });
  //     throw new Error('Failed to create Delivery Challan');
  //   } finally {
  //     await queryRunner.release();
  //   }
  // }

  public async getByIdCustomerDeliveryChallanforUpdate(
    id: string,
  ): Promise<any> {
    const challan = await this.challanRepository
      .createQueryBuilder('challan')
      .leftJoinAndSelect('challan.deliveryChallanProducts', 'products')
      .leftJoinAndSelect('challan.fromLocation', 'fromLocation')
      .leftJoinAndSelect('products.productName', 'productName')
      .leftJoinAndSelect('products.variant', 'variant')
      .leftJoinAndSelect('products.packagingMaterial', 'packagingMaterial')
      .leftJoinAndSelect(
        'products.packagingMaterialUoM',
        'packagingMaterialUoM',
      )
      .leftJoinAndSelect('products.saleUoM', 'saleUoM')
      .leftJoinAndSelect('challan.customerName', 'customerName')
      .leftJoinAndSelect('challan.billingAddress', 'billingAddress')
      .leftJoinAndSelect('challan.deliveryAddress', 'deliveryAddress')
      .leftJoinAndSelect('challan.companyName', 'companyName')
      .leftJoinAndSelect('challan.offices', 'office')
      .leftJoinAndSelect('challan.grnNo', 'grn')
      .where('challan.id = :id', { id })
      .getOne();

    if (!challan) {
      throw new AppError(400, `Delivery Challan with id ${id} not found`);
    }

    const { createdDate, createdTime } = formatDateTime(challan.createdAt);

    const formattedChallan = {
      id: challan.id,
      challanNo: challan.challanNo,
      poNumber: challan.poNumber,
      customerName: challan.customerName?.id || null,
      fromLocation: challan.fromLocation?.id || null,
      transitInsuranceNo:challan.transitInsuranceNo,
      billingAddress: challan.billingAddress
        ? {
            id: challan.billingAddress.id,
            address1: challan.billingAddress.address1,
            address2: challan.billingAddress.address2,
            location: challan.billingAddress.location,
            city: challan.billingAddress.city,
            state: challan.billingAddress.state,
            pincode: challan.billingAddress.pincode,
          }
        : null,

      deliveryAddress: challan.deliveryAddress
        ? {
            id: challan.deliveryAddress.id,
            address1: challan.deliveryAddress.address1,
            address2: challan.deliveryAddress.address2,
            location: challan.deliveryAddress.location,
            city: challan.deliveryAddress.city,
            state: challan.deliveryAddress.state,
            pincode: challan.deliveryAddress.pincode,
          }
        : null,

      companyName: challan.companyName?.id || null,
      office: challan.offices?.id || null,
      grnNo: challan.grnNo?.id || null,
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
      // approvalStatus: challan.approvalStatus,
      remark: challan.remark,
      anyAttachment: challan.anyAttachment,

      deliveryChallanProducts: challan.deliveryChallanProducts.map(
        (product) => ({
          id: product.id,
          productName: product.productName?.id,
          variant: product.variant?.id || null,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          amount: product.amount,
          saleUoM: product.saleUoM?.id || null,
          packingMaterial:
            product.packagingMaterial?.packagingMaterialName || null,
          packagingMaterialUoM: product.packagingMaterialUoM?.id || null,
          packagingMaterialAmount: product.packagingMaterialAmount,
          packagingMaterialUnitPrice: product.packagingMaterialUnitPrice,
          packagingMaterialQuantity: product.packagingMaterialQuantity,
          packagingMaterialTotalWeight: product.packagingMaterialTotalWeight,
        }),
      ),
    };

    return { data: formattedChallan };
  }

  public async getByIdCustomerDeliveryChallanForView(
    docId: string,
  ): Promise<any> {
    const document = await this.docDoubleApproverService.getDocumentById(docId);
    const id = document.documentTypeId;

    if (id) {
      const challan = await this.challanRepository
        .createQueryBuilder('challan')
        .leftJoinAndSelect('challan.deliveryChallanProducts', 'products')
        .leftJoinAndSelect('challan.fromLocation', 'fromLocation')
        .leftJoinAndSelect('products.productName', 'productName')
        .leftJoinAndSelect('products.packagingMaterial', 'packagingMaterial')
        .leftJoinAndSelect('products.variant', 'variant')  
        //.leftJoinAndSelect('documentApproval.documentdef', 'documentdef')
        .leftJoinAndSelect(
          'products.packagingMaterialUoM',
          'packagingMaterialUoM',
        )
        .leftJoinAndSelect('products.saleUoM', 'saleUoM')
        .leftJoinAndSelect('challan.customerName', 'customerName')
        .leftJoinAndSelect('challan.billingAddress', 'billingAddress')
        .leftJoinAndSelect('challan.deliveryAddress', 'deliveryAddress')
        .leftJoinAndSelect('challan.companyName', 'company')
        .leftJoinAndSelect('challan.offices', 'office')
        .leftJoinAndSelect('challan.grnNo', 'grn')
        // ✅ NEW: Load returns for this DC
        .leftJoinAndSelect('challan.returns', 'returns')
        .leftJoinAndSelect('returns.returnedProducts', 'returnedProducts')
        .leftJoinAndSelect('returnedProducts.productName', 'returnProductName')
        .leftJoinAndSelect('returnedProducts.variant', 'returnVariant')
        .where('challan.id = :id', { id })
        .getOne();

      if (!challan) {
        throw new AppError(
          400,
          `Delivery Challan with challanNo ${id} not found`,
        );
      }

      const { createdDate, createdTime } = formatDateTime(challan.createdAt);

      // ✅ NEW: Calculate return summary
      const returnSummary: any = {
        hasReturns: challan.isReturned || false,
        totalReturns: challan.returns?.length || 0,
        totalReturnedAmount: 0,
        totalReturnedQty: 0,
        totalReturnedNetWt: 0,
        returns: []
      };

      if (challan.returns && challan.returns.length > 0) {
        returnSummary.returns = challan.returns.map(ret => {
          const returnAmount = ret.returnedProducts?.reduce(
            (sum, rp) => sum + Number(rp.returnedQtyAmt || 0), 0
          ) || 0;
          const returnQty = ret.returnedProducts?.reduce(
            (sum, rp) => sum + Number(rp.returnedQty || 0), 0
          ) || 0;
          const returnNetWt = ret.returnedProducts?.reduce(
            (sum, rp) => sum + Number(rp.returnedNetWt || 0), 0
          ) || 0;

          returnSummary.totalReturnedAmount += returnAmount;
          returnSummary.totalReturnedQty += returnQty;
          returnSummary.totalReturnedNetWt += returnNetWt;

          return {
            returnId: ret.id,
            returnDate: formatDateTime(ret.date).createdDate,
            remark: ret.remark,
            returnAmount,
            returnQty,
            returnNetWt,
            products: ret.returnedProducts?.map(rp => ({
              productName: rp.productName?.name,
              variant: rp.variant?.variantName,
              returnedQty: rp.returnedQty,
              returnedNetWt: rp.returnedNetWt,
              returnedAmount: rp.returnedQtyAmt,
              rejectedQty: rp.rejectedQty,
              rejectedNetWt: rp.rejectedNetWt,
              rejectedAmount: rp.rejectedQtyAmt
            })) || []
          };
        });
      }

      // ✅ NEW: Calculate net invoice amounts
      const netInvoiceAmount = Number(challan.totalProductAmount || 0) - returnSummary.totalReturnedAmount;
      const netProductWeight = Number(challan.netProductWeight || 0) - returnSummary.totalReturnedNetWt;

      const formattedChallan = {
        id: challan.id,
        challanNo: challan.challanNo,
        poNumber: challan.poNumber,

        customerName: challan.customerName?.organisationName || null,
        transitInsuranceNo:challan.transitInsuranceNo,
        fromLocation: challan.fromLocation?.name || null,
        billingAddress: challan.billingAddress
          ? {
              id: challan.billingAddress.id,
              address1: challan.billingAddress.address1,
              address2: challan.billingAddress.address2,
              location: challan.billingAddress.location,
              city: challan.billingAddress.city,
              state: challan.billingAddress.state,
              pincode: challan.billingAddress.pincode,
            }
          : null,

        deliveryAddress: challan.deliveryAddress
          ? {
              id: challan.deliveryAddress.id,
              address1: challan.deliveryAddress.address1,
              address2: challan.deliveryAddress.address2,
              location: challan.deliveryAddress.location,
              city: challan.deliveryAddress.city,
              state: challan.deliveryAddress.state,
              pincode: challan.deliveryAddress.pincode,
            }
          : null,

        companyName: challan.companyName?.name || null,
        office: challan.offices?.name || null,
        grnNo: challan.grnNo?.grnNo || null,
        driverName: challan.driverName,
        contactNo: challan.contactNo,
        altContactNo: challan.altContactNo,
        vehicleNo: challan.vehicleNo,
        licenseNo: challan.licenseNo,
        receiverName: challan.receiverName,

        // Original amounts
        totalProductAmount: challan.totalProductAmount,
        originalNetProductWeight: challan.netProductWeight,
        netPackagingMaterialWeight: challan.netPackagingMaterialWeight,
        totalPackagingMaterialAmount: challan.totalPackagingMaterialAmount,
        totalAmtInWords: challan.totalAmtInWords,
        
        // ✅ NEW: Return tracking
        isReturned: challan.isReturned || false,
        returnSummary,
        
        // ✅ NEW: Net amounts for invoice generation (after deducting returns)
        netInvoiceAmount,
        netProductWeight,
        
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
            variant: product.variant?.variantName || null,
            quantity: product.quantity,
            unitPrice: product.unitPrice,
            amount: product.amount,
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

      return { data: formattedChallan };
    }
  }

  public async getAllCustomerDeliveryChallans(
    queryOptions: PaginationOptions,
    userId: string,
  ): Promise<any> {
    const { data, meta } =
      await this.docDoubleApproverService.getAllDocumentByUserIdForDoubleApprover(
        userId,
        DocumentTypeEnum.DC_TYPE_CUSTOMER,
        queryOptions,
      );

    // console.log("Data: ", data);

    const typedDocuments = data as DocumentWithRelatedData[];
    for (const doc of typedDocuments) {
      //  console.log("DOC TYPE ID: ",doc.document_type_id);

      if (!doc.document_type_id) continue;
      try {
        console.log('ID:', doc.document_type_id);
        doc.relatedData = await this.challanRepository.findOne({
          where: { id: doc.document_type_id },
          relations: [
            'customerName',
            'fromLocation',
            'billingAddress',
            'deliveryAddress',
            'companyName',
            'offices',
            'grnNo',
            'deliveryChallanProducts',
          ],
        });

        //console.log("ChallanNO:", doc.relatedData.challanNo);
      } catch (error) {
        doc.relatedData = null;
      }
    }

    const relatedDataOnly = typedDocuments
      .filter((doc) => doc.relatedData)
      .map((doc) => ({
        documentId: doc.id,
        overAllStatus: doc.status,
        createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
        createdDate: formatDateTime(doc.createdAt).createdDate,
        createdTime: formatDateTime(doc.createdAt).createdTime,
        ...doc.relatedData,
        id: doc.relatedData.id,
        challanNo: doc.relatedData.challanNo,
        customerName: doc.relatedData.customerName?.organisationName||null,
          // ? {
          //     id: doc.relatedData.customerName.id,
          //     organisationName: doc.relatedData.customerName.organisationName,
          //   }
          // : null,
        transitInsuranceNo:doc.relatedData.transitInsuranceNo,
        totalProductAmount: doc.relatedData.totalProductAmount,
        
        // ✅ NEW: Return indicators for list view
        isReturned: doc.relatedData.isReturned || false,
        returnsCount: doc.relatedData.returns?.length || 0,
        toLocationInput: doc.relatedData.toLocationInput
          ? {
              id: doc.relatedData.toLocationInput.id,
              address1: doc.relatedData.toLocationInput.address1,
              address2: doc.relatedData.toLocationInput.address2,
              location: doc.relatedData.toLocationInput.location,
              city: doc.relatedData.toLocationInput.city,
              state: doc.relatedData.toLocationInput.state,
              pincode: doc.relatedData.toLocationInput.pincode,
            }
          : null,
        fromLocationInput: doc.relatedData.fromLocationInput
          ? {
              id: doc.relatedData.fromLocationInput.id,
              address1: doc.relatedData.fromLocationInput.address1,
              address2: doc.relatedData.fromLocationInput.address2,
              location: doc.relatedData.fromLocationInput.location,
              city: doc.relatedData.fromLocationInput.city,
              state: doc.relatedData.fromLocationInput.state,
              pincode: doc.relatedData.fromLocationInput.pincode,
            }
          : null,

        fromLocation: doc.relatedData.fromLocation
          ? {
              id: doc.relatedData.fromLocation.id,
              name: doc.relatedData.fromLocation.name,
            }
          : null,

        companyName: doc.relatedData.companyName
          ? {
              id: doc.relatedData.companyName.id,
              name: doc.relatedData.companyName.name,
            }
          : null,

        //  challanNo: doc.relatedData
        //  companyName: doc.relatedData.companyName.name || null,
        //fromLocation: doc.relatedData.fromLocation.id || null,
        //  toLocation: doc.relatedData.toLocation || null,
        //  tranferType: doc.relatedData.tranferType || null
        // location: doc.relatedData.location.name || null,
      }));
    console.log('Related Data : ', relatedDataOnly);

    return {
      data: relatedDataOnly,
      meta: {
        total: meta.total,
        page: meta.page,
        pages: meta.pages,
      },
    };

    // const queryBuilder = this.challanRepository
    //   .createQueryBuilder('challan')
    //   .leftJoinAndSelect('challan.deliveryChallanProducts', 'products')
    //   .leftJoinAndSelect('products.productName', 'productName')
    //   .leftJoinAndSelect('challan.fromLocation', 'fromLocation')
    //   .leftJoinAndSelect('products.packagingMaterial', 'packagingMaterial')
    //   .leftJoinAndSelect(
    //     'products.packagingMaterialUoM',
    //     'packagingMaterialUoM',
    //   )
    //   .leftJoinAndSelect('products.saleUoM', 'saleUoM')
    //   .leftJoinAndSelect('challan.customerName', 'customerName')
    //   .leftJoinAndSelect('challan.billingAddress', 'billingAddress')
    //   .leftJoinAndSelect('challan.deliveryAddress', 'deliveryAddress')
    //   .leftJoinAndSelect('challan.companyName', 'company')
    //   .leftJoinAndSelect('challan.offices', 'office')
    //   .leftJoinAndSelect('challan.grnNo', 'grn');

    // const deliveryChallans = await buildQuery(
    //   queryBuilder,
    //   queryOptions,
    //   'challan',
    // );

    // const response = {
    //   data: deliveryChallans.data.map((challan) => {
    //     const { createdDate, createdTime } = formatDateTime(challan.createdAt);

    //     return {
    //       id: challan.id,
    //       challanNo: challan.challanNo,
    //       poNumber: challan.poNumber,
    //       fromLocation: challan.fromLocation?.name || null,
    //       customerName: challan.customerName?.organisationName || null,

    //       billingAddress: challan.billingAddress
    //         ? {
    //           id: challan.billingAddress.id,
    //           address1: challan.billingAddress.address1,
    //           address2: challan.billingAddress.address2,
    //           location: challan.billingAddress.location,
    //           city: challan.billingAddress.city,
    //           state: challan.billingAddress.state,
    //           pincode: challan.billingAddress.pincode,
    //         }
    //         : null,
    //       deliveryAddress: challan.deliveryAddress
    //         ? {
    //           id: challan.deliveryAddress.id,
    //           address1: challan.deliveryAddress.address1,
    //           address2: challan.deliveryAddress.address2,
    //           location: challan.deliveryAddress.location,
    //           city: challan.deliveryAddress.city,
    //           state: challan.deliveryAddress.state,
    //           pincode: challan.deliveryAddress.pincode,
    //         }
    //         : null,
    //       companyName: challan.companyName?.name || null,
    //       office: challan.offices?.name || null,
    //       grnNo: challan.grnNo?.grnNo || null,
    //       driverName: challan.driverName,
    //       contactNo: challan.contactNo,
    //       altContactNo: challan.altContactNo,
    //       vehicleNo: challan.vehicleNo,
    //       licenseNo: challan.licenseNo,
    //       receiverName: challan.receiverName,

    //       totalProductAmount: challan.totalProductAmount,
    //       netProductWeight: challan.netProductWeight,
    //       netPackagingMaterialWeight: challan.netPackagingMaterialWeight,
    //       totalPackagingMaterialAmount: challan.totalPackagingMaterialAmount,
    //       totalAmtInWords: challan.totalAmtInWords,
    //       createdDate,
    //       createdTime,
    //       requestingDepartment: challan.requestingDepartment,
    //       approvalStatus: challan.approvalStatus,
    //       remark: challan.remark,
    //       anyAttachment: challan.anyAttachment,
    //       deliveryChallanProducts: challan.deliveryChallanProducts.map(
    //         (product) => ({
    //           id: product.id,
    //           productName: product.productName?.name,
    //           quantity: product.quantity,
    //           unitPrice: product.unitPrice,
    //           amount: product.amount,
    //           saleUoM: product.saleUoM?.unit || null,
    //           packingMaterial:
    //             product.packagingMaterial?.packagingMaterialName || null,
    //           packagingMaterialUoM: product.packagingMaterialUoM?.unit || null,
    //           packagingMaterialAmount: product.packagingMaterialAmount,
    //           packagingMaterialUnitPrice: product.packagingMaterialUnitPrice,
    //           packagingMaterialQuantity: product.packagingMaterialQuantity,
    //           packagingMaterialTotalWeight:
    //             product.packagingMaterialTotalWeight,
    //         }),
    //       ),
    //     };
    //   }),
    //   meta: deliveryChallans.meta,
    // };
    // const formattedResponse = {
    //   data: response.data,
    //   meta: response.meta,
    // };

    // return formattedResponse;
  }

  async update(id: string, data: any): Promise<any> {
    try {
      const challan = await this.challanRepository.findOne({ where: { id } });

      if (!challan) return null;

      const updated = Object.assign(challan, data);
      return await this.challanRepository.save(updated);
    } catch (err) {
      logger.error(`Error updating delivery challan with ID: ${id}`, {
        error: err,
      });
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      console.log(id);
      const result = await this.challanRepository.delete(id);
      return result.affected !== 0;
    } catch (err) {
      logger.error(`Error deleting delivery challan with ID: ${id}`, {
        error: err,
      });
      return false;
    }
  }
}
