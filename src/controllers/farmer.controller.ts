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
import { upload } from '../middleware/multifileupload';
import {
  captureUser,
  deserializeUser,
  requireUser,
} from '../middleware/deserializeUser';
import { uploads } from '../middleware/muterConfigCSV';
import { uploadNone } from '../middleware/multerConfig';
import logger from '../utils/logger';
import { NotificationService } from '../services/notification.service';
import { PaginationOptions } from '../utils/pagination';
import { CreateFarmerInput } from '../schemas/farmer.schema';
import { uploadFileMultiple } from '../middleware/multiFileWithAWS';
import { PdfGeneratorService } from '../utils/pdfGenerator';
import { Column } from 'typeorm';
import { Status } from '../utils/status.enum';

@controller('/farmers',deserializeUser, requireUser)
export class FarmerController {
  constructor(
    @inject(TYPES.FarmerService)
    private farmerService: FarmerService,
    @inject(TYPES.PdfGeneratorService)
    private readonly pdfGeneratorService: PdfGeneratorService,
    @inject(TYPES.NotificationService)
    private notificationService: NotificationService, // Inject NotificationService
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
    @request() req: Request<{}, {}, any>, //Request<{}, {}, CreateFarmerInput>, // Adjust the type to `any` for the request body
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Attempting to create a new farmer', {
        requestedBy: res.locals.user.id,
      });
      const farmerData = req.body;
      farmerData.createdBy = res.locals.user.id;
      console.log(farmerData);
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

      logger.debug('Farmer data prepared for creation', farmerData);
      const farmer = await this.farmerService.createFarmer(farmerData);
      console.log(farmer);
      if (!farmer) {
        logger.error('Failed to create farmer', { farmerData });
        return next(new AppError(400, 'Farmer could not be created'));
      }
      logger.info('Farmer created successfully', { farmerId: farmer.id });
      // Trigger a notification
      await this.notificationService.createNoti(
        `New farmer created: ${farmer.farmerfName} ${farmer.farmermName} ${farmer.farmerlName}`,
        res.locals.user.id,
      );
      res.status(201).json({
        status: 'success',
        message: 'Farmer created successfully',
        data: farmer.id,
      });
    } catch (err) {
      //console.log(err)
      logger.error('Error occurred while creating farmer', { error: err });
      next(err);
    }
  }
@httpPatch("/approve/:id")
async approveFarmer(req: Request, res: Response, next: NextFunction) {
try {
const farmerId = req.params.id;
const adminUser = res.locals.user.id
 const status = req.query.status as Status;

const approvedFarmer = await this.farmerService.approveFarmer(farmerId, adminUser,status);
return res.status(200).json({ message: "Farmer approved successfully", farmer: approvedFarmer });
} catch (error: any) {
  next(error);

}
}
  @httpGet('/:id')
  public async getFarmerById(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Fetching farmer details by ID', { farmerId: id });
      const farmer = await this.farmerService.getFarmerById(id);
      if (!farmer) {
        logger.warn('Farmer not found', { farmerId: id });
        return next(new AppError(404, 'Farmer not found'));
      }
      logger.info('Farmer details retrieved successfully', { farmer });
      // Trigger a notification
      await this.notificationService.createNoti(
        `Farmer details retrieved successfully ${farmer.farmerfName} ${farmer.farmermName} ${farmer.farmerlName}`,
        res.locals.user.id,
      );
      res.status(200).json({
        status: 'success',
        data: farmer,
      });
    } catch (err) {
      logger.error('Error occurred while fetching farmer details', {
        farmerId: id,
        error: err,
      });
      next(err);
    }
  }
   @httpGet('/view/:id')
  public async getFarmerByIdforview(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      console.log("in get farmer by id for view",id);  
      logger.info('Fetching farmer details by ID', { farmerId: id });
      const farmer = await this.farmerService.getfarmerbyidforview(id);
      if (!farmer) {
        logger.warn('Farmer not found', { farmerId: id });
        return next(new AppError(404, 'Farmer not found'));
      }
      logger.info('Farmer details retrieved successfully', { farmer });
      // Trigger a notification
      await this.notificationService.createNoti(
        `Farmer details retrieved successfully ${farmer.farmerfName} ${farmer.farmermName} ${farmer.farmerlName}`,
        res.locals.user.id,
      );
      res.status(200).json({
        status: 'success',
        data: farmer,
      });
    } catch (err) {
      logger.error('Error occurred while fetching farmer details', {
        farmerId: id,
        error: err,
      });
      next(err);
    }
  }

  @httpGet('/update/:id')
  public async getFarmerByIdforupdate(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      console.log("in get farmer by id for update",id);  
      logger.info('Fetching farmer details by ID', { farmerId: id });
      const farmer = await this.farmerService.getfarmerbyidforupdate(id);
      if (!farmer) {
        logger.warn('Farmer not found', { farmerId: id });
        return next(new AppError(404, 'Farmer not found'));
      }
      logger.info('Farmer details retrieved successfully', { farmer });
      // Trigger a notification
      await this.notificationService.createNoti(
        `Farmer details retrieved successfully ${farmer.farmerfName} ${farmer.farmermName} ${farmer.farmerlName}`,
        res.locals.user.id,
      );
      res.status(200).json({
        status: 'success',
        data: farmer,
      });
    } catch (err) {
      logger.error('Error occurred while fetching farmer details', {
        farmerId: id,
        error: err,
      });
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
      console.log('in upload farmer excel');

      if (!req.file) {
        return next(new AppError(400, 'No file uploaded'));
      }

      const result = await this.farmerService.createFarmerwithExcel(
        req.file.path,
      );

      res.status(200).json({ message: 'File processed successfully' });
    } catch (error) {
      console.error('Error in uploadFarmerExcel:', error);
      next(error);
    }
  }
  @httpGet('/getFarmer/all/:id')
  public async getFarmerByIdForUpdate(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Fetching farmer details by ID', { farmerId: id });
      const farmer = await this.farmerService.getFarmerByIdForUpdate(id);
      if (!farmer) {
        logger.warn('Farmer not found', { farmerId: id });
        return next(new AppError(404, 'Farmer not found'));
      }
      logger.info('Farmer details retrieved successfully', { farmer });

      res.status(200).json({
        status: 'success',
        data: farmer,
      });
    } catch (err) {
      logger.error('Error occurred while fetching farmer details', {
        farmerId: id,
        error: err,
      });
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
      //const {  page, limit } = req.query;
      //  const { search, page, limit, sort, } = req.query;
      // const queryOptions = {
      //   searchFields: ['farmerfName',  'farmermName','farmerlName'],
      //   filters: {},
      //   sort: typeof sort === 'string' ? sort : '',
      //   page: Number(page) || 1,
      //   limit: Number(limit) || 10,
      //   search: typeof search === 'string' ?search:'',
      // };
      const { page, limit, search, sort, farmerfName } = req.query;

      console.log(sort);
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        //searchFields: ['farmer.farmerfName', 'farmer.farmermName', 'farmer.farmerlName'],
        filters: {},
        sort: (sort as string) || undefined, // Adjust this line to match your sorting requirements
        search: (search as string) || '',
      };
      // const queryOptions = {
      //      page: Number(page) || 1,
      //  limit: Number(limit) || 10,
      // }
      //console.log(queryOptions)
      logger.info('Fetching all farmers');
      const farmers = await this.farmerService.getAllFarmers(queryOptions);
      // console.log("farmers is ",farmers)

      if (!farmers) {
        logger.error('No farmers found');
        return next(new AppError(404, 'No farmers found'));
      }
      logger.info('Farmers retrieved successfully');
      res.status(200).json({
        status: 'success',
        data: farmers.data,
        allRecords: farmers.meta.total,
        totalPages: farmers.meta.pages,
        page: farmers.meta.page,
      });
    } catch (err) {
      console.log(err);
      logger.error('Error occurred while fetching all farmers', { error: err });
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
      logger.info('Fetching all farmers');
      const { page, limit, search, sort } = req.query;
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        //searchFields: ['farmer.farmerfName', 'farmer.farmermName', 'farmer.farmerlName'],
        filters: {},
        sort: (sort as string) || undefined, // Adjust this line to match your sorting requirements
        search: (search as string) || '',
      };
      const farmers = await this.farmerService.getAllFarmer(queryOptions);
      //console.log(farmers)
      if (!farmers) {
        logger.error('No farmers found');
        return next(new AppError(404, 'No farmers found'));
      }
      logger.info('Farmers retrieved successfully');
      res.status(200).json({
        status: 'success',
        data: farmers.data1,
        allRecords: farmers.meta.total,
        totalPages: farmers.meta.pages,
        page: farmers.meta.page,
      });
    } catch (err) {
      logger.error('Error occurred while fetching all farmers', { error: err });
      next(err);
    }
  }
  @httpGet('/filterFarmer/:id')
  public async getPartialFarmer(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Fetching all farmers');
      const farmers = await this.farmerService.getPartialFarmersById(id);
      //console.log(farmers)
      if (!farmers) {
        logger.error('No farmers found');
        return next(new AppError(404, 'No farmers found'));
      }
      logger.info('Farmers retrieved successfully');
      res.status(200).json({
        status: 'success',
        data: farmers,
      });
    } catch (err) {
      logger.error('Error occurred while fetching all farmers', { error: err });
      next(err);
    }
  }

  @httpGet('/getfarmerCode/getnos')
  public async getAllFarmersCode(
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Fetching all farmers and thier former code');
      const farmers = await this.farmerService.getAllFarmerCodes();
      if (!farmers) {
        logger.warn('No farmers found');
        return next(new AppError(404, 'No farmers found'));
      }
      logger.info('Farmers and Farmer Code retrieved successfully');
      res.status(200).json({
        status: 'success',
        data: farmers,
      });
    } catch (err) {
      logger.error('Error occurred while fetching all farmers', { error: err });
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
    @request() req: Request<{}, {}, any>, // Adjust the type to `any` for the request body
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Updating farmer details', { farmerId: id });
      console.log('farmer details', req.body),
        console.log('files are ', req.files);
      console.log('id is ', id);
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
          // ✅ Case 1: New file uploaded
          farmerData[field] = uploadedFile.location;
        } else if (typeof bodyValue === 'string') {
          if (bodyValue.trim() === '') {
            // ✅ Case 2: Explicit clear
            farmerData[field] = null;
          } else {
            // ✅ Case 3: Frontend sent existing URL → don't overwrite
            farmerData[field] = undefined;
          }
        } else {
          // ✅ Case 4: Nothing sent → leave unchanged
          farmerData[field] = undefined;
        }
      }

      //       if(req.files)
      //       {
      //         const files = req.files as { [fieldname: string]: Express.MulterS3.File[] };

      //         if (files.farmPhoto ) {
      //   farmerData.farmPhoto = files.farmPhoto[0].location;
      // }

      // if (files.farmerPhoto ) {
      //   farmerData.farmerPhoto = files.farmerPhoto[0].location;
      // }

      // if (files.idProofCopy ) {
      //   farmerData.idProofCopy = files.idProofCopy[0].location;
      // }

      // if (files.sevenTwelveCopy ) {
      //   farmerData.sevenTwelveCopy = files.sevenTwelveCopy[0].location;
      // }

      //       }
      //       if(farmerData.farmPhoto || farmerData.farmerPhoto || farmerData.idProofCopy || farmerData.sevenTwelveCopy) {
      //         farmerData.farmPhoto  = 'undefined';
      //         farmerData.farmerPhoto  = 'undefined';
      //         farmerData.idProofCopy  = 'undefined';
      //         farmerData.sevenTwelveCopy  = 'undefined';
      //       }
      //const updateData = UpdateFarmerSchema.parse(req.body);
      const requestedBy = res.locals.user.id;
      const updatedBy = res.locals.updatedBy.id;
      const farmer = await this.farmerService.updateFarmer(
        id,
        farmerData,
        updatedBy,
        requestedBy,
      );
      if (!farmer) {
        logger.warn('Farmer not found or could not be updated', {
          farmerId: id,
        });
        return next(
          new AppError(404, 'Farmer not found or could not be updated'),
        );
      }
      logger.info('Farmer updated successfully', { farmer });
      await this.notificationService.createNoti(
        `Farmer details updated for: ${farmer.farmerfName} ${farmer.farmermName} ${farmer.farmerlName}`,
        res.locals.user.id,
      );
      res.status(200).json({
        status: 'success',
        message: 'Farmer updated successfully',
        data: farmer,
      });
    } catch (err) {
      logger.error('Error occurred while updating farmer', {
        farmerId: id,
        error: err,
      });
      next(err);
    }
  }

  @httpDelete('/:id')
  public async deleteFarmer(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const result = await this.farmerService.deleteFarmer(id);
      if (!result) {
        return next(
          new AppError(404, 'Farmer not found or could not be deleted'),
        );
      }

      //res.status(204).send(); // No content
      res.status(200).json({
        status: 'success',
        message: 'Farmer deleted successfully',
        //data: farmer,
      });
    } catch (err) {
      logger.error('Error occurred while deleting farmer', { error: err });
      console.log(err);
      next(err);
    }
  }

  // Endpoint to get farmer details by ID
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
        return next(new AppError(404, 'Farmer not found'));
      }

      res.status(200).json({
        status: 'success',
        data: farmer,
      });
    } catch (error) {
      next(error);
    }
  }
  // Endpoint to get farmer details by ID
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
        return next(new AppError(404, 'Farmer not found'));
      }

      res.status(200).json({
        status: 'success',
        data: farmer,
      });
    } catch (error) {
      next(error);
    }
  }
  // Endpoint to upload farmers' data (CSV file)
  @httpPost('/upload', uploads.single('file')) // Use the multer middleware
  public async uploadFarmersData(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<void> {
    try {
      console.log('in upload', req.file?.path);
      const filePath = req.file?.path;
      if (!filePath) {
        return next(new AppError(404, 'File not found'));
      }
      console.log(filePath);

      await this.farmerService.processCsv(filePath);

      // Return success response
      res.status(200).json({
        status: 'success',
        message: 'Farmer data uploaded successfully',
      });
    } catch (error) {
      next(error); 
    }
  }
  @httpGet('/filterFarmer/search/withfilter')
  public async getAllFarmersWithQuery(
    @response() res: Response,
    @request() req: Request,
    @next() next: NextFunction,
  ) {
    try {
      console.log('in filter farmer');
      const filter = req.query.search as string;
      console.log('fetching all farmers', filter);
      logger.info('Fetching all farmers');
      const farmers = await this.farmerService.getAllFarmerWithFilter(filter);
      //console.log(farmers)
      if (!farmers) {
        logger.error('No farmers found');
        return next(new AppError(404, 'No farmers found'));
      }
      logger.info('Farmers retrieved successfully');
      res.status(200).json({

        status: 'success',
        data: farmers,
      });
    } catch (err) {
      logger.error('Error occurred while fetching all farmers', { error: err });
      next(err);
    }
  }
  @httpGet('/download/template')
  public async downloadExcelTemplate(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    const key = 'formats/FarmerDetailsTemplate.xlsx';
    //const bucket = process.env.AWS_S3_BUCKET!;

    const fileBuffer = await this.pdfGeneratorService.getExcelFromS3(key);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${key.split('/').pop()}"`,
    );
    res.send(fileBuffer);
  }

  @httpGet('/multifilter')
  public async getFilteredFarmers(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Fetching filtered farmers');
      const { page, limit, search, sort, ...filters } = req.query;
      console.log("req.query", req.query);
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
        search: (search as string) || '',
        sort: (sort as string) || 'farmer.createdAt:DESC',
        filters: { ...filters },
      
      };

      const result = await this.farmerService.getFarmersWithFilters(queryOptions);

      if (!result || result.data.length === 0) {
        logger.warn('No farmers found for given filters');
        return res.status(404).json({
          status: 'fail',
          message: 'No farmers found for the provided filters',
        });
      }

      res.status(200).json({
        status: 'success',
        total: result.total,
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        data: result.data,
      });
    } catch (err) {
      logger.error('Error fetching filtered farmers', { error: err });
      next(err);
    }
  }
}
