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
import { ControllerLogger } from "../utils/controllerLogger";
import { captureUser, deserializeUser, requireUser } from "../middleware/deserializeUser";
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
      const { page, limit, search, sort } = req.query;
      
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,  
        limit: limit ? Number(limit) : undefined,
        filters: {},
        sort: sort as string || undefined,
        search: search as string|| '',
      };
      
      const customerTypes =
        await this.customerTypeService.getAllCustomerTypes(queryOptions);
      if (!customerTypes.data.length) {
        ControllerLogger.logOperationFailed('Get All', 'Customer Types', 'No records found', req, res);
        return next(new AppError(204, "No customer types found"));
      }
     
      ControllerLogger.logGetAllRecords('Customer Types', req, res);
      res.status(200).json({
        status: "success",
        data: customerTypes.data,
        allRecords:  customerTypes.meta.total,
        totalPages:  customerTypes.meta.pages,
        page:  customerTypes.meta.page,
      });
    } catch (err) {
      ControllerLogger.logError('Get All Customer Types', err, req, res);
      next(err);
    }
  }

  @httpGet("/:id")
  public async getCustomerTypeById(
    @requestParam("id") id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const customerType = await this.customerTypeService.getCustomerTypeById(id);
      
      if (!customerType) {
        ControllerLogger.logNotFound('Customer Type', id, req, res);
        return next(new AppError(404, "Customer type not found"));
      }
     
      ControllerLogger.logView('Customer Type', id, req, res);
      res.status(200).json({
        status: "success",
        data: customerType,
      });
    } catch (err) {
      ControllerLogger.logError('Get Customer Type by ID', err, req, res);
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
     
      if (!name || typeof name !== 'string' || name.trim() === '') {
        ControllerLogger.logValidationError('Create Customer Type', 'Name is required and must be a non-empty string', req, res);
        return next(new AppError(400, "Customer type 'name' is required and must be a non-empty string"));
      }
      
      const customerType = await this.customerTypeService.createCustomerType(name);

      ControllerLogger.logSuccess('Customer Type created', customerType.id, req, res);
      res.status(201).json({
        status: "success",
        message: "Customer type created successfully",
      });
    } catch (err) {
      ControllerLogger.logError('Create Customer Type', err, req, res);
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
     
      const updatedCustomerType =
        await this.customerTypeService.updateCustomerType(id, name, updatedBy);
      
      if (!updatedCustomerType) {
        ControllerLogger.logNotFound('Customer Type', id, req, res);
        return next(
          new AppError(404, "Customer type not found or update failed")
        );
      }

      ControllerLogger.logSuccess('Customer Type updated', id, req, res);
      res.status(200).json({
        status: "success",
        message: "Customer type updated successfully",
      });
    } catch (err) {
      ControllerLogger.logError('Update Customer Type', err, req, res);
      next(err);
    }
  }

  @httpDelete("/:id")
  public async deleteCustomerType(
    @requestParam("id") id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) 
  {
    try {
      const success = await this.customerTypeService.deleteCustomerType(id);
      
      if (!success) {
        ControllerLogger.logNotFound('Customer Type', id, req, res);
        return res.status(404).json({ message: 'Customer Type not found' });
      }
    
      ControllerLogger.logSuccess('Customer Type deleted', id, req, res);
      res.status(200).json({
        status: "success",
        message: "Customer Type deleted successfully",
      });
      
    } catch (err) {
      ControllerLogger.logError('Delete Customer Type', err, req, res);
      next(err);
    }
  }
}
