import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { SecondSaleRepository } from "../repositories/secondSale.repository";

import { SecondSale } from "../entities/secondSale.entity";
import AppError from "../utils/appError";
import { AuditLogService } from "./auditLog.service";
import { DataSource, EntityManager, getManager, ILike, In } from "typeorm";
import { SecondSaleProduct } from "../entities/secondSaleProduct.entity";

import logger from "../utils/logger";
import { SecondSaleProductRepository } from "../repositories/secondSaleProduct.repository";
import { buildQuery, PaginationOptions } from "../utils/pagination";
import { formatDateTime } from "../utils/dateUtils";

import { DocumentTypeEnum } from '../entities/docuemnt.entity';
import { DocumentStatus } from '../entities/docuemnt.entity';
import { DocumentTypeEnum as DocDefEnum } from '../entities/documentdef.entity';
import { DocumentbService, DocumentWithRelatedData } from "./documentb.service";
import { DocDoubleApproverService } from "./docDoubleApprover.service";
import { ApprovalFlowService } from "./approvalFlow.service";
import { ProductVarientRepository } from "../repositories/varients.repository";
import { DocumentbRepository } from "../repositories/documentb.repository";


@injectable()
export class SecondSaleService {
  constructor(
    @inject(TYPES.SecondSaleRepository)
    private readonly secondSaleRepository: SecondSaleRepository,
    @inject(TYPES.SecondSaleProductRepository)
    private readonly secondSaleProductRepository: SecondSaleProductRepository,
    @inject(TYPES.AuditLogService) private auditLogService: AuditLogService,
    @inject(TYPES.DocumentbRepository) private documentbRepository:DocumentbRepository,
    @inject(TYPES.ProductVarientRepository)
          private productVarientsRepository: ProductVarientRepository,
    @inject(TYPES.DataSource)
    private readonly AppDataSource: DataSource,
    @inject(TYPES.DocumentbService)
    private readonly documentbService: DocumentbService,
    @inject(TYPES.DocDoubleApproverService) private readonly docDoubleApproverService: DocDoubleApproverService, // Assuming you have a service for double approval
    @inject(TYPES.ApprovalFlowService)
        private approvalFlowService: ApprovalFlowService 

  ) { }

  private async generateSerialNo(prefix: string): Promise<string> {
    // Get the count of existing GRNs for the branch (or use another unique mechanism)
    const count = await this.secondSaleRepository.count({
      where: { secondSaleNO: ILike(`${prefix}%`) },
    });
    console.log(count);
    // Generate the serial number in the format "PREFIX-001"
    const serialNo = `${prefix}-${(count + 1).toString().padStart(5, '0')}`;
    return serialNo;
  }





  public async createSecondSale(secondSaleData: any, requestedBy: any): Promise<any> {
    const queryRunner = this.AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      //TODO: Check approval flow is exit or not for logged user

       const approvalFlowExit = this.approvalFlowService.findApprovalFlowForLoggedUser(requestedBy, 'second-sale')

      if (!approvalFlowExit) {
        throw new Error('Approval flow not found');
      }
   // 1. Normalize variant IDs
      let variantIds: string[] = [];
      if (Array.isArray(secondSaleData.variants)) {
        variantIds = secondSaleData.variants;
      } else if (secondSaleData.variants) {
        variantIds = [secondSaleData.variants];
      }

      // 2. Fetch variants with product relation
      const variants = await queryRunner.manager.find(this.productVarientsRepository.target, {
        where: { id: In(variantIds) },
        relations: ['product'],
      });

      // 3. Extract product IDs from variants
      const productIds = variants.map(v => v.product?.id).filter(Boolean);
const serialNo = await this.generateSerialNo("SSL");
      secondSaleData.secondSaleNO = serialNo;
      const secondSale = queryRunner.manager.create(this.secondSaleRepository.target, {
        ...secondSaleData,
        variants: variants.map(v => ({ id: v.id })), // only IDs
        products: productIds.map(id => ({ id })),   // only IDs
      });
      const savedSecondSale = await queryRunner.manager.save(secondSale);

      const document = await this.documentbService.createDocument({
        type: DocumentTypeEnum.SECOND_SALE,
        docDef: DocDefEnum.SALE,
        // totalAmt: rfpaData.totalAmt,
        status: DocumentStatus.HOLD,
        remarks: 'Document auto-created with SecondSale',
        lastActionBy: { id: requestedBy },
        document_type_id: Array.isArray(savedSecondSale) ? (savedSecondSale[0] as SecondSale)?.id : (savedSecondSale as SecondSale).id
      }, );

      await this.documentbService.startApprovalFlow(document.id);

      // Commit transaction - all operations succeeded
      await queryRunner.commitTransaction();

      return savedSecondSale;
    } catch (error: any) {
      // Rollback transaction - undo all changes
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }





  public async getAllSecondSales(queryOptions: PaginationOptions, userId: string): Promise<any> {
    try {

      const { data, meta } = await this.docDoubleApproverService.getAllDocumentByUserIdForDoubleApprover(
        userId,
        DocumentTypeEnum.SECOND_SALE,
        queryOptions
      );
const { search } = queryOptions;
     // console.log("Data: ", data);
      
      const typedDocuments = data as DocumentWithRelatedData[];
      for (const doc of typedDocuments) {
        if (!doc.document_type_id) continue;
        try {
          doc.relatedData = await this.secondSaleRepository.findOne({
            where: { id: doc.document_type_id },
            relations: [
              "companyName",
              "location"
            ],
          });

        } catch {
          doc.relatedData = null;
        }
      }

 //     console.log("typedDocuments: ", typedDocuments);
      

      let relatedDataOnly = typedDocuments
     //   .filter((doc) => doc.relatedData)
        .map((doc) => ({
          documentId: doc.id,
          overAllStatus: doc.status,
          createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
          createdDate: formatDateTime(doc.createdAt).createdDate,
          createdTime: formatDateTime(doc.createdAt).createdTime,
          ...doc.relatedData,
          companyName: doc.relatedData.companyName.name || null,
         // location: doc.relatedData.location.name || null,
        })
        );
//console.log("Related data : ", relatedDataOnly);


    // 🔍 Deep search logic
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
// 🔄 Sorting (same as other methods)
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



      // let query = this.secondSaleRepository
      //   .createQueryBuilder("secondSale")
      //   .leftJoinAndSelect("secondSale.secondSaleProducts", "secondSaleProducts")
      //   .leftJoinAndSelect("secondSale.companyName", "companyName")
      //   .leftJoinAndSelect("secondSaleProducts.productName", "product")
      //   .leftJoinAndSelect("secondSaleProducts.uom", "uom") // Join with UOM entity
      //   .select([
      //     "secondSale",
      //     "secondSaleProducts.id",

      //     "companyName.name",
      //     "product.name",
      //     "uom.unit",
      //   ]);

      // const result = await buildQuery(query, queryOptions, "secondSale");

      // const formatData = result.data.map((data: any) => ({
      //   ...data,
      //   companyName: data.companyName?.name || null, // Handle potential null values
      //   secondSaleProducts: data.secondSaleProducts?.map((productData: any) => ({
      //     ...productData,
      //     product: productData.product?.name || null, // Handle potential null values
      //     uom: productData.uom?.unit || null,
      //   })) || [],
      // }));
      // console.log("formatedData is ",formatData)
      // console.log("result is ",result)
      // return { ...result, data: formatData };
    } catch (error) {
      console.error("Error fetching SecondSale:", error);
      throw error;
    }
  }

  public async getSecondSaleById(id: string): Promise<SecondSale | null> {
    try {
      const secondSale = await this.secondSaleRepository
        .createQueryBuilder("secondSale")
        .leftJoinAndSelect(
          "secondSale.secondSaleProducts",
          "secondSaleProducts"
        )
        .leftJoinAndSelect("secondSale.companyName", "companyName")
        .leftJoinAndSelect("secondSale.dcNo", "dcNo")
        .leftJoinAndSelect("secondSale.location", "location")
        .leftJoinAndSelect("secondSaleProducts.productName", "product")
        .leftJoinAndSelect("secondSaleProducts.uom", "uom")
        .select([
          "secondSale",
          "secondSaleProducts.id",
          "secondSaleProducts.count",
          "secondSaleProducts.size",
          "secondSaleProducts.quantity",
          "secondSaleProducts.unitPrice",
          "secondSaleProducts.amount",
          "secondSaleProducts.grossWeight",
          "secondSaleProducts.packingMaterialWeight",
          "secondSaleProducts.netWeight",
          "location.id",
          "location.name",
          "companyName.id",
          "companyName.name",
          "dcNo.id",
          "dcNo.challanNo",
          "product.id",
          "product.name",
          "uom.id",
          "uom.unit",
        ])
        .where("secondSale.id = :id", { id })
        .getOne();
      console.log(secondSale)
      return secondSale || null;
    } catch (error) {
      console.error("Error fetching SecondSale by ID:", error);
      throw error;
    }
  }

  public async getSecondSaleByIdForView(docId: string): Promise<any> {
    
console.log("docid: ", docId);

      const document = await this.docDoubleApproverService.getDocumentById(docId);
   //   console.log("***********************");
      
      const id = document.documentTypeId;

      console.log("Document data:", id);
      

      if(id){
      const secondSale = await this.secondSaleRepository
        .createQueryBuilder("secondSale")
        .leftJoinAndSelect(
          "secondSale.secondSaleProducts",
          "secondSaleProducts"
        )
        .leftJoinAndSelect("secondSale.companyName", "companyName")
        .leftJoinAndSelect("secondSale.dcNo", "dcNo")
        .leftJoinAndSelect("secondSale.location", "location")
        .leftJoinAndSelect("secondSaleProducts.productName", "product")
        .leftJoinAndSelect("secondSaleProducts.uom", "uom")

        .where("secondSale.id = :id", { id })
        .getOne();
      if (!secondSale) {
        throw new AppError(404, "Second Sale not found");
      }

      const rawDate = secondSale.createdAt;
      const { createdDate, createdTime } = formatDateTime(rawDate);
      
      return {
        id: secondSale?.id,
        companyName: secondSale?.companyName?.name || null,
        location: secondSale?.location?.name || null,
        dcNo: secondSale?.dcNo.challanNo || null,
        sale: secondSale?.saleDate || null,
        createdDate,
        createdTime,
        buyerName: secondSale?.buyerName || null,
        buyerMobNo: secondSale?.buyerMobNo || null,
        reasonForSale: secondSale?.reasonForSale || null,
        approvedBy: secondSale?.approvedBy || null,
        soldBy: secondSale?.soldBy || null,
        secondSaleProducts: secondSale?.secondSaleProducts?.map((product: any) => ({
          id: product.id,
          count: product.count,
          size: product.size,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          amount: product.amount,
          grossWeight: product.grossWeight,
          packingMaterialWeight: product.packingMaterialWeight,
          netWeight: product.netWeight,
          productName: product.productName?.name || null,
          uom: product.uom?.unit || null,
        })) || [],
        totalNetWeight: secondSale?.totalNetWeight || null,
        totalAmt: secondSale?.totalAmt || null,
        totalAmtInWords: secondSale?.totalAmtInWords || null,
        paidAmount: secondSale?.paidAmount || null,
        paymentMode: secondSale?.paymentMode || null,
        pendingAmt: secondSale?.pendingAmt || null,
        remarks: secondSale?.remarks || null,
        comments: secondSale?.comments || null,
        submittedBy: secondSale?.submittedBy || null,
        mobileNo: secondSale?.mobileNo || null,

        overAllStatus: document.overAllStatus,
        createdBy: document.createdBy,
        approvalSummary: document.approvalSummary,
        documentId: document.id,
       

      }

      }
    
  }



  public async getSecondSaleByIdForUpdate(id: string): Promise<any> {
    try {
      const secondSale = await this.secondSaleRepository
        .createQueryBuilder("secondSale")
        .leftJoinAndSelect(
          "secondSale.secondSaleProducts",
          "secondSaleProducts"
        )
        .leftJoinAndSelect("secondSale.companyName", "companyName")
        .leftJoinAndSelect("secondSale.dcNo", "dcNo")
        .leftJoinAndSelect("secondSale.location", "location")
        .leftJoinAndSelect("secondSaleProducts.productName", "product")
        .leftJoinAndSelect("secondSaleProducts.uom", "uom")

        .where("secondSale.id = :id", { id })
        .getOne();
      if (!secondSale) {
        throw new AppError(404, "Second Sale not found");
      }
      const rawDate = secondSale.createdAt;
      const { createdDate, createdTime } = formatDateTime(rawDate);
      const formatResponse = {
        id: secondSale?.id,
        companyName: secondSale?.companyName?.id || null,
        location: secondSale?.location?.id || null,
        dcNo: secondSale?.dcNo.id || null,
        sale: secondSale?.saleDate || null,
        createdDate,
        createdTime,
        buyerName: secondSale?.buyerName || null,
        buyerMobNo: secondSale?.buyerMobNo || null,
        reasonForSale: secondSale?.reasonForSale || null,
        approvedBy: secondSale?.approvedBy || null,
        soldBy: secondSale?.soldBy || null,
        secondSaleProducts: secondSale?.secondSaleProducts?.map((product: any) => ({
          id: product.id,
          count: product.count,
          size: product.size,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          amount: product.amount,
          grossWeight: product.grossWeight,
          packingMaterialWeight: product.packingMaterialWeight,
          netWeight: product.netWeight,
          productName: product.productName?.id || null,
          uom: product.uom?.id || null,
        })) || [],
        totalNetWeight: secondSale?.totalNetWeight || null,
        totalAmt: secondSale?.totalAmt || null,
        totalAmtInWords: secondSale?.totalAmtInWords || null,
        paidAmount: secondSale?.paidAmount || null,
        paymentMode: secondSale?.paymentMode || null,
        pendingAmt: secondSale?.pendingAmt || null,
        remarks: secondSale?.remarks || null,
        comments: secondSale?.comments || null,
        submittedBy: secondSale?.submittedBy || null,
        mobileNo: secondSale?.mobileNo || null,



      }
      console.log(secondSale)
      return formatResponse || null;
    } catch (error) {
      console.error("Error fetching SecondSale by ID:", error);
      throw error;
    }
  }

  // // Update a Second Sale document
  // public async updateSecondSale(id: string, secondSaleData: any,updatedBy:string): Promise<SecondSale | null> {
  //     const secondSale = await this.secondSaleRepository.findOne({ where: { id } });

  //     if (!secondSale) {
  //         return null;
  //     }

  //     Object.assign(secondSale, secondSaleData);
  //     return await this.secondSaleRepository.save(secondSale);
  // }
  public async updateSecondSale(
    id: string,
    secondSaleData: any,
    updatedBy: string
  ): Promise<any> {

    const secondSale = await this.secondSaleRepository.findOne({
      where: { id },
    });
    console.log(secondSaleData);
    if (!secondSale) {
      return null;
    }
    //secondSaleData.secondSaleProducts = JSON.parse(secondSaleData.secondSaleProducts);
    // if (secondSaleData.secondSaleProducts) {
    //   secondSaleData.secondSaleProducts = JSON.parse(
    //     secondSaleData.secondSaleProducts
    //   );
      // Map inward products with the correct structure
      //console.log("in service", secondSaleData.secondSaleProducts);
      //  secondSaleData.secondSaleProducts = secondSaleData.secondSaleProducts.map((products: any) => ({
      //     ...product,
      //     product: { id: products.product }, // Map product relation
      //     uom: { id:products.uom }, // Map UOM relation
      // }));
    //}
    const oldData = { ...secondSale }; // Save old data for audit log

    // Update the Second Sale entity
    Object.assign(secondSale, secondSaleData);
    const updatedSecondSale = await this.secondSaleRepository.save(secondSale);

    // Log changes
    const a = await this.auditLogService.logChange(
      "SecondSale", // Entity name
      id, // Entity ID
      oldData, // Old data before the update
      updatedSecondSale, // New data after the update
      updatedBy // User who updated
    );
    //console.log(a)

    return updatedSecondSale; // Return the updated entity
  }

  // Method to delete a Second Sale document (schedule deletion 6 months later)
  public async deleteSecondSale(id: string): Promise<boolean> {
    // Step 1: Find the Second Sale by ID
    const secondSale = await this.secondSaleRepository.findOne({
      where: { id },
    });

    // Step 2: If the Second Sale doesn't exist, return false
    if (!secondSale) {
      return false;
    }

    // Step 3: Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

    // Log the scheduled deletion
    console.log(
      `Second Sale with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`
    );

    // Step 4: Set the deletionScheduledAt field for the Second Sale
    secondSale.deletionScheduledAt = sixMonthsFromNow;

    // Step 5: Save the updated Second Sale with the scheduled deletion date
    await this.secondSaleRepository.save(secondSale);

    // Step 6: Return true to indicate the deletion was scheduled
    console.log(`Second Sale with ID ${id} marked for deletion in 6 months.`);
    return true;
  }

  public async deleteMultipleSecondSale(ids: string[]): Promise<{ success: string[]; failed: { id: string; reason: string }[]; message: string }> {
  const success: string[] = [];
  const failed: { id: string; reason: string }[] = [];  
  for (const id of ids) {
      const secondSale = await this.secondSaleRepository.findOne({
        where: { id },
      });

      if (!secondSale) {
        failed.push({ id, reason: 'Second Sale not found' });
        continue;
      }

      const relatedDocument = await this.documentbRepository.findOne({
        where: { document_type_id: secondSale.id }
      });

      if (!relatedDocument) {
        throw new Error(`Something went wrong`);
      }

      const deleteDocument = await this.documentbRepository.delete(relatedDocument.id);
      if (!deleteDocument) {
        throw new Error(`Failed to delete related document with ID ${relatedDocument.id}`);
      }


      const deleteGrn = await this.secondSaleRepository.delete(secondSale.id);

      if (!deleteGrn) {
        throw new Error(`Failed to delete Second Sale with ID ${id}`);
      }

    }
    const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
    return { success, failed, message};

  }
}
