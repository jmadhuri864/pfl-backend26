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
} from "inversify-express-utils";

import { TYPES } from "../types";
import { Request, Response, NextFunction } from "express";

import AppError from "../utils/appError";
import { UOMConversionMatrixService } from "../services/UOMconversionMatrix.service";
import { UOMConversionMatrix } from "../entities/uom_matrix.entity";
import { uploadNone } from "../middleware/multerConfig";
import logger from "../utils/logger";
import { PaginationOptions } from "../utils/pagination";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";

@controller("/uom-conversion-matrix",deserializeUser,requireUser)
export class UOMConversionMatrixController {
  constructor(
    @inject(TYPES.UOMConversionMatrixService)
    private uomConversionMatrixService: UOMConversionMatrixService
  ) {}

  @httpGet("/")
  public async getAll(@response() res: Response, @next() next: NextFunction,@request() req : Request) {
    try {
      const { page, limit, search, sort,uomConversionMatrixId} = req.query;
          
      
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,  
        limit: limit ? Number(limit) : undefined,
        searchFields: ['uomConversionMatrix.id'],
        filters: {},
        sort: sort as string || undefined, // Adjust this line to match your sorting requirements
        search: search as string|| '',
      };
      const conversions = await this.uomConversionMatrixService.getAll(queryOptions);
      if (!conversions.data.length) {
        return next(new AppError(404, "No UOM conversion data found"));
      }

      res.status(200).json({
        status: "success",
        data: conversions.data,
        allRecords:  conversions.meta.total,  
        totalPages:  conversions.meta.pages,
        page:  conversions.meta.page,
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
      const conversion = await this.uomConversionMatrixService.getById(id);
      if (!conversion) {
        return next(new AppError(404, "UOM conversion data not found"));
      }

      res.status(200).json({
        status: "success",
        data: conversion,
      });
    } catch (err) {
      next(err);
    }
  }


  @httpGet("/getAllForUpate/:id")
  public async getByIdForUpdate(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const conversion = await this.uomConversionMatrixService.getByIdForUpdate(id);
      if (!conversion) {
        return next(new AppError(404, "UOM conversion data not found"));
      }

      res.status(200).json({
        status: "success",
        data: conversion,
      });
    } catch (err) {
      next(err);
    }
  }


  @httpPost("/")
  public async create(
    @requestBody() conversionData: any,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      console.log(req.body)
      const conversion = await this.uomConversionMatrixService.create(
        conversionData
      );
      res.status(201).json({
        status: "success",
        //data: conversion,
        message: "UOM conversion data created successfully",
      });
    } catch (err) {
      next(err);
    }
  }

  @httpPatch("/:id")
  public async update(
    @requestParam("id") id: string,
    @requestBody() conversionData: Partial<UOMConversionMatrix>,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const updateBy=res.locals.id
      const conversion = await this.uomConversionMatrixService.update(
        id,
        conversionData,
        updateBy
      );
      if (!conversion) {
        return next(
          new AppError(404, "UOM conversion data not found or update failed")
        );
      }

      res.status(200).json({
        status: "success",
        //data: conversion,
        message: "UOM conversion data updated successfully",
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
        logger.warn("UOM Conversion Matrix ID not provided");
        return next(new AppError(400, "UOM Conversion Matrix  ID is required"));
      }
      const success = await this.uomConversionMatrixService.delete(id);
      if (success) {
        res.status(200).json({
          status: "success",
          message: "UOM conversion data deleted successfully"
        });
      } else {
        return next(new AppError(404, "UOM conversion data not found"));
      }
    } catch (err) {
      next(err);
    }
  }
}
