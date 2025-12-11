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
  ) { }
  async create(data: any, requestedBy: any): Promise<any> {
    try {
      // 1. Fetch Customer
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

      // 2. Auto-set billing / delivery address
      if (!data.billingDetails || !data.deliveryDetails) {
        data.billingAddress = cus.billingDetails.billingAddress;
        data.deliveryAddress = cus.deliveryDetails.deliveryAddress;
      } else {
        data.billingAddress = data.billingDetails.billingAddress;
        data.deliveryAddress = data.deliveryDetails.deliveryAddress;
      }

      // 3. Generate Challan No
      data.challanNo = await this.deliveryChallanService.generateVoucherNo();

      // 4. Normalize variants list
      let variantIds: string[] = [];
      if (Array.isArray(data.variants)) variantIds = data.variants;
      else if (data.variants) variantIds = [data.variants];

      // 5. Fetch variants
      const variants = await this.productVarientsRepository.find({
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

          if (!variantId) {
            throw new AppError(400, `Variant missing for product`);
          }

          // Fetch variant (to get product id)
          const variant = await this.productVarientsRepository.findOne({
            where: { id: variantId },
            relations: ['product'],
          });

          if (!variant) {
            throw new AppError(400, `Variant with id ${variantId} not found`);
          }

          // Check existing inventory stock
          const existingStock = await this.inventoryStockRepository.findOne({
            where: {
              company: { id: typeof data.companyName === 'string' ? data.companyName : data.companyName?.id },
              location: { id: typeof data.fromLocation === 'string' ? data.fromLocation : data.fromLocation?.id },
              product: { id: variant.product.id },
              variant: { id: variant.id },
            },
            relations: ['product', 'variant'],
          });

          if (!existingStock) {
            throw new AppError(
              400,
              `Insufficient stock: No inventory found for product "${variant.product.name}" (variant: ${variant.variantName || 'N/A'}) at this location`
            );
          }

          // Check if sufficient quantity is available
          const availableQty = Number(existingStock.inwardQty || 0);
          if (availableQty < deliveredQty) {
            throw new AppError(
              400,
              `Insufficient stock: Required ${deliveredQty} units but only ${availableQty} units available for product "${variant.product.name}" (variant: ${variant.variantName || 'N/A'})`
            );
          }
        }
      }

      // 8. Create challan (only after stock validation passes)
      const challan = this.challanRepository.create({
        ...data,
        variants: variants.map(v => ({ id: v.id })),
        products: productIds.map(id => ({ id })),
      });

      const savedChallan = await this.challanRepository.save(challan);

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

      await this.documentbService.startApprovalFlow(document.id);

      const challn = actualChallan;

      // 10. Update Inventory (STOCK OUT) - Now we know stock is sufficient
      for (const item of challn.deliveryChallanProducts ?? []) {
        const deliveredQty = Number(item.netWeight ?? 0);
        const deliveredAmt = Number(item.amount ?? 0);

        const variantId = typeof item.variant === 'object' ? item.variant.id : item.variant;

        // Fetch variant (to get product id)
        const variant = await this.productVarientsRepository.findOne({
          where: { id: variantId },
          relations: ['product'],
        });

        // Get existing stock (we know it exists from validation)
        const existingStock = await this.inventoryStockRepository.findOne({
          where: {
            company: { id: typeof challn.companyName === 'string' ? challn.companyName : challn.companyName?.id },
            location: { id: typeof challn.fromLocation === 'string' ? challn.fromLocation : challn.fromLocation?.id },
            product: { id: variant!.product.id },
            variant: { id: variant!.id },
          },
        });

        if (existingStock) {
          // Reduce inward (OUTWARD movement)
          existingStock.inwardQty = +(existingStock.inwardQty - deliveredQty);
          existingStock.inwardAmt = +(existingStock.inwardAmt - deliveredAmt);

          await this.inventoryStockRepository.save(existingStock);
        }
      }

      return actualChallan;

    } catch (error: any) {
      console.error('Error creating Delivery Challan:', error);
      throw new Error('Failed to create Customer Delivery Challan');
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

        // Original amounts
        totalProductAmount: challan.totalProductAmount,
        originalNetProductWeight: challan.netProductWeight,
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
}
