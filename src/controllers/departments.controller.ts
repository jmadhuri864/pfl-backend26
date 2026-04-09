import { inject } from "inversify";
import { controller, httpPost, httpGet, httpPut, httpDelete, request, requestParam, response, next } from "inversify-express-utils";
import { TYPES } from "../types";


import { NextFunction, Request, Response } from "express";
import AppError from "../utils/appError";

import { DepartmentforApproveService } from "../services/deparment.service";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";

@controller('/departments',deserializeUser,requireUser)
export class DepartmentforApproveController {
  constructor(
    @inject(TYPES.DepartmentforApproveService)
    private departmentService: DepartmentforApproveService
  ) {}

  @httpGet("/")
  public async getAllDepartments(
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
     
      const departments = await this.departmentService.getAllDepartments();
      if (!departments) {
       
        return next(new AppError(404, "No departments found"));
      }
     
      res.status(200).json({
        status: "success",
        data: departments,
      });
    } catch (err) {
     
      next(err);
    }
  }

  @httpGet("/:id")
  public async getDepartmentById(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
     
      const department = await this.departmentService.getDepartmentById(id);
      if (!department) {
       
        return next(new AppError(404, "Department not found"));
      }
     
      res.status(200).json({
        status: "success",
        data: department,
      });
    } catch (err) {
      
      next(err);
    }
  }

  @httpPost("/")
  public async createDepartment(
    @request() req: Request<{}, {}, { name: string }>,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
     
      const { name } = req.body;
      const department = await this.departmentService.createDepartment(name);
      if (!department) {
       
        return next(new AppError(400, "Department could not be created"));
      }
     
      res.status(201).json({
        status: "success",
        message: "Department created successfully",
        data: department.id,
      });
    } catch (err) {
     
      next(err);
    }
  }

  @httpPut("/:id")
  public async updateDepartment(
    @requestParam("id") id: string,
    @request() req: Request<{}, {}, { name: string }>,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
     
      const updateBy = res.locals.user?.id
      const { name } = req.body;
      const department = await this.departmentService.updateDepartment(id, name,updateBy);
      if (!department) {
        
        return next(new AppError(404, "Department not found or could not be updated"));
      }
      
      res.status(200).json({
        status: "success",
        message: "Department updated successfully",
        data: department,
      });
    } catch (err) {
     
      next(err);
    }
  }

  @httpDelete("/:id")
  public async deleteDepartment(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const result = await this.departmentService.deleteDepartment(id);
      if (!result) {
        return next(new AppError(404, "Department not found or could not be deleted"));
      }
      res.status(204).send(); // No content
    } catch (err) {
     
      next(err);
    }
  }
}
