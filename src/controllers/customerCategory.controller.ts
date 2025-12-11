import { Request, Response, NextFunction } from "express";
import {
  controller,
  httpGet,
  httpPost,
  
  httpDelete,
  requestBody,
  requestParam,
  response,
  request,
  next,
  httpPatch,
} from "inversify-express-utils";
import { inject } from "inversify";
import { TYPES } from "../types";
import { CustomerCategoryService } from "../services/customerCategory.service";
import AppError from "../utils/appError"; // Assuming you have a custom error class
import { CustomerCategory } from "../entities/customerCategory.entity";

import { captureUser, deserializeUser, requireUser } from "../middleware/deserializeUser";

import { PaginationOptions } from "../utils/pagination";
import { ControllerLogger } from "../utils/controllerLogger";

@controller("/customerCategory",deserializeUser,requireUser)
export class CustomerCategoryController {
  constructor(
    @inject(TYPES.CustomerCategoryService)
    private customerCategoryService: CustomerCategoryService
  ) {}

  @httpGet("/")
  public async getAll(
    @request() req: Request,
    @response() res: Response, 
    @next() next: NextFunction) {
    try {
      const { page, limit, search, sort } = req.query;
                
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,  
        limit: limit ? Number(limit) : undefined,
        filters: {},
        sort: sort as string || undefined,
        search: search as string|| '',
      };
      
      const categories = await this.customerCategoryService.getAll(queryOptions);
      
      if (!categories || !categories.data || categories.data.length === 0) {
        return res.status(200).json({
          status: "success",
          data: [],
          allRecords: 0,
          totalPages: 0,
          page: queryOptions.page || 1,
        });
      }
      
      // Log successful retrieval with specific message
      ControllerLogger.logGetAllRecords('Customer Category', req, res);
      
      res.status(200).json({
        status: "success",
        data: categories.data,
        allRecords: categories.meta.total,
        totalPages: categories.meta.pages,     
        page: categories.meta.page,
      });
    } catch (err) {
      ControllerLogger.logError('Customer Category retrieval', err, req, res);
      next(err);
    }
  }

  @httpGet("/:id")
  public async getById(
    @requestParam("id") id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const category = await this.customerCategoryService.getById(id);
      
      if (!category) {
        ControllerLogger.logNotFound('Customer Category', id, req, res);
        return next(new AppError(404, "Customer category not found"));
      }
      
      // Log successful view
      ControllerLogger.logView('Customer Category', id, req, res);
      
      res.status(200).json({
        status: "success",
        data: category,
      });
    } catch (err) {
      ControllerLogger.logError('Customer Category view', err, req, res);
      next(err);
    }
  }

  @httpPost("/")
  public async create(
    @requestBody() categoryData: Partial<CustomerCategory>,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const category = await this.customerCategoryService.create(categoryData);
      
      if (!category) {
        ControllerLogger.logOperationFailed('Create', 'Customer Category', 'could not be created', req, res);
        return res.status(400).json({
          status: "error",
          message: "Customer Category could not be created",
        });
      }
      
      // Log successful creation
      ControllerLogger.logSuccess('Customer Category created', (category as any)?.id || 'unknown', req, res);
      
      res.status(201).json({
        status: "success",
        message: "Customer Category created successfully",
      });
    } catch (err) {
      ControllerLogger.logError('Customer Category creation', err, req, res);
      next(err);
    }
  }

  @httpPatch("/:id",captureUser)
  public async update(
    @requestParam("id") id: string,
    @requestBody() categoryData: Partial<CustomerCategory>,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const updatedBy = res.locals.updatedBy;
      const category = await this.customerCategoryService.update(
        id,
        categoryData,
        updatedBy
      );
      
      if (!category) {
        ControllerLogger.logOperationFailed('Update', 'Customer Category', 'not found or could not be updated', req, res);
        return next(
          new AppError(404, "Customer category not found or update failed")
        );
      }
      
      // Log successful update
      ControllerLogger.logSuccess('Customer Category updated', id, req, res);
      
      res.status(200).json({
        status: "success",
        message: "Customer Category updated successfully",
      });
    } catch (err) {
      ControllerLogger.logError('Customer Category update', err, req, res);
      next(err);
    }
  }

  @httpDelete("/:id")
  public async delete(
    @requestParam("id") id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const success = await this.customerCategoryService.deleteCustomerCategory(id);
      
      if (!success) {
        ControllerLogger.logOperationFailed('Delete', 'Customer Category', 'not found or could not be deleted', req, res);
        return res.status(404).json({ message: 'Customer Category not found' });
      }
      
      // Log successful deletion
      ControllerLogger.logSuccess('Customer Category deleted', id, req, res);
     
      res.status(200).json({
        status: "success",
        message: "Customer Category deleted successfully",
      });
    } catch (err) {
      ControllerLogger.logError('Customer Category deletion', err, req, res);
      next(err);
    }
  }
}
