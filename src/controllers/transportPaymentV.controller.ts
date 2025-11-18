import { Request,  Response } from 'express';
import { controller, httpGet, httpPost, httpPut, httpDelete, requestParam, requestBody, response, next, request, httpPatch } from 'inversify-express-utils';
import { inject } from 'inversify';

import { TPVoucher } from '../entities/transportPaymentvoucher.entity';
import { TYPES } from '../types';
import { NextFunction } from 'express';
import AppError from '../utils/appError'; // Custom error handling middleware
import { TPVoucherService } from '../services/transportPaymentV.service';
import { captureUser, deserializeUser, requireUser } from '../middleware/deserializeUser';

import { upload, uploadNone } from "../middleware/multerConfig";
import logger from '../utils/logger';
import { uploadFile } from '../middleware/uploadwithAWS';
import { PaginationOptions } from '../utils/pagination';

@controller('/tpvoucher', deserializeUser, requireUser)
export class TPVoucherController {
  constructor(
    @inject(TYPES.TPVoucherService) private tpVoucherService: TPVoucherService
  ) {}

  @httpPost('/',uploadFile.array('anyAttachment', 5))
  public async createTPVoucher(
    @requestBody() tpVoucherData: any,
    @request() req:Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      console.log("in create transport payment voucher",tpVoucherData)
      logger.info('Received request to create TPVoucher');
    //   if(req.file){
      
    //     const imageUrl = (req.file as any).location;
    //     console.log("imageurl is ",imageUrl)
    //    if (imageUrl) {
         
    //     tpVoucherData.anyAttachment = imageUrl;
    //    }
   
    //  }
      if (req.files && Array.isArray(req.files)) {
      const imageUrls = (req.files as Express.Multer.File[]).map(file => (file as any).location);
      tpVoucherData.anyAttachment = imageUrls;
    }
    
    
     
      tpVoucherData.requestedBy = res.locals.user.id;
      tpVoucherData.requestingDepartment = res.locals.user.selectDepartment;
      const createdVoucher = await this.tpVoucherService.createTPVoucher(tpVoucherData);
      if (!createdVoucher) {
        logger.error('TPVoucher creation failed');
        return next(new AppError(400, "TPVoucher could not be created"));
      }
      logger.info('TPVoucher created successfully', { voucherId: createdVoucher.id });
      res.status(201).json({
        status: 'success',
        message: 'Transport Payment Voucher created successfully',
        //data: createdVoucher,
      });
    } catch (error) {
      logger.error('Error creating TPVoucher', { error });
      console.log(error);
      next(error);
    }
  }

  @httpGet('/')
  public async getAllTPVouchers(
    @request() req:Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info('Received request to get all TPVouchers');
      const userId = res.locals.user.id; // Get the user ID from the request context
      const { page, limit, search, sort,voucherId} = req.query
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,  
        limit: limit ? Number(limit) : undefined,
              searchFields: ['"voucher.voucherNo",'],
              filters: {},
              sort: sort as string || undefined, // Adjust this line to match your sorting requirements
              search: search as string|| '',
            };
      const vouchers = await this.tpVoucherService.getAllTPVouchers(queryOptions, userId);
      // if (!vouchers.length) {
      //   return next(new AppError(404, 'No Transport Payment Vouchers found'));
      // }
      logger.info('Fetched all Transport Payment Vouchers successfully');
      res.status(200).json({
        status: 'success',
        data: vouchers.data,
        allRecords: vouchers.meta.total,
        totalPages: vouchers.meta.pages,
        page: vouchers.meta.page,
      });
    } catch (error) {
      logger.error('Error fetching all TPVouchers', { error });
      next(error);
    }
  }

  @httpGet('/recycle-bin')
  public async getAllRecycleBinTPVouchers(
    @request() req:Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info('Received request to get all TPVouchers');
      const userId = res.locals.user.id; // Get the user ID from the request context
      const { page, limit, search, sort,voucherId} = req.query
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,  
        limit: limit ? Number(limit) : undefined,
              searchFields: ['"voucher.voucherNo",'],
              filters: {},
              sort: sort as string || undefined, // Adjust this line to match your sorting requirements
              search: search as string|| '',
            };
      const vouchers = await this.tpVoucherService.getAllRecycleBinTPVouchers(queryOptions, userId);
      // if (!vouchers.length) {
      //   return next(new AppError(404, 'No Transport Payment Vouchers found'));
      // }
      logger.info('Fetched all Transport Payment Vouchers successfully');
      res.status(200).json({
        status: 'success',
        data: vouchers.data,
        allRecords: vouchers.meta.total,
        totalPages: vouchers.meta.pages,
        page: vouchers.meta.page,
      });
    } catch (error) {
      logger.error('Error fetching all TPVouchers', { error });
      next(error);
    }
  }
  @httpGet('/:id')
  public async getTPVoucherById(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info(`Received request to get TPVoucher with id: ${id}`);
      const voucher = await this.tpVoucherService.getTPVoucherById(id);
      if (!voucher) {
        logger.warn(`TPVoucher with id ${id} not found`);
        return next(new AppError(404, 'Transport Payment Voucher not found'));
      }
      logger.info(`Fetched Transport Payment Voucher with ID: ${id} successfully`);
      res.status(200).json({
        status: 'success',
        data: voucher,
      });
    } catch (error) {
      logger.error('Error fetching TPVoucher by id', { error, id });
      next(error);
    }
  }

  @httpGet('/:id/view')
  public async getTPVoucherByIdForView(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info(`Received request to get TPVoucher with id: ${id}`);
      const voucher = await this.tpVoucherService.getTPVoucherByIdForView(id);
      if (!voucher) {
        logger.warn(`TPVoucher with id ${id} not found`);
        return next(new AppError(404, 'Transport Payment Voucher not found'));
      }
      logger.info(`Fetched Transport Payment Voucher with ID: ${id} successfully`);
      res.status(200).json({
        status: 'success',
        data: voucher,
      });
    } catch (error) {
      logger.error('Error fetching TPVoucher by id', { error, id });
      next(error);
    }
  }

  @httpGet('/:id/update')
  public async getTPVoucherByIdForUpdate(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info(`Received request to get TPVoucher with id: ${id}`);
      const voucher = await this.tpVoucherService.getTPVoucherByIdForUpdate(id);
      if (!voucher) {
        logger.warn(`TPVoucher with id ${id} not found`);
        return next(new AppError(404, 'Transport Payment Voucher not found'));
      }
      logger.info(`Fetched Transport Payment Voucher with ID: ${id} successfully`);
      res.status(200).json({
        status: 'success',
        data: voucher,
      });
    } catch (error) {
      logger.error('Error fetching TPVoucher by id', { error, id });
      next(error);
    }
  }
  @httpPatch('/:id',uploadFile.single('anyAttachment'),captureUser)
  public async updateTPVoucher(
    @requestParam('id') id: string,
    @requestBody() updateData: any,
    @request() req:Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info(`Received request to update TPVoucher with id: ${id}`);
      if(req.file){
      
        const imageUrl = (req.file as any).location;
        console.log("imageurl is ",imageUrl)
       if (imageUrl) {
         
        updateData.anyAttachment = imageUrl;
       }
   
     }
     Object.keys(updateData).forEach((key) => {
      if (updateData[key] === "null") updateData[key] = null;
    });
      const updatedBy=res.locals.updatedBy
      console.log("in update transport payment voucher",updateData)
      const updatedVoucher = await this.tpVoucherService.updateTPVoucher(id, updateData,updatedBy);
      if (!updatedVoucher) {
        logger.warn(`TPVoucher with id ${id} not found for update`);
        return next(new AppError(404, 'Transport Payment Voucher not found for update'));
      }
      logger.info(`TPVoucher with id ${id} updated successfully`);
      res.status(200).json({
        status: 'success',
        // data: updatedVoucher,
        message: 'Transport Payment Voucher updated successfully',
      });
    } catch (error) {
      logger.error('Error updating TPVoucher', { error });
      next(error);
    }
  }

  @httpDelete('/:id')
  public async deleteTPVoucher(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      if (!id) {
        logger.warn("TPVoucher ID not provided");
        return next(new AppError(400, "TPVoucher ID is required"));
      }
      logger.info(`Received request to delete TPVoucher with id: ${id}`);
      const success = await this.tpVoucherService.deleteTPVoucher(id);
      if (!success) {
        logger.warn("TPVoucher ID not provided");
        return next(new AppError(400, "TPVoucher ID is required"));
      }
      logger.info(`TPVoucher with id ${id} deleted successfully`);
      res.status(200).json({
        status: "success",
        message: "TPVoucher deleted successfully"
      });
      //res.status(200).send("Deleted successfully"); // No content
    } catch (error) {
      logger.error('Error deleting TPVoucher', { error });
      next(error);
    }
  }

  @httpDelete('/delete/multiple')
      public async deleteMultipleTransportPaymentVoucher(
        @request() req: Request,
        @response() res: Response,
        @next() next: NextFunction,
      ) {
        try {
          const { ids } = req.body;
          if (!Array.isArray(ids) || ids.length === 0) {
            return next(new AppError(400, 'An array of Transport Payment Voucher IDs is required'));
          }
          const result = await this.tpVoucherService.deleteMultipleTransportPaymentVoucher(ids);
          res.status(200).json({
            message: result.message,
            success: result.success,
            failed: result.failed,
          });
        }
          catch (error) {
          logger.error('Error deleting multiple Transport Payment Voucher', { error });
          next(error);
        }
      }
}
