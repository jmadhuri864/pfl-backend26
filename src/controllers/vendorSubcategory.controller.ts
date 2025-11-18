import { Request, Response, NextFunction } from "express";
import {
  controller,
  httpGet,
  httpPost,
  httpPut,
  httpDelete,
  request,
  response,
  requestBody,
  requestParam,
  next,
  httpPatch,
} from "inversify-express-utils";
import { inject } from "inversify";

import AppError from "../utils/appError";
import { VendorSubcategoryService } from "../services/vendorSubcategory.service";

import { TYPES } from "../types";
import { uploadAny, uploadNone } from "../middleware/multerConfig";
import logger from "../utils/logger";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import { PaginationOptions } from "../utils/pagination";

@controller("/vendor-subcategories", deserializeUser, requireUser)
export class VendorSubcategoryController {
  constructor(
    @inject(TYPES.VendorSubcategoryService)
    private subcategoryService: VendorSubcategoryService
  ) {}

  @httpPost("/")
public async createSubcategory(
  @request() req: Request,
  @response() res: Response,
  @next() next: NextFunction
) {
  try {
    const subcategoryData = req.body; // Ensure subcategoryData is extracted
    console.log("to create the category ", subcategoryData);

    const subcategory = await this.subcategoryService.create(subcategoryData);
if(!subcategory) {
    return next(new AppError(400, "Subcategory not created"));
  }

    res.status(201).json({
      status: "success",
      message: `Vendor subcategory created successfully`,
    });
  } catch (err) {
    next(err);
  }
}


  @httpGet("/")
public async getAllSubcategories(
  @request() req: Request,
  @response() res: Response,
  @next() next: NextFunction
) {
  try {
    const { page, limit, search, sort,subcategoryId} = req.query;
          
      
    const queryOptions: PaginationOptions = {
      page: page ? Number(page) : undefined,  
      limit: limit ? Number(limit) : undefined,
      searchFields: ['subCategory.name'],
      filters: {},
      sort: sort as string || undefined, // Adjust this line to match your sorting requirements
      search: search as string|| '',
    };
    const subcategories = await this.subcategoryService.getByall(queryOptions);

    if (!subcategories || subcategories.data.length === 0) {
      return next(new AppError(404, "Subcategories not found"));
    }

    res.status(200).json({
      status: "success",
      data: subcategories.data,
      allRecords:  subcategories.meta.total,
        totalPages:  subcategories.meta.pages,
        page:  subcategories.meta.page,
     
    });
  } catch (err) {
    next(err);
  }
}

@httpGet("/getSubcategories")
public async getAllSubcategories1(
  @request() req: Request,
  @response() res: Response,
  @next() next: NextFunction
) {
  try {
    
     const categoryId = req.query.search as string; // Get categoryId from query
    // console.log("category id",categoryId)
    const subcategories = await this.subcategoryService.getSubcategories(categoryId);
    console.log("subcategories",subcategories)
    // if (!subcategories || subcategories.length === 0) {
    //   return next(new AppError(404, "Subcategories not found"));
    // }

    res.status(200).json({
      status: "success",
      data: subcategories,
    });
  } catch (err) {
    next(err);
  }
}

  @httpGet("/:id")
  public async getSubcategoryById(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const subcategory = await this.subcategoryService.getById(id);
      if (!subcategory) {
        return next(new AppError(404, "Subcategory not found"));
      }
      res.status(200).json({
        status: "success",
        data: subcategory,
      });
    } catch (err) {
      next(err);
    }
  }

  @httpPatch("/:id")
  public async updateSubcategory(
    @requestParam("id") id: string,
    @requestBody() body: { name?: string; category?: string },
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      //console.log(id)
      console.log(body)
      const updateBy=res.locals.user.id;
      //console.log(updateBy)

      const updatedSubcategory = await this.subcategoryService.update(id, body,updateBy);
      if (!updatedSubcategory) {
        return next(new AppError(404, "Subcategory not found"));
      }
      res.status(200).json({
        status: "success",
        //data: updatedSubcategory,
        message: `Vendor subcategory updated successfully`,
      });
    } catch (err) {
      next(err);
    }
  }

  @httpDelete("/:id")
  public async deleteSubcategory(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      if (!id) {
        logger.warn("User ID not provided");
        return next(new AppError(400, "User ID is required"));
      }
      const success = await this.subcategoryService.delete(id);
      if (!success) {
        return next(new AppError(404, "Subcategory not found"));
      }
      res.status(200).json({
        status: "success",
        message: `Vendor subcategory deleted successfully`,
      });
    } catch (err) {
      next(err);
    }
  }
}
