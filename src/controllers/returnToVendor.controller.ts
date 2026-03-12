import { controller, httpPost, httpGet, httpPut, next, requestBody, request, response, httpDelete } from "inversify-express-utils";

import { inject } from "inversify";
import { TYPES } from "../types";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import { NextFunction, Request, Response } from "express";
import { ControllerLogger } from "../utils/controllerLogger";
import { NotificationService } from "../services/notification.service";
import { ReturnToVendorService } from "../services/retrunToVendor.service";

@controller("/return-to-vendor", deserializeUser, requireUser)
export class ReturnToVendorController {

  constructor(@inject(TYPES.ReturnToVendorService) private returnToVendorService: ReturnToVendorService,
    @inject(TYPES.NotificationService) private notificationService: NotificationService) {

  }

  @httpPost("/")
  public async createReturnToVendor(@requestBody() postReturnData: any,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction) {
    try {
      console.log(postReturnData)

      const requestedBy = res.locals.user.id; // Pass full user object
      const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'Unknown';

      const newPostReturn = await this.returnToVendorService.createReturn(postReturnData, requestedBy, clientIp);

      ControllerLogger.logSuccess('Post Return By Customer created', newPostReturn.id, req, res);

      //Send notification for post return creation
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Post Return By Customer created successfully: ${newPostReturn.id}`,
          userId
        );
      }

      res.status(201).json({
        status: "success",
        data: newPostReturn.id,
        message: "Post return created successfully",
      });
    } catch (error) {
      console.log(error)
      ControllerLogger.logError('Post Return By Customer creation', error, req, res);
      next(error);
    }
  }

  @httpGet("/")
  public async getAllReturnToVendor(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await this.returnToVendorService.getAll(page, limit);

      ControllerLogger.logSuccess('Get all return to vendor records', '', req, res);

      res.status(200).json({
        status: "success",
        data: result.data,
        totalRecords: result.total,
          totalPages: Math.ceil(result.total / result.limit),
          page: result.page,
       
        message: "Return to vendor records fetched successfully",
      });
    } catch (error) {
      console.log(error)
      ControllerLogger.logError('Get all return to vendor records', error, req, res);
      next(error);
    }
  }

  @httpGet("/:id")
  public async getReturnToVendorById(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Return to vendor ID is required",
        });
      }

      const returnRecord = await this.returnToVendorService.getById(id);

      ControllerLogger.logSuccess('Get return to vendor by ID', id, req, res);

      res.status(200).json({
        status: "success",
        data: returnRecord,
        message: "Return to vendor record fetched successfully",
      });
    } catch (error) {
      console.log(error)
      ControllerLogger.logError('Get return to vendor by ID', error, req, res);
      next(error);
    }
  }
  @httpGet("/view/:id")
  public async getReturnToVendorByIdForView(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Return to vendor ID is required",
        });
      }

      const returnRecord = await this.returnToVendorService.getByIdForView(id);

      ControllerLogger.logSuccess('Get return to vendor by ID', id, req, res);

      res.status(200).json({
        status: "success",
        data: returnRecord,
        message: "Return to vendor record fetched successfully",
      });
    } catch (error) {
      console.log(error)
      ControllerLogger.logError('Get return to vendor by ID', error, req, res);
      next(error);
    }
  }
  @httpGet("/update/:id")
  public async getReturnToVendorByIdForUpdate(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Return to vendor ID is required",
        });
      }

      const returnRecord = await this.returnToVendorService.getByIdForUpdate(id);

      ControllerLogger.logSuccess('Get return to vendor by ID', id, req, res);

      res.status(200).json({
        status: "success",
        data: returnRecord,
        message: "Return to vendor record fetched successfully",
      });
    } catch (error) {
      console.log(error)
      ControllerLogger.logError('Get return to vendor by ID', error, req, res);
      next(error);
    }
  }

  @httpPut("/:id")
  public async updateReturnToVendor(
    @request() req: Request,
    @response() res: Response,
    @requestBody() updateData: any,
    @next() next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: "error",
          message: "Return to vendor ID is required",
        });
      }

      const updatedReturn = await this.returnToVendorService.updateReturn(id, updateData);

      ControllerLogger.logSuccess('Return to vendor updated', id, req, res);

      res.status(200).json({
        status: "success",
        data: updatedReturn.id,
        message: "Return to vendor updated successfully",
      });
    } catch (error) {
      console.log(error)
      ControllerLogger.logError('Return to vendor update', error, req, res);
      next(error);
    }
  }

  @httpDelete("/:id")
  public async deleteReturn(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const result = await this.returnToVendorService.softDeleteReturn(id);

      return res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      console.log(error)
      ControllerLogger.logError('Return to vendor delete', error, req, res);
      next(error);
    }
  }
}