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
import { LessThanOrEqual, DataSource, In, IsNull } from 'typeorm';
import { InventoryStockRepository } from '../repositories/inventoryStock.repository';
import { DitemRepository } from '../repositories/dItem.repository';
import { ProductVarientsRepository } from '../repositories/productVarients.repository';
import { ProductRepository } from '../repositories/product.repository';
import { ProductVarientService } from './productVarient.service';
import { ProductVarientRepository } from '../repositories/varients.repository';
import { DocumentbRepository } from '../repositories/documentb.repository';
import { format } from 'date-fns';

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
     @inject(TYPES.DocumentbRepository)
    private readonly documentbRepository: DocumentbRepository,
  ) { }


  public async generateVoucherNo(type: string = 'C'): Promise<string> {
    const today = new Date();
    const formattedDate = format(today, 'yyyyMMdd');
    const typeCode = type.toUpperCase();

    // Count all challans of this type to get next serial
    const count = await this.challanRepository
      .createQueryBuilder('deliveryChallan')
      .where('deliveryChallan.challanNo LIKE :pattern', {
        pattern: `CN%${typeCode}%`,
      })
      .getCount();

    const serialStr = (count + 1).toString().padStart(5, '0');
    return `CN${formattedDate}${typeCode}${serialStr}`;
  }
  async create(data: any, requestedBy: any): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Fetch Customer
      const cus = await queryRunner.manager.findOne(this.customerRepo.target, {
        where: { id: data.partyName },
        relations: [
          'billingDetails.billingAddress',
          'deliveryDetails.deliveryAddress',
        ],
      });

      if (!cus) {
        throw new AppError(400, `Customer with id ${data.partyName} not found`);
      }

      // 2. Auto-set billing / delivery address
      if (!data.billingDetails || !data.deliveryDetails) {
        data.billingAddress = cus.billingDetails.billingAddress;
        data.deliveryAddress = cus.deliveryDetails.deliveryAddress;
      } else {
        data.billingAddress = data.billingDetails.billingAddress;
        data.deliveryAddress = data.deliveryDetails.deliveryAddress;
      }

      // 3. Generate Challan No
      data.challanNo = await this.generateVoucherNo(data.type || 'C');

      // 4. Normalize variants list
      let variantIds: string[] = [];
      if (Array.isArray(data.variants)) variantIds = data.variants;
      else if (data.variants) variantIds = [data.variants];

      // 5. Fetch variants
      const variants = await queryRunner.manager.find(this.productVarientsRepository.target, {
        where: { id: In(variantIds) },
        relations: ['product'],
      });

      // 6. Extract product IDs
      const productIds = variants.map(v => v.product?.id).filter(Boolean);

      // 7. VALIDATE STOCK BEFORE CREATING CHALLAN
      if (data.deliveryChallanProducts && data.deliveryChallanProducts.length > 0) {
        for (const item of data.deliveryChallanProducts) {
          const deliveredQty = Number(item.netWeight ?? 0);
          const variantId = typeof item.variant === 'object' ? item.variant.id : item.variant;
          const productId = typeof item.productName === 'object' ? item.productName.id : item.productName;

          if (!productId) {
            throw new AppError(400, `Product missing`);
          }

          let productInfo;
          
          // If variant exists, fetch variant with product
          if (variantId) {
            const variant = await queryRunner.manager.findOne(this.productVarientsRepository.target, {
              where: { id: variantId },
              relations: ['product'],
            });

            if (!variant) {
              throw new AppError(400, `Variant with id ${variantId} not found`);
            }
            
            productInfo = {
              productId: variant.product.id,
              productName: variant.product.name,
              variantId: variant.id,
              variantName: variant.variantName
            };
          } else {
            // No variant - fetch product directly
            const product = await queryRunner.manager.findOne(this.productRepository.target, {
              where: { id: productId }
            });

            if (!product) {
              throw new AppError(400, `Product with id ${productId} not found`);
            }

            productInfo = {
              productId: product.id,
              productName: product.name,
              variantId: null,
              variantName: null
            };
          }

          // Check existing inventory stock
          const stockWhere: any = {
            company: { id: typeof data.companyName === 'string' ? data.companyName : data.companyName?.id },
            location: { id: typeof data.fromLocation === 'string' ? data.fromLocation : data.fromLocation?.id },
            product: { id: productInfo.productId },
          };

          // Add variant condition only if variant exists
          if (productInfo.variantId) {
            stockWhere.variant = { id: productInfo.variantId };
          } else {
            stockWhere.variant = IsNull();
          }

          const existingStock = await queryRunner.manager.findOne(this.inventoryStockRepository.target, {
            where: stockWhere,
            relations: ['product', 'variant'],
          });

          if (!existingStock) {
            throw new AppError(
              400,
              `Insufficient stock: No inventory found for product "${productInfo.productName}" ${productInfo.variantName ? `(variant: ${productInfo.variantName})` : ''} at this location`
            );
          }

          // Check if sufficient quantity is available
          const availableQty = Number(existingStock.inwardQty || 0);
          if (availableQty < deliveredQty) {
            throw new AppError(
              400,
              `Insufficient stock: Required ${deliveredQty} units but only ${availableQty} units available for product "${productInfo.productName}" ${productInfo.variantName ? `(variant: ${productInfo.variantName})` : ''}`
            );
          }
        }
      }

      // 8. Create challan (only after stock validation passes)
      const challan = queryRunner.manager.create(this.challanRepository.target, {
        ...data,
        variants: variants.map(v => ({ id: v.id })),
        products: productIds.map(id => ({ id })),
      });

      const savedChallan = await queryRunner.manager.save(challan);

      // 9. Auto-create document
      const actualChallan = Array.isArray(savedChallan) ? savedChallan[0] : savedChallan;

      const document = await this.documentbService.createDocument({
        type: DocumentTypeEnum.DC_TYPE_CUSTOMER,
        docDef: DocDefEnum.SALE,
        status: DocumentStatus.HOLD,
        remarks: 'Document auto-created with Customer-DC',
        lastActionBy: { id: requestedBy },
        document_type_id: actualChallan.id,
      });

      const challn = actualChallan;

      // 10. Update Inventory (STOCK OUT) - Now we know stock is sufficient
      for (const item of challn.deliveryChallanProducts ?? []) {
        const deliveredQty = Number(item.netWeight ?? 0);
        const deliveredAmt = Number(item.amount ?? 0);

        const variantId = typeof item.variant === 'object' ? item.variant.id : item.variant;
        const productId = typeof item.productName === 'object' ? item.productName.id : item.productName;

        let productInfo;

        // If variant exists, fetch variant with product
        if (variantId) {
          const variant = await queryRunner.manager.findOne(this.productVarientsRepository.target, {
            where: { id: variantId },
            relations: ['product'],
          });

          if (variant) {
            productInfo = {
              productId: variant.product.id,
              variantId: variant.id
            };
          }
        } else {
          // No variant - use product directly
          productInfo = {
            productId: productId,
            variantId: null
          };
        }

        if (!productInfo) continue;

        // Get existing stock (we know it exists from validation)
        const stockWhere: any = {
          company: { id: typeof challn.companyName === 'string' ? challn.companyName : challn.companyName?.id },
          location: { id: typeof challn.fromLocation === 'string' ? challn.fromLocation : challn.fromLocation?.id },
          product: { id: productInfo.productId },
        };

        // Add variant condition only if variant exists
        if (productInfo.variantId) {
          stockWhere.variant = { id: productInfo.variantId };
        } else {
          stockWhere.variant = IsNull();
        }

        const existingStock = await queryRunner.manager.findOne(this.inventoryStockRepository.target, {
          where: stockWhere,
        });

        if (existingStock) {
          // Reduce inward (OUTWARD movement)
          existingStock.inwardQty = +(existingStock.inwardQty - deliveredQty);
          existingStock.inwardAmt = +(existingStock.inwardAmt - deliveredAmt);

          await queryRunner.manager.save(existingStock);
        }
      }

      // Commit transaction - all operations succeeded
      await queryRunner.commitTransaction();

      // Start approval flow after commit so challan is visible to other DB connections
      await this.documentbService.startApprovalFlow(document.id);

      return actualChallan;

    } catch (error: any) {
      // Rollback transaction - undo all changes
      await queryRunner.rollbackTransaction();
      console.error('Error creating Delivery Challan:', error);
      // Re-throw AppError instances (like insufficient stock) to preserve the error message
      if (error instanceof AppError) {
        throw error;
      }
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }



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
      transitInsuranceNo: challan.transitInsuranceNo,
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
        rmn:challan.rmn,
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
          netWeight: product.netWeight,
          grossWeight: product.grossWeight,

          // Acceptance/Rejection fields
          acceptedQty: product.acceptedQty,
          rejectedQty: product.rejectedQty,

          // Return fields
          returnedQty: product.returnedQty || 0,


          // Changed/Modified fields
          changedQty: product.changedQty,
          changedPrice: product.changedPrice,

          saleUoM: product.saleUoM?.id || null,
          packagingMaterial:
            product.packagingMaterial?.id || null,
          packagingMaterialUoM: product.packagingMaterialUoM?.id || null,
          packagingMaterialAmount: product.packagingMaterialAmount,
          packingMaterialWeight:product.packingMaterialWeight||null,
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

        .where('challan.id = :id', { id })
        .getOne();

      if (!challan) {
        throw new AppError(
          400,
          `Delivery Challan with challanNo ${id} not found`,
        );
      }

      const { createdDate, createdTime } = formatDateTime(challan.createdAt);













      const formattedChallan = {
        id: challan.id,
        challanNo: challan.challanNo,
        poNumber: challan.poNumber,

        customerName: challan.customerName?.organisationName || null,
        transitInsuranceNo: challan.transitInsuranceNo,
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

        deliveryChallanProducts: challan.deliveryChallanProducts.map(product => {
          return {
            id: product.id,
            productName: product.productName?.name,
            variant: product.variant?.variantName,

            // Original values
            quantity: product.quantity,
            unitPrice: product.unitPrice,
            amount: product.amount,
            netWeight: product.netWeight,
            grossWeight: product.grossWeight,
            acceptedQty:product.acceptedQty,
            returnedQty:product.returnedQty,
            rejectedQty:product.rejectedQty,

            // Changed values
            changedQty: product.changedQty,
            changedPrice: product.changedPrice,

            // Packaging
            saleUoM: product.saleUoM?.unit || null,
            packingMaterial: product.packagingMaterial?.packagingMaterialName || null,
            packagingMaterialUoM: product.packagingMaterialUoM?.unit || null,
            packagingMaterialAmount: product.packagingMaterialAmount,
            packagingMaterialUnitPrice: product.packagingMaterialUnitPrice,
            packagingMaterialQuantity: product.packagingMaterialQuantity,
            packagingMaterialTotalWeight: product.packagingMaterialTotalWeight,
          };
        }),


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
    const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === false)
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    for (const doc of activeDocuments) {
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

    const relatedDataOnly = activeDocuments
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
        customerName: doc.relatedData.customerName?.organisationName || null,
        // ? {
        //     id: doc.relatedData.customerName.id,
        //     organisationName: doc.relatedData.customerName.organisationName,
        //   }
        // : null,
        transitInsuranceNo: doc.relatedData.transitInsuranceNo,
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
  public async deleteMultipleCustomerDC(ids: string[]): Promise<{ success: string[]; failed: { id: string; reason: string }[]; message: string }> {
  const success: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      const customerDC = await this.challanRepository.findOne({
        where: { id },
      });
      if (!customerDC) {
        failed.push({ id, reason: 'customerDC not found' });
        continue;
      }
      const relatedDocument = await this.documentbRepository.findOne({
        where: { document_type_id: customerDC.id }
      });

      if (!relatedDocument) {
        throw new Error(`Something went wrong`);
      }

      const deleteDocument = await this.documentbRepository.delete(relatedDocument.id);
      if (!deleteDocument) {
        throw new Error(`Failed to delete related document with ID ${relatedDocument.id}`);
      }

      const deleteAqr = await this.challanRepository.delete(customerDC.id);
      if (!deleteAqr) {
        throw new Error(`Failed to delete customerDC with ID ${id}`);
      }
      success.push(id);
    } catch (error: any) {
      failed.push({ id, reason: error.message || 'Unknown error' });
    }
  }
  const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
  return { success, failed, message };
}



  /**
   * Update delivery challan products with aggregated return data
   * This method calculates total returns per product and updates the delivery challan items
   */
  async updateDeliveryChallanProductsWithReturns(deliveryChallanId: string): Promise<void> {
    try {
      // Get delivery challan with products and returns
      const challan = await this.challanRepository.findOne({
        where: { id: deliveryChallanId },
        relations: [
          'deliveryChallanProducts',
          'deliveryChallanProducts.productName',
          'deliveryChallanProducts.variant',
          'returns',
          'returns.returnedProducts',
          'returns.returnedProducts.productName',
          'returns.returnedProducts.variant',
        ],
      });

      if (!challan) {
        throw new AppError(400, `Delivery Challan with id ${deliveryChallanId} not found`);
      }

      // Aggregate returns by product and variant
      const returnsByProductVariant = new Map<string, {
        returnQty: number;
        returnAmount: number;
        returnNetWeight: number;
      }>();

      if (challan.returns && challan.returns.length > 0) {
        challan.returns.forEach((returnRecord) => {
          returnRecord.returnedProducts?.forEach((returnedProduct) => {
            const productId = returnedProduct.productName?.id;
            const variantId = returnedProduct.variant?.id || 'no-variant';
            const key = `${productId}_${variantId}`;

            const existing = returnsByProductVariant.get(key) || {
              returnQty: 0,
              returnAmount: 0,
              returnNetWeight: 0,
            };

            existing.returnQty += Number(returnedProduct.returnedQty || 0);
            existing.returnAmount += Number(returnedProduct.returnedQtyAmt || 0);
            existing.returnNetWeight += Number(returnedProduct.returnedNetWt || 0);

            returnsByProductVariant.set(key, existing);
          });
        });
      }

      // Update delivery challan products with return data
      let hasReturns = false;
      for (const product of challan.deliveryChallanProducts) {
        const productId = product.productName?.id;
        const variantId = product.variant?.id || 'no-variant';
        const key = `${productId}_${variantId}`;

        const returns = returnsByProductVariant.get(key);

        if (returns) {
          product.returnedQty = returns.returnQty;

          hasReturns = true;
        } else {
          // Reset to 0 if no returns
          product.returnedQty = 0;

        }
      }

      // Update isReturned flag
      challan.isReturned = hasReturns;

      // Save updated challan
      await this.challanRepository.save(challan);

      console.log(`Delivery challan ${challan.challanNo} updated with return data`);
    } catch (error) {
      console.error('Error updating delivery challan with returns:', error);
      throw error;
    }
  }

  /**
   * Get delivery challan with net amounts (after deducting returns)
   * Useful for invoice generation
   */
  async getDeliveryChallanWithNetAmounts(deliveryChallanId: string): Promise<any> {
    // First update with latest return data
    await this.updateDeliveryChallanProductsWithReturns(deliveryChallanId);

    // Get updated challan
    const challan = await this.challanRepository.findOne({
      where: { id: deliveryChallanId },
      relations: [
        'deliveryChallanProducts',
        'deliveryChallanProducts.productName',
        'deliveryChallanProducts.variant',
        'deliveryChallanProducts.uom',
        'deliveryChallanProducts.saleUoM',
        'customerName',
        'fromLocation',
        'companyName',
        'billingAddress',
        'deliveryAddress',
      ],
    });

    if (!challan) {
      throw new AppError(400, `Delivery Challan with id ${deliveryChallanId} not found`);
    }

    // Calculate net amounts
    const productsWithNetAmounts = challan.deliveryChallanProducts.map((product) => {
      const originalQty = Number(product.changedQty || product.quantity || 0);
      const originalAmount = Number(product.amount || 0);
      const originalNetWeight = Number(product.netWeight || 0);

      const returnQty = Number(product.returnedQty || 0);


      return {
        ...product,
        originalQty,
        originalAmount,
        originalNetWeight,
        returnQty,

        netQty: originalQty - returnQty,

      };
    });

    // Calculate totals
    const totalOriginalAmount = productsWithNetAmounts.reduce(
      (sum, p) => sum + p.originalAmount,
      0
    );




    return {
      ...challan,
      deliveryChallanProducts: productsWithNetAmounts,
      summary: {
        totalOriginalAmount,

        hasReturns: challan.isReturned,
      },
    };
  }

  /**
   * Check if Return By Customer has been created for a delivery challan
   * Returns the status and details
   */
  async checkReturnByCustomerStatus(deliveryChallanId: string): Promise<any> {
    const challan = await this.challanRepository.findOne({
      where: { id: deliveryChallanId },
      relations: ['returns'],
    });

    if (!challan) {
      throw new AppError(400, `Delivery Challan with id ${deliveryChallanId} not found`);
    }

    return {
      deliveryChallanId: challan.id,
      challanNo: challan.challanNo,
      isReturnByCustomerCreated: (challan as any).isReturnByCustomerCreated || false,
      isReturned: challan.isReturned,
      returnsCount: challan.returns?.length || 0,
      canCreateReturn: !(challan as any).isReturnByCustomerCreated,
    };
  }
}
