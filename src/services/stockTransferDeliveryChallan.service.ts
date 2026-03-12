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
import { DataSource } from 'typeorm';


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
    
        @inject(TYPES.ProductRepository)
        private readonly productRepository: ProductRepository,
        @inject(TYPES.DataSource)
        private readonly dataSource: DataSource
            
  ) {}

 async create(data: any, requestedBy: any): Promise<any> {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 1. Approval flow check
    const approvalFlowExit =
      await this.approvalFlowService.findApprovalFlowForLoggedUser(
        requestedBy,
        'DC_TYPE_STOCK_TRANSFER'
      );

    if (!approvalFlowExit) {
      throw new Error('Approval flow not found for user');
    }

    // 2. Generate challan number
    data.challanNo = await this.deliveryChallanService.generateVoucherNo();

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

    await this.documentbService.startApprovalFlow(document.id);

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

    return savedChallan;
  } catch (error) {
    // Rollback transaction - undo all changes
    await queryRunner.rollbackTransaction();
    console.error('Error creating Stock Transfer:', error);
    throw new Error('Failed to create Stock Transfer');
  } finally {
    // Release query runner
    await queryRunner.release();
  }
}

  async getById(id: string): Promise<any> {
    try {
      return await this.challanRepository.findOne({
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
    } catch (err) {
      logger.error(`Error fetching stock transfer challan by ID: ${id}`, {
        error: err,
      });
      return null;
    }
  }
  async getByIdChallanforUpdate(id: string): Promise<any> {
    try {
      const challan = await this.challanRepository
        .createQueryBuilder('challan')
        .leftJoinAndSelect('challan.deliveryChallanProducts', 'products')
        .leftJoinAndSelect('products.productName', 'productName')
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
        transferType: challan.transferType,
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
            quantity: product.quantity,
            unitPrice: product.unitPrice,
            amount: product.amount,
            saleUoM: product.saleUoM?.unit || null,
            packingMaterial: product.packagingMaterial?.id || null,
            packagingMaterialUoM: product.packagingMaterialUoM?.id || null,
            packagingMaterialAmount: product.packagingMaterialAmount,
            packagingMaterialUnitPrice: product.packagingMaterialUnitPrice,
            packagingMaterialQuantity: product.packagingMaterialQuantity,
            packagingMaterialTotalWeight: product.packagingMaterialTotalWeight,
          }),
        ),
      };
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

      if (!relatedDocument) {
        throw new Error(`Something went wrong`);
      }

      const deleteDocument = await this.documentbRepository.delete(relatedDocument.id);
      if (!deleteDocument) {
        throw new Error(`Failed to delete related document with ID ${relatedDocument.id}`);
      }

      const deleteDCForStockTransfer = await this.challanRepository.delete(dcForStockTransfer.id);
      if (!deleteDCForStockTransfer) {
        throw new Error(`Failed to delete DC for Stock Transfer with ID ${id}`);
      }
      success.push(id);
    } catch (error: any) {
      failed.push({ id, reason: error.message || 'Unknown error' });
    }
  }
  const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
  return { success, failed, message };
}
  async getByIdChallanforView(docId: string): Promise<any> {
    try {

       const document = await this.docDoubleApproverService.getDocumentById(docId);
   //   console.log("***********************");
      
      const id = document.documentTypeId;

      if(id) {
      const challan = await this.challanRepository
        .createQueryBuilder('challan')
        .leftJoinAndSelect('challan.deliveryChallanProducts', 'products')
        .leftJoinAndSelect('products.productName', 'productName')
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
        transferType: challan.transferType,
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

     const {data, meta} = await this.docDoubleApproverService.getAllDocumentByUserIdForDoubleApprover(
          userId,
          DocumentTypeEnum.DC_TYPE_STOCK_TRANSFER,
          queryOptions
        )
    
      //  console.log("Data : ", data);
        

        const typedDocuments = data as DocumentWithRelatedData[];
        for(const doc of typedDocuments) {
          if(!doc.document_type_id) continue;
          console.log("id:", doc.document_type_id);
          
          try {
            doc.relatedData = await this.challanRepository.findOne({
              where: { id: doc.document_type_id },
              relations:[
                'customerName',
                "fromLocation",
                "toLocation"

              ]
            })
            console.log("data:", doc.relatedData);
            
          } catch (error) {
            doc.relatedData = null;
          }
        }
        
        //console.log("Typerd documents: ", typedDocuments);
        

        const relatedDataOnly = typedDocuments
                .filter((doc) => doc.relatedData)
                .map((doc) => ({
                  documentId: doc.id,
                  overAllStatus: doc.status, 
                  createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
                  createdDate: formatDateTime(doc.createdAt).createdDate,
                  createdTime: formatDateTime(doc.createdAt).createdTime,
                  ...doc.relatedData,
                   companyName: doc.relatedData.companyName?.name || null,
                   //customerName: doc.relatedData.cu || null,
                   customerName: doc.relatedData.customerName?.organisationName || null,
      
    fromLocation: doc.relatedData.fromLocation?.name || null,
    toLocation: doc.relatedData.toLocation?.name || null,
    transferType: doc.relatedData.transferType || null,
                  // companyName: doc.relatedData.companyName.name || null,
                  // location: doc.relatedData.location.name || null,
                })
                );
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

      if (!isNaN(valA) && !isNaN(valB)) {
        return (Number(valA) - Number(valB)) * sortOrder;
      }
      return String(valA).localeCompare(String(valB)) * sortOrder;
    });
  }

                 return {
            data: relatedDataOnly,
            meta: {
              total: meta.total,
              page: meta.page,
              pages: meta.pages
            }
          };
    

    // const queryBuilder = this.challanRepository
    //   .createQueryBuilder('challan')
    //   .leftJoinAndSelect('challan.deliveryChallanProducts', 'products')
    //   .leftJoinAndSelect('products.productName', 'productName')
    //   .leftJoinAndSelect('products.packagingMaterial', 'packagingMaterial')
    //   .leftJoinAndSelect(
    //     'products.packagingMaterialUoM',
    //     'packagingMaterialUoM',
    //   )
    //   .leftJoinAndSelect('products.saleUoM', 'saleUoM')
    //   .leftJoinAndSelect('challan.companyName', 'company')
    //   .leftJoinAndSelect('challan.offices', 'office')
    //   .leftJoinAndSelect('challan.grnNo', 'grn')
    //   .leftJoinAndSelect('challan.fromLocation', 'fromLocation')
    //   .leftJoinAndSelect('challan.toLocation', 'toLocation');

    // const result = await buildQuery(queryBuilder, queryOptions, 'challan');

    // return {
    //   data: result.data.map((challan) => {
    //     const { createdDate, createdTime } = formatDateTime(challan.createdAt);
    //     return {
    //       id: challan.id,
    //       challanNo: challan.challanNo,
    //       transferType: challan.transferType,
    //       companyName: challan.companyName?.name || null,
    //       office: challan.offices?.name || null,
    //       grnNo: challan.grnNo?.grnNo || null,
    //       fromLocation: challan.fromLocation?.name || null,
    //       toLocation: challan.toLocation?.name || null,
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
    //   meta: result.meta,
    // };
  }

  async update(id: string, data: any): Promise<any> {
    try {
      const challan = await this.challanRepository.findOne({ where: { id } });
      if (!challan) return null;

      Object.assign(challan, data);
      return await this.challanRepository.save(challan);
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
      return result.affected !== 0;
    } catch (err) {
      logger.error(`Error deleting stock transfer challan with ID: ${id}`, {
        error: err,
      });
      return false;
    }
  }
}
