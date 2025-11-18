import { inject } from "inversify";
import {
  controller,
  httpGet,
  httpPost,
  httpPatch,
  httpDelete,
  request,
  response,
  requestParam,
  next,
} from "inversify-express-utils";
import { Request, Response, NextFunction } from "express";
import { TYPES } from "../types";

import { AuditLogService } from "../services/auditLog.service";
import AppError from "../utils/appError";
import { LaborAttendancesService } from "../services/labourAttendence.service";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import { uploadAny, uploadNone } from "../middleware/multerConfig";
import logger from "../utils/logger";
import { PaginationOptions } from "../utils/pagination";

@controller("/laborAttendances" ,deserializeUser,requireUser)
export class LaborAttendancesController {
  constructor(
    @inject(TYPES.LaborAttendancesService)
    private laborAttendancesService: LaborAttendancesService,
    @inject(TYPES.AuditLogService)
    private auditLogService: AuditLogService
  ) {}

  @httpGet("/")
  public async getAllAttendances(
    @request() req:Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const { page, limit, search, sort,labourAttendenceId} = req.query;
                
            
                  const queryOptions: PaginationOptions = {
                    page: page ? Number(page) : undefined,  
                    limit: limit ? Number(limit) : undefined,
                    searchFields: ['labourAttendence.id'],
                    filters: {},
                    sort: sort as string || undefined, // Adjust this line to match your sorting requirements
                    search: search as string|| '',
                  };
      const attendances = await this.laborAttendancesService.getAllAttendances(queryOptions);
      res.status(200).json({
        status: "success",
        data: attendances.data,
        allRecords: attendances.meta.total,
        totalPages: attendances.meta.pages, 
        page: attendances.meta.page,
      });
    } catch (error) {
      next(error);
    };
  }

  @httpGet("/:id")
  public async getAttendanceById(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const attendance = await this.laborAttendancesService.getAttendanceById(id);
      if (!attendance) {
        return next(new AppError(404, "Attendance not found"));
      }
      res.status(200).json({
        status: "success",
        data: attendance,
      });
    } catch (error) {
      next(error);
    }
  }

  @httpPost("/")
  public async createAttendance(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
       console.log(req.body)
       req.body.checkedBy = res.locals.user?.id;
      const attendanceData = req.body;
     // Check each labor detail for empty outTime and set it to null if needed
     if (attendanceData.labourDetails && Array.isArray(attendanceData.labourDetails)) {
      attendanceData.labourDetails.forEach((labor: { outTime: string | null }) => {
        if (labor.outTime === '') {
          labor.outTime = null;
        }
      });
    }
      const attendance = await this.laborAttendancesService.createAttendance(attendanceData);
      logger.info("Labor record created successfully", { attendanceDataId: attendanceData.id });
      res.status(201).json({
        status: "success",
        message: "Attendance created successfully",
        data: attendance,
      });
    } catch (error) {
      console.log(error)
      next(error);
    }
  }

  @httpPatch("/:id")
  public async updateAttendance(
    @requestParam("id") id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const updatedBy = res.locals.user?.id; // Assuming the logged-in user ID is stored in res.locals
      const updatedAttendance = await this.laborAttendancesService.updateAttendance(
        id,
        req.body,
        updatedBy
      );
      if (!updatedAttendance) {
        return next(new AppError(404, "Attendance not found or could not be updated"));
      }
      res.status(200).json({
        status: "success",
        message: "Attendance updated successfully",
        data: updatedAttendance,
      });
    } catch (error) {
      next(error);
    }
  }

  @httpDelete("/:id")
  public async deleteAttendance(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Deleting labor Attendence record", { laborId: id });
      const result = await this.laborAttendancesService.deleteAttendance(id);
        if (!result) {
              return next(
                new AppError(404, "Labor record not found or could not be deleted")
              );
            }
      //res.status(204).send();
      res.status(200).json({
        status: "success",
        message: "Labor record deleted successfully",
        //data: updatedLabor,
      });
    } catch (error) {
      next(error);
    }
  }
}
