import { inject } from "inversify";
import { controller, httpDelete, httpGet, httpPatch, httpPost, next, request, requestParam, response } from "inversify-express-utils";
import { TYPES } from "../types";
import { MultiCashVoucherService } from "../services/multiCashVoucher.service";
import { NextFunction,Request,Response } from "express";

import { captureUser, deserializeUser, requireUser } from "../middleware/deserializeUser";


import logger from "../utils/logger";
import AppError from "../utils/appError";
import { ControllerLogger } from '../utils/controllerLogger';

import { PaginationOptions } from "../utils/pagination";
import { NotificationService } from "../services/notification.service";
import { uploadSingle } from "../middleware/uploadsingle.middleware";
import { upload, uploadAttachments } from "../middleware/upload.middleware";
import { setAttachmentUrls } from "../utils/fileUploadHelper";
//,deserializeUser,requireUser
@controller('/multiCashVoucher',deserializeUser,requireUser)
export class  MultiCashVoucherController {

    constructor(
      @inject(TYPES.MultiCashVoucherService) private multicashVoucherService: MultiCashVoucherService,
      @inject(TYPES.NotificationService) private notificationService: NotificationService
    ) {}

    @httpPost("/", uploadAttachments)
  public async createVoucher(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Creating a new Multi Cash Voucher");
      const voucherData = req.body;
    console.log(req.body);
    
    // Use helper function to handle file URL extraction
    setAttachmentUrls(voucherData, req.files as any[]);

   Object.keys(voucherData).forEach((key) => {
    if (voucherData[key] === "null") voucherData[key] = null;
  });
   
    voucherData.requestedBy = res.locals.user.id;
    voucherData.requestingDepartment = res.locals.user.selectDepartment;
      const newVoucher = await this.multicashVoucherService.createVoucher(voucherData);
      console.log("after saving multicashVoucher",newVoucher);
      logger.info("Multi Cash Voucher created successfully", { voucherId: newVoucher.id });
      ControllerLogger.logSuccess('Multi Cash Voucher created', newVoucher.id, req, res);

      // Send notification for multi cash voucher creation
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Multi Cash Voucher created successfully: ${newVoucher.id}`,
          userId
        );
      }
   
      res.status(201).json({
        status: "success",
        message: 'Multi Cash Payment Voucher created successfully',
       
      });
    } catch (err) {
      console.log(err)
      logger.error("Error while creating Multi Cash Voucher", { error: err });
      ControllerLogger.logError('Multi Cash Voucher creation', err, req, res);
      next(err);
    }
  }

@httpGet("/recyclebin")
  public async getAllRecycleBinVouchers(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching all Multi Cash Vouchers");
      const { page, limit, search, sort,voucherId} = req.query;
          
      const userId = res.locals.user.id;
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,  
        limit: limit ? Number(limit) : undefined,
        searchFields: ['"voucher.voucherNo",'],
        filters: {},
        sort: sort as string || undefined, // Adjust this line to match your sorting requirements
        search: search as string|| '',
      };
      const vouchers = await this.multicashVoucherService.getAllRecycleBinVouchers(queryOptions, userId);
      logger.info(`Found ${vouchers.data.length} vouchers`);
      ControllerLogger.logList('Multi Cash Voucher Recycle Bin', req, res);

      res.status(200).json({
        status: "success",
        data: vouchers.data,
        allRecords: vouchers.meta.total,
        totalPages: vouchers.meta.pages,
        page: vouchers.meta.page,
      });
    } catch (err: any) {
      logger.error("Error fetching all Multi Cash Vouchers", { error: err });
      ControllerLogger.logError('Multi Cash Voucher recycle bin retrieval', err, req, res);
      next(err);
    }
  }
  // Get all vouchers
  @httpGet("/")
  public async getAllVouchers(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching all Multi Cash Vouchers");
      const { page, limit, search, sort,voucherId} = req.query;
          
      const userId = res.locals.user.id;
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,  
        limit: limit ? Number(limit) : undefined,
        searchFields: ['"voucher.voucherNo",'],
        filters: {},
        sort: sort as string || undefined, // Adjust this line to match your sorting requirements
        search: search as string|| '',
      };
      const vouchers = await this.multicashVoucherService.getAllVouchers(queryOptions, userId);
      logger.info(`Found ${vouchers.data.length} vouchers`);
      ControllerLogger.logList('Multi Cash Voucher', req, res);

      // Send notification for multi cash voucher list access
      if (userId) {
        await this.notificationService.createNoti(
          'Multi Cash Voucher records list accessed successfully',
          userId
        );
      }

      res.status(200).json({
        status: "success",
        data: vouchers.data,
        allRecords: vouchers.meta.total,
        totalPages: vouchers.meta.pages,
        page: vouchers.meta.page,
      });
    } catch (err: any) {
      logger.error("Error fetching all Multi Cash Vouchers", { error: err });
      ControllerLogger.logError('Multi Cash Voucher list retrieval', err, req, res);
      next(err);
    }
  }

  // Get voucher by ID
  @httpGet("/:id")
  public async getVoucherById(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info(`Fetching Multi Cash Voucher with ID`);
      const { id } = req.params;
      const voucher = await this.multicashVoucherService.getVoucherById(id);

      if (!voucher) {
        logger.warn(`Voucher with ID ${id} not found`);
        return res.status(404).json({ status: "fail", message: "Voucher not found" });
      }
      logger.info("Voucher fetched successfully", { voucherId: id });
      ControllerLogger.logView('Multi Cash Voucher', id, req, res);

      // Send notification for multi cash voucher view
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Multi Cash Voucher viewed: ${id}`,
          userId
        );
      }

      res.status(200).json({
        status: "success",
        data: voucher,
      });
    } catch (err) {
      logger.error(`Error fetching Multi Cash Voucher with ID: ${req.params.id}`, { error: err });
      ControllerLogger.logError('Multi Cash Voucher view', err, req, res);
      next(err);
    }
  }



  @httpGet("/:id/view")
  public async getVoucherByIdForView(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info(`Fetching Multi Cash Voucher with ID`);
      const { id } = req.params;
      const voucher = await this.multicashVoucherService.getVoucherByIdForView(id);

      if (!voucher) {
        logger.warn(`Voucher with ID ${id} not found`);
        return res.status(404).json({ status: "fail", message: "Voucher not found" });
      }
      logger.info("Voucher fetched successfully", { voucherId: id });
      ControllerLogger.logView('Multi Cash Voucher (View)', id, req, res);

      res.status(200).json({
        status: "success",
        data: voucher,
      });
    } catch (err) {
      logger.error(`Error fetching Multi Cash Voucher with ID: ${req.params.id}`, { error: err });
      ControllerLogger.logError('Multi Cash Voucher view', err, req, res);
      next(err);
    }
  }
   @httpGet("/:id/update")
  public async getVoucherByIdForUpdate(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info(`Fetching Multi Cash Voucher with ID`);
      const { id } = req.params;
      const voucher = await this.multicashVoucherService.getVoucherByIdForUpdate(id);

      if (!voucher) {
        logger.warn(`Voucher with ID ${id} not found`);
        return res.status(404).json({ status: "fail", message: "Voucher not found" });
      }
      logger.info("Voucher fetched successfully", { voucherId: id });
      ControllerLogger.logView('Multi Cash Voucher (Update)', id, req, res);

      res.status(200).json({
        status: "success",
        data: voucher,
      });
    } catch (err) {
      logger.error(`Error fetching Multi Cash Voucher with ID: ${req.params.id}`, { error: err });
      ControllerLogger.logError('Multi Cash Voucher view for update', err, req, res);
      next(err);
    }
  }

  // Update a Labour Payment Voucher
  @httpPatch("/:id", uploadAttachments, captureUser)
  public async updateVoucher(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const updatedBy = res.locals.updatedBy;
      const { id } = req.params;
      const updatedData = req.body;
      console.log(req.body)
      logger.info(`Updating Multi Cash Voucher with ID: ${id}`, { updatedBy });
      
      // Use helper function to handle file URL extraction
      setAttachmentUrls(updatedData, req.files as any[]);

     Object.keys( updatedData).forEach((key) => {
      if ( updatedData[key] === "null")  updatedData[key] = null;
    });
      const updatedVoucher = await this.multicashVoucherService.updateVoucher(id, updatedData,updatedBy);

      if (!updatedVoucher) {
        logger.warn(`Voucher with ID ${id} not found for update`);
        return res.status(404).json({ 
          status: "fail",
           message: "Voucher not found" });
      }
      logger.info("Voucher updated successfully", { voucherId: id });
      ControllerLogger.logSuccess('Multi Cash Voucher updated', id, req, res);

      // Send notification for multi cash voucher update
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Multi Cash Voucher updated successfully: ${id}`,
          userId
        );
      }

      res.status(200).json({
        status: "success",
        data: updatedVoucher,
      });
    } catch (err) {
      logger.error(`Error updating Multi Cash Voucher with ID: ${req.params.id}`, { error: err });
      ControllerLogger.logError('Multi Cash Voucher update', err, req, res);
      next(err);
    }
  }
  @httpDelete("/:id")
  public async deleteVoucher(
    @requestParam("id") id: string,
    @request() req: Request,
    @response() res: Response, 
    @next() next: NextFunction
  ) {
    try {
     const voucher = await this.multicashVoucherService.deleteVoucher(id)
     
       if (!voucher) 
        {
               return next(new AppError(404, "Voucher not found or could not be deleted"));
             }

             ControllerLogger.logSuccess('Multi Cash Voucher deleted', id, req, res);

             // Send notification for multi cash voucher deletion
             const userId = res.locals.user?.id;
             if (userId) {
               await this.notificationService.createNoti(
                 `Multi Cash Voucher deleted successfully: ${id}`,
                 userId
               );
             }

             res.status(200).json({ 
              status: "success", 
              message: "Voucher deleted successfully" });
      //res.status(204).send();
    } catch (err) {
      logger.error("Error occurred while deleting voucher", { voucherId: id, error: err });
      ControllerLogger.logError('Multi Cash Voucher deletion', err, req, res);
      next(err);
    }
  }

  @httpDelete('/delete/multiple')
        public async deleteMultipleMultiCashVoucher(
          @request() req: Request,
          @response() res: Response,
          @next() next: NextFunction,
        ) {
          try {
            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.length === 0) {
              return next(new AppError(400, 'An array of MultiCashVoucher IDs is required'));
            }
            const result = await this.multicashVoucherService.deleteMultipleMultiCashVoucher(ids);
            
            ControllerLogger.logSuccess(`${ids.length} Multi Cash Vouchers deleted`, ids.join(', '), req, res);

            res.status(200).json({
              message: result.message,
              success: result.success,
              failed: result.failed,
            });
          }
            catch (error) {
            logger.error('Error deleting multiple multiCashVoucher', { error });
            ControllerLogger.logError('Multiple Multi Cash Vouchers deletion', error, req, res);
            next(error);
          }
        }
@httpGet('/:id/generate-pdf')
async generateVoucherPdf(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const pdfUrl = await this.multicashVoucherService.generateMultiCashVoucherPdf(id);
      res.status(200).json({ message:"Url Fetch Successfully", url: pdfUrl });
    } catch (error) {
      console.error('Error generating voucher PDF:', error);
      res.status(500).json({ success: false, message: 'Failed to generate PDF' });
    }
  }

}