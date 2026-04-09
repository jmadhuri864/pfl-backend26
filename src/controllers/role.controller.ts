import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "inversify";
import { controller, httpGet, httpPost, httpPatch, httpDelete, request, response, next, requestParam, requestBody } from "inversify-express-utils";
import { RoleService } from "../services/role.service";
import { TYPES } from "../types";
import { Role } from "../entities/role.entity";
import AppError from "../utils/appError";
import logger from "../utils/logger";


@controller("/roles")
export class RoleController {
  constructor(
    @inject(TYPES.RoleService) private roleService: RoleService
  ) {}

  @httpGet("/")
  public async getAllRoles(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ): Promise<void> {
    try {
      const roles = await this.roleService.findAllRoles();
      res.status(200).json({
        status: "success",
        data: roles
      });
    } catch (error) {
      next(error); // Pass the error to the global error handler
    }
  }

  @httpGet("/:id")
  public async getRoleById(
    @requestParam("id") roleId: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ): Promise<void> {
    try {
      const role = await this.roleService.findRoleById(roleId);
      if (!role) {
        throw new AppError(404, "Role not found");
      }
      res.status(200).json({
        status: "success",
        data: role
      });
    } catch (error) {
      next(error); // Pass the error to the global error handler
    }
  }

  @httpPost("/")
  public async createRole(
    @requestBody() roleData: Partial<Role>,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ): Promise<void> {
    try {
      const newRole = await this.roleService.createRole(roleData);
      res.status(201).json({
        status: "success",
        message: "Role created successfully",
        data: newRole
      });
    } catch (error) {
      next(error); // Pass the error to the global error handler
    }
  }

  @httpPatch("/:id")
  public async updateRole(
    @requestParam("id") roleId: string,
    @requestBody() roleData: Partial<Role>,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ): Promise<void> {
    try {
      const updateBy = res.locals.user?.id
      const updatedRole = await this.roleService.updateRole(roleId, roleData,updateBy);
      if (!updatedRole) {
        throw new AppError(404, "Role not found or update failed");
      }
      res.status(200).json({
        status: "success",
        message: "Role updated successfully",
        data: updatedRole
      });
    } catch (error) {
      next(error); // Pass the error to the global error handler
    }
  }

  @httpDelete("/:id")
  public async deleteRole(
    @requestParam("id") roleId: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ): Promise<void> {
    try {
      logger.info("Deleting Role ......");
      if (!roleId) {
        logger.warn("Role ID not provided");
        return next(new AppError(400, "Role ID is required"));
      }
      const success=await this.roleService.deleteRole(roleId);
      if (!success) {
        throw new AppError(404, "Role Id not found or update failed");
      }

      res.status(200).json({
        status: "success",
        message: "Role deleted successfully"
      });
    } catch (error) {
      next(error); // Pass the error to the global error handler
    }
  }
}
