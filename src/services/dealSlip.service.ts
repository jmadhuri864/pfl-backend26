import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { DealSlipRepository } from "../repositories/dealSlip.repository";
import { DealSlip } from "../entities/dealSlip.entity";

import { RfpaRepository } from "../repositories/rfpa.repository";
import { Between, DeepPartial, LessThan, MoreThanOrEqual, SelectQueryBuilder, DataSource } from "typeorm";
import { Status } from "../utils/status.enum";
import { UserService } from "./user.service";
import { AuditLogService } from "./auditLog.service";
import AppError from "../utils/appError";
import { format } from "date-fns";
import { buildQueryFromArray, PaginationOptions } from "../utils/pagination";
import { formatDateTime } from "../utils/dateUtils";
import { DocumentbService, DocumentWithRelatedData } from "./documentb.service";
import { DocumentTypeEnum } from "../entities/docuemnt.entity";
import { DocumentStatus } from "../entities/docuemnt.entity";
import { DocumentTypeEnum as DocDefEnum } from "../entities/documentdef.entity";
import { DocSingalApproverService } from "./DocSingalApproverService.service";
import { ApprovalFlowService } from "./approvalFlow.service";
import { DocumentbRepository } from "../repositories/documentb.repository";
import { ApprovalFlowRepository } from "../repositories/approvalFlow.repository";


@injectable()
export class DealSlipService {


    constructor(
        @inject(TYPES.DealSlipRepository)
        private readonly dealSlipRepository: DealSlipRepository,
        @inject(TYPES.RfpaRepository)
        private readonly rfpaRepository: RfpaRepository,
       @inject(TYPES.UserService)
       private readonly userService:UserService,
       @inject(TYPES.AuditLogService)
       private readonly auditLogService:AuditLogService,
       @inject(TYPES.DocumentbService)
       private readonly documentbService: DocumentbService, // Adjust the type as per your DocumentbService
       @inject(TYPES.DocSingalApproverService)
       private readonly docSingalApproverService: DocSingalApproverService,
       @inject(TYPES.ApprovalFlowService)
    private approvalFlowService: ApprovalFlowService,
      @inject(TYPES.ApprovalFlowRepository)
    private approvalFlowRepository:ApprovalFlowRepository, 

    @inject(TYPES.DocumentbRepository)
    private readonly documentbRepository: DocumentbRepository,
    @inject(TYPES.DataSource)
    private readonly dataSource: DataSource

      ) {}

    //   async findAllDealSlip(queryOptions:PaginationOptions): Promise<any[]> {
    //     console.log(queryOptions)
    //     const dealSlips = await this.dealSlipRepository
    //         .createQueryBuilder('dealSlip')
    //         .leftJoinAndSelect('dealSlip.rfpa', 'rfpa')
    //         .leftJoinAndSelect('rfpa.selectedVendor', 'selectedVendor')
    //         .leftJoinAndSelect('rfpa.selectedFarmer', 'selectedFarmer')
    //         .leftJoinAndSelect('selectedFarmer.residensialAddress', 'residensialAddress')
    //         .leftJoinAndSelect('selectedVendor.officeAddress', 'officeAddress')
    //         .leftJoinAndSelect('dealSlip.requestedBy', 'requestedBy')
    //         .orderBy('dealSlip.createdAt', 'DESC')
    //         .getMany(); 
   
    //     return dealSlips.map((dealSlip) => {
    //         const rfpa = dealSlip.rfpa; 
            
    //         return {
    //             id: dealSlip.id,
               
    //             lotNo: dealSlip.lotNo,
    //             approvalNote: dealSlip.approvalNote,
    //             loadingLocation: dealSlip.loadingLocation,
    //             remark: dealSlip.remark,
    //             specialRequest: dealSlip.specialRequest,
    //             requestingDepartment: dealSlip.requestingDepartment,
    //             approvalStatus: dealSlip.approvalStatus,
    //             createdDate: dealSlip.createdDate,
    //             createdTime:dealSlip.createdTime,
                
    //             dealSlipNo: dealSlip.dealSlipNo,
    //             requestedBy: dealSlip.requestedBy
    //                 ? {
    //                     id: dealSlip.requestedBy.id,
    //                     firstName: dealSlip.requestedBy.firstName,
    //                     lastName: dealSlip.requestedBy.lastName,
    //                 }
    //                 : null,
    
                
    //         };
    //     });
    // }


  async findAllDealSlip(queryOptions: PaginationOptions): Promise<{ data: any[]; total: number; page: number; totalPages: number }> {
      console.log(queryOptions);
  
     
      const page = queryOptions.page ?? 1; 
      const limit = queryOptions.limit ?? 10;
      const search = queryOptions.search;
      const queryBuilder = this.dealSlipRepository
          .createQueryBuilder("dealSlip")
          .leftJoinAndSelect("dealSlip.rfpa", "rfpa")
          .leftJoinAndSelect("rfpa.selectedVendor", "selectedVendor")
          .leftJoinAndSelect("rfpa.selectedFarmer", "selectedFarmer")
          .leftJoinAndSelect("selectedFarmer.residensialAddress", "residensialAddress")
          .leftJoinAndSelect("selectedVendor.officeAddress", "officeAddress")
          // .leftJoinAndSelect("dealSlip.requestedBy", "requestedBy")
          .orderBy("dealSlip.createdAt", "DESC");
  
      
      if (search) {
          queryBuilder.where("dealSlip.dealSlipNo ILIKE :search", { search: `%${search}%` });
      }
  
      
      const total = await queryBuilder.getCount();
        
    const totalPages = Math.ceil(total / limit);
  
  
      const dealSlips = await queryBuilder
          .skip((page - 1) * limit) 
          .take(limit) 
          .getMany();
  
      
      const formattedDealSlips = dealSlips.map((dealSlip) => {
        const rawDate = dealSlip.createdAt;
        const { createdDate, createdTime } = formatDateTime(rawDate);
      
        return {
          id: dealSlip.id,
          lotNo: dealSlip.lotNo,
          approvalNote: dealSlip.approvalNote,
          loadingLocation: dealSlip.loadingLocation,
          remark: dealSlip.remark,
          specialRequest: dealSlip.specialRequest,
          requestingDepartment: dealSlip.requestingDepartment,
          approvalStatus: dealSlip.approvalStatus,
          createdDate: createdDate,
          createdTime: createdTime,
          dealSlipNo: dealSlip.dealSlipNo,
          // requestedBy: dealSlip.requestedBy
          //     ? {
          //         id: dealSlip.requestedBy.id,
          //         firstName: dealSlip.requestedBy.firstName,
          //         lastName: dealSlip.requestedBy.lastName,
          //     }
          //     : null,
        };
      });
  
      return {
          data: formattedDealSlips,
          total,
          page,
          totalPages
      };
  }
  
  

   async findDealSlipByIdforView(id: string): Promise<any> {
      const dealSlip = await this.dealSlipRepository.findOne({
          where: { id },
          relations: [
              'rfpa',
              'rfpa.selectedVendor',
              'rfpa.selectedFarmer',
              'rfpa.selectedVendor.vendorSaleInfo', 
              'rfpa.rfpaProducts', 
              //'requestedBy', 
          ],
      });
  
      if (!dealSlip) {
          return null;
      }
      const rawDate = dealSlip.createdAt;
      const { createdDate, createdTime } = formatDateTime(rawDate);
      const { rfpa } = dealSlip;
  
      
      const response: any = {
          id: dealSlip.id,
        
          lotNo: dealSlip.lotNo,
          approvalNote: dealSlip.approvalNote,
          loadingLocation: dealSlip.loadingLocation,
          remark: dealSlip.remark,
          specialRequest: dealSlip.specialRequest,
          requestingDepartment: dealSlip.requestingDepartment,
          approvalStatus: dealSlip.approvalStatus,
          createdDate: createdDate,
          createdTime:createdTime,
          dealSlipNo: dealSlip.dealSlipNo,
          rfpa:rfpa.rfpaId
      }
  
      return response;
  }


  async findDealSlipByIdforUpdate(id: string): Promise<any> {
      const dealSlip = await this.dealSlipRepository.findOne({
          where: { id },
          relations: [
              'rfpa',
              'rfpa.selectedVendor',
              'rfpa.selectedFarmer',
              'rfpa.selectedVendor.vendorSaleInfo', 
              'rfpa.rfpaProducts', 
              //'requestedBy', 
          ],
      });
  
      if (!dealSlip) {
          return null;
      }
      const rawDate = dealSlip.createdAt;
      const { createdDate, createdTime } = formatDateTime(rawDate);
      const { rfpa } = dealSlip;
  
      
      const response: any = {
          id: dealSlip.id,
        
          lotNo: dealSlip.lotNo,
          approvalNote: dealSlip.approvalNote,
          loadingLocation: dealSlip.loadingLocation,
          remark: dealSlip.remark,
          specialRequest: dealSlip.specialRequest,
          requestingDepartment: dealSlip.requestingDepartment,
          approvalStatus: dealSlip.approvalStatus,
          createdDate: createdDate,
          createdTime:createdTime,
          dealSlipNo: dealSlip.dealSlipNo,
          rfpa:rfpa.id
      }
  
      return response;
  }
    
    async findDealSlipById(id: string): Promise<any> {
      const dealSlip = await this.dealSlipRepository.findOne({
          where: { id },
          relations: [
              'rfpa',
              'rfpa.selectedVendor',
              'rfpa.selectedFarmer',
              'rfpa.selectedVendor.vendorSaleInfo', 
              'rfpa.rfpaProducts', 
              //'requestedBy', 
          ],
      });
  
      if (!dealSlip) {
          return null;
      }
      const rawDate = dealSlip.createdAt;
      const { createdDate, createdTime } = formatDateTime(rawDate);
      const { rfpa } = dealSlip;
  
      
      const response: any = {
          id: dealSlip.id,
        
          lotNo: dealSlip.lotNo,
          approvalNote: dealSlip.approvalNote,
          loadingLocation: dealSlip.loadingLocation,
          remark: dealSlip.remark,
          specialRequest: dealSlip.specialRequest,
          requestingDepartment: dealSlip.requestingDepartment,
          approvalStatus: dealSlip.approvalStatus,
          createdDate: createdDate,
          createdTime:createdTime,
          dealSlipNo: dealSlip.dealSlipNo,
          // requestedBy: dealSlip.requestedBy
          //     ? {
          //           id: dealSlip.requestedBy.id,
          //           firstName: dealSlip.requestedBy.firstName, 
          //           lastName: dealSlip.requestedBy.lastName, 
          //       }
          //     : null,
               rfpa: rfpa.id,
              }
      //     rfpa: {
      //         id: rfpa.id,
      //         rfpaId: rfpa.rfpaId,
      //         companyName: rfpa.companyName,
      //         source: rfpa.source,
      //         purchaseForWhich: rfpa.purchaseForWhich,
      //         purchaseLocation: rfpa.purchaseLocation,
      //         rfpaProducts: rfpa.rfpaProducts.map(product => ({
      //             id: product.id,
      //             createdAt: product.createdAt,
      //             updatedAt: product.updatedAt,
      //             grade: product.grade,
      //             description: product.description,
      //             quantity: product.quantity,
      //             unitPrice: product.unitPrice,
      //             totalVal: product.totalVal,
      //             purchaseDate: product.purchaseDate,
      //             expectedHarvestDate: product.expectedHarvestDate,
      //             dispatchDate: product.dispatchDate,
      //             deliveryDate: product.deliveryDate,
      //             deliveryLocation: product.deliveryLocation,
      //             product: product.product.name,
      //             uom: product.uom.unit,
      //         })),
      //     },
      // };
  
      // // Dynamically add the field based on source (vendor or farmer)
      // if (rfpa.source === 'vendor' && rfpa.selectedVendor) {
      //     response.rfpa.vendor = {
      //         id: rfpa.selectedVendor.id,
      //         companyName: rfpa.selectedVendor.companyName, // Add more fields as needed
      //         vendorCode: rfpa.selectedVendor.vendorCode,
      //         officeAddress:rfpa.selectedVendor.officeAddress,
      //         email:rfpa.selectedVendor.email,
      //         officeContactNo:rfpa.selectedVendor.officeContactNo,
             
             
      //         vendorSaleInfo: rfpa.selectedVendor.vendorSaleInfo
      //         ? {
      //               contactFName: rfpa.selectedVendor.vendorSaleInfo.contactFName,
      //               contactMName: rfpa.selectedVendor.vendorSaleInfo.contactMName,
      //               contactLName: rfpa.selectedVendor.vendorSaleInfo.contactLName,
                    
      //           }
      //         : null,
      // };
      // } else if (rfpa.source === 'farmer' && rfpa.selectedFarmer) {
      //     response.rfpa.farmer = {
      //         id: rfpa.selectedFarmer.id,
      //         farmerfName: rfpa.selectedFarmer.farmerfName,
      //         farmermName: rfpa.selectedFarmer.farmermName,
      //         farmerlName: rfpa.selectedFarmer.farmerlName,
      //         farmerCode:rfpa.selectedFarmer.farmerCode,
      //         residensialAddress:rfpa.selectedFarmer.residensialAddress,
      //         email:rfpa.selectedFarmer.email,
      //     };
      // }
  
      return response;
  }
  

      async createDealSlip(dealSlipData: any): Promise<any> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
              const rfpaId=dealSlipData.rfpa

              if(!rfpaId)
              {
                throw new Error("id not found")
              }

          const rfpa = await queryRunner.manager.findOne(this.rfpaRepository.target, { where: { id: rfpaId } }); 

              if (!rfpa) {
                  throw new Error('RFPA not found');
              }

              // Check if deal slip already created for this RFPA
              if (rfpa.isDealSlipCreated) {
                  throw new AppError(409, 'Deal slip already created for this RFPA. Please check existing deal slips.');
              }
          //console.log(rfpa)
              // Ensure the RFPA is approved before allowing Deal Slip creation
              // if (rfpa.approvalStatus !== Status.APPROVED) {
              //     throw new Error('Cannot create Deal Slip because the associated RFPA is not approved');
              // }


              const dealSlipId = await this.generateDealSlipId();
              dealSlipData.dealSlipNo = dealSlipId;


              const dealSlip = queryRunner.manager.create(this.dealSlipRepository.target, {
                  ...dealSlipData,
                  rfpa
              });


              const savedDealSlip= await queryRunner.manager.save(dealSlip);

              // Update RFPA isDealSlipCreated flag
              rfpa.isDealSlipCreated = true;
              await queryRunner.manager.save(rfpa);

              //Todo:By Vaishali
                     const document = await this.documentbService.createDocument({
                            type: DocumentTypeEnum.DEAL_SLIP,
                            docDef: DocDefEnum.PROCUREMENT,
                           // totalAmt: rfpaData.totalAmt,
                            status: DocumentStatus.HOLD,
                            remarks: 'Document auto-created with Deal Slip',
                            lastActionBy: { id: dealSlipData.requestedBy },
                            document_type_id: Array.isArray(savedDealSlip) ? (savedDealSlip[0] as DealSlip)?.id : (savedDealSlip as DealSlip).id
                          });

                          await this.documentbService.startApprovalFlow(document.id);

          // Commit transaction - all operations succeeded
          await queryRunner.commitTransaction();

                          return savedDealSlip;
        } catch (error: any) {
          // Rollback transaction - undo all changes
          await queryRunner.rollbackTransaction();
          throw error;
        } finally {
          // Release query runner
          await queryRunner.release();
        }
      }


    
    

      async generateDealSlipId(): Promise<string> {
        const today = new Date();
        const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');
    
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 0);
    
        const lastDealSlip = await this.dealSlipRepository.findOne({
          where: {
              createdAt: Between(startOfDay, endOfDay),
          },
          order: { createdAt: "DESC" },
      });
      
    
        const sequenceNumber = lastDealSlip ? parseInt(lastDealSlip.dealSlipNo.slice(-4)) + 1 : 1;
    
       
        return `${datePart}${sequenceNumber.toString().padStart(4, '0')}`;
    }


  
public async approveDealSlip(dealSlipId: string, userId: string, data: { approvalStatus: string, approvalNote?: string }) {
 
  const dealSlip = await this.dealSlipRepository.findOne({
    where: { id: dealSlipId },
    relations: ['rfpa'],
  });

  if (!dealSlip) {
    throw new Error('Deal Slip not found');
  }

 
  const rfpa = dealSlip.rfpa;
  // if (!rfpa  !== Status.APPROVED) {
  //   throw new Error('Cannot update Deal Slip because the associated RFPA is not approved');
  // }

 
  if (data.approvalStatus !== Status.APPROVED && data.approvalStatus !== Status.REJECTED) {
    throw new Error('Invalid approval status. It must be either APPROVED or REJECTED.');
  }


  dealSlip.approvalStatus = data.approvalStatus;  
  dealSlip.approvalNote = data.approvalNote || '';  
  dealSlip.dealSlipApprovedAt = new Date();  

  
  await this.dealSlipRepository.save(dealSlip);


  const user = await this.userService.findUserById(userId);

  if (!user) {
    throw new Error('User not found');
  }


  const response = {
    message: `Deal Slip status updated to ${data.approvalStatus}`,
    approvalStatus: dealSlip.approvalStatus,
    approvalNote: dealSlip.approvalNote,
    user: {
      name: `${user.firstName} ${user.lastName}`,
    
      department: user.selectDepartment,
    },
  };

  return response;
}

    public async updateDealSlip(id: string, dealSlipData: DeepPartial<DealSlip>, updatedBy: string): Promise<DealSlip | null> {
      const existingDealSlip = await this.dealSlipRepository.findOneBy({ id });
      if (!existingDealSlip) {
        return null;
      }
     
  const originalDealSlip = { ...existingDealSlip };
    
      
  Object.assign(existingDealSlip, dealSlipData);

 
  await this.dealSlipRepository.save(existingDealSlip);

 
  await this.auditLogService.logChange(
    'DealSlip',
    existingDealSlip.id,
    originalDealSlip,
    existingDealSlip,
    updatedBy
  );

  return existingDealSlip;
}
// public async getAllDealSlipsNo(): Promise<{ id: string; dealSlipNo: string; approvalStatus: string }[]> {
//   const dealSlips = await this.dealSlipRepository.find({
//     select: ["id", "dealSlipNo", "approvalStatus"], // Select the required fields
//     order: {
//       createdAt: "DESC", // Optionally order by creation date
//     },
//   });

//   // Map the results to include the required fields
//   return dealSlips.map(dealSlip => ({
//     id: dealSlip.id as string,
//     dealSlipNo: dealSlip.dealSlipNo as string,
//     approvalStatus: dealSlip.approvalStatus as string,
//   }));
// }

public async getAllDealSlipsNo(
  filter: {
    overAllStatus?: string;
    isGrnCreated?: boolean;
    employeeBaseHirechey?: boolean;
    page?: number;
    limit?: number;
    search?: string;
  },
  loginUserId: string
): Promise<any> {

  const where: any = {};

  if (typeof filter?.isGrnCreated === "boolean") {
    console.log("--------------------------");
    where.isGrnCreated = filter.isGrnCreated;
  }

  console.log("where", where);
  

  const dealSlips = await this.dealSlipRepository.find({
    select: ["id", "dealSlipNo", "isGrnCreated"],
    where: where,
    relations: ["createdBy"],
    order: { createdAt: "DESC" }
  });

  const filteredResults: {
    id: string;
    dealSlipNo: string;
    documentId: string | null;
  }[] = [];

  for (const dealSlip of dealSlips) {

    if (!dealSlip.id || !dealSlip.dealSlipNo) {
      continue;
    }

    const document = await this.documentbRepository.findOne({
      where: { document_type_id: dealSlip.id },
      select: ["id", "status"]
    });

    const documentId = document?.id || null;
    const documentStatus = document?.status;


    // =============================
    // Employee Hierarchy Logic
    // =============================

    if (filter?.employeeBaseHirechey) {

      const approvalFlow = await this.approvalFlowRepository
        .createQueryBuilder("approvalflows")

        .leftJoinAndSelect("approvalflows.creator", "creator")
        .leftJoinAndSelect("approvalflows.verifiers", "verifiers")

        .leftJoinAndSelect("approvalflows.approvers", "approvers")

        .leftJoinAndSelect("approvers.firstApprover", "firstApprover")
        .leftJoinAndSelect("firstApprover.users", "firstApproverUsers")

        .leftJoinAndSelect("approvers.secondApprover", "secondApprover")
        .leftJoinAndSelect("secondApprover.users", "secondApproverUsers")

        .leftJoinAndSelect("approvers.thirdApprover", "thirdApprover")
        .leftJoinAndSelect("thirdApprover.users", "thirdApproverUsers")

        .leftJoinAndSelect("approvalflows.finalizers", "finalizers")
        .leftJoinAndSelect("finalizers.firstFinalizers", "firstFinalizers")
        .leftJoinAndSelect("finalizers.secondFinalizers", "secondFinalizers")

        .where("creator.id = :creatorId", { creatorId: dealSlip.createdBy?.id })
        .andWhere("approvalflows.type = :documentType", { documentType: "Procurement" })

        .getOne();

      if (!approvalFlow) {
        continue;
      }

      let hierarchy = 0;

      if (approvalFlow.creator?.id === loginUserId) {
        hierarchy = 1;
      }
      else if (approvalFlow.verifiers?.some(v => v.id === loginUserId)) {
        hierarchy = 2;
      }
      else if (approvalFlow.approvers?.firstApprover?.users?.some(u => u.id === loginUserId)) {
        hierarchy = 3;
      }
      else if (approvalFlow.approvers?.secondApprover?.users?.some(u => u.id === loginUserId)) {
        hierarchy = 4;
      }
      else if (approvalFlow.approvers?.thirdApprover?.users?.some(u => u.id === loginUserId)) {
        hierarchy = 5;
      }
      else if (approvalFlow.finalizers?.firstFinalizers?.some(u => u.id === loginUserId)) {
        hierarchy = 6;
      }
      else if (approvalFlow.finalizers?.secondFinalizers?.some(u => u.id === loginUserId)) {
        hierarchy = 7;
      }

      if (hierarchy === 0) {
        continue;
      }

      if (hierarchy === 1 && dealSlip.createdBy?.id !== loginUserId) {
        continue;
      }
    }

    // =============================
    // Approval Status Filtering
    // =============================

    if (filter?.overAllStatus &&
      typeof filter?.isGrnCreated === "boolean"
    ) {

      if (documentStatus === filter.overAllStatus &&
        dealSlip.isGrnCreated === filter.isGrnCreated
      ) {
        filteredResults.push({
          id: dealSlip.id,
          dealSlipNo: dealSlip.dealSlipNo,
          documentId
        });
      }

    } else if (typeof filter?.isGrnCreated === "boolean") {

      if (dealSlip.isGrnCreated === filter.isGrnCreated) {
        filteredResults.push({ 
          id: dealSlip.id, 
          dealSlipNo: dealSlip.dealSlipNo, 
          documentId });
      }

    }
     else {

      filteredResults.push({
        id: dealSlip.id,
        dealSlipNo: dealSlip.dealSlipNo,
        documentId
      });

    }

  }

  // =============================
  // Search
  // =============================

  let searchedResults = filteredResults;

  if (filter?.search) {
    const search = filter.search.toLowerCase();

    searchedResults = filteredResults.filter(item =>
      item.dealSlipNo.toLowerCase().includes(search)
    );
  }

  // =============================
  // Pagination
  // =============================

  const page = filter.page || 1;
  const limit = filter.limit || 10;

  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  const paginatedResults = searchedResults.slice(startIndex, endIndex);

  return {
    data: paginatedResults,
    pagination: {
    total: searchedResults.length,
    page,
    limit,
    totalPages: Math.ceil(searchedResults.length / limit)
    }
  };
}


public async deleteDealSlip(dealSlipId: string): Promise<boolean> {
  // Find the Deal Slip by ID
  const dealSlip = await this.dealSlipRepository.findOne({
    where: { id: dealSlipId },
   
  });

  if (!dealSlip) {
    throw new AppError(404, `Deal Slip with ID ${dealSlipId} not found`);
  }

  
  

  // Calculate the date 6 months ahead
  const now = new Date();
  const sixMonthsFromNow = new Date(now);
  sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
  sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

  // Log the scheduled deletion
  console.log(`Deal Slip with ID ${dealSlipId} marked for deletion in 6 months at ${sixMonthsFromNow}`);

  // Set the deletionScheduledAt field for the Deal Slip
  dealSlip.deletionScheduledAt = sixMonthsFromNow;

  // Save the updated Deal Slip with the scheduled deletion date
  await this.dealSlipRepository.save(dealSlip);


  

  console.log(`Deal Slip with ID ${dealSlipId} marked for deletion in 6 months.`);
  return true;
}


//Todo:Get All DealSlip..By Vaishali
//  public async getAllDealSlips(queryOptions: PaginationOptions, userId: string): Promise<{
//   data: any[];
//   meta: { total: number; page: number; pages: number };
// }> {
//   const data = await this.docSingalApproverService.getAllSingleApprovalDocumentsByUserId(
//     userId,
//     DocumentTypeEnum.DEAL_SLIP,
//   );
//     const data1 = await buildQueryFromArray(data, queryOptions);
//  const { search } = queryOptions;
//   console.log('Fetched documents:', data);



//   const typedDocuments = data1.data as DocumentWithRelatedData[];

//   if (typedDocuments.length > 0) {
//     console.log("doc.relatedData", typedDocuments[0].relatedData);
//   } else {
//     console.log("No documents found for user.");
//   }

//   for (const doc of typedDocuments) {
//     if (!doc.document_type_id) continue;

//     try {
//       doc.relatedData = await this.dealSlipRepository.findOne({
//         where: { id: doc.document_type_id },
//         relations: ['rfpa']
//       });
//     } catch (e) {
//       console.log("in catch block", e);
//       doc.relatedData = null;
//     }
//   }

//   let relatedDataOnly = typedDocuments.map((doc) => {
//     const rd = doc.relatedData || {};
//     return {
//       documentId: doc.id,
//       overAllStatus: doc.status,
//       createdBy: doc.lastActionBy,
//       createdDate: formatDateTime(doc.createdAt).createdDate,
//       createdTime: formatDateTime(doc.createdAt).createdTime,
//       id: rd.id || null,
//       lotNo: rd.lotNo || null,
//       approvalNote: rd.approvalNote || null,
//       loadingLocation: rd.loadingLocation || null,
//       remark: rd.remark || null,
//       specialRequest: rd.specialRequest || null,
//       requestingDepartment: rd.requestingDepartment || null,
//       approvalStatus: rd.approvalStatus || null,
//       dealSlipCreatedAt: rd.dealSlipCreatedAt || null,
//       dealSlipApprovedAt: rd.dealSlipApprovedAt || null,
//       dealSlipNo: rd.dealSlipNo || null,
//     };
//   });

//   // 🔍 Deep search logic
//   const objectToString = (obj: any): string => {
//     if (obj == null) return '';
//     if (typeof obj === 'object') {
//       return Object.values(obj)
//         .map((v) => objectToString(v))
//         .join(' ');
//     }
//     return String(obj);
//   };

//   if (search && search.trim()) {
//     const term = search.toLowerCase();
//     relatedDataOnly = relatedDataOnly.filter((item) =>
//       objectToString(item).toLowerCase().includes(term)
//     );
//   }
//   // 🔄 Sorting logic
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
// console.log(relatedDataOnly.length)
//   return {
//     data: relatedDataOnly,
//     meta: {
//       total: data1.meta.total,
//       page: data1.meta.page,
//       pages: data1.meta.pages,
//     }
//   };
// }

//Todo:Get All DealSlip..By Vaishali
 public async getAllDealSlips(queryOptions: PaginationOptions, userId: string): Promise<{
  data: any[];
  meta: { total: number; page: number; pages: number };
}> {
  const data = await this.docSingalApproverService.getAllSingleApprovalDocumentsByUserId(
    userId,
    DocumentTypeEnum.DEAL_SLIP,
  );
    const data1 = await buildQueryFromArray(data, queryOptions);
 const { search } = queryOptions;
  console.log('Fetched documents:', data);



  const typedDocuments = data1.data as DocumentWithRelatedData[];
  // Exclude soft-deleted documents
  const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === false);
  if (activeDocuments.length > 0) {
    console.log("doc.relatedData", activeDocuments[0].relatedData);
  } else {
    console.log("No documents found for user.");
  }

  for (const doc of activeDocuments) {
    if (!doc.document_type_id) continue;

    try {
      doc.relatedData = await this.dealSlipRepository.findOne({
        where: { id: doc.document_type_id , isDeleted: false },
        relations: ['rfpa']
      });
    } catch (e) {
      console.log("in catch block", e);
      doc.relatedData = null;
    }
  }

  let relatedDataOnly = activeDocuments.map((doc) => {
    const rd = doc.relatedData || {};
    return {
      documentId: doc.id,
      overAllStatus: doc.status,
      createdBy: `${doc.lastActionBy?.firstName || ''} ${doc.lastActionBy?.lastName || ''} `, //Omkar
      createdDate: formatDateTime(doc.createdAt).createdDate,
      createdTime: formatDateTime(doc.createdAt).createdTime,
      id: rd.id || null,
      rfpa: rd.rfpa.rfpaId || null, //Omkar
      lotNo: rd.lotNo || null,
      // approvalNote: rd.approvalNote || null,
      loadingLocation: rd.loadingLocation || null,
      remark: rd.remark || null,
      specialRequest: rd.specialRequest || null,
     // requestingDepartment: rd.requestingDepartment || null,
      //approvalStatus: rd.approvalStatus || null,
      // dealSlipCreatedAt: rd.dealSlipCreatedAt || null,
      // dealSlipApprovedAt: rd.dealSlipApprovedAt || null,
      dealSlipNo: rd.dealSlipNo || null,
    };
  });

  // 🔍 Deep search logic
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj)
        .map((v) => objectToString(v))
        .join(' ');
    }
    return String(obj);
  };

  if (search && search.trim()) {
    const term = search.toLowerCase();
    relatedDataOnly = relatedDataOnly.filter((item) =>
      objectToString(item).toLowerCase().includes(term)
    );
  }
  // 🔄 Sorting logic
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
console.log(relatedDataOnly.length)
  return {
    data: relatedDataOnly,
    meta: {
      total: data1.meta.total,
      page: data1.meta.page,
      pages: data1.meta.pages,
    }
  };
}

public async getRecycleBinDealSlips(queryOptions: PaginationOptions, userId: string): Promise<{
  data: any[];
  meta: { total: number; page: number; pages: number };
}> {
  const data = await this.docSingalApproverService.getAllSingleApprovalDocumentsByUserId(
    userId,
    DocumentTypeEnum.DEAL_SLIP,
  );
    const data1 = await buildQueryFromArray(data, queryOptions);
 const { search } = queryOptions;
  console.log('Fetched documents:', data);



  const typedDocuments = data1.data as DocumentWithRelatedData[];
  // Exclude soft-deleted documents
  const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === true);
  if (activeDocuments.length > 0) {
    console.log("doc.relatedData", activeDocuments[0].relatedData);
  } else {
    console.log("No documents found for user.");
  }

  for (const doc of activeDocuments) {
    if (!doc.document_type_id) continue;

    try {
      doc.relatedData = await this.dealSlipRepository.findOne({
        where: { id: doc.document_type_id, isDeleted: true },
        relations: ['rfpa']
      });
    } catch (e) {
      console.log("in catch block", e);
      doc.relatedData = null;
    }
  }

  let relatedDataOnly = activeDocuments.map((doc) => {
    const rd = doc.relatedData || {};
    return {
      documentId: doc.id,
      overAllStatus: doc.status,
      createdBy: doc.lastActionBy,
      createdDate: formatDateTime(doc.createdAt).createdDate,
      createdTime: formatDateTime(doc.createdAt).createdTime,
      id: rd.id || null,
      lotNo: rd.lotNo || null,
      approvalNote: rd.approvalNote || null,
      loadingLocation: rd.loadingLocation || null,
      remark: rd.remark || null,
      specialRequest: rd.specialRequest || null,
      requestingDepartment: rd.requestingDepartment || null,
      approvalStatus: rd.approvalStatus || null,
      dealSlipCreatedAt: rd.dealSlipCreatedAt || null,
      dealSlipApprovedAt: rd.dealSlipApprovedAt || null,
      dealSlipNo: rd.dealSlipNo || null,
    };
  });

  // 🔍 Deep search logic
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj)
        .map((v) => objectToString(v))
        .join(' ');
    }
    return String(obj);
  };

  if (search && search.trim()) {
    const term = search.toLowerCase();
    relatedDataOnly = relatedDataOnly.filter((item) =>
      objectToString(item).toLowerCase().includes(term)
    );
  }
  // 🔄 Sorting logic
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
console.log(relatedDataOnly.length)
  return {
    data: relatedDataOnly,
    meta: {
      total: data1.meta.total,
      page: data1.meta.page,
      pages: data1.meta.pages,
    }
  };
}
//TODO:Get Deal Slip By Id For View..By Vaishali
public async getDealSlipByIdForView(docid: string, userId:string): Promise<any> {
    const document = await this.docSingalApproverService.getSingleApprovalDocumentById(docid,userId)
    if(!document)
    {
      return null;
    }
    const id = document.documentTypeId;
    console.log('id in getDealSlipByIdForView', id);
    
    if (id) {
      //console.log("Hiiiiiiiiiiiiiiiiiiiiiii");
      //console.log('Document type ID not found for document:', id);
      
      const dealSlip = await this.dealSlipRepository.findOne({
        where: { id },
        relations: [/*'rfpa'*/
          'rfpa',
          // 'companyName',
          // 'grnProducts',
          // 'grnProducts.productName',
          // 'grnProducts.uom',
          // 'selectedFarmer',
          // 'selectedVendor',
          // //'documentApproval',
          // //"requestedBy",
          // // "documentApproval",
          // // "documentApproval.documentdef",
          // // "documentApproval.requestedBy",
          // // "documentApproval.verifiedBy",
          // // "documentApproval.authorisedBy",
          // 'paymentInfo',
          // 'dealSlipId',
          // 'purchaseForSalesLocation',
          // 'purchaseLocation',
          // 'createdBy',
          // 'purchaseBy',
        ],
      });

      console.log('dealslip in getDealSlipByIdForView', dealSlip);
      

      if (!dealSlip) { 
        throw new Error('dealSlip not found');
      }

      // let selectedPartyId: string | null = null;
      // if (grn.source === 'vendor' && grn.selectedVendor) {
      //   selectedPartyId = grn.selectedVendor.companyName;
      // } else if (grn.source === 'farmer' && grn.selectedFarmer) {
      //   selectedPartyId =
      //     grn.selectedFarmer.farmerfName +
      //     ' ' +
      //     grn.selectedFarmer.farmermName +
      //     ' ' +
      //     grn.selectedFarmer.farmerlName;
      // }
      const rawDate = dealSlip.createdAt;
      const { createdDate, createdTime } = formatDateTime(rawDate);
      return {
    documentId: document.documentId,
    overAllStatus: document.status,
    createdBy:document.createdBy,
     

    createdDate,
    createdTime,
    approvalSummary: document.approvalSummary,

    id: dealSlip.id,
    lotNo: dealSlip.lotNo,
    approvalNote: dealSlip.approvalNote,
    loadingLocation: dealSlip.loadingLocation,
    remark: dealSlip.remark,
    specialRequest: dealSlip.specialRequest,
    requestingDepartment: dealSlip.requestingDepartment,
    approvalStatus: dealSlip.approvalStatus,
    dealSlipCreatedAt: dealSlip.dealSlipCreatedAt,
    dealSlipApprovedAt: dealSlip.dealSlipApprovedAt,
    dealSlipNo: dealSlip.dealSlipNo,
    //Omkar
    rfpa: dealSlip.rfpa ? dealSlip.rfpa.rfpaId : null,   // include RFPA relation id if needed
  };
  }

    
}
   //TODO:Filterd DealSlips By Vaishali...20/08/2025
 async filterDealSlips(
  page: number,
  limit: number,
  filters: Record<string, any>
) {
  const queryBuilder: SelectQueryBuilder<DealSlip> =
    this.dealSlipRepository.createQueryBuilder("dealSlip");

  // ✅ Select all fields from Aqr
  queryBuilder.select("dealSlip");

  // ✅ Join relations but select only specific fields
  queryBuilder
    .leftJoin("dealSlip.rfpa", "rfpa")
    .addSelect("rfpa.rfpaId");

  // ✅ Apply dynamic filters (including related fields)
  Object.entries(filters).forEach(([key, value]) => {
    if (key.includes(".")) {
      // Example: filters = { "sendedBy.firstName": "John" }
      const [alias, field] = key.split(".");
      queryBuilder.andWhere(`${alias}.${field} ILIKE :${field}`, {
        [field]: `%${value}%`,
      });
    } else {
      // Normal Aqr field filter
      if (typeof value === "string" && isNaN(Number(value))) {
        queryBuilder.andWhere(`dealSlip.${key} ILIKE :${key}`, {
          [key]: `%${value}%`,
        });
      } else {
        queryBuilder.andWhere(`dealSlip.${key} = :${key}`, { [key]: value });
      }
    }
  });

  // ✅ Pagination
  queryBuilder.skip((page - 1) * limit).take(limit);

  const [data, total] = await queryBuilder.getManyAndCount();

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

public async deleteMultipleDealSlips(ids: string[]): Promise< any> {
  const success: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      const aqr = await this.dealSlipRepository.findOne({
        where: { id },
      });
      if (!aqr) {
        failed.push({ id, reason: 'Deal Slip not found' });
        continue;
      }
      const relatedDocument = await this.documentbRepository.findOne({
        where: { document_type_id: aqr.id }
      });

      if (!relatedDocument) {
        throw new Error(`Something went wrong`);
      }

      const deleteDocument = await this.documentbRepository.delete(relatedDocument.id);
      if (!deleteDocument) {
        throw new Error(`Failed to delete related document with ID ${relatedDocument.id}`);
      }

      const deleteDealSlip = await this.dealSlipRepository.delete(aqr.id);
      if (!deleteDealSlip) {
        throw new Error(`Failed to delete DealSlip with ID ${id}`);
      }
      success.push(id);
    } catch (error: any) {
      failed.push({ id, reason: error.message || 'Unknown error' });
    }
  }
  // const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
  // return { success, failed, message };
     return { message: 'dealSlip records marked for deletion successfully' };

}
 
}