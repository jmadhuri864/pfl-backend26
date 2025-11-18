import { controller, httpDelete, httpGet, httpPatch, httpPost, next, request, response } from "inversify-express-utils";
import { captureUser, deserializeUser, requireUser } from "../middleware/deserializeUser";
import { inject } from "inversify";
import { TYPES } from "../types";
import { PaymentRequestService } from "../services/paymentRequest.service";
import { NextFunction,Response,Request } from "express";
import { uploadAny, uploadNone } from "../middleware/multerConfig";
import logger from "../utils/logger";

@controller("/paymentRequest",deserializeUser, requireUser)
export class PaymentRequestController {
  constructor(@inject(TYPES.PaymentRequestService) private paymentRequestService: PaymentRequestService) {}

  @httpGet("/")
  public async getAllPaymentRequests(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    logger.info("Fetching all payment requests");
    try {
      const paymentRequests = await this.paymentRequestService.getAllPaymentRequests();
  
      if (!paymentRequests) {
        logger.warn("No payment requests found");
        return res.status(404).json({
          status: "fail",
          message: "No payment requests found",
        });
      }
  
      logger.info("Successfully fetched all payment requests", { count: paymentRequests.length });
      res.status(200).json({
        status: "success",
        data: paymentRequests,
      });
    } catch (err) {
      logger.error("Error fetching all payment requests", { err });
      next(err);
    }
  }
  
// Get a payment request by ID
@httpGet("/:id")
public async getPaymentRequestById(
  @request() req: Request,
  @response() res: Response,
  @next() next: NextFunction
) {
  try {
    const { id } = req.params;
    logger.info("Fetching payment request by ID", { id });
    const paymentRequest = await this.paymentRequestService.getPaymentRequestById(id);

    if (!paymentRequest) {
      logger.warn("Payment request not found", { id });
      return res.status(404).json({ status: "fail", message: "Payment Request not found" });
    }
    logger.info("Successfully fetched payment request", { id });
    res.status(200).json({
      status: "success",
      data: paymentRequest,
    });
  } catch (err) {
    logger.error("Error fetching payment request by ID", { error: err });
    next(err);
  }
}

// Create a new payment request
@httpPost("/:id")
public async createPaymentRequest(
  @request() req: Request,
  @response() res: Response,
  @next() next: NextFunction
) {
  try {
    const paymentRequestData = req.body;
    paymentRequestData.requestedBy = res.locals.user.id;
    const id = req.params.id
    console.log(req.body)
    logger.info("Creating a new payment request", { id });
    const newPaymentRequest = await this.paymentRequestService.createPaymentRequest(paymentRequestData,id);
    logger.info("Payment request created successfully");
    res.status(201).json({
      status: "success",
      message: 'Payment Request created successfully',
      data: newPaymentRequest,
    });
  } catch (err) {
    logger.error("Error creating payment request", {  error: err });
    next(err);
  }
}

// Update a payment request
@httpPatch("/:id",captureUser)
public async updatePaymentRequest(
  @request() req: Request,
  @response() res: Response,
  @next() next: NextFunction
) {
  try {
    logger.info("Updating payment request");
    const updatedBy=res.locals.updatedBy
    const { id } = req.params;
    const updatedData: Partial<PaymentRequest> = req.body;
    const updatedPaymentRequest = await this.paymentRequestService.updatePaymentRequest(id, updatedData,updatedBy);

    if (!updatedPaymentRequest) {
      logger.warn("Payment request not found or update failed", { id });
      return res.status(404).json({ status: "fail", message: "Payment Request not found" });
    }
    logger.info("Payment request updated successfully", { id });
    res.status(200).json({
      status: "success",
      data: updatedPaymentRequest,
    });
  } catch (err) {
    logger.error("Error updating payment request", { error: err });
    next(err);
  }
}

// Delete a payment request
@httpDelete("/:id")
public async deletePaymentRequest(
  @request() req: Request,
  @response() res: Response,
  @next() next: NextFunction
) {
  try {
    const { id } = req.params;
    logger.info("Deleting payment request", { id });
    await this.paymentRequestService.deletePaymentRequest(id);
    logger.info("Payment request deleted successfully", { id });
    res.status(200).json({ 
      status: "success", 
      message: "Payment Request deleted successfully" });
  } catch (err) {
    logger.error("Error deleting payment request", {error: err });
    next(err);
  }
}

}
