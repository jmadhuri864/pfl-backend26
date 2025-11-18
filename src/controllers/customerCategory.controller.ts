import { Request, Response, NextFunction } from "express";
import {
  controller,
  httpGet,
  httpPost,
  httpPut,
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
import { uploadNone } from "../middleware/multerConfig";
import { captureUser, deserializeUser, requireUser } from "../middleware/deserializeUser";
import logger from "../utils/logger";
import { PaginationOptions } from "../utils/pagination";

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
      logger.info("Fetching all customer categories");
       const { page, limit, search, sort,customerCategoryId} = req.query;
                
            
            const queryOptions: PaginationOptions = {
              page: page ? Number(page) : undefined,  
              limit: limit ? Number(limit) : undefined,
             // searchFields: ['customerCategory.id'],
              filters: {},
              sort: sort as string || undefined, // Adjust this line to match your sorting requirements
              search: search as string|| '',
            };
      const categories = await this.customerCategoryService.getAll(queryOptions);
      if (!categories.data.length) {
        logger.warn("No customer categories found");
        return next(new AppError(404, "No customer categories found"));
      }
      logger.info("Fetched all customer categories", { count: categories.data.length });
      res.status(200).json({
        status: "success",
        data: categories.data,
        allRecords:  categories.meta.total,
        totalPages:  categories.meta.pages,     
        page:  categories.meta.page,
      });
    } catch (err) {
      logger.error("Error fetching customer categories", { error: err });
      next(err);
    }
  }

  @httpGet("/:id")
  public async getById(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching customer category by ID", { id });
      const category = await this.customerCategoryService.getById(id);
      if (!category) {
        logger.warn("Customer category not found", { id });
        return next(new AppError(404, "Customer category not found"));
      }
      logger.info("Fetched customer category by ID", { id });
      res.status(200).json({
        status: "success",
        data: category,
      });
    } catch (err) {
      logger.error("Error fetching customer category by ID", { id, error: err });
      next(err);
    }
  }

  @httpPost("/")
  public async create(
    @requestBody() categoryData: Partial<CustomerCategory>,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Creating a new customer category")
      const category = await this.customerCategoryService.create(categoryData);
      logger.info("Created new customer category");
      res.status(201).json({
        status: "success",
        //data: category,
        message: "Customer Category created successfully",
      });
    } catch (err) {
      logger.error("Error creating customer category", {  error: err });
      next(err);
    }
  }

  @httpPatch("/:id",captureUser)
  public async update(
    @requestParam("id") id: string,
    @requestBody() categoryData: Partial<CustomerCategory>,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("updating customer category")
      const updatedBy=res.locals.updatedBy
      const category = await this.customerCategoryService.update(
        id,
        categoryData,
        updatedBy
      );
      if (!category) {
        logger.warn("Customer category not found or update failed", { id });
        return next(
          new AppError(404, "Customer category not found or update failed")
        );
      }
      logger.info("Updated customer category");
      res.status(200).json({
        status: "success",
        // data: category,
        message: "Customer Category updated successfully",
      });
    } catch (err) {
      logger.error("Error updating customer category", {  error: err });
      next(err);
    }
  }

  @httpDelete("/:id")
  public async delete(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("deleting the customer category")
      const success = await this.customerCategoryService.deleteCustomerCategory(id)
      if (!success) {
        logger.warn("Customer Category not found for delete", { id });
        return res.status(404).json({ message: 'Customer Category not found' });
      }
      logger.info("Deleted customer category", { id });
      res.status(200).json({
        status: "success",
        message: "Customer Category deleted successfully",
      });
    } catch (err) {
      logger.error("Error deleting customer category", { id, error: err });
      next(err);
    }
  }
}
