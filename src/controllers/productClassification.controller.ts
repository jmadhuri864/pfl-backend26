import { Request, Response, NextFunction } from "express";
import { inject } from "inversify";
import { TYPES } from "../types";
import { ProductClassificationService } from "../services/product_classification.service";
import { ProductClassification } from "../entities/product_classification.entity";
import AppError from "../utils/appError";
import { controller, httpGet, httpPost, httpPatch, httpDelete, request, response, requestParam, requestBody, next } from "inversify-express-utils";
import { captureUser, deserializeUser, requireUser } from "../middleware/deserializeUser";
import { uploadNone } from "../middleware/multerConfig";
import { PaginationOptions } from "../utils/pagination";

@controller("/productClassification", deserializeUser, requireUser)
export class ProductClassificationController {
  constructor(
    @inject(TYPES.ProductClassificationService) 
    private productClassificationService: ProductClassificationService
  ) {}

  @httpGet("/")
  public async findAll(
    @request() req:Request,
    @response() res: Response,
    @next() next: NextFunction
  ): Promise<void> {
    try {
      const { page, limit, search, sort,name} = req.query;
                
            
                  const queryOptions: PaginationOptions = {
                    page: page ? Number(page) : undefined,  
                    limit: limit ? Number(limit) : undefined,
                    searchFields: ['product.name'],
                    filters: {},
                    sort: sort as string || undefined, // Adjust this line to match your sorting requirements
                    search: search as string|| '',
                  };
      const classifications = await this.productClassificationService.findAll(queryOptions);
      //console.log(classifications)
      if (!classifications.data.length) {
        return next(new AppError(404, "No classifications found"));
      }
      res.status(200).json({
        status: "success",
        data: classifications.data,
        allRecords:classifications.meta.total,
        totalPages:classifications.meta.pages,
        page:classifications.meta.page,
      });
    } catch (error) {
      console.log(error);
      next(new AppError(500, "Error fetching classifications"));
    }
  }

  @httpGet("/:id")
  public async findById(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ): Promise<void> {
    try {
      const classification = await this.productClassificationService.findById(id);
      if (!classification) {
        return next(new AppError(404, "Classification not found"));
      }
      res.status(200).json({
        status: "success",
        data: classification,
      });
    } catch (error) {
      next(new AppError(500, "Error fetching classification"));
    }
  }

  @httpPost("/")
  public async create(
    @requestBody() classificationData: Partial<ProductClassification>,
    @response() res: Response,
    @next() next: NextFunction
  ): Promise<void> {
    try {
      const newClassification = await this.productClassificationService.create(classificationData);
      res.status(201).json({
        status: "success",
        message: "Product classification created successfully",
        data: newClassification,
      });
    } catch (error) {
      next(new AppError(500, "Error creating classification"));
    }
  }

  @httpPatch("/:id",captureUser)
  public async update(
    @requestParam("id") id: string,
    @requestBody() classificationData: Partial<ProductClassification>,
    @response() res: Response,
    @next() next: NextFunction
  ): Promise<void> {
    try {
      const updatedBy=res.locals.updatedBy
      const updatedClassification = await this.productClassificationService.update(id, classificationData,updatedBy);
      if (!updatedClassification) {
        return next(new AppError(404, "Classification not found"));
      }
      res.status(200).json({
        status: "success",
        message: "Product classification updated successfully",
        data: updatedClassification,
      });
    } catch (error) {
      next(new AppError(500, "Error updating classification"));
    }
  }

  @httpDelete("/:id")
  public async delete(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ): Promise<void> {
    try {
      const success = await this.productClassificationService.delete(id);
      if (!success) {
        return next(new AppError(404, "Classification not found"));
      }
      res.status(200).json({
        status: "success",
        message: "Product classification deleted successfully",
      });
    } catch (error) {
      next(new AppError(500, "Error deleting classification"));
    }
  }
}
