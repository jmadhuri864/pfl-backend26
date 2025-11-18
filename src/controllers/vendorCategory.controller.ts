import { Request, Response, NextFunction } from "express";
import {
  controller,
  httpGet,
  httpPost,

  httpDelete,

  response,
  requestBody,
  requestParam,
  next,
  httpPatch,
  request,
} from "inversify-express-utils";
import { inject } from "inversify";
import { VendorCategoryService } from "../services/vendorCategory.service";
import { VendorCategory } from "../entities/vendorCategory.entity";
import AppError from "../utils/appError";
import { TYPES } from "../types";
import { uploadAny, uploadNone } from "../middleware/multerConfig";
import logger from "../utils/logger";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import { validate } from "../middleware/validate";
import { createVendorCategorySchema, deleteVendorCategorySchema, getAllVendorCategoriesSchema, getVendorCategoryByIdSchema, updateVendorCategorySchema } from "../schemas/vendorCategory.schema";
import { PaginationOptions } from "../utils/pagination";


@controller("/vendor-categories", deserializeUser, requireUser)
export class VendorCategoryController {
  constructor(
    @inject(TYPES.VendorCategoryService)
    private vendorCategoryService: VendorCategoryService
  ) {}

  @httpPost("/", validate(createVendorCategorySchema))
  public async createCategory(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const { name } = req.body; // `name` should now be correctly set
      console.log("In the controller:", name);
  
      if (!name) {
        return next(new AppError(400, "Category name is required"));
      }
  
      const category = await this.vendorCategoryService.create({ name });
  
      if (!category) {
        return next(new AppError(400, "Category not created"));
      }
  
      res.status(201).json({
        status: "success",
        message: `Vendor category created successfully`,
        data: category,
      });
    } catch (err) {
      console.log(err);
      next(err);
    }
  }
  
  @httpGet("/",validate(getAllVendorCategoriesSchema))
  public async getCategories(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
       const { page, limit, search, sort,categoryId} = req.query;
                
            
                  const queryOptions: PaginationOptions = {
                    page: page ? Number(page) : undefined,  
                    limit: limit ? Number(limit) : undefined,
                    searchFields: ['category.name'],
                    filters: {},
                    sort: sort as string || undefined, // Adjust this line to match your sorting requirements
                    search: search as string|| '',
                  };
      const categories = await this.vendorCategoryService.getCategories(queryOptions);
      if (!categories.data.length) {
        return next(new AppError(404, "No categories found"));
      }

      res.status(200).json({
        status: "success",
        data: categories.data,
        allRecords: categories.meta.total,
        totalPages: categories.meta.pages,
        page: categories.meta.page,
      });
    } catch (err) {
      next(err);
    }
  }

  @httpGet("/:id",validate(getVendorCategoryByIdSchema))
  public async getCategoryById(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const category = await this.vendorCategoryService.getById(id);
      if (!category) {
        return next(new AppError(404, "Category not found"));
      }

      res.status(200).json({
        status: "success",
        data: category,
      });
    } catch (err) {
      next(err);
    }
  }

  @httpPatch("/:id", validate(updateVendorCategorySchema))
public async updateCategory(
  @requestParam("id") id: string,
  @request() req: Request,
  @response() res: Response,
  @next() next: NextFunction
) {
  try {
    const updateBy = res.locals.user?.id; // Ensure you extract the user ID from the locals

    console.log("Update Request Body:", req.body); // Log request body

    const updatedCategory = await this.vendorCategoryService.update(
      id,
      req.body,
      updateBy
    );

    if (!updatedCategory) {
      return next(new AppError(404, "Category not found or update failed"));
    }

    res.status(200).json({
      status: "success",
      message: "Vendor category updated successfully",
    });
  } catch (err) {
    next(err);
  }
}


  @httpDelete("/:id",validate(deleteVendorCategorySchema))
  public async deleteCategory(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      if (!id) {
        logger.warn("Vendor Category ID not provided");
        return next(new AppError(400, "Vendor Category ID is required"));
      }
      const success = await this.vendorCategoryService.delete(id);
      if (!success) {
        return next(new AppError(404, "Vendor Category not found"));
      }
      res.status(200).json({
        status: "success",
        message: `Vendor category  deleted successfully`,
      });
    } catch (err) {
      next(err);
    }
  }
}
