import { inject, injectable } from "inversify";
import { DocumentStatus, DocumentTypeEnum } from "../entities/docuemnt.entity";
import { TYPES } from "../types";
import { DocumentbRepository } from "../repositories/documentb.repository";
import { Brackets } from "typeorm";
import { UserRepository } from "../repositories/user.repository";
import { ApproverStatus } from "../entities/approvalname.entity";
import { DocumentApprovalFlowRepository } from "../repositories/DocumentApprovalFlowRepository.repository";
import { ApprovalStageInfoRepository } from "../repositories/approvalStageInfoRepository";
import { NotificationService } from "./notification.service";
import { buildQueryFromArray } from "../utils/pagination";
import { DocumentbService } from "./documentb.service";


@injectable()
export class DocSingalApproverService {
    constructor( @inject(TYPES.DocumentbRepository)
    private documentbRepository: DocumentbRepository,
    @inject(TYPES.UserRepository)
    private userRepository: UserRepository,
    @inject(TYPES.DocumentApprovalFlowRepository)
    private documentApprovalFlowRepository: DocumentApprovalFlowRepository,
    @inject(TYPES.ApprovalStageInfoRepository)
    private approvalStageInfoRepository: ApprovalStageInfoRepository,
    @inject(TYPES.NotificationService)
    private notificationService: NotificationService,
    @inject(TYPES.DocumentbService)
    private documentBService: DocumentbService
  ){}

  // Convert document type to readable format
  private getReadableDocumentType(type: string): string {
    const typeMap: { [key: string]: string } = {
      'grn': 'GRN',
      'rfpa': 'RFPA',
      'deal-slip': 'Deal Slip',
      'aqr': 'AQR',
      'second-sale': 'Second Sale',
      'vehicle-dispatch-register': 'Vehicle Dispatch',
      'dump-register': 'Dump Register',
      'inward-register': 'Inward Register',
      'dc-type-other': 'Delivery Challan',
      'dc-type-stock-transfer': 'Stock Transfer Challan',
      'dc-type-customer': 'Customer Delivery Challan',
      'return-by-customer': 'Return by Customer',
      'return-to-vendor': 'Return to Vendor',
      'multi-cash-voucher': 'Cash Voucher',
      'labor-payment-voucher': 'Labor Payment Voucher',
      'transport-payment-voucher': 'Transport Payment Voucher',
      'packaging-material-voucher': 'Packaging Material Voucher',
    };
    return typeMap[type.toLowerCase()] || type;
  }
  
  private isSingleApprovalBasedDocument(type: DocumentTypeEnum): boolean {
    return [
      //Todo:Have To Add Some documentType...pending
      DocumentTypeEnum.RFPA,
      DocumentTypeEnum.DEAL_SLIP,
      DocumentTypeEnum.AQR,
      DocumentTypeEnum.INWARD_REGISTER,
      DocumentTypeEnum.VEHICLE_DISPATCH_REGISTER,
    ].includes(type);
  }

    //Todo:New By Vaishali
  //TODO: Approve Document
  async approveDocumentStepForSingleLevel(
    documentId: string,
    userId: string,
    action: ApproverStatus,
    reason?: string,
  ): Promise<void> {
    const document = await this.documentbRepository.findOne({
      where: { id: documentId },
      relations: [
        'approvalFlow',
        'approvalFlow.verifiers',
        'approvalFlow.approvers',
        'approvalFlow.approvers.firstApprover',
        'approvalFlow.approvers.firstApprover.users',
        'approvalFlow.approvers.secondApprover',
        'approvalFlow.approvers.secondApprover.users',
        'approvalFlow.approvers.thirdApprover',
        'approvalFlow.approvers.thirdApprover.users',
        'approvalFlow.approvers.fourthApprover',
        'approvalFlow.approvers.fourthApprover.users',
        'approvalFlow.approvers.fifthApprover',
        'approvalFlow.approvers.fifthApprover.users',
        'approvalFlow.approvers.sixthApprover',
        'approvalFlow.approvers.sixthApprover.users',
        'approvalFlow.finalizers',
        'approvalFlow.finalizers.firstFinalizers',
        'approvalFlow.finalizers.secondFinalizers',
        'lastActionBy',
      ],
    });

    if (!document || !document.approvalFlow) {
      throw new Error('Document or approval flow not found');
    }

    const now = new Date();
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const userName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
    const { approvalFlow, approvalInfo, type } = document;

    console.log("Document Type",type);
    //TODO  : 1) Single approval documents
    if (this.isSingleApprovalBasedDocument(type)) {
      console.log("Inside isSingleApprovalBasedDocument block");
      
       // 🛡 ensure approvalInfo exists
  if (!document.approvalInfo) {
    const newApprovalInfo = this.documentApprovalFlowRepository.create({});
    document.approvalInfo = await this.documentApprovalFlowRepository.save(newApprovalInfo);
    await this.documentbRepository.save(document); // link it
  }
  const approvalInfo = document.approvalInfo;
      const block = approvalFlow.approvers.firstApprover;
      if (block && block.users.some((u) => u.id === userId)) {

        if(document.status===DocumentStatus.COMPLETE)
        {
          throw new Error(
            `Document already Approved  by your approver block`,
          );
        }
        if(document.status===DocumentStatus.REJECT)
        {
            throw new Error(
            `Document Is Already Rejected  by approver `,
          ); 
        }

        // Create and save stage info
        const stage = this.approvalStageInfoRepository.create({
          userId,
          userName: userName,
          status: action as ApproverStatus,
          reason: reason ?? '',
          statusChangedAt: now,
        });
        // Save stage info
        const savedStage = await this.approvalStageInfoRepository.save(stage);
        console.log("savedStage",savedStage);
        approvalInfo.firstApproved = savedStage;
        await this.documentApprovalFlowRepository.save(approvalInfo);

          const docNo = await this.documentBService.resolveDocumentTypeNo(document);
          const readableType = this.getReadableDocumentType(document.type);
          const docLabel = docNo ? `${readableType} #${docNo}` : readableType;

          if (action === 'reject') {
          const remark = `${document.type} Document Rejected By Approvers`;
          document.status = DocumentStatus.REJECT;
          document.remarks = remark;
          await this.documentbRepository.save(document);

          // 🔔 Actor
          await this.notificationService.createNoti(`You rejected ${docLabel} at Approver Level 1`, userId);
          // 🔔 Creator
          if (document.lastActionBy?.id) {
            await this.notificationService.createNoti(
              `Your ${docLabel} was rejected at Approver Level 1 by ${userName}`,
              document.lastActionBy.id,
            );
          }
          // 🔔 Same-stage peers — batch notification
          const rejectPeerIds = (block.users ?? []).filter(u => u.id !== userId).map(u => u.id);
          if (rejectPeerIds.length > 0) {
            await this.notificationService.createBatchNoti(
              `${docLabel} was rejected at Approver Level 1 by ${userName}. No action needed from you`,
              rejectPeerIds
            );
          }
        } else if (action === 'approved') {
          const remark = `${document.type} Document Approved By Approvers`;
          document.status = DocumentStatus.COMPLETE;
          document.remarks = remark;
          await this.documentbRepository.save(document);

          // 🔔 Actor
          await this.notificationService.createNoti(`You approved ${docLabel} at Approver Level 1`, userId);
          // 🔔 Creator
          if (document.lastActionBy?.id) {
            await this.notificationService.createNoti(
              `Your ${docLabel} was approved at Approver Level 1 by ${userName}. Document is now Complete`,
              document.lastActionBy.id,
            );
          }
          // 🔔 Same-stage peers — batch notification
          const approvePeerIds = (block.users ?? []).filter(u => u.id !== userId).map(u => u.id);
          if (approvePeerIds.length > 0) {
            await this.notificationService.createBatchNoti(
              `${docLabel} has already been approved at Approver Level 1 by ${userName}. No action needed from you`,
              approvePeerIds
            );
          }
        }

        return;
      }
    }

    throw new Error(
      'User is not authorized to act on this document at this stage',
    );
  }

    //Todo:By Vaishali....17-07-2025
    //Todo:get All Single Approval Documents By UserId
    public async getAllSingleApprovalDocumentsByUserId(
      userId: string,
      documentType: string,
    ): Promise<any> {
      if (!Object.values(DocumentTypeEnum).includes(documentType as DocumentTypeEnum)) {
        throw new Error(`Invalid document type: ${documentType}`);
      }
    
      const queryBuilder = this.documentbRepository
        .createQueryBuilder('document')
        .leftJoinAndSelect('document.approvalFlow', 'approvalFlow')
        .leftJoinAndSelect('approvalFlow.approvers', 'approvalLevel')
        .leftJoinAndSelect('approvalLevel.firstApprover', 'firstApproverBlock')
        .leftJoinAndSelect('firstApproverBlock.users', 'firstApproverUser')
        .leftJoinAndSelect('document.lastActionBy', 'lastActionBy')
        .where('document.type = :documentType', { documentType })
        .andWhere('document.document_type_id IS NOT NULL')
        .andWhere(
          new Brackets((qb) => {
            qb.where('firstApproverUser.id = :userId', { userId })
              .orWhere('lastActionBy.id = :userId', { userId });
        }),
        );
    
      const [data, total] = await queryBuilder.getManyAndCount();
      console.log('Fetched single-level documents:', data ,total);
     // return buildQueryFromArray(data, queryOptions);
      return data;
    }
    
//Todo:By Vaishali....17-07-2025

//TODO: Only creator or first-level approvers can see single-approval document
//TODO:get Single Approval Document ById
async getSingleApprovalDocumentById(documentId: string, userId: string): Promise<any> {
  try {
    const document = await this.documentbRepository.findOne({
      where: { id: documentId },
      relations: [
        'approvalInfo',
        'approvalInfo.firstApproved', // include nested relation if needed
        'lastActionBy',
        'approvalFlow',
        'approvalFlow.approvers',
        'approvalFlow.approvers.firstApprover',
        'approvalFlow.approvers.firstApprover.users',
      ],
    });

    if (!document) {
      throw new Error(`Document with ID ${documentId} not found`);
    }

    const isCreator = document.lastActionBy?.id === userId;

    // first-level approvers
    const firstLevelUsers = document.approvalFlow?.approvers?.firstApprover?.users ?? [];
    const isFirstApprover = firstLevelUsers.some(u => u.id === userId);

    if (!isCreator && !isFirstApprover) {
      // user has no access
      //throw new Error('Access denied: you are neither creator nor first-level approver');
        return null;
    }

    // build approvalSummary if needed (reuse your logic)
    const approvalInfo = document.approvalInfo;
    const approvalInfoSummary = approvalInfo
      ? {
          firstApproved: approvalInfo.firstApproved
            ? {
                name: approvalInfo.firstApproved.userName,
                status: approvalInfo.firstApproved.status,
                reason: approvalInfo.firstApproved.reason,
              }
            : null,
        }
      : null;

    return {
      documentId: document.id,
      documentTypeId: document.document_type_id,
      status: document.status,
      overAllStatus: document.status,
      createdBy: document.lastActionBy?.firstName+" "+document.lastActionBy?.lastName ?? null,
      approvalSummary: approvalInfoSummary,
      // documentType: document.type,
      //type: document.type,
       createdAt: document.createdAt,
       
    };
  } catch (error) {
    throw new Error(`Error fetching single-approval document: ${error}`);
  }
}

}