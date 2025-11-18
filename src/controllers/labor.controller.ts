import { inject } from "inversify";
import {
  controller,
  httpGet,
  httpPatch,
  httpPost,
  next,
  request,
  requestParam,
  response,
} from "inversify-express-utils";
import { TYPES } from "../types";
import { LaborService } from "../services/labor.service";
import { NextFunction, Response, Request } from "express";
import logger from "../utils/logger";
import AppError from "../utils/appError";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import { uploadNone } from "../middleware/multerConfig";
import { PaginationOptions } from "../utils/pagination";

@controller("/labors",deserializeUser,requireUser)
export class LaborController {
  constructor(
    @inject(TYPES.LaborService) private readonly laborService: LaborService
  ) {}
  @httpPost("/")
  public async createLabor(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Attempting to create a new labor record");
      //console.log(req.body);
      const laborData = req.body;
     console.log(laborData)
      const labor = await this.laborService.createLabor(laborData);
      if (!labor) {
        return next(new AppError(400, "Labor record could not be created"));
      }

      logger.info("Labor record created successfully", { laborId: labor.id });
      res.status(201).json({
        status: "success",
        message: "Labor record created successfully",
        //data: labor,
      });
    } catch (error) {
      logger.error("Error occurred while creating labor record", { error });
      next(error);
    }
  }

  @httpGet("/:id")
  public async getLaborById(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching labor record by ID", { laborId: id });
      const labor = await this.laborService.getLaborById(id);
      if (!labor) {
        return next(new AppError(404, "Labor record not found"));
      }

      res.status(200).json({
        status: "success",
        data: labor,
      });
    } catch (error) {
      logger.error("Error occurred while fetching labor record", { error });
      next(error);
    }
  }

  @httpGet("/")
  public async getAllLabors(
    @request() req:Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching all labor records");
      const { page, limit, search, sort,labourId} = req.query;
          
      
            const queryOptions: PaginationOptions = {
              page: page ? Number(page) : undefined,  
              limit: limit ? Number(limit) : undefined,
              searchFields: ['labour.id'],
              filters: {},
              sort: sort as string || undefined, // Adjust this line to match your sorting requirements
              search: search as string|| '',
            };
      const labors = await this.laborService.getAllLabors(queryOptions);
      res.status(200).json({
        status: "success",
        data: labors.data,

        allRecords: labors.meta.total,
        totalPages: labors.meta.pages,
        page: labors.meta.page,
      });
    } catch (error) {
      logger.error("Error occurred while fetching all labor records", {
        error,
      });
      next(error);
    }
  }

  @httpPatch("/:id")
  public async updateLabor(
    @requestParam("id") id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const updatedBy=res.locals.user.id
      logger.info("Updating labor record", { laborId: id });
      const updatedLabor = await this.laborService.updateLabor(id, req.body,updatedBy);

      if (!updatedLabor) {
        return next(
          new AppError(404, "Labor record not found or could not be updated")
        );
      }

      res.status(200).json({
        status: "success",
        message: "Labor record updated successfully",
        //data: updatedLabor,
      });
    } catch (error) {
      logger.error("Error occurred while updating labor record", { error });
      next(error);
    }
  }


  @httpPatch("/:id")
  public async deleteLabor(
    @requestParam("id") id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      
      logger.info("Deleting labor record", { laborId: id });
      const deletedLabor = await this.laborService.deleteLabor(id);

      if (!deletedLabor) {
        return next(
          new AppError(404, "Labor record not found or could not be deleted")
        );
      }

      res.status(200).json({
        status: "success",
        message: "Labor record deleted successfully",
        //data: updatedLabor,
      });
    } catch (error) {
      logger.error("Error occurred while updating labor record", { error });
      next(error);
    }
  }
}
