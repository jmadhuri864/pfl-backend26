import { Request, Response, NextFunction } from "express";
import {
  controller,
  httpGet,
  httpPost,
  httpPatch,
  httpDelete,
  request,
  response,
  requestParam,
  next,
} from "inversify-express-utils";
import { inject } from "inversify";
import { TYPES } from "../types";
import { CustomerTypeService } from "../services/customerType.service";
import AppError from "../utils/appError";
import { uploadNone } from "../middleware/multerConfig";
import { captureUser, deserializeUser, requireUser } from "../middleware/deserializeUser";
import logger from "../utils/logger";
import { PaginationOptions } from "../utils/pagination";

@controller("/customerType",deserializeUser,requireUser)
export class CustomerTypeController {
  constructor(
    @inject(TYPES.CustomerTypeService)
    private customerTypeService: CustomerTypeService
  ) {}

  @httpGet("/")
  public async getAllCustomerTypes(
    @request() req:Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const { page, limit, search, sort,customerTypeId} = req.query;
          
      
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,  
        limit: limit ? Number(limit) : undefined,
        //searchFields: ['customerType.id'],
        filters: {},
        sort: sort as string || undefined, // Adjust this line to match your sorting requirements
        search: search as string|| '',
      };
      logger.info("Fetching all customer types");
      const customerTypes =
        await this.customerTypeService.getAllCustomerTypes(queryOptions);
      if (!customerTypes.data.length) {
        logger.warn("No customer types found");
        return next(new AppError(204, "No customer types found"));
      }
      logger.info("Fetched all customer types", { count: customerTypes.length });
      res.status(200).json({
        status: "success",
        data: customerTypes.data,
        allRecords:  customerTypes.meta.total,
        totalPages:  customerTypes.meta.pages,
        page:  customerTypes.meta.page,
      });
    } catch (err) {
      logger.error("Error fetching customer types", { error: err });
      next(err);
    }
  }

  @httpGet("/:id")
  public async getCustomerTypeById(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching customer type by ID", { id });
      const customerType = await this.customerTypeService.getCustomerTypeById(
        id
      );
      if (!customerType) {
        logger.warn("Customer type not found", { id });
        return next(new AppError(404, "Customer type not found"));
      }
      logger.info("Fetched customer type by ID", { id });
      res.status(200).json({
        status: "success",
        data: customerType,
      });
    } catch (err) {
      logger.error("Error fetching customer type by ID", { id, error: err });
      next(err);
    }
  }

  @httpPost("/")
  public async createCustomerType(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const { name } = req.body;
      logger.info("Creating a new customer type", { name });
      // Validate that 'name' is present
    if (!name || typeof name !== 'string' || name.trim() === '') {
      logger.warn("Invalid customer type 'name'", { name })
      return next(new AppError(400, "Customer type 'name' is required and must be a non-empty string"));
    }
      const customerType = await this.customerTypeService.createCustomerType(
        name
      );

      logger.info("Created new customer type", { name });
      res.status(201).json({
        status: "success",
        //data: customerType,
        message: "Customer type created successfully",
      });
    } catch (err) {
      logger.error("Error creating customer type", { error: err });
      next(err);
    }
  }

  @httpPatch("/:id",captureUser)
  public async updateCustomerType(
    @requestParam("id") id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) 
  {
    try {
      const updatedBy=res.locals.updatedBy;
      const { name } = req.body;
      logger.info("Updating customer type");
      const updatedCustomerType =
        await this.customerTypeService.updateCustomerType(id, name, updatedBy);
      if (!updatedCustomerType) {
        logger.warn("Customer type not found or update failed", { id });
        return next(
          new AppError(404, "Customer type not found or update failed")
        );
      } logger.info("Updated customer type", { id });

      res.status(200).json({
        status: "success",
        //data: updatedCustomerType,
        message: "Customer type updated successfully",
      });
    } catch (err) {
      logger.error("Error updating customer type", { id, error: err });
      next(err);
    }
  }

  @httpDelete("/:id")
  public async deleteCustomerType(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) 
  {
    try {
      logger.info("Deleting customer type", { id });
      const success = await this.customerTypeService.deleteCustomerType(id);
      if (!success) {
        logger.warn("Customer Type not found for delete", { id });
        return res.status(404).json({ message: 'Customer Type not found' });
      }
      logger.info("Deleted customer type", { id });
      res.status(200).json({
        status: "success",
        message: "Customer Type deleted successfully",
      });
      
    } catch (err) {
      logger.error("Error deleting customer type", { id, error: err });
      next(err);
    }
  }
}



