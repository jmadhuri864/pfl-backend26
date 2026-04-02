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

        if (action === 'reject') {
          const remark = `${document.type} Document Rejected By Aprrovers`;
          document.status = DocumentStatus.REJECT;
          document.remarks = remark;
          await this.documentbRepository.save(document);

          const docNo = await this.documentBService.resolveDocumentTypeNo(document);
          const docLabel = docNo ? `${document.type} (${docNo})` : document.type;

          // 🔔 Notify approver
          await this.notificationService.createNoti(
            `${docLabel} was rejected by ${userName}`,
            userId,
          );
          // 🔔 Notify creator
          if (document.lastActionBy?.id) {
            await this.notificationService.createNoti(
              `Your ${docLabel} was rejected by ${userName}`,
              document.lastActionBy.id,
            );
          }
        } else if (action === 'approved') {
          const remark = `${document.type} Document Aprroved By Aprrovers`;
          document.status = DocumentStatus.COMPLETE;
          document.remarks = remark;
          await this.documentbRepository.save(document);

          const docNo = await this.documentBService.resolveDocumentTypeNo(document);
          const docLabel = docNo ? `${document.type} (${docNo})` : document.type;

          // 🔔 Notify approver
          await this.notificationService.createNoti(
            `${docLabel} was Approved by ${userName}`,
            userId,
          );
          // 🔔 Notify creator that document is fully approved
          if (document.lastActionBy?.id) {
            await this.notificationService.createNoti(
              `Your ${docLabel} has been approved by ${userName}`,
              document.lastActionBy.id,
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