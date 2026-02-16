import { Request, Response, NextFunction } from "express";
import { LabourPaymentVoucherService } from "../services/labourPaymentVoucher.service";
import { inject } from "inversify";
import { controller, httpGet, httpPost, httpPut, httpDelete, request, response, next, httpPatch } from "inversify-express-utils";
import { TYPES } from "../types";
import { LPVoucher } from "../entities/labourPaymentVoucher.entity";
import { captureUser, deserializeUser, requireUser } from "../middleware/deserializeUser";

import logger from "../utils/logger";

import { PaginationOptions } from "../utils/pagination";
import AppError from "../utils/appError";
import { ControllerLogger } from '../utils/controllerLogger';
import { NotificationService } from "../services/notification.service";
import { upload, uploadAttachments } from "../middleware/upload.middleware";
import { setAttachmentUrls } from "../utils/fileUploadHelper";

@controller("/lpvoucher", deserializeUser, requireUser)
export class LabourPaymentVoucherController {
  constructor(
    @inject(TYPES.LabourPaymentVoucherService) private lpVoucherService: LabourPaymentVoucherService,
    @inject(TYPES.NotificationService) private notificationService: NotificationService
  ) {}

  // Get all Labour Payment Vouchers
  @httpGet("/")
  public async getAllVouchers(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching all Labour Payment Vouchers");
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
      const vouchers = await this.lpVoucherService.getLPVouchers(queryOptions, userId);
      logger.info(`Fetched ${vouchers.length} vouchers successfully`);
      ControllerLogger.logList('Labour Payment Voucher', req, res);

      // Send notification for labour payment voucher list access
      if (userId) {
        await this.notificationService.createNoti(
          'Labour Payment Voucher records list accessed successfully',
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
    } catch (err) {
      logger.error("Error fetching Labour Payment Vouchers", { error: err });
      ControllerLogger.logError('Labour Payment Voucher list retrieval', err, req, res);
      next(err);
    }
  }

  // Get Labour Payment Voucher by ID
  @httpGet("/:id")
  public async getVoucherById(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info(`Fetching Labour Payment Voucher with ID`);
      const { id } = req.params;
      const voucher = await this.lpVoucherService.getLPVoucherById(id);

      if (!voucher) {
        logger.warn(`Voucher with ID: ${id} not found`);
        return res.status(404).json({ status: "fail", message: "Voucher not found" });
      }
      logger.info(`Fetched voucher with ID: ${id} successfully`);
      ControllerLogger.logView('Labour Payment Voucher', id, req, res);

      // Send notification for labour payment voucher view
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Labour Payment Voucher viewed: ${id}`,
          userId
        );
      }

      res.status(200).json({
        status: "success",
        data: voucher,
      });
    } catch (err) {
      logger.error("Error fetching Labour Payment Voucher by ID", { error: err });
      ControllerLogger.logError('Labour Payment Voucher view', err, req, res);
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
      logger.info(`Fetching Labour Payment Voucher with ID`);
      const { id } = req.params;
      const voucher = await this.lpVoucherService.getLPVoucherByIdForView(id);

      if (!voucher) {
        logger.warn(`Voucher with ID: ${id} not found`);
        return res.status(404).json({ status: "fail", message: "Voucher not found" });
      }
      logger.info(`Fetched voucher with ID: ${id} successfully`);
      ControllerLogger.logView('Labour Payment Voucher (View)', id, req, res);

      res.status(200).json({
        status: "success",
        data: voucher,
      });
    } catch (err) {
      logger.error("Error fetching Labour Payment Voucher by ID", { error: err });
      ControllerLogger.logError('Labour Payment Voucher view', err, req, res);
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
      logger.info(`Fetching Labour Payment Voucher with ID`);
      const { id } = req.params;
      const voucher = await this.lpVoucherService.getLPVoucherByIdForUpdate(id);

      if (!voucher) {
        logger.warn(`Voucher with ID: ${id} not found`);
        return res.status(404).json({ status: "fail", message: "Voucher not found" });
      }
      logger.info(`Fetched voucher with ID: ${id} successfully`);
      ControllerLogger.logView('Labour Payment Voucher (Update)', id, req, res);

      res.status(200).json({
        status: "success",
        data: voucher,
      });
    } catch (err) {
      logger.error("Error fetching Labour Payment Voucher by ID", { error: err });
      ControllerLogger.logError('Labour Payment Voucher view for update', err, req, res);
      next(err);
    }
  }

  // Create a new Labour Payment Voucher
  @httpPost("/", uploadAttachments)
  public async createVoucher(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Creating new Labour Payment Voucher");
      const voucherData = req.body;
      
      // Use helper function to handle file URL extraction
      setAttachmentUrls(voucherData, req.files as any[]);
     Object.keys( voucherData).forEach((key) => {
      if ( voucherData[key] === "null")  voucherData[key] = null;
    });
      voucherData.requestedBy = res.locals.user.id;
      voucherData.requestingDepartment = res.locals.user.selectDepartment; // Assuming the user id is available in res.locals
      const newVoucher = await this.lpVoucherService.createLPVoucher(voucherData);
      console.log(newVoucher);
      logger.info("Labour Payment Voucher created successfully");
      ControllerLogger.logSuccess('Labour Payment Voucher created', newVoucher[0].id, req, res);

      // Send notification for labour payment voucher creation
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Labour Payment Voucher created successfully: ${newVoucher[0].id}`,
          userId
        );
      }

      res.status(201).json({
        status: "success",
        message: 'Labour Payment Voucher created successfully',
        //data: newVoucher,
      });
    } catch (err) {
      logger.error("Error creating Labour Payment Voucher", { error: err });
      ControllerLogger.logError('Labour Payment Voucher creation', err, req, res);
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
      logger.info(`Updating Labour Payment Voucher with ID: ${id}`);
      console.log(req.body)
      const updatedData= req.body;
      
      // Use helper function to handle file URL extraction
      setAttachmentUrls(updatedData, req.files as any[]);

     Object.keys(updatedData).forEach((key) => {
      if (updatedData[key] === "null") updatedData[key] = null;
    });
      const updatedVoucher = await this.lpVoucherService.updateLPVoucher(id, updatedData,updatedBy);

      if (!updatedVoucher) {
        logger.warn(`Voucher with ID: ${id} not found`);
        return res.status(404).json({ 
          status: "fail",
           message: "Voucher not found" });
      }
      logger.info(`Labour Payment Voucher with ID: ${id} updated successfully`);
      ControllerLogger.logSuccess('Labour Payment Voucher updated', id, req, res);

      // Send notification for labour payment voucher update
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Labour Payment Voucher updated successfully: ${id}`,
          userId
        );
      }

      res.status(200).json({
        status: "success",
        //data: updatedVoucher,
      });
    } catch (err) {
      logger.error("Error updating Labour Payment Voucher", { error: err });
      ControllerLogger.logError('Labour Payment Voucher update', err, req, res);
      next(err);
    }
  }

  // Delete a Labour Payment Voucher
  @httpDelete("/:id")
  public async deleteVoucher(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info(`Deleting Labour Payment Voucher with ID`);
      const { id } = req.params;
      await this.lpVoucherService.deleteLPVoucher(id);
      logger.info(`Labour Payment Voucher with ID: ${id} deleted successfully`);
      ControllerLogger.logSuccess('Labour Payment Voucher deleted', id, req, res);

      // Send notification for labour payment voucher deletion
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Labour Payment Voucher deleted successfully: ${id}`,
          userId
        );
      }

      res.status(200).json({ 
        status: "success", 
        message: "Voucher deleted successfully" });
    } catch (err) {
      logger.error("Error deleting Labour Payment Voucher", { error: err });
      ControllerLogger.logError('Labour Payment Voucher deletion', err, req, res);
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
      logger.info("Fetching all Labour Payment Vouchers");
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
      const vouchers = await this.lpVoucherService.getLPRecycleBinVouchers(queryOptions, userId);
      logger.info(`Fetched ${vouchers.length} vouchers successfully`);
      ControllerLogger.logList('Labour Payment Voucher Recycle Bin', req, res);

      res.status(200).json({
        status: "success",
        data: vouchers.data,
        allRecords: vouchers.meta.total,
        totalPages: vouchers.meta.pages,
        page: vouchers.meta.page,
      });
    } catch (err) {
      logger.error("Error fetching Labour Payment Vouchers", { error: err });
      ControllerLogger.logError('Labour Payment Voucher recycle bin retrieval', err, req, res);
      next(err);
    }
  }


  @httpDelete('/delete/multiple')
      public async deleteMultipleLPVoucher(
        @request() req: Request,
        @response() res: Response,
        @next() next: NextFunction,
      ) {
        try {
          const { ids } = req.body;
          if (!Array.isArray(ids) || ids.length === 0) {
            return next(new AppError(400, 'An array of AQR IDs is required'));
          }
          const result = await this.lpVoucherService.deleteMultipleLPVoucher(ids);
          ControllerLogger.logSuccess(`${ids.length} Labour Payment Vouchers deleted`, ids.join(', '), req, res);

          res.status(200).json({
            message: result.message,
            success: result.success,
            failed: result.failed,
          });
        }
          catch (error) {
          logger.error('Error deleting multiple LPVoucher', { error });
          ControllerLogger.logError('Multiple Labour Payment Vouchers deletion', error, req, res);
          next(error);
        }
      }
  

}
