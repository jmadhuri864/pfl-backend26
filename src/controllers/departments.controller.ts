import { inject } from "inversify";
import { controller, httpPost, httpGet, httpPut, httpDelete, request, requestParam, response, next } from "inversify-express-utils";
import { TYPES } from "../types";


import { NextFunction, Request, Response } from "express";
import AppError from "../utils/appError";
import logger from "../utils/logger";
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
      logger.info("Fetching all departments");
      const departments = await this.departmentService.getAllDepartments();
      if (!departments) {
        logger.warn("No departments found");
        return next(new AppError(404, "No departments found"));
      }
      logger.info("Departments retrieved successfully");
      res.status(200).json({
        status: "success",
        data: departments,
      });
    } catch (err) {
      logger.error("Error occurred while fetching all departments", { error: err });
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
      logger.info("Fetching department by ID", { departmentId: id });
      const department = await this.departmentService.getDepartmentById(id);
      if (!department) {
        logger.warn("Department not found", { departmentId: id });
        return next(new AppError(404, "Department not found"));
      }
      logger.info("Department details retrieved successfully", { department });
      res.status(200).json({
        status: "success",
        data: department,
      });
    } catch (err) {
      logger.error("Error occurred while fetching department details", { departmentId: id, error: err });
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
      logger.info("Attempting to create a new department");
      const { name } = req.body;
      const department = await this.departmentService.createDepartment(name);
      if (!department) {
        logger.error("Failed to create department", { departmentData: req.body });
        return next(new AppError(400, "Department could not be created"));
      }
      logger.info("Department created successfully", { departmentId: department.id });
      res.status(201).json({
        status: "success",
        message: "Department created successfully",
        data: department.id,
      });
    } catch (err) {
      logger.error("Error occurred while creating department", { error: err });
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
      logger.info("Updating department details", { departmentId: id });
      const updateBy = res.locals.id
      const { name } = req.body;
      const department = await this.departmentService.updateDepartment(id, name,updateBy);
      if (!department) {
        logger.warn("Department not found or could not be updated", { departmentId: id });
        return next(new AppError(404, "Department not found or could not be updated"));
      }
      logger.info("Department updated successfully", { department });
      res.status(200).json({
        status: "success",
        message: "Department updated successfully",
        data: department,
      });
    } catch (err) {
      logger.error("Error occurred while updating department", { departmentId: id, error: err });
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
      logger.error("Error occurred while deleting department", { departmentId: id, error: err });
      next(err);
    }
  }
}
