//TODO: This service is replica of documentb.service.ts. 'documentb.service.ts' will be used for multiple level approval like grns and voucher.
//TODO: This service will be used for single level approval like deal slips, rfpa, etc.

import { inject, injectable } from "inversify";
import { DocumentbRepository } from "../repositories/documentb.repository";
import { TYPES } from "../types";
import { UserRepository } from "../repositories/user.repository";
import { NotificationService } from "./notification.service";
import { ApprovalStageInfoRepository } from "../repositories/approvalStageInfoRepository";
import { DocumentApprovalFlowRepository } from "../repositories/DocumentApprovalFlowRepository.repository";
import { ApproverStatus } from "../entities/approvalname.entity";
import { DocumentStatus, DocumentTypeEnum } from "../entities/docuemnt.entity";
import { PaginationOptions } from "../utils/pagination";
import { Brackets } from "typeorm";
import { DocumentbService } from "./documentb.service";

@injectable()
export class DocDoubleApproverService {

  constructor(
    @inject(TYPES.DocumentbRepository) private documentbRepository: DocumentbRepository,
    @inject(TYPES.UserRepository) private userRepository: UserRepository,
    @inject(TYPES.NotificationService) private notificationService: NotificationService,
    @inject(TYPES.ApprovalStageInfoRepository) private approvalStageInfoRepository: ApprovalStageInfoRepository,
    @inject(TYPES.DocumentApprovalFlowRepository) private documentApprovalFlowRepository: DocumentApprovalFlowRepository,
    @inject(TYPES.DocumentbService) private documentBService: DocumentbService
  ) {
  }


  async approveDocumentStepForDoubleLevel(
  documentId: string,
  userId: string,
  action: ApproverStatus,
  reason?: string,
): Promise<void> {
  const document = await this.documentbRepository.findOne({
    where: { id: documentId },
    relations: [
      'approvalFlow',
      'approvalFlow.approvers',
      'approvalFlow.approvers.firstApprover',
      'approvalFlow.approvers.firstApprover.users',
      'approvalFlow.approvers.secondApprover',
      'approvalFlow.approvers.secondApprover.users',
       'approvalInfo',
       'approvalInfo.firstApproved',
        'approvalInfo.secondApproved',
    ],
  });

  if (!document || !document.approvalFlow) {
    throw new Error('Document or its approval flow not found');
  }

  const now = new Date();
  const user = await this.userRepository.findOne({ where: { id: userId } });
  const userName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';

  // Ensure approvalInfo exists
  if (!document.approvalInfo) {
    document.approvalInfo = await this.documentApprovalFlowRepository.save(
      this.documentApprovalFlowRepository.create()
    );
    await this.documentbRepository.save(document);
  }

  const info = document.approvalInfo;
  const flow = document.approvalFlow;
  const firstBlock = flow.approvers.firstApprover;
  const secondBlock = flow.approvers.secondApprover;

  const isFirstApprover = firstBlock?.users?.some(u => u.id === userId);
  const isSecondApprover = secondBlock?.users?.some(u => u.id === userId);

  if (!isFirstApprover && !isSecondApprover) {
    throw new Error('User is not authorized to act on this document');
  }

  // REJECTED handling (immediate)
  if (action === ApproverStatus.REJECTED) {
    const stage = await this.approvalStageInfoRepository.save({
      userId,
      userName,
      status: action,
      reason: reason ?? '',
      statusChangedAt: now,
    });

    if (isFirstApprover) {
      if (info.firstApproved) throw new Error('First approver already acted');
      info.firstApproved = stage;
      document.remarks = `${document.type} Rejected at Approver Level 1`;
    } else if (isSecondApprover) {
      if (info.secondApproved) throw new Error('Second approver already acted');
      info.secondApproved = stage;
      document.remarks = `${document.type} Rejected at Approver Level 2`;
    }

    document.status = DocumentStatus.REJECT;
    await this.documentApprovalFlowRepository.save(info);
    await this.documentbRepository.save(document);
    return;
  }

  // APPROVED handling
  if (action === ApproverStatus.APPROVED) {
    const stage = await this.approvalStageInfoRepository.save({
      userId,
      userName,
      status: action,
      reason: reason ?? '',
      statusChangedAt: now,
    });

    if (isFirstApprover) {
      if (info.firstApproved) throw new Error('First approver already acted');
      info.firstApproved = stage;
    } else if (isSecondApprover) {
      if (info.secondApproved) throw new Error('Second approver already acted');
      info.secondApproved = stage;
    }

    await this.documentApprovalFlowRepository.save(info);

    // Check if both levels approved
    const firstApproved = info.firstApproved?.status === ApproverStatus.APPROVED;
    const secondApproved = info.secondApproved?.status === ApproverStatus.APPROVED;

    if (firstApproved && secondApproved) {
      document.status = DocumentStatus.COMPLETE;
      document.remarks = `${document.type} Approved by Required Approvers`;
      await this.documentbRepository.save(document);
    }

    return;
  }

  throw new Error('Invalid approval action');
}



  //TODO: Get Document with Data
  public async getAllDocumentByUserIdForDoubleApprover(userId: string, documentType: string, queryOptions: PaginationOptions): Promise<any> {

  //  console.log("documentType", documentType);

    if (!Object.values(DocumentTypeEnum).includes(documentType as DocumentTypeEnum)) {
      throw new Error(`Invalid document type: ${documentType}`);
    }


    const queryBuilder = this.documentbRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.approvalFlow', 'approvalFlow')
      .leftJoinAndSelect('approvalFlow.verifiers', 'verifier')
      .leftJoinAndSelect('approvalFlow.approvers', 'approvalLevel')
      .leftJoinAndSelect('approvalLevel.firstApprover', 'firstApproverBlock')
      .leftJoinAndSelect('firstApproverBlock.users', 'firstApproverUser')
      .leftJoinAndSelect('approvalLevel.secondApprover', 'secondApproverBlock')
      .leftJoinAndSelect('secondApproverBlock.users', 'secondApproverUser')
      .leftJoinAndSelect('approvalLevel.thirdApprover', 'thirdApproverBlock')
      .leftJoinAndSelect('thirdApproverBlock.users', 'thirdApproverUser')
      .leftJoinAndSelect('approvalLevel.fourthApprover', 'fourthApproverBlock')
      .leftJoinAndSelect('fourthApproverBlock.users', 'fourthApproverUser')
      .leftJoinAndSelect('approvalLevel.fifthApprover', 'fifthApproverBlock')
      .leftJoinAndSelect('fifthApproverBlock.users', 'fifthApproverUser')
      .leftJoinAndSelect('approvalLevel.sixthApprover', 'sixthApproverBlock')
      .leftJoinAndSelect('sixthApproverBlock.users', 'sixthApproverUser')
      .leftJoinAndSelect('approvalFlow.finalizers', 'finalizerBlock')
      .leftJoinAndSelect('finalizerBlock.firstFinalizers', 'firstFinalizerUser')
      .leftJoinAndSelect('finalizerBlock.secondFinalizers', 'secondFinalizerUser')
      .leftJoinAndSelect('document.lastActionBy', 'lastActionBy')
      .where(
        new Brackets((qb) => {
          //   qb.where('verifier.id = :userId', { userId })
          qb.orWhere('firstApproverUser.id = :userId', { userId })
            .orWhere('secondApproverUser.id = :userId', { userId })
            // .orWhere('thirdApproverUser.id = :userId', { userId })
            // .orWhere('fourthApproverUser.id = :userId', { userId })
            // .orWhere('fifthApproverUser.id = :userId', { userId })
            // .orWhere('sixthApproverUser.id = :userId', { userId })
            // .orWhere('firstFinalizerUser.id = :userId', { userId })
            // .orWhere('secondFinalizerUser.id = :userId', { userId })
            .orWhere('lastActionBy.id = :userId', { userId });
        }),
      )
      .andWhere('document.document_type_id IS NOT NULL')
      .andWhere('document.type = :documentType', { documentType });

     //console.log("from queryBuilder: ",queryBuilder);
      

    const sort = queryOptions?.sort || 'document.createdAt:DESC';
    const [sortField, sortOrderRaw] = sort.split(':');
    const sortOrder = (sortOrderRaw || 'DESC').toUpperCase() as 'ASC' | 'DESC';

    queryBuilder.orderBy(sortField, sortOrder);

    const page = queryOptions?.page || 1;
    const limit = queryOptions?.limit || 10;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    // Execute with count
    const [data, total] = await queryBuilder.getManyAndCount();

    //console.log("data & total:", data, total);
    

    return {
      data,
      meta: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    };

  }

  //TODO: For View
   async getDocumentById(id: string): Promise<any> {
    try {
      //TODO: By Shri
      console.log("In document double service");
      
      const document = await this.documentbRepository.findOne({
        where: { id },
        relations: [
          'lastActionBy',
          'approvalInfo',
          'approvalInfo.firstFinalized',
          'approvalInfo.secondFinalized',
          'approvalInfo.firstApproved',
          'approvalInfo.secondApproved',
          'approvalInfo.thirdApproved',
          'approvalInfo.verified',
        ],
        order: { createdAt: 'DESC' },
      });

      console.log("Approval flow : ", document);
      

      if (!document) {
        throw new Error(`Document with ID ${id} not found`);
      }

   //   console.log("+++++++++++++++++++++++++++++++++++");
      
      //TODO: By Shri
      const approvalInfo = document.approvalInfo;
      const approvalInfoSummary = approvalInfo
        ? {
          verified: approvalInfo.verified
            ? {
              name: approvalInfo.verified.userName,
              status: approvalInfo.verified.status,
            }
            : null,
          firstApproved: approvalInfo.firstApproved
            ? {
              name: approvalInfo.firstApproved.userName,
              status: approvalInfo.firstApproved.status,
            }
            : null,
          secondApproved: approvalInfo.secondApproved
            ? {
              name: approvalInfo.secondApproved.userName,
              status: approvalInfo.secondApproved.status,
            }
            : null,
          thirdApproved: approvalInfo.thirdApproved
            ? {
              name: approvalInfo.thirdApproved.userName,
              status: approvalInfo.thirdApproved.status,
            }
            : null,
          firstFinalized: approvalInfo.firstFinalized
            ? {
              name: approvalInfo.firstFinalized.userName,
              status: approvalInfo.firstFinalized.status,
            }
            : null,
          secondFinalized: approvalInfo.secondFinalized
            ? {
              name: approvalInfo.secondFinalized.userName,
              status: approvalInfo.secondFinalized.status,
            }
            : null,
        }
        : null;

   //     console.log("Approva summary: ", approvalInfoSummary);
        

      // Construct response
      return {
        documentId: document.id,
        // documentType: document.type,
        documentTypeId: document.document_type_id,
        status: document.status,
        //type: document.type,
        overAllStatus: document.status,
        // createdAt: document.createdAt,
        createdBy: document.lastActionBy?.firstName ?? null,
        // ...documentDataByForm, // full GRN info (or null)
        approvalSummary: approvalInfoSummary, // name + status summary
      };
    } catch (error) {
      throw new Error(`Error fetching document: ${error}`);
    }
  }


}