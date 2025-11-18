import { inject } from "inversify";
import {
  controller,
  httpDelete,
  httpGet,
  httpPost,
  httpPut,
  requestBody,
  requestParam,
  request,
  response,
  next,
  httpPatch,
} from "inversify-express-utils";

import { TYPES } from "../types";
import { Request, Response, NextFunction } from "express";
import { UOM } from "../entities/uom.entity";
import AppError from "../utils/appError";
import { UOMService } from "../services/UOM.service";
import { captureUser, deserializeUser, requireUser } from "../middleware/deserializeUser";
import { uploadNone } from "../middleware/multerConfig";
import logger from "../utils/logger";
import { PaginationOptions } from "../utils/pagination";



@controller("/uoms" , deserializeUser, requireUser)
export class UOMController {
  constructor(
    @inject(TYPES.UOMService)
    private uomService: UOMService
  ) {}

  @httpGet("/")
  public async getAll(@response() res: Response, 
  @request() req:Request,
  @next() next: NextFunction) {
    try {
      const { page, limit, search, sort} = req.query;
          
      
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,  
        limit: limit ? Number(limit) : undefined,
        //searchFields: ['uom.id'],
        filters: {},
        sort: sort as string || undefined, // Adjust this line to match your sorting requirements
        search: search as string|| '',
      };
      const uoms = await this.uomService.getAll(queryOptions);
      if (!uoms.data.length) {
        return next(new AppError(404, "No UOMs found"));
      }

      res.status(200).json({
        status: "success",
        data: uoms.data,
        allRecords:  uoms.meta.total,
        totalPages:  uoms.meta.pages,
        page:  uoms.meta.page,
      });
    } catch (err) {
      next(err);
    }
  }

  @httpGet("/getAll/partialdata")
  public async getAllPartialData(@response() res: Response, 
  @next() next: NextFunction) {
    try {
      const uoms = await this.uomService.getAllPartial();
      if (!uoms.length) {
        return next(new AppError(404, "No UOMs found"));
      }

      res.status(200).json({
        status: "success",
        data: uoms,
      });
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
      const uom = await this.uomService.getById(id);
      if (!uom) {
        return next(new AppError(404, "UOM not found"));
      }

      res.status(200).json({
        status: "success",
        data: uom,
      });
    } catch (err) {
      next(err);
    }
  }

  @httpPost("/")
  public async create(
    @requestBody() uomData: Partial<UOM>,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const uom = await this.uomService.create(uomData);
      res.status(201).json({
        status: "success",
        message: "UOM created successfully",
        //data: uom,
      });
    } catch (err) {
      next(err);
    }
  }

  @httpPatch("/:id",captureUser)
  public async update(
    @requestParam("id") id: string,
    @requestBody() uomData: Partial<UOM>,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const updatedBy=res.locals.updatedBy
      const uom = await this.uomService.update(id, uomData,updatedBy);
      if (!uom) {
        return next(new AppError(404, "UOM not found or update failed"));
      }

      res.status(200).json({
        status: "success",
        message: "UOM updated successfully",
        //data: uom,
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
      if (!id) {
        logger.warn("UOM ID not provided");
        return next(new AppError(400, "UOM ID is required"));
      }
      const success = await this.uomService.delete(id);
      if (success) {
        res.status(204).json({
          status: "success",
          message: "UOM deleted successfully"
        });
      } else {
        return next(new AppError(404, "UOM not found"));
      }
    } catch (err) {
      next(err);
    }
  }

  @httpDelete("/multiple-delete/delete")
  public async multipleDelete(
    @requestBody() body: { ids: string[] },
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const { ids } = body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return next(new AppError(400, "Please provide an array of IDs"));
      }

      const deleted = await this.uomService.multipledelete(ids);

      if (deleted === false) {
        return next(new AppError(404, "No records found for deletion"));
      }

      res.status(200).json({
        status: "success",
        message: "Records deleted successfully",
      });
    } catch (err) {
      console.log(err)
      next(err);
    }
  }

}

