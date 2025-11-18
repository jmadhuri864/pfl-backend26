import { Request, Response, NextFunction } from "express";
import { PMPVoucherService } from "../services/pmpvoucher.service";
import { inject } from "inversify";
import { controller, httpGet, httpPost, httpPut, httpDelete, request, response, next, httpPatch } from "inversify-express-utils";
import { TYPES } from "../types";

import { captureUser, deserializeUser, requireUser } from "../middleware/deserializeUser";

import logger from "../utils/logger";
import { upload } from "../middleware/multerConfig";
import { uploadFile } from "../middleware/uploadwithAWS";
import { PaginationOptions } from "../utils/pagination";
import AppError from "../utils/appError";
//,deserializeUser, requireUser
@controller("/pmpvoucher",deserializeUser, requireUser)
export class PMPVoucherController {
  constructor(@inject(TYPES.PMPVoucherService) private pmpVoucherService: PMPVoucherService) {}

  // Get all vouchers
  @httpGet("/")
  public async getAllVouchers(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching all vouchers");
      const userId = res.locals.user.id;
      const { page, limit, search, sort,voucherNo} = req.query
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,  
                limit: limit ? Number(limit) : undefined,
        searchFields: ['"voucher.voucherNo",'],
        filters: {},
        sort: sort as string || undefined, // Adjust this line to match your sorting requirements
        search: search as string|| '',
      };
      const vouchers = await this.pmpVoucherService.getAllVouchers(queryOptions, userId);
      logger.info("Vouchers fetched successfully", { vouchers });
      res.status(200).json({
        status: "success",
        data: vouchers.data,
        allRecords: vouchers.meta.total,
        totalPages: vouchers.meta.pages,
        page: vouchers.meta.page,
      });
    } catch (err: any) {
      logger.error("Error fetching vouchers", { error: err });
      console.log(err)
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
      logger.info("Fetching all vouchers");
      const userId = res.locals.user.id;
      const { page, limit, search, sort,voucherNo} = req.query
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,  
                limit: limit ? Number(limit) : undefined,
        searchFields: ['"voucher.voucherNo",'],
        filters: {},
        sort: sort as string || undefined, // Adjust this line to match your sorting requirements
        search: search as string|| '',
      };
      const vouchers = await this.pmpVoucherService.getAllRecycleBinVouchers(queryOptions, userId);
      console.log("vouchers",vouchers.data);
      
      logger.info("Vouchers fetched successfully", { vouchers });
      res.status(200).json({
        status: "success",
        data: vouchers.data,
        allRecords: vouchers.meta.total,
        totalPages: vouchers.meta.pages,
        page: vouchers.meta.page,
      });
    } catch (err: any) {
      logger.error("Error fetching vouchers", { error: err });
      console.log(err)
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
      const { id } = req.params;
      const voucher = await this.pmpVoucherService.getVoucherById(id);
      logger.info(`Fetching voucher with ID: ${id}`);
      if (!voucher) {
        logger.warn(`Voucher with ID: ${id} not found`);
        return res.status(404).json({ status: "fail", message: "Voucher not found" });
      }
      logger.info(`Voucher with ID: ${id} fetched successfully`);
      res.status(200).json({
        status: "success",
        data: voucher,
      });
    } catch (err) {
      logger.error("Error fetching voucher by ID", { error: err });
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
      const { id } = req.params;
      const voucher = await this.pmpVoucherService.getVoucherByIdforView(id);
      logger.info(`Fetching voucher with ID: ${id}`);
      if (!voucher) {
        logger.warn(`Voucher with ID: ${id} not found`);
        return res.status(404).json({ status: "fail", message: "Voucher not found" });
      }
      logger.info(`Voucher with ID: ${id} fetched successfully`);
      res.status(200).json({
        status: "success",
        data: voucher,
      });
    } catch (err) {
      logger.error("Error fetching voucher by ID", { error: err });
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
      const { id } = req.params;
      const voucher = await this.pmpVoucherService.getVoucherByIdForUpdate(id);
      logger.info(`Fetching voucher with ID: ${id}`);
      if (!voucher) {
        logger.warn(`Voucher with ID: ${id} not found`);
        return res.status(404).json({ status: "fail", message: "Voucher not found" });
      }
      logger.info(`Voucher with ID: ${id} fetched successfully`);
      res.status(200).json({
        status: "success",
        data: voucher,
      });
    } catch (err) {
      logger.error("Error fetching voucher by ID", { error: err });
      next(err);
    }
  }

  // Create a new voucher
  @httpPost("/",uploadFile.single('anyAttachment'))
  public async createVoucher(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      console.log("reqbody",req.body)
      const voucherData = req.body;
      if(req.file){
      
        const imageUrl = (req.file as any).location;
        console.log("imageurl is ",imageUrl)
       if (imageUrl) {
         
        voucherData.anyAttachment = imageUrl;
       }
   
     }
      Object.keys(voucherData).forEach((key) => {
        if (voucherData[key] === "null") voucherData[key] = null;
      });
      logger.info("Creating a new voucher");
      
    voucherData.requestedBy= res.locals.user.id;
    voucherData.requestingDepartment = res.locals.user.selectDepartment;
    console.log(voucherData)
      const newVoucher = await this.pmpVoucherService.createVoucher(voucherData);
      console.log(newVoucher)
      logger.info("New voucher created successfully");
      res.status(201).json({
        status: "success",
        message: 'Packing Material Payment Voucher created successfully',
        //data: newVoucher,
      });
    } catch (err) {
      logger.error("Error creating voucher", { error: err });
      console.log(err)
      next(err);
    }
  }

  // Update a voucher
  @httpPatch("/:id",uploadFile.single('anyAttachment'),captureUser)
  public async updateVoucher(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const updatedBy=res.locals.updatedBy
      const { id } = req.params;
      const updatedData = req.body;
      // const file = req.file;
      // console.log(file);
      // if (file) {
      //   updatedData.anyAttachment=file.path;
      //   //console.log("Uploaded file:", file); // Check file path, originalname, etc.
      // } 
      if(req.file){
      
        const imageUrl = (req.file as any).location;
        console.log("imageurl is ",imageUrl)
       if (imageUrl) {
         
        updatedData.anyAttachment = imageUrl;
       }
   
     }

     Object.keys(updatedData).forEach((key) => {
      if (updatedData[key] === "null") updatedData[key] = null;
    });
      logger.info(`Updating voucher with ID`);
      //console.log(req.body)
      const updatedVoucher = await this.pmpVoucherService.updateVoucher(id, updatedData,updatedBy);

      if (!updatedVoucher) {
        logger.warn(`Voucher with ID: ${id} not found for update`);
        return res.status(404).json({ status: "fail", message: "Voucher not found" });
      }
      logger.info(`Voucher with ID: ${id} updated successfully`);
      res.status(200).json({
        status: "success",
        data: updatedVoucher,
      });
    } catch (err) {
      logger.error("Error updating voucher", { error: err });
      next(err);
    }
  }

  // Delete a voucher
  @httpDelete("/:id")
  public async deleteVoucher(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const { id } = req.params;
      logger.info(`Deleting voucher with ID: ${id}`);
      const success = await this.pmpVoucherService.deleteVoucher(id);

      if (!success) {
        logger.warn(`Voucher with ID: ${id} not found for deletion`);
        return res.status(404).json({ status: "fail", message: "Voucher not found" });
      }
      logger.info(`Voucher with ID: ${id} deleted successfully`);
      res.status(200).json({ 
        status: "success",
         message: "Voucher deleted successfully" });
    } catch (err) {
      logger.error("Error deleting voucher", { error: err });
      next(err);
    }
  }
  @httpDelete('/delete/multiple')
      public async deleteMultiplePMPVoucher(
        @request() req: Request,
        @response() res: Response,
        @next() next: NextFunction,
      ) {
        try {
          const { ids } = req.body;
          if (!Array.isArray(ids) || ids.length === 0) {
            return next(new AppError(400, 'An array of AQR IDs is required'));
          }
          const result = await this.pmpVoucherService.deleteMultiplePMPVoucher(ids);
          res.status(200).json({
            message: result.message,
            success: result.success,
            failed: result.failed,
          });
        }
          catch (error) {
          logger.error('Error deleting  PMPVoucher', { error });
          next(error);
        }
      }


}
