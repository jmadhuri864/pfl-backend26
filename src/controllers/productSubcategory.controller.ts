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
import { ControllerLogger } from "../utils/controllerLogger";
import { NotificationService } from "../services/notification.service";

@controller("/productSubcategory",deserializeUser,requireUser)
export class ProductSubcategoryController {
  constructor(
    @inject(TYPES.ProductSubcategoryService)
    private productSubcategoryService: ProductSubcategoryService,
    @inject(TYPES.NotificationService)
    private notificationService: NotificationService
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
        ControllerLogger.logError('Product Subcategory list retrieval', new AppError(404, "No product subcategories found"), req, res);
        return next(new AppError(404, "No product subcategories found"));
      }
      ControllerLogger.logList('Product Subcategory', req, res);

      // Send notification for product subcategory list access
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          'Product Subcategory records list accessed successfully',
          userId
        );
      }

      res.status(200).json({ status: "success",
         data: subcategories.data,
        allRecords: subcategories.meta.total,
        totalPages: subcategories.meta.pages,
        page: subcategories.meta.page, });
    } catch (err) {
      ControllerLogger.logError('Product Subcategory list retrieval', err, req, res);
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
      const subcategory = await this.productSubcategoryService.getById(id);
      if (!subcategory) {
        ControllerLogger.logError('Product Subcategory view', new AppError(404, "Product subcategory not found"), req, res);
        return next(new AppError(404, "Product subcategory not found"));
      }
      ControllerLogger.logView('Product Subcategory', id, req, res);

      // Send notification for product subcategory view
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Product Subcategory viewed: ${id}`,
          userId
        );
      }

      res.status(200).json({ status: "success", data: subcategory });
    } catch (err) {
      ControllerLogger.logError('Product Subcategory view', err, req, res);
      next(err);
    }
  }

  @httpPost("/")
  public async create(
    @requestBody() subcategoryData: { name: string; category: string },
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const { name, category } = subcategoryData;
      const subcategory = await this.productSubcategoryService.create(
        name,
        category
      );
      ControllerLogger.logSuccess('Product Subcategory created', subcategory.id, req, res);

      // Send notification for product subcategory creation
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Product Subcategory created successfully: ${subcategory.id}`,
          userId
        );
      }

      res.status(201).json({
        status: "success",
        message: "Product subcategory created successfully",
        //data: subcategory,
      });
    } catch (err) {
      ControllerLogger.logError('Product Subcategory creation', err, req, res);
      next(err);
    }
  }

  @httpPatch("/:id",captureUser)
  public async update(
    @requestParam("id") id: string,
    @requestBody() subcategoryData: any,
    @request() req: Request,
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
        ControllerLogger.logError('Product Subcategory update', new AppError(404, "Product subcategory not found or update failed"), req, res);
        return next(
          new AppError(404, "Product subcategory not found or update failed")
        );
      }
      ControllerLogger.logSuccess('Product Subcategory updated', id, req, res);

      // Send notification for product subcategory update
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Product Subcategory updated successfully: ${id}`,
          userId
        );
      }

      res.status(200).json({
        status: "success",
        message: "Product subcategory updated successfully",
        //data: subcategory,
      });
    } catch (err) {
      ControllerLogger.logError('Product Subcategory update', err, req, res);
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
      logger.info(`Deleting voucher with ID: ${id}`);
      const success = await this.productSubcategoryService.delete(id);
      if (success) {
        ControllerLogger.logSuccess('Product Subcategory deleted', id, req, res);

        // Send notification for product subcategory deletion
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Product Subcategory deleted successfully: ${id}`,
            userId
          );
        }

        res.status(200).json({
          status: "success",
          message: "Product subcategory deleted successfully",
        });
      } else {
        ControllerLogger.logError('Product Subcategory deletion', new AppError(404, "Product subcategory not found"), req, res);
        return next(new AppError(404, "Product subcategory not found"));
      }
    } catch (err) {
      ControllerLogger.logError('Product Subcategory deletion', err, req, res);
      next(err);
    }
  }
}
