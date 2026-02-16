//TODO: This service is used for multiple level approval like grns and vouchers.
import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { DocumentbRepository } from '../repositories/documentb.repository';
import { Documentb, DocumentStatus, DocumentTypeEnum } from '../entities/docuemnt.entity';
import { ApprovalFlowRepository } from '../repositories/approvalFlow.repository';
import { ApproverBlock } from '../entities/approvalBlock.entity';
import { ApprovalLevel } from '../entities/approvalLevel.entity';
import { User } from '../entities/user.entity';
import { NotificationService } from './notification.service';
import { ApproverStatus } from '../entities/approvalname.entity';
import { ApprovalStageInfoRepository } from '../repositories/approvalStageInfoRepository';
import { DocumentApprovalFlow } from '../entities/documentApproveBy.entity';
import { GrnRepository } from '../repositories/grn.repository';
import { DocumentApprovalFlowRepository } from '../repositories/DocumentApprovalFlowRepository.repository';
import { RfpaRepository } from '../repositories/rfpa.repository';
import { DealSlipRepository } from '../repositories/dealSlip.repository';
import { log } from 'node:console';
import { UserRepository } from '../repositories/user.repository';
import { MultiCashVoucherRepository } from '../repositories/multicashVoucher.repository';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import { ParsedQs } from 'qs';
import { Brackets } from 'typeorm';
import e from 'express';
//import { DocumentApprovalFlowRepository } from '../repositories/DocumentApprovalFlowRepository.repository';

export interface DocumentWithRelatedData extends Documentb {
  relatedData?: any;
}

@injectable()
export class DocumentbService {
  constructor(
    @inject(TYPES.DocumentbRepository)
    private documentbRepository: DocumentbRepository,
    @inject(TYPES.ApprovalFlowRepository)
    private approvalFlowRepo: ApprovalFlowRepository,
    @inject(TYPES.NotificationService)
    private notificationService: NotificationService,
    @inject(TYPES.ApprovalStageInfoRepository)
    private approvalStageInfoRepository: ApprovalStageInfoRepository,
    @inject(TYPES.GrnRepository) private readonly grnRepository: GrnRepository,
    //@inject(TYPES.DocumentApprovalFlowRepository) documentApprovalFlowRepository: ApprovalStageInfoRepository,
    @inject(TYPES.DocumentApprovalFlowRepository)
    private documentApprovalFlowRepository: DocumentApprovalFlowRepository,
    @inject(TYPES.RfpaRepository)
    private rfpaRepository: RfpaRepository, // Replace with actual type
    @inject(TYPES.DealSlipRepository)
    private dealSlipRepository: DealSlipRepository, // Replace with actual type
    @inject(TYPES.UserRepository) private userRepository: UserRepository,
    @inject(TYPES.MultiCashVoucherRepository)
    private cashVoucherRepository: MultiCashVoucherRepository,
  ) { }

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
  private isDoubleApprovalBasedDocument(type: DocumentTypeEnum): boolean {
    return [
      //Todo:Have To Add Some documentType...pending
      DocumentTypeEnum.DC_TYPE_CUSTOMER,
      DocumentTypeEnum.DC_TYPE_STOCK_TRANSFER,
      DocumentTypeEnum.LABOR_PAYMENT_VOUCHER,
      DocumentTypeEnum.MULTI_CASH_VOUCHER,
      DocumentTypeEnum.TRANSPORT_PAYMENT_VOUCHER,
      DocumentTypeEnum.PACKAGING_MATERIAL_VOUCHER,
      DocumentTypeEnum.DUMP_REGISTER
    ].includes(type);
  }

  private isVerifierBasedDocument(type: DocumentTypeEnum): boolean {
    return [
      DocumentTypeEnum.GRN,
      DocumentTypeEnum.LABOR_PAYMENT_VOUCHER,
      DocumentTypeEnum.MULTI_CASH_VOUCHER,
      DocumentTypeEnum.TRANSPORT_PAYMENT_VOUCHER,
      DocumentTypeEnum.PACKAGING_MATERIAL_VOUCHER,
    ].includes(type);
  }

  //TODO: Create Docuemnt Approval Flow
  async createDocument(documentData: any,/* approvalFlow: any*/): Promise<any> {
    try {
      // console.log('Creating document with data:', documentData);

      const lastActionByUser = documentData.lastActionBy;
      
      if (!lastActionByUser || !lastActionByUser.id) {
        throw new Error(
          'lastActionBy user is required to fetch approval flow.',
        );
      }

      console.log("Document Data:", documentData);


      const approvalFlow = await this.approvalFlowRepo.findOne({
        where: {
          creator: { id: lastActionByUser.id },
          type: documentData.docDef,
        },
        relations: [
          'verifiers',
          'approvers',
          'approvers.firstApprover',
          'approvers.secondApprover',
          'approvers.thirdApprover',
          'approvers.fourthApprover',
          'approvers.fifthApprover',
          'approvers.sixthApprover',
        ],
      });

      console.log("Approval flow: ", approvalFlow);

      if (!approvalFlow) {
        throw new Error(
          `No approval flow found for user ${lastActionByUser.id} and type GRN`,
        );
      }

      // const approvalInfo = this.approvalStageInfoRepository.create({});
      // await this.approvalStageInfoRepository.save(approvalInfo);

      const document = this.documentbRepository.create({
        ...documentData,
        approvalFlow
        //  approvalInfo
      });

      const savedDocument = await this.documentbRepository.save(document);
      //  console.log("Document created:", savedDocument);

      return savedDocument;
    } catch (error) {
      throw new Error(`Error creating document: ${error}`);
    }
  }

  //TODO: To Get document's approval flow by using document id (for example to get created grn's approval flow pass created grn id )
  async getDocumentById(id: string): Promise<any> {
    try {
      //TODO: By Shri
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

      if (!document) {
        throw new Error(`Document with ID ${id} not found`);
      }
      console.log("Document: ", document);

      // Attach full GRN details (if it's a GRN document)
      // let documentDataByForm = null;
      // if (document.type === DocumentTypeEnum.GRN && document.document_type_id) {
      //   documentDataByForm = await this.grnRepository.findOne({
      //     where: { id: document.document_type_id },
      //   //  relations: ['grnProducts','paymentInfo']
      //   });
      // } else if (document.type === DocumentTypeEnum.MULTI_CASH_VOUCHER && document.document_type_id) {
      //   documentDataByForm = await this.cashVoucherRepository.findOne({
      //     where: { id: document.document_type_id },
      //   //  relations: ['grnProducts','paymentInfo']
      //   });
      // }

      //TODO: By Shri
      const approvalInfo = document.approvalInfo;
      const approvalInfoSummary = approvalInfo
        ? {
          verified: approvalInfo.verified
            ? {
              name: approvalInfo.verified.userName,
              status: approvalInfo.verified.status,
              reason: approvalInfo.verified?.reason || null,
            }
            : null,
          firstApproved: approvalInfo.firstApproved
            ? {
              name: approvalInfo.firstApproved.userName,
              status: approvalInfo.firstApproved.status,
              reason: approvalInfo.firstApproved?.reason || null,
            }
            : null,
          secondApproved: approvalInfo.secondApproved
            ? {
              name: approvalInfo.secondApproved.userName,
              status: approvalInfo.secondApproved.status,
              reason: approvalInfo.secondApproved?.reason || null,
            }
            : null,
          thirdApproved: approvalInfo.thirdApproved
            ? {
              name: approvalInfo.thirdApproved.userName,
              status: approvalInfo.thirdApproved.status,
              reason: approvalInfo.thirdApproved?.reason || null,
            }
            : null,
          firstFinalized: approvalInfo.firstFinalized
            ? {
              name: approvalInfo.firstFinalized.userName,
              status: approvalInfo.firstFinalized.status,
              reason: approvalInfo.firstFinalized?.reason || null,
            }
            : null,
          secondFinalized: approvalInfo.secondFinalized
            ? {
              name: approvalInfo.secondFinalized.userName,
              status: approvalInfo.secondFinalized.status,
              reason: approvalInfo.secondFinalized?.reason || null,
            }
            : null,
        }
        : null;
console.log("Approval Info Summary: ", approvalInfoSummary);
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

  //TODO: Get document by document_type_id (e.g., GRN id) with approval flow
  async getDocumentByTypeId(documentTypeId: string): Promise<any> {
    try {
      const document = await this.documentbRepository.findOne({
        where: { document_type_id: documentTypeId },
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
        ],
      });

      return document;
    } catch (error) {
      throw new Error(`Error fetching document by type ID: ${error}`);
    }
  }


  // async startApprovalFlow(documentId: string): Promise<void> {
  //   const document = await this.documentbRepository.findOne({
  //     where: { id: documentId },
  //     relations: [
  //       'approvalFlow',
  //       'approvalFlow.verifiers',
  //       'approvalFlow.approvers',
  //       'approvalFlow.approvers.firstApprover',
  //       'approvalFlow.approvers.secondApprover',
  //       'approvalFlow.approvers.thirdApprover',
  //       'approvalFlow.approvers.fourthApprover',
  //       'approvalFlow.approvers.fifthApprover',
  //       'approvalFlow.approvers.sixthApprover',
  //     ],
  //   });

  //   if (!document || !document.approvalFlow) {
  //     throw new Error('Document or Approval Flow not found');
  //   }

  //   const { approvalFlow, totalAmt, type } = document;

  //   // If document type matches and verifiers exist, assign to verifiers
  //   if (
  //     [
  //       DocumentTypeEnum.GRN,
  //       DocumentTypeEnum.LABOR_PAYMENT_VOUCHER,
  //       DocumentTypeEnum.MULTI_CASH_VOUCHER,
  //       DocumentTypeEnum.TRANSPORT_PAYMENT_VOUCHER,
  //       DocumentTypeEnum.PACKAGING_MATERIAL_VOUCHER,
  //     ].includes(type) &&
  //     approvalFlow.verifiers.length > 0
  //   ) {
  //     await this.assignToUsers(documentId, approvalFlow.verifiers, 'verifier');
  //     return;
  //   }

  //   // Else assign to appropriate approver block based on amount
  //   const approvers = this.getMatchingApproverBlock(
  //     totalAmt,
  //     approvalFlow.approvers,
  //   );
  //   if (!approvers)
  //     throw new Error('No approver found for this document amount.');
  //   await this.assignToUsers(documentId, approvers, 'approver');
  // }

  async startApprovalFlow(documentId: string): Promise<void> {
    console.log("Starting approval flow for document ID:", documentId);
    const document = await this.documentbRepository.findOne({
      where: { id: documentId },
      relations: [
        'approvalFlow',
        'approvalFlow.verifiers',
        'approvalFlow.approvers',
        'approvalFlow.approvers.firstApprover.users',
        'approvalFlow.approvers.secondApprover.users',
        'approvalFlow.approvers.thirdApprover.users',
        'approvalFlow.approvers.fourthApprover.users',
        'approvalFlow.approvers.fifthApprover.users',
        'approvalFlow.approvers.sixthApprover.users',
      ],
    });
  
console.log("Document for starting approval flow: ", document?.type);
    if (!document || !document.approvalFlow) {
      throw new Error('Document or Approval Flow not found');
    }

    const { approvalFlow, totalAmt, type } = document;

    // If document type matches and verifiers exist, assign to verifiers
    if (
      [
        DocumentTypeEnum.GRN,
        //Todo:By Vaishali
        //Todo
        DocumentTypeEnum.LABOR_PAYMENT_VOUCHER,
        DocumentTypeEnum.MULTI_CASH_VOUCHER,
        DocumentTypeEnum.TRANSPORT_PAYMENT_VOUCHER,
        DocumentTypeEnum.PACKAGING_MATERIAL_VOUCHER,
      ].includes(type) &&
      approvalFlow.verifiers.length > 0
    ) {
      await this.assignToUsers(documentId, approvalFlow.verifiers, 'verifier');
      return;
    }

    // Else assign to appropriate approver block based on amount
    const approvers = this.getMatchingApproverBlock(
      totalAmt,
      approvalFlow.approvers,
    );
    if (!approvers) {
      throw new Error('No approver found for this document amount.');
    } else if (this.isSingleApprovalBasedDocument(type) /*&& approvers*/) {
      const FirstLevelApprovers =
        document.approvalFlow.approvers.firstApprover.users;
      console.log('FirstLevelApprovers', FirstLevelApprovers);
      await this.assignToUsers(documentId, FirstLevelApprovers, 'approver');
      return;
    } else if (this.isDoubleApprovalBasedDocument(type) /*&& approvers*/) {
      const firstLevelApprovers =
        document.approvalFlow.approvers.firstApprover.users;
      const secondLevelApprovers =
        document.approvalFlow.approvers.secondApprover.users;
      console.log('FirstLevelApprovers', firstLevelApprovers);
      console.log('secondLevelApprovers', secondLevelApprovers);
      await this.assignToUsers(documentId, firstLevelApprovers, 'approver');
      await this.assignToUsers(documentId, secondLevelApprovers, 'approver');
      return;
    }
    await this.assignToUsers(documentId, approvers, 'approver');
  }

  getMatchingApproverBlock(
    amount: number,
    level: ApprovalLevel,
  ): User[] | null {
    const blocks: (ApproverBlock | null)[] = [
      level.firstApprover,
      level.secondApprover,
      level.thirdApprover,
      // level.fourthApprover,
      // level.fifthApprover,
      // level.sixthApprover,
    ];

    for (const block of blocks) {
      if (
        block &&
        amount >= (block.minAmtCanApprove || 0) &&
        amount <= (block.maxAmtCanApprove || Infinity)
      ) {
        return block.users;
      }
    }
    return null;
  }


  // TODO: Approve Document
  async approveDocumentStep(
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
        'approvalFlow.approvers.firstApprover.users',
        'approvalFlow.approvers.secondApprover.users',
        'approvalFlow.approvers.thirdApprover.users',
        'approvalFlow.finalizers.firstFinalizers',
        'approvalFlow.finalizers.secondFinalizers',
        'approvalInfo',
        'approvalInfo.verified',
        'approvalInfo.firstApproved',
        'approvalInfo.secondApproved',
        'approvalInfo.thirdApproved',
        'approvalInfo.firstFinalized',
        'approvalInfo.secondFinalized',
      ],
    });



    if (!document || !document.approvalFlow) {
      throw new Error('Document or its approval flow not found');
    }

    const now = new Date();
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const userName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
console.log(userName);
    // Ensure approvalInfo exists
    if (!document.approvalInfo) {
      document.approvalInfo = await this.documentApprovalFlowRepository.save(
        this.documentApprovalFlowRepository.create()
      );
      await this.documentbRepository.save(document);
    }

    const info = document.approvalInfo;
    const flow = document.approvalFlow;


    if (document.type === DocumentTypeEnum.GRN || document.type === DocumentTypeEnum.MULTI_CASH_VOUCHER
      || document.type === DocumentTypeEnum.LABOR_PAYMENT_VOUCHER || document.type === DocumentTypeEnum.TRANSPORT_PAYMENT_VOUCHER ||
      document.type === DocumentTypeEnum.PACKAGING_MATERIAL_VOUCHER) {

      // 🟣 Verifier Stage
      if (!info.verified) {
        const isVerifier = flow.verifiers.some(u => u.id === userId);
        if (isVerifier) {
          const verifierStage = await this.approvalStageInfoRepository.save({
            userId,
            userName,
            status: action,
            reason: reason ?? '',
            statusChangedAt: now,
          });

          info.verified = verifierStage;
          await this.documentApprovalFlowRepository.save(info);

          if (action === ApproverStatus.REJECTED) {
            document.status = DocumentStatus.REJECT;
            document.remarks = `${document.type} Rejected by Verifier`;
            await this.documentbRepository.save(document);
            return;
          }

          document.status = DocumentStatus.VERIFIED;
          document.remarks = `${document.type} Verified by Verifier`;
          await this.documentbRepository.save(document);

          // 🚀 Send to all 3 approver levels at once
          await this.assignToUsers(documentId, flow.approvers.firstApprover.users, 'approver');
          await this.assignToUsers(documentId, flow.approvers.secondApprover.users, 'approver');
          await this.assignToUsers(documentId, flow.approvers.thirdApprover.users, 'approver');
          return;
        } else {
          throw new Error('Only verifiers can act at this stage');
        }
      }


      const totalAmt = Number(document.totalAmt) || 0;
      const firstBlock = flow.approvers.firstApprover;
      const secondBlock = flow.approvers.secondApprover;
      const thirdBlock = flow.approvers.thirdApprover;

      console.log('firstBlock:', firstBlock);
      console.log('secondBlock:', secondBlock);
      console.log('thirdBlock:', thirdBlock);
      
      

      // ...existing code...
function isWithinRange(min: number | string | null, max: number | string | null, value: number | string): boolean {
  const minVal = min !== null ? Number(min) : 0;
  const maxVal = max !== null ? Number(max) : Infinity;
  const val = typeof value === 'string' ? Number(value) : value;
  return val >= minVal && val <= maxVal;
}
// ...existing code...


      // Only set block required if users exist and amount falls in range
      const requiresFirst = firstBlock?.users?.length > 0 &&
        isWithinRange(firstBlock.minAmtCanApprove, firstBlock.maxAmtCanApprove, document.totalAmt);

      const requiresSecond = secondBlock?.users?.length > 0 &&
        isWithinRange(secondBlock.minAmtCanApprove, secondBlock.maxAmtCanApprove, document.totalAmt);

      const requiresThird = thirdBlock?.users?.length > 0 &&
        isWithinRange(thirdBlock.minAmtCanApprove, thirdBlock.maxAmtCanApprove, document.totalAmt);

      console.log('first:', requiresFirst);
      console.log('second:', requiresSecond);
      console.log('third:', requiresThird);




      //TODO: First Amount Approver
      if (requiresFirst && !info.firstApproved && firstBlock.users.some(u => u.id === userId)) {
        console.log('in first block amount:', totalAmt);

        if (!info.firstApproved) {
          const stage = await this.approvalStageInfoRepository.save({
            userId,
            userName,
            status: action,
            reason: reason ?? '',
            statusChangedAt: now,
          });

          info.firstApproved = stage;
          await this.documentApprovalFlowRepository.save(info);

          if (action === ApproverStatus.REJECTED) {
            document.status = DocumentStatus.REJECT;
            document.remarks = `${document.type} Rejected at Approver Level 1`;
            await this.documentbRepository.save(document);
            return;
          }

          const a1 = info.firstApproved?.status === ApproverStatus.APPROVED;
          const a2 = info.secondApproved?.status === ApproverStatus.APPROVED;
          const a3 = info.thirdApproved?.status === ApproverStatus.APPROVED;

          if (
            a1
          ) {
            console.log("Shri in service");

            document.status = DocumentStatus.APPROVED;
            document.remarks = `${document.type} Approved by Required Approvers`;
            await this.documentbRepository.save(document);
            await this.assignToUsers(documentId, flow.finalizers.firstFinalizers, 'finalizer');
            return;
          }

          return;

        } else {
          throw new Error('First approver has already acted on this document');
        }

      }

      //TODO: Second Amount Approver
      if (requiresSecond && (!info.firstApproved || !info.secondApproved) && (firstBlock.users.some(u => u.id === userId) || secondBlock.users.some(u => u.id === userId))) {
        console.log("helloo");

        if (firstBlock.users.some(u => u.id === userId)) {
          if (!info.firstApproved) {
            const stage = await this.approvalStageInfoRepository.save({
              userId,
              userName,
              status: action,
              reason: reason ?? '',
              statusChangedAt: now,
            });
            info.firstApproved = stage;

            await this.documentApprovalFlowRepository.save(info);

            if (action === ApproverStatus.REJECTED) {
              document.status = DocumentStatus.REJECT;
              document.remarks = `${document.type} Rejected at Approver Level 2`;
              await this.documentbRepository.save(document);
              return;
            }

            const a1 = info.firstApproved?.status === ApproverStatus.APPROVED;
            const a2 = info.secondApproved?.status === ApproverStatus.APPROVED;
            const a3 = info.thirdApproved?.status === ApproverStatus.APPROVED;

            if (
              a1 && a2// Only L1 + L2 required
              //   (requiresThird && a1 && a2 && a3) // All three required
            ) {
              document.status = DocumentStatus.APPROVED;
              document.remarks = `${document.type} Approved by Required Approvers`;
              await this.documentbRepository.save(document);
              await this.assignToUsers(documentId, flow.finalizers.firstFinalizers, 'finalizer');
              return;
            }


            return;

          }
          else {
            throw new Error('First approver has already acted on this document');
          }
        } else if (secondBlock.users.some(u => u.id === userId)) {
          if (!info.secondApproved) {
            const stage = await this.approvalStageInfoRepository.save({
              userId,
              userName,
              status: action,
              reason: reason ?? '',
              statusChangedAt: now,
            });
            info.secondApproved = stage;

            await this.documentApprovalFlowRepository.save(info);

            if (action === ApproverStatus.REJECTED) {
              document.status = DocumentStatus.REJECT;
              document.remarks = `${document.type} Rejected at Approver Level 2`;
              await this.documentbRepository.save(document);
              return;
            }

            const a1 = info.firstApproved?.status === ApproverStatus.APPROVED;
            const a2 = info.secondApproved?.status === ApproverStatus.APPROVED;
            //  const a3 = info.thirdApproved?.status === ApproverStatus.APPROVED;

            if (
              (a1 && a2)
            ) {
              console.log("Hey i am in second block amount, ", totalAmt);

              document.status = DocumentStatus.APPROVED;
              document.remarks = `${document.type} Approved by Required Approvers`;
              await this.documentbRepository.save(document);
              await this.assignToUsers(documentId, flow.finalizers.firstFinalizers, 'finalizer');
              return;
            }


            return;

          } else {
            throw new Error('Second approver has already acted on this document');
          }
        } else {
          throw new Error('User is not authorized to act on this document at this stage');
        }
      }


      //TODO: Third Amount Approver
      if (requiresThird && (!info.firstApproved || !info.secondApproved || !info.thirdApproved) && (firstBlock.users.some(u => u.id === userId) || secondBlock.users.some(u => u.id === userId) || thirdBlock.users.some(u => u.id === userId))) {

        if (firstBlock.users.some(u => u.id === userId)) {
          if (!info.firstApproved) {
            const stage = await this.approvalStageInfoRepository.save({
              userId,
              userName,
              status: action,
              reason: reason ?? '',
              statusChangedAt: now,
            });
            info.firstApproved = stage;
            await this.documentApprovalFlowRepository.save(info);
            if (action === ApproverStatus.REJECTED) {
              document.status = DocumentStatus.REJECT;
              document.remarks = `${document.type} Rejected at Approver Level 3`;
              await this.documentbRepository.save(document);
              return;
            }

            const a1 = info.firstApproved?.status === ApproverStatus.APPROVED;
            const a2 = info.secondApproved?.status === ApproverStatus.APPROVED;
            const a3 = info.thirdApproved?.status === ApproverStatus.APPROVED;

            if (a1 && a2 && a3) {
              document.status = DocumentStatus.APPROVED;
              document.remarks = `${document.type} Approved by All Approvers`;
              await this.documentbRepository.save(document);
              await this.assignToUsers(documentId, flow.finalizers.firstFinalizers, 'finalizer');
              return;
            }
            return;
          } else {
            throw new Error('First approver has already acted on this document');
          }
        } else if (secondBlock.users.some(u => u.id === userId)) {
          if (!info.secondApproved) {
            const stage = await this.approvalStageInfoRepository.save({
              userId,
              userName,
              status: action,
              reason: reason ?? '',
              statusChangedAt: now,
            });
            info.secondApproved = stage;
            await this.documentApprovalFlowRepository.save(info);
            if (action === ApproverStatus.REJECTED) {
              document.status = DocumentStatus.REJECT;
              document.remarks = `${document.type} Rejected at Approver Level 3`;
              await this.documentbRepository.save(document);
              return;
            }
            const a1 = info.firstApproved?.status === ApproverStatus.APPROVED;
            const a2 = info.secondApproved?.status === ApproverStatus.APPROVED;
            const a3 = info.thirdApproved?.status === ApproverStatus.APPROVED;
            if (a1 && a2 && a3) {
              document.status = DocumentStatus.APPROVED;
              document.remarks = `${document.type} Approved by All Approvers`;
              await this.documentbRepository.save(document);
              await this.assignToUsers(documentId, flow.finalizers.firstFinalizers, 'finalizer');
              return;
            }
            return;
          } else {
            throw new Error('Second approver has already acted on this document');
          }
        } else if (thirdBlock.users.some(u => u.id === userId)) {
          if (!info.thirdApproved) {
            const stage = await this.approvalStageInfoRepository.save({
              userId,
              userName,
              status: action,
              reason: reason ?? '',
              statusChangedAt: now,
            });
            info.thirdApproved = stage;
            await this.documentApprovalFlowRepository.save(info);
            if (action === ApproverStatus.REJECTED) {
              document.status = DocumentStatus.REJECT;
              document.remarks = `${document.type} Rejected at Approver Level 3`;
              await this.documentbRepository.save(document);
              return;
            }
            const a1 = info.firstApproved?.status === ApproverStatus.APPROVED;
            const a2 = info.secondApproved?.status === ApproverStatus.APPROVED;
            const a3 = info.thirdApproved?.status === ApproverStatus.APPROVED;
            if (a1 && a2 && a3) {
              document.status = DocumentStatus.APPROVED;
              document.remarks = `${document.type} Approved by All Approvers`;
              await this.documentbRepository.save(document);
              await this.assignToUsers(documentId, flow.finalizers.firstFinalizers, 'finalizer');
              return;
            }
            return;
          } else {
            throw new Error('Third approver has already acted on this document');
          }
        } else {
          throw new Error('User is not authorized to act on this document at this stage');
        }

      }

      // 🔵 Finalizer 1
      if (!info.firstFinalized) {
        const isFinalizer1 = flow.finalizers.firstFinalizers.some(u => u.id === userId);
        if (isFinalizer1) {
          const a1 = info.firstApproved?.status === ApproverStatus.APPROVED;
          const a2 = info.secondApproved?.status === ApproverStatus.APPROVED;
          const a3 = info.thirdApproved?.status === ApproverStatus.APPROVED;

          const requiredApprovalsPassed =
            (!requiresFirst || a1) &&
            (!requiresSecond || (a1 && a2)) &&
            (!requiresThird || (a1 && a2 && a3));
          console.log('status: ', document.status);

          if (document.status !== 'approved') {
            throw new Error('Required approver levels have not approved yet for Finalizer 1 to act.');
          }
          console.log("REqui: ", requiredApprovalsPassed);




          const stage = await this.approvalStageInfoRepository.save({
            userId,
            userName,
            status: action,
            reason: reason ?? '',
            statusChangedAt: now,
          });

          info.firstFinalized = stage;
          await this.documentApprovalFlowRepository.save(info);

          if (action === ApproverStatus.REJECTED) {
            document.status = DocumentStatus.REJECT;
            document.remarks = `${document.type} Rejected by First Finalizer`;
          } else {
            document.status = DocumentStatus.FINALIZING;
            document.remarks = `${document.type} Approved by First Finalizer`;
            await this.assignToUsers(documentId, flow.finalizers.secondFinalizers, 'finalizer');
          }

          await this.documentbRepository.save(document);
          return;
        }
      }


      // 🔴 Finalizer 2
      if (!info.secondFinalized) {
        const isFinalizer2 = flow.finalizers.secondFinalizers.some(u => u.id === userId);
        if (isFinalizer2) {
          if (!info.firstFinalized || info.firstFinalized.status !== ApproverStatus.APPROVED) {
            throw new Error('Finalizer 1 must approve before Finalizer 2 can act');
          }

          const stage = await this.approvalStageInfoRepository.save({
            userId,
            userName,
            status: action,
            reason: reason ?? '',
            statusChangedAt: now,
          });

          info.secondFinalized = stage;
          await this.documentApprovalFlowRepository.save(info);

          if (action === ApproverStatus.REJECTED) {
            document.status = DocumentStatus.REJECT;
            document.remarks = `${document.type} Rejected by Second Finalizer`;
          } else {
            document.status = DocumentStatus.COMPLETE;
            document.remarks = `${document.type} Fully Approved and Finalized`;
          }

          await this.documentbRepository.save(document);
          return;
        }
      }

    }



    throw new Error('User is not authorized to act on this document at this stage');
  }

  



  // async approveDocumentStep(
  //   documentId: string,
  //   userId: string,
  //   action: ApproverStatus,
  //   reason?: string,
  // ): Promise<void> {
  //   const document = await this.documentbRepository.findOne({
  //     where: { id: documentId },
  //     relations: [
  //       'approvalFlow',
  //       'approvalFlow.verifiers',
  //       'approvalFlow.approvers.firstApprover.users',
  //       'approvalFlow.approvers.secondApprover.users',
  //       'approvalFlow.approvers.thirdApprover.users',
  //       'approvalFlow.finalizers.firstFinalizers',
  //       'approvalFlow.finalizers.secondFinalizers',
  //       'approvalInfo',
  //       'approvalInfo.verified',
  //       'approvalInfo.firstApproved',
  //       'approvalInfo.secondApproved',
  //       'approvalInfo.thirdApproved',
  //       'approvalInfo.firstFinalized',
  //       'approvalInfo.secondFinalized',
  //     ],
  //   });

  //   if (!document || !document.approvalFlow) {
  //     throw new Error('Document or its approval flow not found');
  //   }

  //   const now = new Date();
  //   const user = await this.userRepository.findOne({ where: { id: userId } });
  //   const userName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';

  //   if (!document.approvalInfo) {
  //     document.approvalInfo = await this.documentApprovalFlowRepository.save(
  //       this.documentApprovalFlowRepository.create()
  //     );
  //     await this.documentbRepository.save(document);
  //   }

  //   const info = document.approvalInfo;
  //   const flow = document.approvalFlow;

  //   // Verifier stage
  //   if (!info.verified) {
  //     const isVerifier = flow.verifiers.some(u => u.id === userId);
  //     if (!isVerifier) throw new Error('Only verifiers can act at this stage');

  //     const verifierStage = await this.approvalStageInfoRepository.save({
  //       userId,
  //       userName,
  //       status: action,
  //       reason: reason ?? '',
  //       statusChangedAt: now,
  //     });

  //     info.verified = verifierStage;
  //     await this.documentApprovalFlowRepository.save(info);

  //     if (action === ApproverStatus.REJECTED) {
  //       document.status = DocumentStatus.REJECT;
  //       document.remarks = `${document.type} Rejected by Verifier`;
  //     } else {
  //       document.status = DocumentStatus.VERIFIED;
  //       document.remarks = `${document.type} Verified by Verifier`;
  //       if (flow.approvers.firstApprover)
  //         await this.assignToUsers(documentId, flow.approvers.firstApprover.users, 'approver');
  //       if (flow.approvers.secondApprover)
  //         await this.assignToUsers(documentId, flow.approvers.secondApprover.users, 'approver');
  //       if (flow.approvers.thirdApprover)
  //         await this.assignToUsers(documentId, flow.approvers.thirdApprover.users, 'approver');
  //     }

  //     await this.documentbRepository.save(document);
  //     return;
  //   }

  //   const totalAmt = Number(document.totalAmt) || 0;
  //   const firstBlock = flow.approvers.firstApprover ?? null;
  //   const secondBlock = flow.approvers.secondApprover ?? null;
  //   const thirdBlock = flow.approvers.thirdApprover ?? null;

  // //   const requiresFirst = firstBlock &&
  // //     totalAmt >= Number(firstBlock.minAmtCanApprove) &&
  // //     (firstBlock.maxAmtCanApprove === null || totalAmt <= Number(firstBlock.maxAmtCanApprove));
  // // console.log('first', requiresFirst);

  // //   const requiresSecond = secondBlock &&
  // //     totalAmt >= Number(secondBlock.minAmtCanApprove) &&
  // //     (secondBlock.maxAmtCanApprove === null || totalAmt <= Number(secondBlock.maxAmtCanApprove));
  // // console.log('second', requiresSecond);

  // //   const requiresThird = thirdBlock &&
  // //     totalAmt >= Number(thirdBlock.minAmtCanApprove) &&
  // //     (thirdBlock.maxAmtCanApprove === null || totalAmt <= Number(thirdBlock.maxAmtCanApprove));
  // // console.log('third', requiresThird);

  // // console.log('Total Amount:', document.totalAmt);

  // // console.log('firstBlock:', firstBlock);
  // // console.log('secondBlock:', secondBlock);
  // // console.log('thirdBlock:', thirdBlock);


  // function isWithinRange(min: number | null, max: number | null, value: number): boolean {
  //   const minVal = min !== null ? min : 0;
  //   const maxVal = max !== null ? max : Infinity;
  //   return value >= minVal && value <= maxVal;
  // }


  // // Only set block required if users exist and amount falls in range
  // const requiresFirst = firstBlock?.users?.length > 0 &&
  //   isWithinRange(firstBlock.minAmtCanApprove, firstBlock.maxAmtCanApprove, document.totalAmt);

  // const requiresSecond = secondBlock?.users?.length > 0 &&
  //   isWithinRange(secondBlock.minAmtCanApprove, secondBlock.maxAmtCanApprove, document.totalAmt);

  // const requiresThird = thirdBlock?.users?.length > 0 &&
  //   isWithinRange(thirdBlock.minAmtCanApprove, thirdBlock.maxAmtCanApprove, document.totalAmt);

  // console.log('first:', requiresFirst);
  // console.log('second:', requiresSecond);
  // console.log('third:', requiresThird);

  //   // Utility to save approval and check rejection
  //   const handleApproval = async (
  //     stageKey: 'firstApproved' | 'secondApproved' | 'thirdApproved',
  //     remarks: string,
  //   ) => {
  //     const stage = await this.approvalStageInfoRepository.save({
  //       userId,
  //       userName,
  //       status: action,
  //       reason: reason ?? '',
  //       statusChangedAt: now,
  //     });

  //     info[stageKey] = stage;
  //     await this.documentApprovalFlowRepository.save(info);

  //     if (action === ApproverStatus.REJECTED) {
  //       document.status = DocumentStatus.REJECT;
  //       document.remarks = `${document.type} Rejected at ${remarks}`;
  //       await this.documentbRepository.save(document);
  //       return false;
  //     }

  //     return true;
  //   };

  //   // First approver block
  //   if (requiresFirst && !info.firstApproved && firstBlock?.users.some(u => u.id === userId)) {
  //     const proceed = await handleApproval('firstApproved', 'Approver Level 1');
  //     if (!proceed) return;

  //     if (!requiresSecond && !requiresThird) {
  //       document.status = DocumentStatus.APPROVED;
  //       document.remarks = `${document.type} Approved by Required Approvers`;
  //       await this.documentbRepository.save(document);
  //       await this.assignToUsers(documentId, flow.finalizers.firstFinalizers, 'finalizer');
  //     }

  //     return;
  //   }

  //   // Second approver block
  //   if (requiresSecond && secondBlock?.users.some(u => u.id === userId)) {
  //     if (!info.firstApproved?.status || info.firstApproved.status !== ApproverStatus.APPROVED) {
  //       throw new Error('First level approval is required before second approver can act');
  //     }

  //     if (!info.secondApproved) {
  //       const proceed = await handleApproval('secondApproved', 'Approver Level 2');
  //       if (!proceed) return;

  //       if (!requiresThird) {
  //         document.status = DocumentStatus.APPROVED;
  //         document.remarks = `${document.type} Approved by Required Approvers`;
  //         await this.documentbRepository.save(document);
  //         await this.assignToUsers(documentId, flow.finalizers.firstFinalizers, 'finalizer');
  //       }

  //       return;
  //     } else {
  //       throw new Error('Second approver has already acted');
  //     }
  //   }

  //   // Third approver block
  //   if (requiresThird && thirdBlock?.users.some(u => u.id === userId)) {
  //     if (
  //       info.firstApproved?.status !== ApproverStatus.APPROVED ||
  //       info.secondApproved?.status !== ApproverStatus.APPROVED
  //     ) {
  //       throw new Error('First and second approvals are required before third approver can act');
  //     }

  //     if (!info.thirdApproved) {
  //       const proceed = await handleApproval('thirdApproved', 'Approver Level 3');
  //       if (!proceed) return;

  //       document.status = DocumentStatus.APPROVED;
  //       document.remarks = `${document.type} Approved by Required Approvers`;
  //       await this.documentbRepository.save(document);
  //       await this.assignToUsers(documentId, flow.finalizers.firstFinalizers, 'finalizer');
  //       return;
  //     } else {
  //       throw new Error('Third approver has already acted');
  //     }
  //   }

  //   // Finalizer 1
  //   if (!info.firstFinalized) {
  //     const isFinalizer1 = flow.finalizers.firstFinalizers.some(u => u.id === userId);
  //     if (isFinalizer1) {
  //       const a1 = info.firstApproved?.status === ApproverStatus.APPROVED;
  //       const a2 = info.secondApproved?.status === ApproverStatus.APPROVED;
  //       const a3 = info.thirdApproved?.status === ApproverStatus.APPROVED;

  //       const requiredApprovalsPassed =
  //         (requiresFirst ? a1 : true) &&
  //         (requiresSecond ? a2 : true) &&
  //         (requiresThird ? a3 : true);

  //       if (!requiredApprovalsPassed || document.status !== DocumentStatus.APPROVED) {
  //         throw new Error('Required approvals are not completed for Finalizer 1');
  //       }

  //       const stage = await this.approvalStageInfoRepository.save({
  //         userId,
  //         userName,
  //         status: action,
  //         reason: reason ?? '',
  //         statusChangedAt: now,
  //       });

  //       info.firstFinalized = stage;
  //       await this.documentApprovalFlowRepository.save(info);

  //       if (action === ApproverStatus.REJECTED) {
  //         document.status = DocumentStatus.REJECT;
  //         document.remarks = `${document.type} Rejected by Finalizer 1`;
  //       } else {
  //         document.status = DocumentStatus.FINALIZING;
  //         document.remarks = `${document.type} Approved by Finalizer 1`;
  //         await this.assignToUsers(documentId, flow.finalizers.secondFinalizers, 'finalizer');
  //       }

  //       await this.documentbRepository.save(document);
  //       return;
  //     }
  //   }

  //   // Finalizer 2
  //   if (!info.secondFinalized) {
  //     const isFinalizer2 = flow.finalizers.secondFinalizers.some(u => u.id === userId);
  //     if (isFinalizer2) {
  //       if (!info.firstFinalized || info.firstFinalized.status !== ApproverStatus.APPROVED) {
  //         throw new Error('Finalizer 1 must approve before Finalizer 2 can act');
  //       }

  //       const stage = await this.approvalStageInfoRepository.save({
  //         userId,
  //         userName,
  //         status: action,
  //         reason: reason ?? '',
  //         statusChangedAt: now,
  //       });

  //       info.secondFinalized = stage;
  //       await this.documentApprovalFlowRepository.save(info);

  //       if (action === ApproverStatus.REJECTED) {
  //         document.status = DocumentStatus.REJECT;
  //         document.remarks = `${document.type} Rejected by Finalizer 2`;
  //       } else {
  //         document.status = DocumentStatus.COMPLETE;
  //         document.remarks = `${document.type} Fully Approved and Finalized`;
  //       }

  //       await this.documentbRepository.save(document);
  //       return;
  //     }
  //   }

  //   throw new Error('User is not authorized to act on this document at this stage');
  // }




  //Todo:Send Nottification to related Approval Flow User
  async assignToUsers(
    documentId: string,
    users: User[],
    role: 'verifier' | 'approver' | 'finalizer',
  ): Promise<void> {
    if (!users || users.length === 0) {
      console.warn(
        `No users provided to assign for document ${documentId} as ${role}`,
      );
      return;
    }

    console.log(
      `Assigning document ${documentId} to ${role}s:`,
      users.map((u) => u.id),
    );

    const document = await this.documentbRepository.findOne({
      where: { id: documentId },
    });

    let documentType = null;
    let documentTypeNo = null;
    switch (document?.type) {
      case 'grn':
        documentType = await this.grnRepository.findOne({
          where: { id: document.document_type_id },
        });
        documentTypeNo = documentType?.grnNo;
        break;

      case 'rfpa':
        documentType = await this.rfpaRepository.findOne({
          where: { id: document.document_type_id },
          //relations: ['someRelation'], // replace with actual relations
        });
        documentTypeNo = documentType?.rfpaId;
        break;

      case 'deal-slip':
        documentType = await this.dealSlipRepository.findOne({
          where: { id: document.document_type_id },
          //relations: ['someRelation'],
        });
        documentTypeNo = documentType?.dealSlipNo;
        break;

      // ➕ Add more cases as needed
    }

    for (const user of users) {
      console.log(
        `Assigned user ${user.id} as ${role} for document ${documentId}`,
      );

      const message = `You have been assigned as a ${role} for ${document?.type} type document with ${document?.type}No=${documentTypeNo}`;

      try {
        await this.notificationService.createNoti(message, user.id);
      } catch (err) {
        console.error(`Failed to send notification to user ${user.id}:`, err);
      }
    }

    // Optional: Update document status
    // await this.documentbRepository.update(documentId, {
    //   status: DocumentStatus.IN_PROGRESS,
    // });
  }

  async getAllHoldGrnDocuments(): Promise<any[]> {
    return this.documentbRepository.find({
      where: {
        type: DocumentTypeEnum.GRN,
        status: DocumentStatus.HOLD,
      },
      relations: [
        'lastActionBy',
        'approvalFlow',
        'approvalFlow.verifiers',
        'approvalFlow.approvers',
        'approvalFlow.approvers.firstApprover.users',
        'approvalFlow.approvers.secondApprover.users',
        'approvalFlow.approvers.thirdApprover.users',
        'approvalFlow.approvers.fourthApprover.users',
        'approvalFlow.approvers.fifthApprover.users',
        'approvalFlow.approvers.sixthApprover.users',
        'approvalFlow.finalizers',
        'approvalFlow.finalizers.firstFinalizers',
        'approvalFlow.finalizers.secondFinalizers',
      ],
      order: { createdAt: 'DESC' }, // optional: newest first
    });
  }

  //TODO: Get Document with Data
  public async getAllDocumentByUserId(userId: string, documentType: string, queryOptions: PaginationOptions, skipPagination: boolean = false): Promise<any> {

    //console.log("documentType", documentType);

    if (!Object.values(DocumentTypeEnum).includes(documentType as DocumentTypeEnum)) {
      throw new Error(`Invalid document type: ${documentType}`);
    }

    // const paginationOptions: PaginationOptions = {
    //   page: Number(query.page) || 1,
    //   limit: Number(query.limit) || 10,
    //   search: query.search as string,
    //   sort: query.sort as string,
    //   filters: query.filters
    //     ? JSON.parse(query.filters as string)
    //     : {},
    //   searchFields: ['type', 'remarks'],
    // };

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
          qb.where('verifier.id = :userId', { userId })
            .orWhere('firstApproverUser.id = :userId', { userId })
            .orWhere('secondApproverUser.id = :userId', { userId })
            .orWhere('thirdApproverUser.id = :userId', { userId })
            .orWhere('fourthApproverUser.id = :userId', { userId })
            .orWhere('fifthApproverUser.id = :userId', { userId })
            .orWhere('sixthApproverUser.id = :userId', { userId })
            .orWhere('firstFinalizerUser.id = :userId', { userId })
            .orWhere('secondFinalizerUser.id = :userId', { userId })
            .orWhere('lastActionBy.id = :userId', { userId });
        }),
      )
      .andWhere('document.document_type_id IS NOT NULL')
      .andWhere('document.type = :documentType', { documentType });

    const sort = queryOptions?.sort || 'document.createdAt:DESC';
    const [sortField, sortOrderRaw] = sort.split(':');
    const sortOrder = (sortOrderRaw || 'DESC').toUpperCase() as 'ASC' | 'DESC';

    queryBuilder.orderBy(sortField, sortOrder);

        // Execute with count
    const [data, total] = await queryBuilder.getManyAndCount();

    // Apply pagination if not skipped and page/limit are provided
    let paginatedData = data;
    let currentPage = 1;
    let currentLimit = total; // Default to all records if no pagination
    
    if (!skipPagination && queryOptions?.page && queryOptions?.limit) {
      const page = queryOptions.page;
      const limit = queryOptions.limit;
      const skip = (page - 1) * limit;

      paginatedData = data.slice(skip, skip + limit);
      currentPage = page;
      currentLimit = limit;
    }

    return {
      data: paginatedData,
      meta: {
        total,
        page: currentPage,
        pages: currentLimit ? Math.ceil(total / currentLimit) : 1,
      },
    };


    // Apply search/filter/sort/pagination
    // const { data: documents, meta } = await buildQuery(
    //   queryBuilder,
    //   // query,
    //   'document',
    // );
    //  const typedDocuments = queryBuilder as DocumentWithRelatedData[];

    // for (const doc of typedDocuments) {
    //   if (!doc.document_type_id) continue;

    //   try {
    //     if (doc.type === DocumentTypeEnum.GRN) {
    //       doc.relatedData = await this.grnRepository.findOne({
    //         where: { id: doc.document_type_id },
    //         relations: ['paymentInfo'],
    //       });
    //     } else if (doc.type === DocumentTypeEnum.RFPA) {
    //       // Add RFPA fetch logic when needed
    //     }

    //   } catch {
    //     doc.relatedData = null;
    //   }
    // }

    // const relatedDataOnly = typedDocuments
    //   .filter((d) => d)
    // .map((doc) => ({
    //   documentId: doc.id,
    //   documentType: doc.type,
    //   documentTypeId: doc.document_type_id,
    //   status: doc.status
    // }));


    return null;
    {
      // status: 'success',
      //data: relatedDataOnly,  
      // meta: {
      //   total: meta.total,
      //   pages: meta.pages,    
      //   page: meta.page,
      // },
    };
  }

}
