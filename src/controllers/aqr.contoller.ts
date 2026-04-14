import { Request, Response, NextFunction } from "express";
import { inject } from "inversify";
import {
  controller, httpGet, httpPost, httpDelete, httpPatch,
  request, response, next, requestParam,
} from "inversify-express-utils";
import { TYPES } from "../types";
import { AqrService } from "../services/aqr.service";
import { NotificationService } from "../services/notification.service";
import AppError from "../utils/appError";
import { PaginationOptions } from "../utils/pagination";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import { ControllerLogger } from "../utils/controllerLogger";

@controller("/aqr", deserializeUser, requireUser)
export class AqrController {
  constructor(
    @inject(TYPES.AqrService) private aqrService: AqrService,
    @inject(TYPES.NotificationService) private notificationService: NotificationService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  @httpPost("/")
  public async createAqr(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<Response | void> {
    try {
      const aqrData = { ...req.body, requestedBy: res.locals.user.id };
      const createdAqr = await this.aqrService.createAqr(aqrData);

      if (!createdAqr) {
        ControllerLogger.logOperationFailed("Create", "AQR", "not created", req, res);
        return next(new AppError(400, "AQR not created"));
      }

      this.notificationService
        .createNoti("AQR created successfully and submitted for approval", res.locals.user.id)
        .catch(() => {});

      ControllerLogger.logSuccess("AQR created", createdAqr.id, req, res);
      return res.status(201).json({ status: "success", message: "AQR created successfully" });
    } catch (error) {
      ControllerLogger.logError("AQR creation", error, req, res);
      if (error instanceof Error) return next(new AppError(400, error.message));
      next(error);
    }
  }

  // ─── Get All ──────────────────────────────────────────────────────────────

  @httpGet("/")
  public async getAllAqrs(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const { page, limit, search, sort, supplierName, arrivalDate } = req.query;
      const userId = res.locals.user.id;

      const filters: any = {};
      if (supplierName) filters.supplierName = supplierName;
      if (arrivalDate) filters.arrivalDate = arrivalDate;

      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
        filters,
        sort: (sort as string) || undefined,
        search: (search as string) || "",
      };

      const aqrs = await this.aqrService.getAllAqrs(queryOptions, userId);

      if (!aqrs || aqrs.data.length === 0) {
        return res.status(200).json({ status: "success", data: [], allRecords: 0, totalPages: 0, page: queryOptions.page });
      }

      ControllerLogger.logGetAllRecords("AQR", req, res);
      res.status(200).json({
        status: "success",
        data: aqrs.data,
        allRecords: aqrs.meta.total,
        totalPages: aqrs.meta.pages,
        page: aqrs.meta.page,
      });
    } catch (error) {
      ControllerLogger.logError("AQR retrieval", error, req, res);
      next(error);
    }
  }

  // ─── Recycle Bin ──────────────────────────────────────────────────────────

  @httpGet("/recycle-bin")
  public async getAllRecycleBinAqrs(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const { page, limit, search, sort, supplierName, arrivalDate } = req.query;
      const userId = res.locals.user.id;

      const filters: any = {};
      if (supplierName) filters.supplierName = supplierName;
      if (arrivalDate) filters.arrivalDate = arrivalDate;

      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
        filters,
        sort: (sort as string) || undefined,
        search: (search as string) || "",
      };

      const aqrs = await this.aqrService.getAllRecycleBinAqrs(queryOptions, userId);

      if (!aqrs || aqrs.data.length === 0) {
        return res.status(200).json({ status: "success", data: [], allRecords: 0, totalPages: 0, page: queryOptions.page });
      }

      ControllerLogger.logGetAllRecords("AQR", req, res);
      res.status(200).json({
        status: "success",
        data: aqrs.data,
        allRecords: aqrs.meta.total,
        totalPages: aqrs.meta.pages,
        page: aqrs.meta.page,
      });
    } catch (error) {
      ControllerLogger.logError("Aqr Recycle Bin", error, req, res);
      next(error);
    }
  }

  // ─── View (with approval info) ────────────────────────────────────────────

  @httpGet("/view/:docid")
  public async getAQRByIdForView(
    @requestParam("docid") docid: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const userId = res.locals.user.id;
      const aqr = await this.aqrService.getAQRByIdForView(docid, userId);

      if (!aqr) {
        ControllerLogger.logOperationFailed("View", "AQR", "permission denied or not found", req, res);
        return res.status(403).json({ status: "fail", message: "You do not have permission to view this AQR" });
      }

      ControllerLogger.logView("AQR", docid, req, res);
      res.status(200).json({ status: "success", data: aqr });
    } catch (error) {
      ControllerLogger.logError("AQR view", error, req, res);
      next(error);
    }
  }

  // ─── Filter ───────────────────────────────────────────────────────────────

  @httpGet("/filter")
  public async filterAqrs(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const { page: _p, limit: _l, ...restQuery } = req.query;

      const filters: Record<string, any> = {};
      for (const [key, value] of Object.entries(restQuery ?? {})) {
        if (value !== undefined && value !== "") filters[key] = value;
      }

      const result = await this.aqrService.filterAqrs(page, limit, filters);
      res.json({ success: true, ...result });
    } catch (error) {
      ControllerLogger.logError("AQR filter", error, req, res);
      next(error);
    }
  }

  // ─── Get By ID ────────────────────────────────────────────────────────────

  @httpGet("/:id")
  public async getAqrById(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<Response | void> {
    try {
      const { id } = req.params;
      const aqr = await this.aqrService.getAqrById(id);

      if (!aqr) {
        ControllerLogger.logNotFound("AQR", id, req, res);
        throw new AppError(404, "AQR not found");
      }

      ControllerLogger.logView("AQR", id, req, res);
      return res.status(200).json({ status: "success", data: aqr });
    } catch (error) {
      ControllerLogger.logError("AQR Get", error, req, res);
      next(error);
    }
  }

  // ─── Get For Update ───────────────────────────────────────────────────────

  @httpGet("/update/:id")
  public async getAqrByIdForUpdate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> {
    try {
      const { id } = req.params;
      const aqr = await this.aqrService.getAqrByIdForUpdate(id);

      if (!aqr) {
        ControllerLogger.logNotFound("AQR", id, req, res);
        throw new AppError(404, "AQR not found");
      } 

      ControllerLogger.logView("AQR", id, req, res);
      return res.status(200).json({ status: "success", data: aqr });
    } catch (error) {
      ControllerLogger.logError("AQR Get", error, req, res);
      next(error);
    }
  }

  // ─── Search ───────────────────────────────────────────────────────────────

  @httpGet("/search/:search")
  public async searchAqr(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<Response | void> {
    try {
      const { search } = req.params;
      const aqr = await this.aqrService.searchAqr(search);

      if (!aqr) {
        ControllerLogger.logNotFound("AQR", search, req, res);
        throw new AppError(404, "AQR not found");
      }

      ControllerLogger.logView("AQR", search, req, res);
      return res.status(200).json({ status: "success", data: aqr });
    } catch (error) {
      ControllerLogger.logError("AQR search", error, req, res);
      next(error);
    }
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  @httpPatch("/:id")
  public async updateAqr(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<Response | void> {
    try {
      const { id } = req.params;
      const updatedAqr = await this.aqrService.updateAqr(id, req.body, res.locals.updatedBy);

      if (!updatedAqr) {
        ControllerLogger.logOperationFailed("Update", "AQR", "not found or could not be updated", req, res);
        throw new AppError(404, "AQR not found or could not be updated");
      }

      this.notificationService
        .createNoti("AQR updated successfully", res.locals.user.id)
        .catch(() => {});

      ControllerLogger.logSuccess("AQR updated", id, req, res);
      return res.status(200).json({ status: "success", message: "AQR updated successfully", });
    } catch (error) {
      ControllerLogger.logError("AQR update", error, req, res);
      next(error);
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  @httpDelete("/:id")
  public async deleteAqr(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<Response | void> {
    try {
      const { id } = req.params;
      const deleted = await this.aqrService.deleteAqr(id);

      if (!deleted) {
        ControllerLogger.logOperationFailed("Delete", "AQR", "not found or could not be deleted", req, res);
        throw new AppError(404, "AQR not found or could not be deleted");
      }

      ControllerLogger.logSuccess("AQR deleted", id, req, res);
      return res.status(200).json({ status: "success", message: "AQR deleted successfully" });
    } catch (error) {
      ControllerLogger.logError("AQR deletion", error, req, res);
      next(error);
    }
  }

  // ─── Delete Multiple ──────────────────────────────────────────────────────

  @httpDelete("/delete/multiple")
  public async deleteMultipleAqrs(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return next(new AppError(400, "An array of AQR IDs is required"));
      }

      const result = await this.aqrService.deleteMultipleAqrs(ids);
      res.status(200).json({ message: result.message, success: result.success, failed: result.failed });
    } catch (error) {
      ControllerLogger.logError("AQR bulk delete", error, req, res);
      next(error);
    }
  }
}
