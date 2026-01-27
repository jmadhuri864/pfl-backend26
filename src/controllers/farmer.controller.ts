import { inject } from 'inversify';
import {
  controller,
  httpPost,
  httpGet,
  httpPatch,
  httpDelete,
  request,
  requestParam,
  response,
  next,
  httpPut,
} from 'inversify-express-utils';
import { TYPES } from '../types';
import { NextFunction, Request, Response } from 'express';
import AppError from '../utils/appError';
import { FarmerService } from '../services/farmer.service';
import {
  captureUser,
  deserializeUser,
  requireUser,
} from '../middleware/deserializeUser';
import { uploads } from '../middleware/muterConfigCSV';
import { NotificationService } from '../services/notification.service';
import { PaginationOptions } from '../utils/pagination';
import { uploadFileMultiple } from '../middleware/multiFileWithAWS';
import { PdfGeneratorService } from '../utils/pdfGenerator';
import { Status } from '../utils/status.enum';
import { ControllerLogger } from '../utils/controllerLogger';

@controller('/farmers',deserializeUser, requireUser)
export class FarmerController {
  constructor(
    @inject(TYPES.FarmerService)
    private farmerService: FarmerService,
    @inject(TYPES.PdfGeneratorService)
    private readonly pdfGeneratorService: PdfGeneratorService,
    @inject(TYPES.NotificationService)
    private notificationService: NotificationService,
  ) {}

  @httpPost(
    '/',
    uploadFileMultiple.fields([
      { name: 'farmPhoto', maxCount: 1 },
      { name: 'farmerPhoto', maxCount: 1 },
      { name: 'idProofCopy', maxCount: 1 },
      { name: 'sevenTwelveCopy', maxCount: 1 },
    ]),
  )
  public async createFarmer(
    @request() req: Request<{}, {}, any>,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const farmerData = req.body;
      farmerData.createdBy = res.locals.user.id;
      
      if (req.files) {
        const files = req.files as {
          [fieldname: string]: Express.MulterS3.File[];
        };

        farmerData.farmPhoto = files.farmPhoto
          ? files.farmPhoto[0].location
          : null;
        farmerData.farmerPhoto = files.farmerPhoto
          ? files.farmerPhoto[0].location
          : null;
        farmerData.idProofCopy = files.idProofCopy
          ? files.idProofCopy[0].location
          : null;
        farmerData.sevenTwelveCopy = files.sevenTwelveCopy
          ? files.sevenTwelveCopy[0].location
          : null;
      }

      const farmer = await this.farmerService.createFarmer(farmerData);
      
      if (!farmer) {
        ControllerLogger.logOperationFailed('Create', 'Farmer', 'Creation failed', req, res);
        return next(new AppError(400, 'Farmer could not be created'));
      }
      
      await this.notificationService.createNoti(
        `New farmer created: ${farmer.farmerfName} ${farmer.farmermName} ${farmer.farmerlName}`,
        res.locals.user.id,
      );
      
      ControllerLogger.logSuccess('Farmer created', farmer.id, req, res);
      res.status(201).json({
        status: 'success',
        message: 'Farmer created successfully',
        data: farmer.id,
      });
    } catch (err) {
      ControllerLogger.logError('Create Farmer', err, req, res);
      next(err);
    }
  }

  @httpPatch("/approve/:id")
  async approveFarmer(
    @requestParam('id') farmerId: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const adminUser = res.locals.user.id;
      const status = req.query.status as Status;

      const approvedFarmer = await this.farmerService.approveFarmer(farmerId, adminUser, status);
      
      // 🔔 Send notification for farmer approval
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Farmer approved with status: ${status}`,
            userId
          );
        }
      } catch (notifError) {
        console.log('Farmer approval notification error:', notifError);
      }
      
      ControllerLogger.logSuccess('Farmer approved', farmerId, req, res);
      return res.status(200).json({ message: "Farmer approved successfully", farmer: approvedFarmer });
    } catch (error: any) {
      ControllerLogger.logError('Approve Farmer', error, req, res);
      next(error);
    }
  }

  @httpGet('/:id')
  public async getFarmerById(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const farmer = await this.farmerService.getFarmerById(id);
      
      if (!farmer) {
        ControllerLogger.logNotFound('Farmer', id, req, res);
        return next(new AppError(404, 'Farmer not found'));
      }
      
      await this.notificationService.createNoti(
        `Farmer details retrieved successfully ${farmer.farmerfName} ${farmer.farmermName} ${farmer.farmerlName}`,
        res.locals.user.id,
      );
      
      ControllerLogger.logView('Farmer', id, req, res);
      res.status(200).json({
        status: 'success',
        data: farmer,
      });
    } catch (err) {
      ControllerLogger.logError('Get Farmer by ID', err, req, res);
      next(err);
    }
  }

  @httpGet('/view/:id')
  public async getFarmerByIdforview(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const farmer = await this.farmerService.getfarmerbyidforview(id);
      
      if (!farmer) {
        ControllerLogger.logNotFound('Farmer', id, req, res);
        return next(new AppError(404, 'Farmer not found'));
      }
      
      await this.notificationService.createNoti(
        `Farmer details retrieved successfully ${farmer.farmerfName} ${farmer.farmermName} ${farmer.farmerlName}`,
        res.locals.user.id,
      );
      
      ControllerLogger.logView('Farmer', id, req, res);
      res.status(200).json({
        status: 'success',
        data: farmer,
      });
    } catch (err) {
      ControllerLogger.logError('Get Farmer for view', err, req, res);
      next(err);
    }
  }

  @httpGet('/update/:id')
  public async getFarmerByIdforupdate(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const farmer = await this.farmerService.getfarmerbyidforupdate(id);
      
      if (!farmer) {
        ControllerLogger.logNotFound('Farmer', id, req, res);
        return next(new AppError(404, 'Farmer not found'));
      }
      
      await this.notificationService.createNoti(
        `Farmer details retrieved successfully ${farmer.farmerfName} ${farmer.farmermName} ${farmer.farmerlName}`,
        res.locals.user.id,
      );
      
      ControllerLogger.logView('Farmer (for update)', id, req, res);
      res.status(200).json({
        status: 'success',
        data: farmer,
      });
    } catch (err) {
      ControllerLogger.logError('Get Farmer for update', err, req, res);
      next(err);
    }
  }

  @httpPost('/upload-farmer', uploads.single('file'))
  public async uploadFarmerExcel(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.file) {
        ControllerLogger.logValidationError('Upload Farmer Excel', 'No file uploaded', req, res);
        return next(new AppError(400, 'No file uploaded'));
      }

      await this.farmerService.createFarmerwithExcel(req.file.path);

      ControllerLogger.logSuccess('Farmer Excel uploaded', 'bulk', req, res);
      res.status(200).json({ message: 'File processed successfully' });
    } catch (error) {
      ControllerLogger.logError('Upload Farmer Excel', error, req, res);
      next(error);
    }
  }

  @httpGet('/getFarmer/all/:id')
  public async getFarmerByIdForUpdate(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const farmer = await this.farmerService.getFarmerByIdForUpdate(id);
      
      if (!farmer) {
        ControllerLogger.logNotFound('Farmer', id, req, res);
        return next(new AppError(404, 'Farmer not found'));
      }

      ControllerLogger.logView('Farmer (for update)', id, req, res);
      res.status(200).json({
        status: 'success',
        data: farmer,
      });
    } catch (err) {
      ControllerLogger.logError('Get Farmer by ID for update', err, req, res);
      next(err);
    }
  }

  @httpGet('/')
  public async getAllFarmers(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const { page, limit, search, sort } = req.query;

      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        filters: {},
        sort: (sort as string) || undefined,
        search: (search as string) || '',
      };
      
      const farmers = await this.farmerService.getAllFarmers(queryOptions);

      if (!farmers) {
        ControllerLogger.logOperationFailed('Get All', 'Farmers', 'No records found', req, res);
        return next(new AppError(404, 'No farmers found'));
      }
      
      // 🔔 Send notification for get all farmers
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Retrieved ${farmers.meta.total} farmers`,
            userId
          );
        }
      } catch (notifError) {
        console.log('Get all farmers notification error:', notifError);
      }
      
      ControllerLogger.logGetAllRecords('Farmers', req, res);
      res.status(200).json({
        status: 'success',
        data: farmers.data,
        allRecords: farmers.meta.total,
        totalPages: farmers.meta.pages,
        page: farmers.meta.page,
      });
    } catch (err) {
      ControllerLogger.logError('Get All Farmers', err, req, res);
      next(err);
    }
  }

  @httpGet('/filterFarmer/all')
  public async getAllFarmer(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const { page, limit, search, sort } = req.query;
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        filters: {},
        sort: (sort as string) || undefined,
        search: (search as string) || '',
      };
      
      const farmers = await this.farmerService.getAllFarmer(queryOptions);
      
      if (!farmers) {
        ControllerLogger.logOperationFailed('Get All', 'Farmers (filtered)', 'No records found', req, res);
        return next(new AppError(404, 'No farmers found'));
      }
      
      ControllerLogger.logList('Farmers (filtered)', req, res);
      res.status(200).json({
        status: 'success',
        data: farmers.data1,
        allRecords: farmers.meta.total,
        totalPages: farmers.meta.pages,
        page: farmers.meta.page,
      });
    } catch (err) {
      ControllerLogger.logError('Get All Farmers (filtered)', err, req, res);
      next(err);
    }
  }

  @httpGet('/filterFarmer/:id')
  public async getPartialFarmer(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const farmers = await this.farmerService.getPartialFarmersById(id);
      
      if (!farmers) {
        ControllerLogger.logNotFound('Partial Farmer', id, req, res);
        return next(new AppError(404, 'No farmers found'));
      }
      
      ControllerLogger.logView('Partial Farmer', id, req, res);
      res.status(200).json({
        status: 'success',
        data: farmers,
      });
    } catch (err) {
      ControllerLogger.logError('Get Partial Farmer', err, req, res);
      next(err);
    }
  }

  @httpGet('/getfarmerCode/getnos')
  public async getAllFarmersCode(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const farmers = await this.farmerService.getAllFarmerCodes();
      
      if (!farmers) {
        ControllerLogger.logOperationFailed('Get All', 'Farmer Codes', 'No records found', req, res);
        return next(new AppError(404, 'No farmers found'));
      }
      
      ControllerLogger.logList('Farmer Codes', req, res);
      res.status(200).json({
        status: 'success',
        data: farmers,
      });
    } catch (err) {
      ControllerLogger.logError('Get All Farmer Codes', err, req, res);
      next(err);
    }
  }

  @httpPut(
    '/:id',
    captureUser,
    uploadFileMultiple.fields([
      { name: 'farmPhoto', maxCount: 1 },
      { name: 'farmerPhoto', maxCount: 1 },
      { name: 'idProofCopy', maxCount: 1 },
      { name: 'sevenTwelveCopy', maxCount: 1 },
    ]),
  )
  public async updateFarmer(
    @requestParam('id') id: string,
    @request() req: Request<{}, {}, any>,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const farmerData = req.body;

      const fileFields = [
        'farmPhoto',
        'farmerPhoto',
        'idProofCopy',
        'sevenTwelveCopy',
      ];

      for (const field of fileFields) {
        const uploadedFile = (
          req.files as { [key: string]: Express.MulterS3.File[] }
        )?.[field]?.[0];
        const bodyValue = farmerData[field];

        if (uploadedFile && uploadedFile.location) {
          farmerData[field] = uploadedFile.location;
        } else if (typeof bodyValue === 'string') {
          if (bodyValue.trim() === '') {
            farmerData[field] = null;
          } else {
            farmerData[field] = undefined;
          }
        } else {
          farmerData[field] = undefined;
        }
      }

      const requestedBy = res.locals.user.id;
      const updatedBy = res.locals.updatedBy.id;
      const farmer = await this.farmerService.updateFarmer(
        id,
        farmerData,
        updatedBy,
        requestedBy,
      );
      
      if (!farmer) {
        ControllerLogger.logNotFound('Farmer', id, req, res);
        return next(
          new AppError(404, 'Farmer not found or could not be updated'),
        );
      }
      
      await this.notificationService.createNoti(
        `Farmer details updated for: ${farmer.farmerfName} ${farmer.farmermName} ${farmer.farmerlName}`,
        res.locals.user.id,
      );
      
      ControllerLogger.logSuccess('Farmer updated', id, req, res);
      res.status(200).json({
        status: 'success',
        message: 'Farmer updated successfully',
        data: farmer,
      });
    } catch (err) {
      ControllerLogger.logError('Update Farmer', err, req, res);
      next(err);
    }
  }

  @httpDelete('/:id')
  public async deleteFarmer(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const result = await this.farmerService.deleteFarmer(id);
      
      if (!result) {
        ControllerLogger.logNotFound('Farmer', id, req, res);
        return next(
          new AppError(404, 'Farmer not found or could not be deleted'),
        );
      }

      // 🔔 Send notification for farmer deletion
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Farmer with ID ${id} deleted successfully`,
            userId
          );
        }
      } catch (notifError) {
        console.log('Farmer deletion notification error:', notifError);
      }

      ControllerLogger.logSuccess('Farmer deleted', id, req, res);
      res.status(200).json({
        status: 'success',
        message: 'Farmer deleted successfully',
      });
    } catch (err) {
      ControllerLogger.logError('Delete Farmer', err, req, res);
      next(err);
    }
  }

  @httpGet('/forRfpa/:farmerId')
  public async getFarmerDetails(
    @requestParam('farmerId') farmerId: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<void> {
    try {
      const farmer = await this.farmerService.getFarmerDetails(farmerId);

      if (!farmer) {
        ControllerLogger.logNotFound('Farmer', farmerId, req, res);
        return next(new AppError(404, 'Farmer not found'));
      }

      ControllerLogger.logView('Farmer Details', farmerId, req, res);
      res.status(200).json({
        status: 'success',
        data: farmer,
      });
    } catch (error) {
      ControllerLogger.logError('Get Farmer Details', error, req, res);
      next(error);
    }
  }

  @httpGet('/bySearch/farmer')
  public async getFarmerbyid(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<void> {
    try {
      const farmerId = req.query.search as string;
      const farmer = await this.farmerService.getFarmerDetails(farmerId);

      if (!farmer) {
        ControllerLogger.logNotFound('Farmer', farmerId, req, res);
        return next(new AppError(404, 'Farmer not found'));
      }

      ControllerLogger.logView('Farmer by Search', farmerId, req, res);
      res.status(200).json({
        status: 'success',
        data: farmer,
      });
    } catch (error) {
      ControllerLogger.logError('Get Farmer by Search', error, req, res);
      next(error);
    }
  }

  @httpPost('/upload', uploads.single('file'))
  public async uploadFarmersData(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<void> {
    try {
      const filePath = req.file?.path;
      
      if (!filePath) {
        ControllerLogger.logValidationError('Upload Farmers Data', 'File not found', req, res);
        return next(new AppError(404, 'File not found'));
      }

      await this.farmerService.processCsv(filePath);

      ControllerLogger.logSuccess('Farmers Data uploaded', 'bulk', req, res);
      res.status(200).json({
        status: 'success',
        message: 'Farmer data uploaded successfully',
      });
    } catch (error) {
      ControllerLogger.logError('Upload Farmers Data', error, req, res);
      next(error); 
    }
  }

  @httpGet('/filterFarmer/search/withfilter')
  public async getAllFarmersWithQuery(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const filter = req.query.search as string;
      const farmers = await this.farmerService.getAllFarmerWithFilter(filter);
      
      if (!farmers) {
        ControllerLogger.logOperationFailed('Get All', 'Farmers (with filter)', 'No records found', req, res);
        return next(new AppError(404, 'No farmers found'));
      }
      
      ControllerLogger.logList('Farmers (with filter)', req, res);
      res.status(200).json({
        status: 'success',
        data: farmers,
      });
    } catch (err) {
      ControllerLogger.logError('Get All Farmers with Filter', err, req, res);
      next(err);
    }
  }

  @httpGet('/download/template')
  public async downloadExcelTemplate(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const key = 'formats/FarmerDetailsTemplate.xlsx';
      const fileBuffer = await this.pdfGeneratorService.getExcelFromS3(key);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${key.split('/').pop()}"`,
      );
      
      ControllerLogger.logList('Farmer Template Downloaded', req, res);
      res.send(fileBuffer);
    } catch (error) {
      ControllerLogger.logError('Download Farmer Template', error, req, res);
      next(error);
    }
  }

  @httpGet('/multifilter')
  public async getFilteredFarmers(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const { page, limit, search, sort, ...filters } = req.query;
      
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
        search: (search as string) || '',
        sort: (sort as string) || 'farmer.createdAt:DESC',
        filters: { ...filters },
      };

      const result = await this.farmerService.getFarmersWithFilters(queryOptions);

      if (!result || result.data.length === 0) {
        ControllerLogger.logOperationFailed('Get', 'Farmers (multi-filter)', 'No records found', req, res);
        return res.status(404).json({
          status: 'fail',
          message: 'No farmers found for the provided filters',
        });
      }

      ControllerLogger.logList('Farmers (multi-filter)', req, res);
      res.status(200).json({
        status: 'success',
        total: result.total,
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        data: result.data,
      });
    } catch (err) {
      ControllerLogger.logError('Get Filtered Farmers', err, req, res);
      next(err);
    }
  }
}
