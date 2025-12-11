import { inject } from 'inversify';
import {
  controller,
  httpPost,
  httpGet,

  httpDelete,
  request,
  requestParam,
  response,
  next,
 
  httpPut,
} from 'inversify-express-utils';
import { TYPES } from '../types';
import { NextFunction, Request, Response } from 'express';
import AppError from '../utils/appError'; // Custom error handling
import { GrnService } from '../services/grn.service';
import {
  captureUser,
  deserializeUser,
  requireUser,
} from '../middleware/deserializeUser';
import { Source, CompanyName } from '../utils/status.enum';

import logger from '../utils/logger';
import { http } from 'winston';
import { uploadFile } from '../middleware/uploadwithAWS';
import ExcelJS from 'exceljs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { NotificationService } from '../services/notification.service';
import { PaginationOptions } from '../utils/pagination';
import { DocumentbService } from '../services/documentb.service';
import { GrnRepository } from '../repositories/grn.repository';
import { UserRepository } from '../repositories/user.repository';
import { UserActivityLogService } from '../services/userActivityLog.service';
import { ActivityAction, ActivityModule } from '../entities/userActivityLog.entity';
import { ControllerLogger } from '../utils/controllerLogger';

@controller('/grns', deserializeUser, requireUser)
export class GrnController {
  private s3Client: S3Client;
  private bucketName: string;
  constructor(
    @inject(TYPES.GrnService) private readonly grnService: GrnService,
    @inject(TYPES.NotificationService)
    private notificationService: NotificationService,
    @inject(TYPES.DocumentbService)
    private readonly documentbService: DocumentbService,
    @inject(TYPES.GrnRepository) private readonly grnRepository: GrnRepository,
    @inject(TYPES.UserRepository) private readonly userRepository: UserRepository,
    @inject(TYPES.UserActivityLogService)
    private readonly activityLogService: UserActivityLogService,

  ) {
    this.s3Client = new S3Client({
      credentials: {
        accessKeyId: process.env.ACCESS_KEY!,
        secretAccessKey: process.env.ACCESS_SECRET!,
      },
      region: process.env.REGION!,
    });
    this.bucketName = process.env.BUCKET_NAME!;
  }

  /**
   * Helper method to log user activity
   */
  private async logUserActivity(
    req: Request,
    res: Response,
    action: ActivityAction,
    description: string,
    options?: {
      entityId?: string;
      metadata?: Record<string, any>;
      changes?: Record<string, { oldValue: any; newValue: any }>;
    }
  ): Promise<void> {
    try {
      const user = res.locals.user;
      await this.activityLogService.logActivity({
        userId: user.id,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        action,
        module: ActivityModule.GRN,
        entityName: 'GRN',
        entityId: options?.entityId,
        description,
        metadata: options?.metadata,
        changes: options?.changes,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        endpoint: req.originalUrl,
        httpMethod: req.method,
        statusCode: res.statusCode,
      });
    } catch (error) {
      logger.error('Failed to log activity:', error);
    }
  }

  //TODO: Create GRN
  @httpPost('/', uploadFile.single('billImage'))
  public async createGrn(
    @request() req: Request<{}, {}, any>,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      
      const grnData = req.body;
      console.log(grnData, 'grnData');

      if (req.file) {
        const imageUrl = (req.file as any).location;
        console.log('imageurl is ', imageUrl);
        if (imageUrl) {
          grnData.billImage = imageUrl;
        }
      }

      // Object.keys(req.body).forEach((key) => {
      //   if (grnData[key] === "null") grnData[key] = null;
      // });

      const requestedBy = res.locals.user.id;
      console.log("requested user: ", requestedBy);

      //const baseLocation = res.locals.user.relocationPlace;
      grnData.createdBy = requestedBy;
      grnData.requestedBy = requestedBy;
      // grnData.baseLocation = baseLocation;
      grnData.requestingDepartment = res.locals.user.selectDepartment;
      if (grnData === '')
        if (grnData.source === Source.VENDOR && !grnData.selectedParty) {
          
          return next(
            new AppError(
              400,
              'Vendor must be provided when the source is vendor',
            ),
          );
        } else if (grnData.source === Source.FARMER && !grnData.selectedParty) {
         
          return next(
            new AppError(
              400,
              'Farmer must be provided when the source is farmer',
            ),
          );
        }

      if (grnData.source === Source.VENDOR) {
        grnData.selectedVendor = { id: grnData.selectedParty };
        grnData.expectedHarvestDate = null;
      } else if (grnData.source === Source.FARMER) {
        grnData.selectedFarmer = { id: grnData.selectedParty };
      }

      //console.log("Final GRN Data:", grnData);

      const newGrn = await this.grnService.createGrn(grnData);
      if (!newGrn) {
        
        return next(new AppError(400, 'GRN could not be created'));
      }
      

      // 🔔 Send SSE notification to creator
      try {
        await this.notificationService.createNoti(
          `GRN ${newGrn.grnNo} created successfully and submitted for approval`,
          requestedBy
        );
       
      } catch (notifError) {
        
        // Don't fail the main operation if notification fails
      }

      // 🔔 Notify approvers if approval flow exists
      try {
        // Get the Document record for this GRN with approval flow
        const document = await this.documentbService.getDocumentByTypeId(newGrn.id);

        if (document && document.approvalFlow) {
          const flow = document.approvalFlow;
          const approvers: string[] = [];

          // Collect verifiers
          if (flow.verifiers && flow.verifiers.length > 0) {
            flow.verifiers.forEach((verifier: any) => {
              if (verifier.id) approvers.push(verifier.id);
            });
          }

          // Collect approvers from approval levels
          if (flow.approvers) {
            const levels = [
              flow.approvers.firstApprover,
              flow.approvers.secondApprover,
              flow.approvers.thirdApprover
            ];

            levels.forEach((level: any) => {
              if (level && level.users && level.users.length > 0) {
                level.users.forEach((user: any) => {
                  if (user.id) approvers.push(user.id);
                });
              }
            });
          }

          // Send notifications to all approvers
          for (const approverId of approvers) {
            await this.notificationService.createNoti(
              `New GRN ${newGrn.grnNo} requires your approval`,
              approverId
            );
            
          }
        }
      } catch (approverNotifError) {
       
        // Don't fail the main operation
      }

      // 📊 Log user activity
      try {
        const user = res.locals.user;
        await this.activityLogService.logActivity({
          userId: requestedBy,
          userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          action: ActivityAction.CREATE,
          module: ActivityModule.GRN,
          entityName: 'GRN',
          entityId: newGrn.id,
          description: `Created GRN ${newGrn.grnNo}`,
          metadata: {
            grnNo: newGrn.grnNo,
            totalAmt: newGrn.totalAmt,
            source: newGrn.source,
            purchaseLocation: newGrn.purchaseLocation,
          },
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.get('user-agent'),
          endpoint: req.originalUrl,
          httpMethod: req.method,
          statusCode: 201,
        });
       
      } catch (activityLogError) {
        
        // Don't fail the main operation
      }

      ControllerLogger.logSuccess('GRN created', newGrn.id, req, res);

      res.status(201).json({
        status: 'success',
        message: 'GRN created successfully',
        //data: newGrn,
      });
    } catch (error) {
      console.log(error);
      ControllerLogger.logError('GRN creation', error, req, res);
      next(error);
    }
  }

  //TODO: Get All Recycle Bin GRN
  @httpGet('/recycle-bin')
  public async getAllRecycleBinGrns(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
     
      const { page, limit, search, sort, rfpaId, companyName, source, grnType, locationType } = req.query;
      const userId = res.locals.user.id;
      console.log('userId is ', userId);
      // const userRole = res.locals.user.role;
      // if (userRole !== "SuperAdmin")
      //   return res.status(403).json({ message: "Access denied" });

      //TODO: Shri
      const filters: any = {};
      if (companyName) filters.companyName = companyName; // GRN field
      if (source) filters.source = source; // GRN field
      if (grnType) filters.grnType = grnType; // GRN field
      if (locationType) filters.locationType = locationType; // GRN field
      //if (status) filters.status = status; // Document field
      //if (remarks) filters.remarks = remarks;




      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        searchFields: ['grn.grnNo'],
        filters,
        sort: (sort as string) || undefined, // Adjust this line to match your sorting requirements
        search: (search as string) || '',
      };
      const grns = await this.grnService.getAllRecycleBinGrns(queryOptions, userId);
      //console.log(grns)
      if (!grns) {
        
        return next(new AppError(404, 'No GRNs found'));
      }
      
      ControllerLogger.logList('GRN Recycle Bin', req, res);

      res.status(200).json({
        status: 'success',
        data: grns.data,
        allRecords: grns.meta.total,
        totalPages: grns.meta.pages,
        page: grns.meta.page,
      });
    } catch (error) {
      console.log(error);
      ControllerLogger.logError('GRN recycle bin retrieval', error, req, res);
      next(error);
    }
  }
  //TODO: GRN get all
  @httpGet('/')
  public async getAllGrns(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {

      const { page, limit, search, sort, rfpaId, companyName, source, grnType, locationType } = req.query;
      const userId = res.locals.user.id;
      console.log('userId is ', userId);

      //TODO: Shri
      const filters: any = {};
      if (companyName) filters.companyName = companyName; // GRN field
      if (source) filters.source = source; // GRN field
      if (grnType) filters.grnType = grnType; // GRN field
      if (locationType) filters.locationType = locationType; // GRN field
      //if (status) filters.status = status; // Document field
      //if (remarks) filters.remarks = remarks;




      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        searchFields: ['grn.grnNo'],
        filters,
        sort: (sort as string) || undefined, // Adjust this line to match your sorting requirements
        search: (search as string) || '',
      };
      const grns = await this.grnService.getAllGrns(queryOptions, userId);
      //console.log(grns)
      if (!grns) {
        
        return next(new AppError(404, 'No GRNs found'));
      }
      
      
      // 📊 Log activity
      await this.logUserActivity(req, res, ActivityAction.VIEW,
        `Viewed all GRNs (${grns.data.length} items)`,
        { metadata: { count: grns.data.length, filters, page, limit } }
      );

      ControllerLogger.logList('GRN', req, res);

      res.status(200).json({
        status: 'success',
        data: grns.data,

        allRecords: grns.meta.total,
        totalPages: grns.meta.pages,
        page: grns.meta.page,
      });
    } catch (error) {
      console.log(error);
      ControllerLogger.logError('GRN list retrieval', error, req, res);
      next(error);
    }
  }


  //TODO: GRN get by id
  @httpGet('/:id')
  public async getGrnById(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      
      console.log(id);
      
      const grn = await this.grnService.getGrnById(id);
      //console.log(grn);
      if (!grn) {
        return next(new AppError(404, 'GRN not found'));
      }
      
      const accessedBy = res.locals.user.id;
      console.log('user is ', accessedBy);

      // 🔔 Send SSE notification when GRN is accessed
      try {
        const document = await this.documentbService.getDocumentByTypeId(grn.id);

        if (document && document.approvalFlow) {
          const flow = document.approvalFlow;
          let isApprover = false;

          // Check if accessor is a verifier
          if (flow.verifiers && flow.verifiers.length > 0) {
            isApprover = flow.verifiers.some((v: any) => v.id === accessedBy);
          }

          // Check if accessor is an approver
          if (!isApprover && flow.approvers) {
            const levels = [
              flow.approvers.firstApprover,
              flow.approvers.secondApprover,
              flow.approvers.thirdApprover
            ];

            for (const level of levels) {
              if (level && level.users && level.users.length > 0) {
                if (level.users.some((u: any) => u.id === accessedBy)) {
                  isApprover = true;
                  break;
                }
              }
            }
          }

          // If accessor is an approver, notify the creator
          if (isApprover && grn.createdBy?.id && grn.createdBy.id !== accessedBy) {
            const accessor = await this.userRepository.findOne({ where: { id: accessedBy } });
            const accessorName = accessor ? `${accessor.firstName} ${accessor.lastName}` : 'An approver';

            await this.notificationService.createNoti(
              `${accessorName} viewed GRN ${grn.grnNo}`,
              grn.createdBy.id
            );
            
          }
        }
      } catch (notifError) {
        
      }

      // 📊 Log activity
      await this.logUserActivity(req, res, ActivityAction.VIEW,
        `Viewed GRN ${grn.grnNo}`,
        { 
          entityId: grn.id,
          metadata: { grnNo: grn.grnNo, totalAmt: grn.totalAmt }
        }
      );

      ControllerLogger.logView('GRN', grn.id, req, res);

      res.status(200).json({
        status: 'success',
        data: grn,
      });
    } catch (error) {
      console.log(error);
      ControllerLogger.logError('GRN view', error, req, res);
      next(error);
    }
  }

  //TODO: GRN get by id for view
  @httpGet('/view/:docid')
  public async getGrnByIdForView(
    @requestParam('docid') docid: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      
      console.log("Shriiiiiiiiiii");

      console.log(docid);
      const grn = await this.grnService.getGrnByIdForView(docid);
      console.log("grn for view", grn);
      if (!grn) {
        return next(new AppError(404, 'GRN not found'));
      }
      
      const viewedBy = res.locals.user.id;
      console.log('user is ', viewedBy);

      // 🔔 Send SSE notification when GRN is viewed by approver
      try {
        const document = await this.documentbService.getDocumentByTypeId(grn.id);

        if (document && document.approvalFlow) {
          const flow = document.approvalFlow;
          let isApprover = false;

          // Check if viewer is a verifier
          if (flow.verifiers && flow.verifiers.length > 0) {
            isApprover = flow.verifiers.some((v: any) => v.id === viewedBy);
          }

          // Check if viewer is an approver
          if (!isApprover && flow.approvers) {
            const levels = [
              flow.approvers.firstApprover,
              flow.approvers.secondApprover,
              flow.approvers.thirdApprover
            ];

            for (const level of levels) {
              if (level && level.users && level.users.length > 0) {
                if (level.users.some((u: any) => u.id === viewedBy)) {
                  isApprover = true;
                  break;
                }
              }
            }
          }

          // If viewer is an approver, notify the creator
          if (isApprover && grn.createdBy?.id && grn.createdBy.id !== viewedBy) {
            const viewer = await this.userRepository.findOne({ where: { id: viewedBy } });
            const viewerName = viewer ? `${viewer.firstName} ${viewer.lastName}` : 'An approver';

            await this.notificationService.createNoti(
              `${viewerName} is reviewing GRN ${grn.grnNo}`,
              res.locals.user.id
            );
            
          }
        }
      } catch (notifError) {
        
      }

      ControllerLogger.logView('GRN', grn.id, req, res);

      res.status(200).json({
        status: 'success',
        data: grn,
      });
    } catch (error) {
      console.log(error);
      ControllerLogger.logError('GRN view', error, req, res);
      next(error);
    }
  }

  //TODO: GRN get by id for update
  @httpGet('/update/:id')
  public async getGrnByIdForupdate(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      
      console.log(id);
      const grn = await this.grnService.getGrnByIdForupdate(id);
      //console.log(grn);
      if (!grn) {
        return next(new AppError(404, 'GRN not found'));
      }
      console.log(grn)
  
      const requestedBy = res.locals.user.id;
      console.log('user is ', requestedBy);

      // 🔔 Send SSE notification when GRN is opened for editing
      try {
        const grnNo = grn.grnNo || id;

        // Notify creator if someone else is editing
        if (grn.createdBy?.id && grn.createdBy.id !== requestedBy) {
          const editor = await this.userRepository.findOne({ where: { id: requestedBy } });
          const editorName = editor ? `${editor.firstName} ${editor.lastName}` : 'Someone';

          await this.notificationService.createNoti(
            `${editorName} is editing GRN ${grnNo}`,
            grn.createdBy.id
          );
          
        }

        // Notify approvers that GRN is being edited
        const document = await this.documentbService.getDocumentByTypeId(grn.id);
        if (document && document.approvalFlow) {
          const flow = document.approvalFlow;
          const approvers: string[] = [];

          if (flow.verifiers && flow.verifiers.length > 0) {
            flow.verifiers.forEach((verifier: any) => {
              if (verifier.id && verifier.id !== requestedBy) approvers.push(verifier.id);
            });
          }

          if (flow.approvers) {
            const levels = [
              flow.approvers.firstApprover,
              flow.approvers.secondApprover,
              flow.approvers.thirdApprover
            ];

            levels.forEach((level: any) => {
              if (level && level.users && level.users.length > 0) {
                level.users.forEach((user: any) => {
                  if (user.id && user.id !== requestedBy) approvers.push(user.id);
                });
              }
            });
          }

          // Send notification to approvers
          for (const approverId of approvers) {
            await this.notificationService.createNoti(
              `GRN ${grnNo} is being edited and may require re-approval`,
              approverId
            );
          }
        }
      } catch (notifError) {
        
      }

      ControllerLogger.logView('GRN (for update)', grn.id, req, res);

      res.status(200).json({
        status: 'success',
        data: grn,
      });
    } catch (error) {
      console.log(error);
      ControllerLogger.logError('GRN retrieval for update', error, req, res);
      next(error);
    }
  }


  //TODO: Get all GRN numbers
  @httpGet('/grnnumbers/getAllgrnNo')
  public async getAllGrnNumbers(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const grns = await this.grnService.getAllGrnNumbers(); // Call the service method
      if (!grns || grns.length === 0) {
        return next(new AppError(404, 'No GRNs found'));
      }
     
      ControllerLogger.logList('GRN Numbers', req, res);

      res.status(200).json({
        status: 'success',
        data: grns, // Respond with the fetched GRN data
      });
    } catch (error) {
      ControllerLogger.logError('GRN numbers retrieval', error, req, res);
      next(error); // Pass any errors to the error-handling middleware
    }
  }

  //TODO: Update GRN by Image(Billing)
  @httpPut('/:id', uploadFile.single('billImage'), captureUser)
  public async updateGrn(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
     

      let grnData = req.body;

      // ✅ Handle multipart form-data JSON body
      if (req.body.grn) {
        grnData = JSON.parse(req.body.grn);
      }

      // ✅ Handle uploaded image
      if (req.file) {
        const imageUrl = (req.file as any).location;
        if (imageUrl) grnData.billImage = imageUrl;
      }

      // ✅ Clean 'null' strings
      Object.keys(grnData).forEach((key) => {
        if (grnData[key] === 'null') grnData[key] = null;
      });

      const updatedBy = res.locals.updatedBy;

      const updatedGrn = await this.grnService.updateGrn(id, grnData, updatedBy);

      if (!updatedGrn) {
        return next(new AppError(404, 'GRN not found or could not be updated'));
      }

      // 🔔 Send SSE notification to updater
      try {
        await this.notificationService.createNoti(
          `GRN ${updatedGrn.grnNo} updated successfully`,
          updatedBy
        );
        

        // 🔔 Notify approvers about the update
        const document = await this.documentbService.getDocumentByTypeId(updatedGrn.id);
        if (document && document.approvalFlow) {
          const flow = document.approvalFlow;
          const approvers: string[] = [];

          // Collect verifiers
          if (flow.verifiers && flow.verifiers.length > 0) {
            flow.verifiers.forEach((verifier: any) => {
              if (verifier.id) approvers.push(verifier.id);
            });
          }

          // Collect approvers from approval levels
          if (flow.approvers) {
            const levels = [
              flow.approvers.firstApprover,
              flow.approvers.secondApprover,
              flow.approvers.thirdApprover
            ];

            levels.forEach((level: any) => {
              if (level && level.users && level.users.length > 0) {
                level.users.forEach((user: any) => {
                  if (user.id && user.id !== updatedBy) approvers.push(user.id);
                });
              }
            });
          }

          // Send notifications to approvers
          for (const approverId of approvers) {
            await this.notificationService.createNoti(
              `GRN ${updatedGrn.grnNo} has been updated and requires re-approval`,
              approverId
            );
          }
        }
      } catch (notifError) {
       
      }

      ControllerLogger.logSuccess('GRN updated', updatedGrn.id, req, res);

      res.status(200).json({
        status: 'success',
        message: 'GRN updated successfully',
        data: updatedGrn,
      });
    } catch (error) {
      ControllerLogger.logError('GRN update', error, req, res);
      next(error);
    }
  }


  //TODO: GRN delete by id
  @httpDelete('/:id')
  public async deleteGrn(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const deletedBy = res.locals.user.id;

      // Get GRN details before deletion for notification
      const grn = await this.grnService.getGrnById(id);
      const grnNo = grn?.grnNo || id;

      const success = await this.grnService.deleteGrn(id);
      if (!success) {
        return next(new AppError(404, 'GRN not found or could not be deleted'));
      }

      // 🔔 Send SSE notification to deleter
      try {
        await this.notificationService.createNoti(
          `GRN ${grnNo} deleted successfully`,
          deletedBy
        );
        

        // 🔔 Notify relevant users about deletion
        if (grn) {
          // Notify creator if different from deleter
          if (grn.createdBy?.id && grn.createdBy.id !== deletedBy) {
            await this.notificationService.createNoti(
              `GRN ${grnNo} has been deleted`,
              grn.createdBy.id
            );
          }

          // Notify approvers about deletion
          const document = await this.documentbService.getDocumentByTypeId(id);
          if (document && document.approvalFlow) {
            const flow = document.approvalFlow;
            const notifyUsers: string[] = [];

            if (flow.verifiers && flow.verifiers.length > 0) {
              flow.verifiers.forEach((verifier: any) => {
                if (verifier.id && verifier.id !== deletedBy) notifyUsers.push(verifier.id);
              });
            }

            if (flow.approvers) {
              const levels = [
                flow.approvers.firstApprover,
                flow.approvers.secondApprover,
                flow.approvers.thirdApprover
              ];

              levels.forEach((level: any) => {
                if (level && level.users && level.users.length > 0) {
                  level.users.forEach((user: any) => {
                    if (user.id && user.id !== deletedBy) notifyUsers.push(user.id);
                  });
                }
              });
            }

            for (const userId of notifyUsers) {
              await this.notificationService.createNoti(
                `GRN ${grnNo} has been deleted`,
                userId
              );
            }
          }
        }
      } catch (notifError) {
        
      }

      ControllerLogger.logSuccess('GRN deleted', id, req, res);

      res.status(200).json({
        status: 'success',
        message: 'Grn deleted successfully',
      });
    } catch (error) {
      ControllerLogger.logError('GRN deletion', error, req, res);
      next(error);
    }
  }

  //TODO: Fetch GRN details by id
  @httpGet('/details/:id')
  public async getGrnDetails(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      
      const grnDetails = await this.grnService.getGrnDetails(id);
      if (!grnDetails) {
        return next(new AppError(404, 'GRN details not found'));
      }
      
      ControllerLogger.logView('GRN Details', id, req, res);

      res.status(200).json({
        status: 'success',
        data: grnDetails,
      });
    } catch (error) {
      ControllerLogger.logError('GRN details retrieval', error, req, res);
      next(error);
    }
  }

  //approve grn
  // @httpPost('/request/:grnId')
  // async requestApproval(@requestParam('grnId') grnId: string,
  // @response() res: Response,
  // ) {
  //   try {
  //     const requestedBy = res.locals.user.id;
  //     const approval = await this.grnService.requestApproval(grnId,requestedBy);
  //     res.status(201).json(approval);
  //   } catch (err) {
  //     res.status(400).json({ err });
  //   }
  // }

  // @httpGet('/getall/get-pending-approvals')
  // async getPendingApprovals(
  //   @response() res: Response,
  //   @next() next: NextFunction
  // ) {
  //   try {
  //     const userId = res.locals.user.id;
  //     const pendingApprovals = await this.grnService.getPendingGrns(userId);
  //     res.status(200).json({
  //       status: "success",
  //       data: pendingApprovals,
  //     });
  //   } catch (error) {
  //     logger.error("Error fetching pending approvals:", error);
  //     next(error);
  //   }
  // }

  //TODO: Get all pending approvals
  // @httpGet('/getAll')
  // async getAllPendingApprovals(
  //   @response() res: Response,
  //   @next() next: NextFunction
  // ) {
  //   try {
  //     const userId = res.locals.user.id;
  //     const result = await this.grnService.getAllPendingApprovals();
  //   } catch (error) {
  //      logger.error("Error fetching pending approvals:", error);
  //      next(error);
  //   }
  // }


  @httpGet('/grn/hold')
  public async getAllHoldGrns(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const grns = await this.documentbService.getAllHoldGrnDocuments();
      ControllerLogger.logList('Hold GRNs', req, res);
      res.status(200).json({ status: 'success', data: grns });
    } catch (error) {
      ControllerLogger.logError('Hold GRNs retrieval', error, req, res);
      next(error);
    }
  }

  //TODO: Get all grn
  @httpGet("/getall/grns")
  async getAllGrn(@request() req: Request, @response() res: Response, @next() next: NextFunction) {
    try {
      const resutl = await this.grnRepository.find();
      ControllerLogger.logList('All GRNs', req, res);
      res.status(200).json({ status: 'success', data: resutl });
    } catch (error) {
      ControllerLogger.logError('All GRNs retrieval', error, req, res);
      next(error);
    }
  }
  @httpDelete('/delete/multiple')
  public async deleteMultipleGrns(
    @request() req: Request<{}, {}, { ids: string[] }>,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
      
        return next(new AppError(400, 'An array of GRN IDs is required'));
      }

      const deletedBy = res.locals.user.id;

      // Get GRN details before deletion for notifications
      const grns = await Promise.all(
        ids.map(id => this.grnService.getGrnById(id).catch(() => null))
      );

      const result = await this.grnService.deleteMultipleGrns(ids);

      // 🔔 Send SSE notification to deleter
      try {
        await this.notificationService.createNoti(
          `${ids.length} GRNs deleted successfully`,
          deletedBy
        );
       

        // 🔔 Notify relevant users about bulk deletion
        const notifiedUsers = new Set<string>();

        for (const grn of grns) {
          if (!grn) continue;

          const grnNo = grn.grnNo || 'Unknown';

          // Notify creator
          if (grn.createdBy?.id && grn.createdBy.id !== deletedBy && !notifiedUsers.has(grn.createdBy.id)) {
            await this.notificationService.createNoti(
              `Multiple GRNs including ${grnNo} have been deleted`,
              grn.createdBy.id
            );
            notifiedUsers.add(grn.createdBy.id);
          }

          // Notify approvers
          const document = await this.documentbService.getDocumentByTypeId(grn.id);
          if (document && document.approvalFlow) {
            const flow = document.approvalFlow;

            if (flow.verifiers && flow.verifiers.length > 0) {
              flow.verifiers.forEach((verifier: any) => {
                if (verifier.id && verifier.id !== deletedBy) notifiedUsers.add(verifier.id);
              });
            }

            if (flow.approvers) {
              const levels = [
                flow.approvers.firstApprover,
                flow.approvers.secondApprover,
                flow.approvers.thirdApprover
              ];

              levels.forEach((level: any) => {
                if (level && level.users && level.users.length > 0) {
                  level.users.forEach((user: any) => {
                    if (user.id && user.id !== deletedBy) notifiedUsers.add(user.id);
                  });
                }
              });
            }
          }
        }

        // Send bulk notification to all affected users
        for (const userId of notifiedUsers) {
          await this.notificationService.createNoti(
            `${ids.length} GRNs have been deleted`,
            userId
          );
        }
      } catch (notifError) {
       
      }

      ControllerLogger.logSuccess(`${ids.length} GRNs deleted`, ids.join(', '), req, res);

      res.status(200).json({
        message: result.message,
      });
    } catch (error) {
      ControllerLogger.logError('Multiple GRNs deletion', error, req, res);
      next(error);
    }
  }

}
