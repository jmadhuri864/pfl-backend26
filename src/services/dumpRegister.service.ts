import { inject, injectable } from "inversify";
import { DumpRegister } from "../entities/dumpRegister.entity";
import { DumpRegisterRepository } from "../repositories/dumpRegister.repository";
import { TYPES } from "../types";
import { AuditLogService } from "./auditLog.service";
import AppError from "../utils/appError";
import logger from "../utils/logger";
import { DataSource, EntityManager, ILike, In, IsNull } from "typeorm";
import { DumpProductRepository } from "../repositories/dumpProduct.repository";
import { buildQuery, PaginationOptions } from "../utils/pagination";
import { formatDateTime } from "../utils/dateUtils";
import { sign } from "node:crypto";
import { DocumentbService, DocumentWithRelatedData } from "./documentb.service";
import { DocumentStatus, DocumentTypeEnum } from '../entities/docuemnt.entity';
import { DocumentTypeEnum as DocDefEnum } from '../entities/documentdef.entity';
import { DocDoubleApproverService } from "./docDoubleApprover.service";
import { ApprovalFlowService } from "./approvalFlow.service";
import { DocumentbRepository } from "../repositories/documentb.repository";
import { ProductVarientRepository } from "../repositories/varients.repository";
import { InventoryStockRepository } from "../repositories/inventoryStock.repository";



@injectable()
export class DumpRegisterService{

    constructor(
        @inject(TYPES.DumpRegisterRepository) private readonly dumpRegisterRepository: DumpRegisterRepository,
        @inject(TYPES.DumpProductRepository) private readonly dumpProductRepository: DumpProductRepository,

          @inject(TYPES.ProductVarientRepository)
        private productVarientsRepository: ProductVarientRepository,
       @inject(TYPES.AuditLogService) private readonly auditLogService: AuditLogService,
       @inject(TYPES.DocumentbService) private readonly documentService: DocumentbService, // Assuming you have a Document service for handling documents
      @inject(TYPES.DocDoubleApproverService) private readonly docDoubleApproverService: DocDoubleApproverService, // Assuming you have a service for double approval 
      @inject(TYPES.ApprovalFlowService)
    private approvalFlowService: ApprovalFlowService,
     @inject(TYPES.InventoryStockRepository)
                private readonly inventoryStockRepository: InventoryStockRepository,
    @inject(TYPES.DocumentbRepository)
    private documentbRepository: DocumentbRepository,
    @inject(TYPES.DataSource)
    private readonly dataSource: DataSource
    ) {}
  private async generateSerialNo(): Promise<string> {
    const now = new Date();
    const yyyy = now.getFullYear().toString();
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const datePrefix = `DPR${yyyy}${mm}${dd}`;

    const count = await this.dumpRegisterRepository.count({
      where: { dumpNo: ILike(`${datePrefix}%`) },
    });

    return `${datePrefix}${(count + 1).toString().padStart(5, '0')}`;
  }





    async createDumpRegister(data: any): Promise<any> {
       // 1. Validate approval flow exists before doing anything else
      const approvalFlow = await this.approvalFlowService.findApprovalFlowForLoggedUser(data.requestedBy, DocDefEnum.OPERATION);

      if (!approvalFlow) {
        throw new AppError(400, 'No approval flow configured for this user. Please contact the admin to create an approval flow before creating a Dump Register.');
      }
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        console.log(data)
        console.log("Creating Dump Register with data:", JSON.stringify(data, null, 2));

        // Expecting data.dumpProducts to be an array of { productId, variantId, uomId, quantity, unitPrice, amount }
        if (!data.dumpProducts || !Array.isArray(data.dumpProducts) || data.dumpProducts.length === 0) {
          throw new Error("dumpProducts array is required and must not be empty");
        }

        console.log("Creating dump register header...");
        // Create the dump register header
        // Handle both companyId/companyName field names
        const companyId = data.companyId || data.companyName;
        const locationId = data.locationId || data.location;
        const grnId = data.grn || data.grnNo;
        const deliveryChallanId = data.deliveryChallanNo || data.deliveryChallan;
        const rbcId = data.rbcNo || data.rbc;
const serialNo = await this.generateSerialNo();

        const dumpRegister = queryRunner.manager.create(this.dumpRegisterRepository.target, {
          dumpNo: serialNo,
          companyName: companyId ? { id: companyId } : undefined,
          location: locationId ? { id: locationId } : undefined,
          grn: grnId ? { id: grnId } : undefined,
          deliveryChallanNo: deliveryChallanId ? { id: deliveryChallanId } : undefined,
          rbcNo: rbcId ? { id: rbcId } : undefined,
          requestedBy: data.requestedBy ? { id: data.requestedBy } : undefined,
          date: data.date,
          dumpType: data.dumpType || undefined,
          batchNo: data.batchNo,
          totalQty: data.totalQty,
          totalDumpCost: data.totalDumpCost,
          totalCostInWords: data.totalCostInWords,
          remark: data.remark,
        });

        console.log("Saving dump register...");
        const savedDumpRegister = await queryRunner.manager.save(dumpRegister);
        console.log("Dump register saved with ID:", savedDumpRegister.id);

        console.log("Creating document...");
        // Create document
        const document = await this.documentService.createDocument({
          type: DocumentTypeEnum.DUMP_REGISTER,
          docDef: DocDefEnum.OPERATION,
          status: DocumentStatus.HOLD,
          remarks: 'Document auto-created with Dump Register',
          lastActionBy: { id: data.requestedBy },
          document_type_id: savedDumpRegister.id,
        });

        console.log("Document created with ID:", document.id);
        console.log("Starting approval flow...");

        console.log("Creating dump products and updating inventory...");
        // Create DumpProduct records and update inventory
        for (const productData of data.dumpProducts) {
          console.log("Processing product:", productData);
          // Handle both field name variations
          const productId = productData.productId || productData.productName;
          const variantId = productData.variantId || productData.variant;
          const uomId = productData.uomId || productData.uom;
          const quantity = productData.quantity;
          const unitPrice = productData.unitPrice;
          const amount = productData.amount;

          if (!productId) {
            throw new Error("Each dump product must have productId/productName");
          }

          const dumpQty = Number(quantity ?? 0);
          const dumpAmt = Number(amount ?? 0);

          if (dumpQty <= 0) continue;

          // Create DumpProduct record
          const dumpProductData: any = {
            dumpRegister: { id: savedDumpRegister.id },
            productName: { id: productId },
            quantity: dumpQty,
            unitPrice: Number(unitPrice ?? 0),
            amount: dumpAmt,
          };

          if (variantId) {
            dumpProductData.variant = { id: variantId };
          }

          if (uomId) {
            dumpProductData.uom = { id: uomId };
          }

          const dumpProduct = queryRunner.manager.create(this.dumpProductRepository.target, dumpProductData);
          await queryRunner.manager.save(dumpProduct);

          // Update inventory stock
          const companyId = data.companyId || data.companyName;
          const locationId = data.locationId || data.location;

          let stock = await queryRunner.manager.findOne(this.inventoryStockRepository.target, {
            where: {
              company: { id: companyId },
              location: { id: locationId },
              product: { id: productId },
              variant: variantId ? { id: variantId } : IsNull(),
            },
          });

          if (!stock) {
            // Create new stock record if it doesn't exist
            const stockData: Record<string, any> = {
              company: { id: companyId },
              location: { id: locationId },
              product: { id: productId },
              inwardQty: 0,
              inwardAmt: 0,
              dumpQty: dumpQty,
              dumpAmt: dumpAmt,
            };

            if (variantId) {
              stockData.variant = { id: variantId };
            }

            stock = queryRunner.manager.create(this.inventoryStockRepository.target, stockData);
          } else {
            // Update existing stock
            stock.inwardQty = Number(stock.inwardQty ?? 0) - dumpQty;
            stock.inwardAmt = Number(stock.inwardAmt ?? 0) - dumpAmt;
            stock.dumpQty = Number(stock.dumpQty ?? 0) + dumpQty;
            stock.dumpAmt = Number(stock.dumpAmt ?? 0) + dumpAmt;
          }

          if (stock) {
            await queryRunner.manager.save(stock);
            console.log(`Updated stock for variant ${variantId}: -${dumpQty} inwardQty, +${dumpQty} dumpQty`);
          }
        }

        // Commit transaction - all operations succeeded
        await queryRunner.commitTransaction();

        // Start approval flow after commit so dump register is visible to other DB connections
        await this.documentService.startApprovalFlow(document.id);

        return savedDumpRegister;
      } catch (error) {
        // Rollback transaction - undo all changes
        await queryRunner.rollbackTransaction();
        console.error('Error creating Dump Register:', error);
        // Re-throw the original error with more context
        if (error instanceof Error) {
          throw new Error(`Failed to create Dump Register: ${error.message}`);
        }
        throw error;
      } finally {
        // Release query runner
        await queryRunner.release();
      }
    }

  async getAllRecycleBinDumpRegisters(queryOptions:PaginationOptions, userId: string): Promise<any> {

      const {data, meta} = await this.docDoubleApproverService.getAllDocumentByUserIdForDoubleApprover(
        userId,
        DocumentTypeEnum.DUMP_REGISTER,
        queryOptions
      );
 const { search } = queryOptions;
     
      
      const typedDocuments = data as DocumentWithRelatedData[];
      const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === true);
          for (const doc of activeDocuments) {
            if (!doc.document_type_id) continue;
            try {
              doc.relatedData = await this.dumpRegisterRepository.findOne({
                where: { id: doc.document_type_id, isDeleted:true },
                relations: ['companyName', 'location', 'grn', 'deliveryChallanNo', 'rbcNo', 'dumpProducts', 'dumpProducts.productName', 'dumpProducts.uom'],
              });
      
            } catch {
              doc.relatedData = null;
            }
          }
      
          let relatedDataOnly = activeDocuments
            .filter((doc) => doc.relatedData)
            .map((doc) => ({
              documentId: doc.id,
              overAllStatus: doc.status,
              createdBy: doc.lastActionBy?.firstName + ' ' + doc.lastActionBy?.lastName,
              createdDate: formatDateTime(doc.createdAt).createdDate,
              createdTime: formatDateTime(doc.createdAt).createdTime,
              id: doc.relatedData.id,
              dumpNo: doc.relatedData.dumpNo,
              companyName: doc.relatedData?.companyName?.name || null,
              location: doc.relatedData?.location?.name || null,
              grn: doc.relatedData?.grn?.grnNo || null,
              deliveryChallanNo: doc.relatedData?.deliveryChallanNo?.challanNo || null,
              rbcNo: doc.relatedData?.rbcNo?.rbcNo || null,
              date: doc.relatedData.date,
              batchNo: doc.relatedData.batchNo,
              totalQty: doc.relatedData.totalQty,
              totalDumpCost: doc.relatedData.totalDumpCost,
              totalCostInWords: doc.relatedData.totalCostInWords,
              remark: doc.relatedData.remark,
              dumpType: doc.relatedData.dumpType || null,
            }));

             // 🔍 Deep search helper
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj).map((v) => objectToString(v)).join(' ');
    }
    return String(obj);
  };

  // 🔍 Apply search filter
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
    }
  
  //TODO: Document for view
      async getDumpRegisterById(id: string): Promise<any> {
        const dumpRegister = await this.dumpRegisterRepository.findOne({
          where: { id },
          relations: ["location", "grn", "requestedBy", "dumpProducts", "dumpProducts.productName", "dumpProducts.uom","companyName","location"],
        });
      
        if (!dumpRegister) {
          throw new Error(`Dump Register with ID ${id} not found`);
        }

        const rawDate = dumpRegister.createdAt;
        const { createdDate, createdTime } = formatDateTime(rawDate);
      
        return {
          id: dumpRegister.id,
          companyName: dumpRegister.companyName?.id,
          createdDate: createdDate, 
          createdTime: createdTime,   
          location: dumpRegister.location ? dumpRegister.location.id : null,
          date: dumpRegister.date,
          totalDumpCost: dumpRegister.totalDumpCost,
          totalCostInWords: dumpRegister.totalCostInWords,
          batchNo: dumpRegister.batchNo,
          remark: dumpRegister.remark,
          grn: dumpRegister.grn ? dumpRegister.grn.id : null,
            
          requestedBy: dumpRegister.requestedBy
            ? {
                id: dumpRegister.requestedBy.id,
                firstName: dumpRegister.requestedBy.firstName,
                lastName: dumpRegister.requestedBy.lastName,
              }
            : null,
          dumpProducts: dumpRegister.dumpProducts.map((dumpProduct) => ({
            id: dumpProduct.id,
            productName: dumpProduct.productName ? {
              id:dumpProduct.productName.id ,
              productName:dumpProduct.productName.name
            }: null,

              varient: dumpProduct.variant ? {
              id:dumpProduct.variant.id ,
              productName:dumpProduct.variant.variantName
            }: null,
            uom: dumpProduct.uom ?{ id:dumpProduct.uom.id,unit:dumpProduct.uom.unit }: null,
           
            quantity: dumpProduct.quantity,
            amount:dumpProduct.amount,
            unitPrice:dumpProduct.unitPrice
           
          })),
        };
      }

       async getDumpRegisterByIdforUpdate(id: string): Promise<any> {
        const dumpRegister = await this.dumpRegisterRepository.findOne({
          where: { id },
          relations: ["location", "grn", "deliveryChallanNo", "rbcNo", "requestedBy", "dumpProducts", "dumpProducts.productName", "dumpProducts.variant", "dumpProducts.uom", "companyName"],
        });
      
        if (!dumpRegister) {
          throw new Error(`Dump Register with ID ${id} not found`);
        }

        const rawDate = dumpRegister.createdAt;
        const { createdDate, createdTime } = formatDateTime(rawDate);
      
        return {
          id: dumpRegister.id,
          dumpNo: dumpRegister.dumpNo || null,
          companyName: dumpRegister.companyName?.id,
          createdDate: createdDate, 
          createdTime: createdTime, 
          dumpType: dumpRegister.dumpType || null,
          location: dumpRegister.location ? dumpRegister.location.id : null,
          date: dumpRegister.date,
          totalDumpCost: dumpRegister.totalDumpCost,
          totalCostInWords: dumpRegister.totalCostInWords,
          totalQty: dumpRegister.totalQty,
          batchNo: dumpRegister.batchNo,
          remark: dumpRegister.remark,
          grn: dumpRegister.grn?.id || null,
          deliveryChallanNo: dumpRegister.deliveryChallanNo?.id || null,
          rbcNo: dumpRegister.rbcNo?.id || null,
          requestedBy: dumpRegister.requestedBy?.id || null,
          dumpProducts: dumpRegister.dumpProducts.map((dumpProduct) => ({
            id: dumpProduct.id,
            productName: dumpProduct.productName?.id || null,
            variant: dumpProduct.variant?.id || null,
            uom: dumpProduct.uom?.id || null,
            quantity: dumpProduct.quantity,
            amount: dumpProduct.amount,
            unitPrice: dumpProduct.unitPrice,
          })),
        };
      }

      //TODO: Get DumpRegister for View
       async getDumpRegisterByIdforView(docId: string): Promise<any> {

        const document = await this.docDoubleApproverService.getDocumentById(docId);
        const id = document.documentTypeId;

        if(id){
        const dumpRegister = await this.dumpRegisterRepository.findOne({
          where: { id },
          relations: ["location", "grn", "requestedBy", "dumpProducts", "dumpProducts.productName", "dumpProducts.variant", "dumpProducts.uom", "companyName", "deliveryChallanNo", "rbcNo"],
        });
      
        if (!dumpRegister) {
          throw new Error(`Dump Register with ID ${id} not found`);
        }

        const rawDate = dumpRegister.createdAt;
        const { createdDate, createdTime } = formatDateTime(rawDate);
      
        return {
          id: dumpRegister.id,
          dumpNo: dumpRegister.dumpNo || null,
          grn: dumpRegister.grn?.grnNo || null,
          deliveryChallanNo: dumpRegister.deliveryChallanNo?.challanNo || null,
          rbcNo: dumpRegister.rbcNo?.rbcNo || null,
          dumpType: dumpRegister.dumpType || null,
          companyName: dumpRegister.companyName?.name || null,
          createdDate: createdDate, 
          createdTime: createdTime,   
          location: dumpRegister.location?.name || null,
          date: dumpRegister.date,
          totalDumpCost: dumpRegister.totalDumpCost,
          totalCostInWords: dumpRegister.totalCostInWords,
          totalQty: dumpRegister.totalQty,
          batchNo: dumpRegister.batchNo,
          remark: dumpRegister.remark,
          requestedBy: dumpRegister.requestedBy
            ? `${dumpRegister.requestedBy.firstName} ${dumpRegister.requestedBy.lastName}`
            : null,
          dumpProducts: dumpRegister.dumpProducts.map((dumpProduct) => ({
            id: dumpProduct?.id,
            productName: dumpProduct.productName?.name,
            variant: dumpProduct.variant?.variantName || null,
            uom: dumpProduct.uom?.unit || null,
            quantity: dumpProduct.quantity,
            amount: dumpProduct.amount,
            unitPrice: dumpProduct.unitPrice,
          })),
          overAllStatus: document.overAllStatus,
          createdBy: document.createdBy,
          approvalSummary: document.approvalSummary,
          documentId: document.documentId,
        };
      }
      }
//     async getAllDumpRegisters(queryOptions:PaginationOptions, userId: string): Promise<any> {

//       const {data, meta} = await this.docDoubleApproverService.getAllDocumentByUserIdForDoubleApprover(
//         userId,
//         DocumentTypeEnum.DUMP_REGISTER,
//         queryOptions
//       );
//  const { search } = queryOptions;
//       // let queryBuilder = await this.dumpRegisterRepository
//       // .createQueryBuilder("dump_register") 
//       // .leftJoinAndSelect("dump_register.location", "location")
//       // .leftJoinAndSelect("dump_register.dumpProducts", "dumpProducts")
//       // .leftJoinAndSelect("dump_register.grn", "grn")
//       // .leftJoinAndSelect("dump_register.requestedBy", "requestedBy")
//       // .leftJoinAndSelect("dumpProducts.productName", "productName") 
//       // .leftJoinAndSelect("dumpProducts.uom", "uom")
//       // .leftJoinAndSelect("dump_register.companyName", "companyName")
//       // .orderBy("dump_register.createdAt", "DESC");
    
//       //   const { data, meta } = await buildQuery(queryBuilder, queryOptions, 'dump_register');
      
//       const typedDocuments = data as DocumentWithRelatedData[];
//           for (const doc of typedDocuments) {
//             if (!doc.document_type_id) continue;
//             try {
//               doc.relatedData = await this.dumpRegisterRepository.findOne({
//                 where: { id: doc.document_type_id },
//                 relations: ['companyName', 'location', 'dumpProducts', 'dumpProducts.productName', 'dumpProducts.uom'],
//               });
      
//             } catch {
//               doc.relatedData = null;
//             }
//           }
      
//           let relatedDataOnly = typedDocuments
//             .filter((doc) => doc.relatedData)
//             .map((doc) => ({
//               documentId: doc.id,
//               overAllStatus: doc.status, 
//               createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
//               createdDate: formatDateTime(doc.createdAt).createdDate,
//               createdTime: formatDateTime(doc.createdAt).createdTime,
//               ...doc.relatedData,
//               companyName: doc.relatedData.companyName.name || null,
//               location: doc.relatedData.location.name || null,
//             })
//             );

//              // 🔍 Deep search helper
//   const objectToString = (obj: any): string => {
//     if (obj == null) return '';
//     if (typeof obj === 'object') {
//       return Object.values(obj).map((v) => objectToString(v)).join(' ');
//     }
//     return String(obj);
//   };

//   // 🔍 Apply search filter
//   if (search && search.trim()) {
//     const term = search.toLowerCase();
//     relatedDataOnly = relatedDataOnly.filter((item) =>
//       objectToString(item).toLowerCase().includes(term)
//     );
//   }
//    // 🔄 Sorting
//   if (queryOptions.sort) {
//     const [field, direction] = queryOptions.sort.split(':');
//     const sortOrder = direction?.toUpperCase() === 'DESC' ? -1 : 1;

//     const getNestedValue = (obj: any, path: string) =>
//       path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);

//     relatedDataOnly.sort((a, b) => {
//       const valA = getNestedValue(a, field);
//       const valB = getNestedValue(b, field);

//       if (valA == null && valB == null) return 0;
//       if (valA == null) return -1 * sortOrder;
//       if (valB == null) return 1 * sortOrder;

//       if (!isNaN(valA) && !isNaN(valB)) {
//         return (Number(valA) - Number(valB)) * sortOrder;
//       }
//       return String(valA).localeCompare(String(valB)) * sortOrder;
//     });
//   }
      
//              return {
//         data: relatedDataOnly,
//         meta: {
//           total: meta.total,
//           page: meta.page,
//           pages: meta.pages
//         }
//       };
      

//     //     return {
//     // data :data.map(dumpRegister => {
//     //   const rawDate = dumpRegister.createdAt;
//     //   const { createdDate, createdTime } = formatDateTime(rawDate);
//     //   return {
//     //     id: dumpRegister.id,
//     //     companyName: dumpRegister.companyName?.name || null,
//     //     location: dumpRegister.location ? dumpRegister.location.name : null,
//     //     createdDate: createdDate,
//     //     createdTime: createdTime,
//     //     date: dumpRegister.date,
//     //     batchNo: dumpRegister.batchNo,
//     //     remark: dumpRegister.remark,
//     //     grn: dumpRegister.grn
//     //       ? {
//     //           id: dumpRegister.grn.id || null,
//     //           grnNo: dumpRegister.grn.grnNo,
//     //         }
//     //       : null,
//     //     requestedBy: dumpRegister.requestedBy
//     //       ? {
//     //           id: dumpRegister.requestedBy.id || null,
//     //           firstName: dumpRegister.requestedBy.firstName,
//     //           lastName: dumpRegister.requestedBy.lastName,
//     //         }
//     //       : null,
//     //     dumpProducts: dumpRegister.dumpProducts.map((dumpProduct) => ({
//     //       id: dumpProduct.id,
//     //       product: dumpProduct.productName?.name || null,
//     //       uom: dumpProduct.uom.unit || null,
//     //       variety:dumpProduct.variety,
//     //       count:dumpProduct.count,
//     //       size:dumpProduct.size,
//     //       origin:dumpProduct.origin,
//     //       quantity: dumpProduct.quantity,
//     //       amount:dumpProduct.amount,
//     //       unitPrice:dumpProduct.unitPrice
//     //     })),
//     //   };
//     // }),
//     // meta,
//     //     }
// }
async getAllDumpRegisters(queryOptions:PaginationOptions, userId: string): Promise<any> {

      const {data, meta} = await this.docDoubleApproverService.getAllDocumentByUserIdForDoubleApprover(
        userId,
        DocumentTypeEnum.DUMP_REGISTER,
        queryOptions
      );
 const { search } = queryOptions;
      // let queryBuilder = await this.dumpRegisterRepository
      // .createQueryBuilder("dump_register") 
      // .leftJoinAndSelect("dump_register.location", "location")
      // .leftJoinAndSelect("dump_register.dumpProducts", "dumpProducts")
      // .leftJoinAndSelect("dump_register.grn", "grn")
      // .leftJoinAndSelect("dump_register.requestedBy", "requestedBy")
      // .leftJoinAndSelect("dumpProducts.productName", "productName") 
      // .leftJoinAndSelect("dumpProducts.uom", "uom")
      // .leftJoinAndSelect("dump_register.companyName", "companyName")
      // .orderBy("dump_register.createdAt", "DESC");
    
      //   const { data, meta } = await buildQuery(queryBuilder, queryOptions, 'dump_register');
      
      const typedDocuments = data as DocumentWithRelatedData[];
      //const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === false);
      const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === false)
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());  
      for (const doc of activeDocuments) {
            if (!doc.document_type_id) continue;
            try {
              doc.relatedData = await this.dumpRegisterRepository.findOne({
                where: { id: doc.document_type_id, isDeleted:false },
                relations: ['companyName', 'location', 'grn', 'deliveryChallanNo', 'rbcNo', 'dumpProducts', 'dumpProducts.productName', 'dumpProducts.uom'],
              });
      
            } catch {
              doc.relatedData = null;
            }
          }
      
          let relatedDataOnly = activeDocuments
            .filter((doc) => doc.relatedData)
            .map((doc) => ({
              documentId: doc.id,
              overAllStatus: doc.status,
              createdBy: doc.lastActionBy?.firstName + ' ' + doc.lastActionBy?.lastName,
              createdDate: formatDateTime(doc.createdAt).createdDate,
              createdTime: formatDateTime(doc.createdAt).createdTime,
              id: doc.relatedData.id,
              dumpNo: doc.relatedData.dumpNo,
              companyName: doc.relatedData?.companyName?.name || null,
              location: doc.relatedData?.location?.name || null,
              grn: doc.relatedData?.grn?.grnNo || null,
              deliveryChallanNo: doc.relatedData?.deliveryChallanNo?.challanNo || null,
              rbcNo: doc.relatedData?.rbcNo?.rbcNo || null,
              date: doc.relatedData.date,
              batchNo: doc.relatedData.batchNo,
              totalQty: doc.relatedData.totalQty,
              totalDumpCost: doc.relatedData.totalDumpCost,
              totalCostInWords: doc.relatedData.totalCostInWords,
              remark: doc.relatedData.remark,
              dumpType: doc.relatedData.dumpType || null,
            }));

             // 🔍 Deep search helper
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj).map((v) => objectToString(v)).join(' ');
    }
    return String(obj);
  };

  // 🔍 Apply search filter
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
    }
    
public async updateDumpRegister(
  id: string,
  data: Partial<DumpRegister>,
  updatedBy: string
): Promise<DumpRegister | null> {
  
  const existingDumpRegister = await this.dumpRegisterRepository.findOne({
    where: { id },
    relations: ["dumpProducts"],
  });

  if (!existingDumpRegister) {
    throw new Error("DumpRegister entry not found");
  }

  
  const oldData = { ...existingDumpRegister };

 
  const { dumpProducts, ...updateData } = data;

  
  Object.assign(existingDumpRegister, updateData);

  
  if (dumpProducts && Array.isArray(dumpProducts)) {
    
    await this.dumpProductRepository.delete({ dumpRegister: { id } });

    const newDumpProducts = dumpProducts.map(product => {
      return this.dumpProductRepository.create({
        ...product,
        dumpRegister: existingDumpRegister, 
      });
    });

    await this.dumpProductRepository.save(newDumpProducts);
    existingDumpRegister.dumpProducts = newDumpProducts;
  }

 
  const updatedDumpRegister = await this.dumpRegisterRepository.save(existingDumpRegister);


  await this.auditLogService.logChange(
    'DumpRegister',        
    id,                    
    oldData,               
    updatedDumpRegister,   
    updatedBy              
  );

  return updatedDumpRegister;
}


    
     
async deleteDumpRegister(id: string): Promise<boolean> {
  
  const dumpRegister = await this.dumpRegisterRepository.findOne({
    where: { id },
  });

  if (!dumpRegister) {
    throw new AppError(404, `Dump Register with ID ${id} not found`);
  }

 
  const now = new Date();
  const sixMonthsFromNow = new Date(now);
  sixMonthsFromNow.setMonth(now.getMonth() + 6); 
  sixMonthsFromNow.setHours(0, 0, 0, 0); 

  console.log(`Dump Register with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`);

  
  dumpRegister.deletionScheduledAt = sixMonthsFromNow;

  
  await this.dumpRegisterRepository.save(dumpRegister);

  console.log(`Dump Register with ID ${id} marked for deletion in 6 months.`);
  return true;
}

async dumpcount():Promise<number>{
  const count = await this.dumpRegisterRepository.count();
  return count; 
}

async totaldumpquantity():Promise<number>{
  const total = await this.dumpRegisterRepository.createQueryBuilder("dumpRegister")
  .select("SUM(dumpRegister.totalQty)", "total")
  .getRawOne();
  return total.total;
}
// async totaldumpcost():Promise<number>{
//   const total = await this.dumpRegisterRepository.createQueryBuilder("dumpRegister")
//   .select("SUM(dumpRegister.totalCost)", "total")
//   .getRawOne();
//   return total.total;
// }

async totaldumpcost(): Promise<number> {
  const total = await this.dumpRegisterRepository
    .createQueryBuilder("dumpRegister")
    .leftJoin("dumpRegister.dumpProducts", "dumpProduct") // Join DumpProduct
    .select("SUM(dumpProduct.amount)", "total") // Sum dumpCost from DumpProduct
    .getRawOne();

  return total.total ? Number(total.total) :0; // Ensure it returns a number
}


async totalqunatityandtotaldumpcostfromstartdatetoenddate(startdate: Date, enddate: Date): Promise<any> {
  const total = await this.dumpRegisterRepository
    .createQueryBuilder("dumpRegister")
    .leftJoin("dumpRegister.dumpProducts", "dumpProduct") // Join DumpProduct
    .select("SUM(dumpRegister.totalQty)", "totalQuantity") // Sum totalQty from DumpRegister
    .addSelect("SUM(dumpProduct.amount)", "totalCost") // Sum dumpCost from DumpProduct
    .where("dumpRegister.date BETWEEN :startdate AND :enddate", { startdate: startdate, enddate: enddate })
    .getRawOne();

  console.log(total);
  return total;
}
async getDumpRegisterlocation(location: string): Promise<any> { 
  const total = await this.dumpRegisterRepository
  .createQueryBuilder("dumpRegister")
  .leftJoin("dumpRegister.location", "location")
  .where("location.id = :location", { location: location })
  .getMany();
  return total; 
}

async getDumpRegisterByCompanyName(companyName: string): Promise<any> {
  const total = await this.dumpRegisterRepository
    .createQueryBuilder("dumpRegister")
    .leftJoin("dumpRegister.companyName", "companyName")
    .where("companyName.id = :companyName", { companyName: companyName })
    .getMany();

  return total; 
}

public async getDumpDataForDates(
  filterType?: string,
  startDate?: string,
  endDate?: string
): Promise<any[]> {
  let query = this.dumpProductRepository
    .createQueryBuilder("dumpProducts")
    .select("TO_CHAR(dumpRegister.date, 'YYYY-MM-DD')", "date")
    .addSelect("COALESCE(SUM(dumpProducts.quantity), 0)", "totalQuantity")
    .addSelect("COALESCE(SUM(dumpProducts.amount), 0)", "totalCost")
    .innerJoin(DumpRegister, "dumpRegister", "dumpRegister.id = dumpProducts.dumpRegister") // Fixed alias here
    .groupBy("TO_CHAR(dumpRegister.date, 'YYYY-MM-DD')")
    .orderBy("TO_CHAR(dumpRegister.date, 'YYYY-MM-DD')", "ASC");

  
  const currentDate = new Date().toISOString().split("T")[0]; 

  switch (filterType) {
    case "tillDate":
      query = query.andWhere("dumpRegister.date <= :currentDate", { currentDate });
      break;

    case "financialYear": {
      const today = new Date();
      const financialYearStart =
        today.getMonth() + 1 >= 4 
          ? `${today.getFullYear()}-04-01`
          : `${today.getFullYear() - 1}-04-01`;
      query = query.andWhere("dumpRegister.date BETWEEN :start AND :end", {
        start: financialYearStart,
        end: currentDate,
      });
      break;
    }

    case "today":
      query = query.andWhere("TO_CHAR(dumpRegister.date, 'YYYY-MM-DD') = :currentDate", {
        currentDate,
      });
      break;

    case "dateRange":
      if (startDate && endDate) {
        query = query.andWhere("dumpRegister.date BETWEEN :start AND :end", {
          start: startDate,
          end: endDate,
        });
      }
      break;

    default:
      break; 
  }

  const result = await query.getRawMany();

  return result.map((row) => ({
    date: row.date,
    quantity: Number(row.totalQuantity),
    amount: Number(row.totalCost),
  }));
}
public async deleteMultipleDumpRegisters(ids: string[]): Promise<any> {
  const success: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      const dumpRegister = await this.dumpProductRepository.findOne({
        where: { id },
      });
      if (!dumpRegister) {
        failed.push({ id, reason: 'AQR not found' });
        continue;
      }
      const relatedDocument = await this.documentbRepository.findOne({
        where: { document_type_id: dumpRegister.id }
      });

      if (!relatedDocument) {
        throw new Error(`Something went wrong`);
      }

      const deleteDocument = await this.documentbRepository.delete(relatedDocument.id);
      if (!deleteDocument) {
        throw new Error(`Failed to delete related document with ID ${relatedDocument.id}`);
      }

      const deleteAqr = await this.dumpRegisterRepository.delete(dumpRegister.id);
      if (!deleteAqr) {
        throw new Error(`Failed to delete Dump Register with ID ${id}`);
      }
      success.push(id);
    } catch (error: any) {
      failed.push({ id, reason: error.message || 'Unknown error' });
    }
  }
  // const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
  // return { success, failed, message };
     return { message: 'Dump records marked for deletion successfully' };
}

}