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
            
  ) {}

  async create(data: any, requestedBy: any): Promise<any> {
    try {

      //TODO: Check approval flow is exit or not for logged user

     const approvalFlowExit = this.approvalFlowService.findApprovalFlowForLoggedUser(requestedBy, 'DC_TYPE_STOCK_TRANSFER')

     //console.log('approval ;', approvalFlowExit);
     

    if (!approvalFlowExit) {
      throw new Error('Approval flow not found');
    }


      data.challanNo = await this.deliveryChallanService.generateVoucherNo();
      //console.log("challan:", data.challan);
      
      const challan = this.challanRepository.create(data);
      const savedchallan = await this.challanRepository.save(challan);
      if (!savedchallan) {
        logger.error('Failed to save stock transfer delivery challan');
        return null;
      }

      const document = await this.documentbService.createDocument({
                  type: DocumentTypeEnum.DC_TYPE_STOCK_TRANSFER,
                  docDef: DocDefEnum.OPERATION,
                  status: DocumentStatus.HOLD,
                  remarks: 'Document auto-created with Stock Transfer Challan',
                  lastActionBy: { id: requestedBy },
                  document_type_id : Array.isArray(savedchallan) ? (savedchallan[0] as StockTransferDeliveryChallan)?.id : (savedchallan as StockTransferDeliveryChallan).id
                },/* approvalFlowExit*/);
                //console.log('Document created:', docuemnt);
                //const saved = await this.grnRepository.save(savedGrn);
          
                await this.documentbService.startApprovalFlow(document.id);
                const challn = Array.isArray(savedchallan)
      ? savedchallan[0]
      : savedchallan;

      

      console.log("after saving chalan.......",challn.id)


      const chllan1 = await this.challanRepository.findOne({
        where: { id: challn.id },
        relations: [
          'deliveryChallanProducts',
          'fromLocation',
          'toLocation',
          'companyName'
        ]
      })
      if(!chllan1)
      {
        return null
      }
      console.log(chllan1)
      for (const item of chllan1.deliveryChallanProducts) {
        const {
          count,
          size,
          variety,
          origin,
          unitPrice,
          productName,
          netWeight,
          amount
        } = item;
console.log("companyname for deliverychllan...........",chllan1.companyName.id);
console.log("fromlocation for dc ------------------",chllan1.fromLocation.id);
// console.log(variant.productTemplate.id);
// console.log(variant.id)
console.log("tolocation------------------",chllan1.toLocation.id)
        const productId =
          typeof productName === 'object' ? productName.id : productName;

        let variant = await this.variantRepository.findOne({
          where: {
            productTemplate: { id: productId },
            count,
            size,
            variety,
            origin,
          },
          relations: ['productTemplate'],
        });
        console.log('varient found', variant);
        if (!variant) {
          const product = await this.productRepository.findOne({
            where: { id: productId },
          });
          if (!product) throw new Error('Product not found');

          const generatedCode = this.productVarientService.generateVariantCode(
            product.productCode,
            {
              count,
              size,
              variety,
              productOrigin: origin,
            },
          );

          const newVariant = this.variantRepository.create({
            productTemplate: product,
            count,
            size,
            variety,
            origin,
            productCode: generatedCode,
          });
          console.log('New variant created:', newVariant);
          variant = await this.variantRepository.save(newVariant);
        }
         const returnedNetWt1 = Number(item.netWeight ?? 0);
        const returnedQtyAmt1 = Number(item.amount ?? 0);

        // Update fromLocation stock (deduct)
            let fromStock = await this.inventoryStockRepository.findOne({
                where: {
                    companyName: { id: chllan1.companyName.id },
                    location: { id: chllan1.fromLocation.id },
                    product: { id: variant.productTemplate.id },
                    varients: { id: variant.id },
                },
                relations: ['product', 'varients', 'location', 'companyName'],
            });

            if (fromStock) {
                 fromStock.onHandQty =
            Number(fromStock.onHandQty) - returnedNetWt1;
          fromStock.amount = Number(fromStock.amount) - returnedQtyAmt1;
                await this.inventoryStockRepository.save(fromStock);
            } else {
                await this.inventoryStockRepository.save(
                    this.inventoryStockRepository.create({
                        companyName: { id: chllan1.companyName.id },
                        location: { id:chllan1.fromLocation.id },
                        product: { id: variant.productTemplate.id },
                        varients: { id: variant.id },
                        onHandQty: -returnedNetWt1,
                        amount: -returnedQtyAmt1,
                    })
                );
            }
            console.log("from stock",fromStock)
            const returnedNetWt2 = Number(item.netWeight ?? 0);
        const returnedQtyAmt2 = Number(item.amount ?? 0);
// Update toLocation stock (add)
            let toStock = await this.inventoryStockRepository.findOne({
                where: {
                    companyName: { id: chllan1.companyName.id },
                    location: { id: chllan1.toLocation.id },
                    product: { id: variant.productTemplate.id },
                    varients: { id: variant.id },
                },
                relations: ['product', 'varients', 'location', 'companyName'],
            });

            if (toStock) {
               toStock.onHandQty =
            Number(toStock.onHandQty) + returnedNetWt2;
          toStock.amount = Number(toStock.amount) + returnedQtyAmt2;
                await this.inventoryStockRepository.save(toStock);
            } else {
                await this.inventoryStockRepository.save(
                    this.inventoryStockRepository.create({
                        companyName: { id: chllan1.companyName.id },
                        location: { id: chllan1.toLocation.id },
                        product: { id: variant.productTemplate.id },
                        varients: { id: variant.id },
                        onHandQty: returnedNetWt2,
                        amount: returnedQtyAmt2,
                    })
                );
            }
            console.log("to stock",toStock)
       }

      return savedchallan;
    } catch (error: any) {
      console.error('Error creating dc:', error);
      throw new Error('Failed to create dc');
    }
  }
  // catch(err: any) {
  //   logger.error('Error creating stock transfer delivery challan', {
  //     error: err,
  //   });
  //   return null;
  // }

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
                'customerName'
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
