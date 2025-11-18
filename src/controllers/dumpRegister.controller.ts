import { inject } from "inversify";
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
} from "inversify-express-utils";
import { TYPES } from "../types";
import { Request, Response, NextFunction } from "express";
import AppError from "../utils/appError";
import { DumpRegisterService } from "../services/dumpRegister.service";
import { NotificationService } from "../services/notification.service";
import { deserializeUser, requireUser, captureUser } from "../middleware/deserializeUser";
import logger from "../utils/logger";
import { uploadNone } from "../middleware/multerConfig";
import { http } from "winston";
import { PaginationOptions } from "../utils/pagination";

@controller("/dumpRegister", deserializeUser, requireUser)
export class DumpRegisterController {
  constructor(
    @inject(TYPES.DumpRegisterService) private readonly dumpRegisterService: DumpRegisterService,
    @inject(TYPES.NotificationService) private readonly notificationService: NotificationService
  ) {}

 
  @httpPost("/")
  public async createDumpRegister(
    @request() req: Request<{}, {}, any>,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
        console.log(req.body)
       
      //logger.info("Attempting to create a new dump register", { requestedBy: res.locals.user.id });
      // Enhanced logging with request data
    logger.info("Received dump register creation request", {
      requestedBy: res.locals.user.id,
      timestamp: new Date().toISOString()
    });
   
      const dumpRegisterData = req.body;
     const requestedBy = res.locals.user.id;
      dumpRegisterData.requestedBy = requestedBy;
     
      const dumpRegister = await this.dumpRegisterService.createDumpRegister(dumpRegisterData);
      console.log("after saving",dumpRegister)
      if (!dumpRegister) {
        return next(new AppError(400, "Dump register could not be created"));
      }
 // Success logging
 logger.info("Dump register created successfully", {
  dumpRegisterId: dumpRegister.id,
  createdBy: res.locals.user.id
});

      logger.info("Dump register created successfully", { dumpRegisterId: dumpRegister.id });
      await this.notificationService.createNoti(
        `New dump register created with ID: ${dumpRegister.id}`,
        res.locals.user.id
      );

      res.status(201).json({
        status: "success",
        message: "Dump register created successfully",
        data: dumpRegister.id,
      });
    } catch (error) {
      logger.error("Error occurred while creating dump register", { error: error });
      logger.error("Error in dump register creation", {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        requestedBy: res.locals.user.id
      });
      console.log(error)
      next(error);
    }
  }

  @httpGet("/:id")
  public async getDumpRegisterById(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching dump register details by ID", { dumpRegisterId: id });
      const dumpRegister = await this.dumpRegisterService.getDumpRegisterById(id);
      if (!dumpRegister) {
        return next(new AppError(404, "Dump register not found"));
      }

      logger.info("Dump register details retrieved successfully", { dumpRegister });
      res.status(200).json({
        status: "success",
        data: dumpRegister,
      });
    } catch (err) {
      logger.error("Error occurred while fetching dump register details", { dumpRegisterId: id, error: err });
      next(err);
    }
  }


  @httpGet("/recyclebin")
  public async getAllRecycleBinDumpRegisters(
    @response() res: Response,
    @request()req: Request,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching all dump registers");

       const { page, limit, search, sort,dumpRegisterId} = req.query;
          
       const userId = res.locals.user.id;
       if(!userId) {
        return next(new AppError(401, "Unauthorized access"));
      }
      
            const queryOptions: PaginationOptions = {
              page: page ? Number(page) : undefined,  
              limit: limit ? Number(limit) : undefined,
              searchFields: ['dumpRegister.id'],
              filters: {},
              sort: sort as string || undefined, // Adjust this line to match your sorting requirements
              search: search as string|| '',
            };
      const dumpRegisters = await this.dumpRegisterService.getAllRecycleBinDumpRegisters(queryOptions, userId);
      if (!dumpRegisters) {
        return next(new AppError(404, "No dump registers found"));
      }

      logger.info("Dump registers retrieved successfully");
      res.status(200).json({
        status: "success",
        data: dumpRegisters.data,
        allRecords: dumpRegisters.meta.total,
        totalPages: dumpRegisters.meta.pages,
        page:dumpRegisters.meta.page,
      });
    } catch (err) {
      console.log(err)
      logger.error("Error occurred while fetching all dump registers", { error: err });
      next(err);
    }
  }

  @httpGet("/update/:id")
  public async getDumpRegisterByIdforupate(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching dump register details by ID", { dumpRegisterId: id });
      const dumpRegister = await this.dumpRegisterService.getDumpRegisterByIdforUpdate(id);
      if (!dumpRegister) {
        return next(new AppError(404, "Dump register not found"));
      }

      logger.info("Dump register details retrieved successfully", { dumpRegister });
      res.status(200).json({
        status: "success",
        data: dumpRegister,
      });
    } catch (err) {
      logger.error("Error occurred while fetching dump register details", { dumpRegisterId: id, error: err });
      next(err);
    }
  }
  @httpGet("/view/:id")
  public async getDumpRegisterByIdforView(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching dump register details by ID", { dumpRegisterId: id });
      const dumpRegister = await this.dumpRegisterService.getDumpRegisterByIdforView(id);
      if (!dumpRegister) {
        return next(new AppError(404, "Dump register not found"));
      }

      logger.info("Dump register details retrieved successfully", { dumpRegister });
      res.status(200).json({
        status: "success",
        data: dumpRegister,
      });
    } catch (err) {
      logger.error("Error occurred while fetching dump register details", { dumpRegisterId: id, error: err });
      next(err);
    }
  }


  @httpGet("/")
  public async getAllDumpRegisters(
    @response() res: Response,
    @request()req: Request,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching all dump registers");

       const { page, limit, search, sort,dumpRegisterId} = req.query;
          
       const userId = res.locals.user.id;
       if(!userId) {
        return next(new AppError(401, "Unauthorized access"));
      }
      
            const queryOptions: PaginationOptions = {
              page: page ? Number(page) : undefined,  
              limit: limit ? Number(limit) : undefined,
              searchFields: ['dumpRegister.id'],
              filters: {},
              sort: sort as string || undefined, // Adjust this line to match your sorting requirements
              search: search as string|| '',
            };
      const dumpRegisters = await this.dumpRegisterService.getAllDumpRegisters(queryOptions, userId);
      if (!dumpRegisters) {
        return next(new AppError(404, "No dump registers found"));
      }

      logger.info("Dump registers retrieved successfully");
      res.status(200).json({
        status: "success",
        data: dumpRegisters.data,
        allRecords: dumpRegisters.meta.total,
        totalPages: dumpRegisters.meta.pages,
        page:dumpRegisters.meta.page,
      });
    } catch (err) {
      console.log(err)
      logger.error("Error occurred while fetching all dump registers", { error: err });
      next(err);
    }
  }

  @httpPatch("/:id", captureUser)
  public async updateDumpRegister(
    @requestParam("id") id: string,
    @request() req: Request<{}, {}, any>,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Updating dump register details", { dumpRegisterId: id });
      const updatedBy = res.locals.user.id;

      const dumpRegister = await this.dumpRegisterService.updateDumpRegister(id, req.body,updatedBy);
      if (!dumpRegister) {
        return next(new AppError(404, "Dump register not found or could not be updated"));
      }

      logger.info("Dump register updated successfully", { dumpRegister });
      await this.notificationService.createNoti(
        `Dump register updated with ID: ${dumpRegister.id}`,
        res.locals.user.id
      );

      res.status(200).json({
        status: "success",
        message: "Dump register updated successfully",
        data: dumpRegister,
      });
    } catch (err) {
      logger.error("Error occurred while updating dump register", { dumpRegisterId: id, error: err });
      next(err);
    }
  }

  @httpDelete("/:id")
  public async deleteDumpRegister(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Deleting dump register", { dumpRegisterId: id });
      const result = await this.dumpRegisterService.deleteDumpRegister(id);
      if (!result) {
        return next(new AppError(404, "Dump register not found or could not be deleted"));
      }

      logger.info("Dump register deleted successfully", { dumpRegisterId: id });
      res.status(204).send();
    } catch (err) {
      logger.error("Error occurred while deleting dump register", { dumpRegisterId: id, error: err });
      next(err);
    }
  }

  @httpGet("/getDump/quantityandcost")
  public async getDumpRegisterQty(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching all dump registers quantity");
      const dumpRegisterQty = await this.dumpRegisterService.totaldumpquantity();
      const dumpregisterAmt = await this.dumpRegisterService.totaldumpcost()
      if (!dumpRegisterQty) {
        return next(new AppError(404, "No dump registers found"));
      }
const number1 = parseInt(dumpRegisterQty.toString())
      logger.info("Dump registers quantity retrieved successfully");
      res.status(200).json({
        status: "success",
        data: {
          totalDumpQuantity: number1,
          totalDumpAmount: dumpregisterAmt
        },
      });
    } catch (err) {
      logger.error("Error occurred while fetching all dump registers quantity", { error: err });
      next(err);
    }
  }

  
  @httpGet("/getDump/all/count")
  public async getDumpRegisterCount(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching all dump registers count");
      const dumpRegister = await this.dumpRegisterService.dumpcount();
      if (!dumpRegister) {
        return next(new AppError(404, "No dump registers found"));
      }

      logger.info("Dump registers count retrieved successfully");
      res.status(200).json({
        status: "success",
        data: dumpRegister,
      });
    } catch (err) {
      logger.error("Error occurred while fetching all dump registers count", { error: err });
      next(err);
    }
  }

  @httpGet("/getDump/:startdate/and/:enddate")
  public async getDumpRegisterByDate(
    @requestParam("startdate") startdate: string,
    @requestParam("enddate") enddate: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching all dump registers by date");
      const startDateObj = new Date(startdate);
      const endDateObj = new Date(enddate);
      console.log(startDateObj);
      console.log(endDateObj);
      const dumpRegister = await this.dumpRegisterService.totalqunatityandtotaldumpcostfromstartdatetoenddate(startDateObj, endDateObj);
      if (!dumpRegister) {
        return next(new AppError(404, "No dump registers found"));
      }

      logger.info("Dump registers by date retrieved successfully");
      res.status(200).json({
        status: "success",
        data: dumpRegister,
      });
    } catch (err) {
      logger.error("Error occurred while fetching all dump registers by date", { error: err });
      next(err);
    }
  }

  @httpGet("/getDump/location/:location")
  public async getDumpRegisterByLocation(
    @requestParam("location") location: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching all dump registers by location");
      const dumpRegister = await this.dumpRegisterService.getDumpRegisterlocation(location);
      if (!dumpRegister) {
        return next(new AppError(404, "No dump registers found"));
      }

      logger.info("Dump registers by location retrieved successfully");
      res.status(200).json({
        status: "success",
        data: dumpRegister,
      });
    } catch (err) {
      logger.error("Error occurred while fetching all dump registers by location", { error: err });
      next(err);
    }
  
  }

  @httpGet("/getDump/companyName/:companyName")
  public async getDumpRegisterByCompanyName(
    @requestParam("companyName") location: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching all dump registers by location");
      const dumpRegister = await this.dumpRegisterService.getDumpRegisterByCompanyName(location);
      if (!dumpRegister) {
        return next(new AppError(404, "No dump registers found"));
      }

      logger.info("Dump registers by location retrieved successfully");
      res.status(200).json({
        status: "success",
        data: dumpRegister,
      });
    } catch (err) {
      logger.error("Error occurred while fetching all dump registers by location", { error: err });
      next(err);
    }
  }

  @httpGet("/calculations/dates")
  public async getDumpData(
    @request() req: Request,
     @response() res: Response,
      @next() next: NextFunction) {
    try {
      const { filterType, startDate, endDate } = req.query;
 
      const data = await this.dumpRegisterService.getDumpDataForDates(
        filterType as string |undefined ,
        startDate as string|undefined ,
        endDate as string|undefined
      );
      const overallTotal =data.reduce(
        (acc, row) => {
          acc.quantity += Number(row.quantity);
          acc.amount += Number(row.amount);
          return acc;
        },
        {  quantity: 0, amount: 0 }
      );
      console.log(overallTotal)
      res.status(200).json({
        message: "Dump calculations fetched successfully.",
        data:overallTotal,
      }) 
    } catch (err) {
      logger.error("Error occurred while fetching dump data", { error: err });
      console.log(err)
      next(err);
    }
  }

  @httpDelete("/delete/multiple/dumpRegisters")
  public async deleteMultipleDumpRegisters(
    @request() req: Request<{}, {}, { ids: string[] }>,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return next(new AppError(400, "Invalid request. 'ids' must be a non-empty array."));
      }
      const result = await this.dumpRegisterService.deleteMultipleDumpRegisters(ids);
      res.status(200).json({
        message: result.message,
        success: result.success,
        failed: result.failed,
      });
    } catch (error) {
      logger.error("Error deleting multiple dump registers", { error });
      next(error);
    }
  }

  }
  


