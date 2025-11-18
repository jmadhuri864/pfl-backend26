import { inject } from "inversify";
import {
  controller,
  httpPost,
  httpGet,
  httpPatch,
  httpDelete,
  request,
  requestParam,
  response,
  next,
} from "inversify-express-utils";
import { TYPES } from "../types";
import { Request, Response, NextFunction } from "express";
import { SaleOrderService } from "../services/saleOrder.service";
import AppError from "../utils/appError";
import logger from "../utils/logger";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";

@controller('/saleOrders',deserializeUser,requireUser)
export class SaleOrderController {
  constructor(
    @inject(TYPES.SaleOrderService)
    private saleOrderService: SaleOrderService
  ) {}

  @httpPost("/")
  public async createSaleOrder(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Creating a new sale order");
      const saleOrderData = req.body;
      const saleOrder = await this.saleOrderService.createSaleOrder(saleOrderData);

      res.status(201).json({
        status: "success",
        message: "Sale order created successfully",
        data: saleOrder,
      });
    } catch (err) {
      logger.error("Error occurred while creating sale order", { error: err });
      next(err);
    }
  }

  @httpGet("/:id")
  public async getSaleOrderById(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching sale order by ID", { saleOrderId: id });
      const saleOrder = await this.saleOrderService.getSaleOrderById(id);

      if (!saleOrder) {
        logger.warn("Sale order not found", { saleOrderId: id });
        return next(new AppError(404, "Sale order not found"));
      }

      res.status(200).json({
        status: "success",
        data: saleOrder,
      });
    } catch (err) {
      logger.error("Error occurred while fetching sale order", { error: err });
      next(err);
    }
  }

  @httpGet("/")
  public async getAllSaleOrders(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Fetching all sale orders");
      const saleOrders = await this.saleOrderService.getAllSaleOrders();

      res.status(200).json({
        status: "success",
        data: saleOrders,
      });
    } catch (err) {
      logger.error("Error occurred while fetching all sale orders", { error: err });
      next(err);
    }
  }

  @httpPatch("/:id")
  public async updateSaleOrder(
    @requestParam("id") id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Updating sale order", { saleOrderId: id });
      const updatedBy = res.locals.user?.id; // Assuming user info is available in res.locals
      const saleOrderData = req.body;

      const updatedSaleOrder = await this.saleOrderService.updateSaleOrder(id, saleOrderData, updatedBy);

      if (!updatedSaleOrder) {
        logger.warn("Sale order not found or could not be updated", { saleOrderId: id });
        return next(new AppError(404, "Sale order not found or could not be updated"));
      }

      res.status(200).json({
        status: "success",
        message: "Sale order updated successfully",
        data: updatedSaleOrder,
      });
    } catch (err) {
      logger.error("Error occurred while updating sale order", { error: err });
      next(err);
    }
  }

  @httpDelete("/:id")
  public async deleteSaleOrder(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Deleting sale order", { saleOrderId: id });
      await this.saleOrderService.deleteSaleOrder(id);

      res.status(200).json({
        status: "success",
        message: "Sale order deleted successfully",
      });
    } catch (err) {
      logger.error("Error occurred while deleting sale order", { error: err });
      next(err);
    }
  }
}
