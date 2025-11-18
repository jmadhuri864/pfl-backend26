import { inject } from "inversify";
import {
  controller,
  httpDelete,
  httpGet,
  httpPost,
  httpPatch,
  request,
  requestParam,
  requestBody,
  response,
  next,
} from "inversify-express-utils";
import { TYPES } from "../types";
import AppError from "../utils/appError";
import { NextFunction, Response, Request } from "express";
import { ProductCategoryService } from "../services/product_category.service";
import { captureUser, deserializeUser, requireUser } from "../middleware/deserializeUser";
import { uploadNone } from "../middleware/multerConfig";
import logger from "../utils/logger";
import { PaginationOptions } from "../utils/pagination";

@controller("/productCategory", deserializeUser, requireUser)
export class ProductCategoryController {
  constructor(
    @inject(TYPES.ProductCategoryService)
    private productCategoryService: ProductCategoryService
  ) {}

  // Get all product categories
  @httpGet("/")
  public async getAll(
    @request() req:Request,
    @response() res: Response, @next() next: NextFunction) {
    try {
      console.log("Fetching all product categories")
      logger.info("Fetching all product categories");

      const { page, limit, search, sort,name} = req.query;
                      
                  
                        const queryOptions: PaginationOptions = {
                          page: page ? Number(page) : undefined,  
                          limit: limit ? Number(limit) : undefined,
                          searchFields: ['category.name'],
                          filters: {},
                          sort: sort as string || undefined, // Adjust this line to match your sorting requirements
                          search: search as string|| '',
                        };
      console.log(res.locals.id)
      const categories = await this.productCategoryService.getAll(queryOptions);
      if (!categories.data.length) {
        logger.warn("No product categories found");
        return next(new AppError(404, "No product categories found"));
      }
      logger.info("Successfully fetched product categories", { count: categories.length });
      res.status(200).json({ status: "success",
         data: categories.data ,
         allRecords: categories.meta.total,
         totalPages: categories.meta.pages,
         page: categories.meta.page,
        });
    } catch (err) {
      logger.error("Error fetching product categories", { error: err });
      console.log(err)
      next(err);
    }
  }

  // Get product category by ID
  @httpGet("/:id")
  public async getById(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching product category by ID", { id });
      const category = await this.productCategoryService.getById(id);
      if (!category) {
        logger.warn("Product category not found", { id });
        return next(new AppError(404, "Product category not found"));
      }
      logger.info("Successfully fetched product category", { id });
      res.status(200).json({ status: "success", data: category });
    } catch (err) {
      logger.error("Error fetching product category by ID", {  error: err });
      next(err);
    }
  }

  // Create a new product category
  @httpPost("/")
  public async create(
   @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {  logger.info("Creating a new product category");
    try {
      console.log(req.body)
      const category = await this.productCategoryService.create(req.body);
      logger.info("Product category created successfully", { category });
      res.status(201).json({
        status: "success",
        message: "Product category created successfully",
        data: category,
      });
    } catch (err) {
      logger.error("Error creating product category", { error: err});
      next(err);
    }
  }

  // Update product category by ID
  @httpPatch("/:id",captureUser)
  public async update(
    @requestParam("id") id: string,
    @requestBody() categoryData: any,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    logger.info("Updating product category");
    try {
      const updatedBy=res.locals.updatedBy
      console.log(categoryData)
      const category = await this.productCategoryService.update(id, categoryData,updatedBy);
      if (!category) {
        logger.warn("Product category not found or update failed", { id });
        return next(new AppError(404, "Product category not found or update failed"));
      }
      logger.info("Product category updated successfully", { id });
      res.status(200).json({
        status: "success",
        message: "Product category updated successfully",
        data: category,
      });
    } catch (err) {
      logger.error("Error updating product category", { id, error: err });
      next(err);
    }
  }

  // Delete product category by ID
  @httpDelete("/:id")
  public async delete(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {logger.info("Deleting product category", { id });
    try {
      const success = await this.productCategoryService.delete(id);
      if (!success) {
        logger.info("Product category deleted successfully", { id });
        res.status(200).json({
          status: "success",
          message: "Product category deleted successfully",
        });
      } else {
        logger.warn("Product category not found", { id });
        return next(new AppError(404, "Product category not found"));
      }
    } catch (err) {
      logger.error("Error deleting product category", { id, error: err });
      next(err);
    }
  }
}
