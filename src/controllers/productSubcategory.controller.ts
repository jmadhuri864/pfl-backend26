import { inject } from "inversify";
import {
  controller,
  httpDelete,
  httpGet,
  httpPost,
  httpPut,
  requestBody,
  requestParam,
  response,
  next,
  httpPatch,
  request,
  all,
} from "inversify-express-utils";

import { TYPES } from "../types";
import AppError from "../utils/appError";
import { NextFunction, Response,Request } from "express";
import { ProductSubcategoryService } from "../services/product_subcategory";
import { uploadNone } from "../middleware/multerConfig";
import { captureUser, deserializeUser, requireUser } from "../middleware/deserializeUser";
import logger from "../utils/logger";
import { PaginationOptions } from "../utils/pagination";

@controller("/productSubcategory",deserializeUser,requireUser)
export class ProductSubcategoryController {
  constructor(
    @inject(TYPES.ProductSubcategoryService)
    private productSubcategoryService: ProductSubcategoryService
  ) {}

  @httpGet("/")
  public async getAll(
    @request() req:Request,
    @response() res: Response, @next() next: NextFunction) {
    try {
      const { page, limit, search, sort,name} = req.query;
                            
                        
                              const queryOptions: PaginationOptions = {
                                page: page ? Number(page) : undefined,  
                limit: limit ? Number(limit) : undefined,
                                searchFields: ['subCategory.name'],
                                filters: {},
                                sort: sort as string || undefined, // Adjust this line to match your sorting requirements
                                search: search as string|| '',
                              };
      const subcategories = await this.productSubcategoryService.getAll(queryOptions);
      console.log()
      if (!subcategories.data.length) {
        return next(new AppError(404, "No product subcategories found"));
      }
      res.status(200).json({ status: "success",
         data: subcategories.data,
        allRecords: subcategories.meta.total,
        totalPages: subcategories.meta.pages,
        page: subcategories.meta.page, });
    } catch (err) {
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
      const subcategory = await this.productSubcategoryService.getById(id);
      if (!subcategory) {
        return next(new AppError(404, "Product subcategory not found"));
      }
      res.status(200).json({ status: "success", data: subcategory });
    } catch (err) {
      next(err);
    }
  }

  @httpPost("/")
  public async create(
    @requestBody() subcategoryData: { name: string; category: string },
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const { name, category } = subcategoryData;
      const subcategory = await this.productSubcategoryService.create(
        name,
        category
      );
      res.status(201).json({
        status: "success",
        message: "Product subcategory created successfully",
        //data: subcategory,
      });
    } catch (err) {
      next(err);
    }
  }

  @httpPatch("/:id",captureUser)
  public async update(
    @requestParam("id") id: string,
    @requestBody() subcategoryData: any,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const updatedBy=res.locals.updatedBy
      console.log(subcategoryData)
      const subcategory = await this.productSubcategoryService.update(
        id,
        subcategoryData,
        updatedBy
      );
      if (!subcategory) {
        return next(
          new AppError(404, "Product subcategory not found or update failed")
        );
      }
      res.status(200).json({
        status: "success",
        message: "Product subcategory updated successfully",
        //data: subcategory,
      });
    } catch (err) {
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
      logger.info(`Deleting voucher with ID: ${id}`);
      const success = await this.productSubcategoryService.delete(id);
      if (success) {
        res.status(200).json({
          status: "success",
          message: "Product subcategory deleted successfully",
        });
      } else {
        return next(new AppError(404, "Product subcategory not found"));
      }
    } catch (err) {
      next(err);
    }
  }
}
