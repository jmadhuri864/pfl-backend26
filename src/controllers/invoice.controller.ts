import { controller, httpGet, httpPost } from "inversify-express-utils";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import { NextFunction, Request, Response } from "express";
import { inject } from "inversify";
import { TYPES } from "../types";
import { InvoiceService } from "../services/invoice.service";
import AppError from "../utils/appError";
import { ControllerLogger } from '../utils/controllerLogger';
import { NotificationService } from '../services/notification.service';

@controller("/invoice", deserializeUser, requireUser)
export class InvoiceController {
  constructor(
    @inject(TYPES.InvoiceService)
    private readonly invoiceService: InvoiceService,
    @inject(TYPES.NotificationService)
    private notificationService: NotificationService,
  ) {}

  @httpPost("/:orderId")
  public async createInvoice(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const orderId = req.params.orderId;
      const data = req.body;
      const newCrop = await this.invoiceService.createInvoice(orderId, data);
      
      // 🔔 Send notification for invoice creation
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Invoice created for order ${orderId}`,
            userId
          );
        }
      } catch (notifError) {
        console.log('Invoice creation notification error:', notifError);
      }
      
      ControllerLogger.logSuccess('Invoice created', newCrop.id, req, res);

      res.status(201).json(newCrop);
    } catch (error) {
      ControllerLogger.logError('Invoice creation', error, req, res);
      next(error);
    }
  }
  @httpPost("/generate/profarma/:deliveryChallanId")
  async generateInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { deliveryChallanId } = req.params;
        const invoiceType='proforma';
        console.log("delivery challan controller")
        const invoice = await this.invoiceService.generateInvoice(deliveryChallanId,invoiceType);
        if(!invoice){
          return next(new AppError(400 ,'Delivery Challan not found'))
        }

        // 🔔 Send notification for proforma invoice generation
        try {
          const userId = res.locals.user?.id;
          if (userId) {
            await this.notificationService.createNoti(
              `Proforma invoice generated for delivery challan ${deliveryChallanId}`,
              userId
            );
          }
        } catch (notifError) {
          console.log('Proforma invoice generation notification error:', notifError);
        }

        ControllerLogger.logSuccess('Proforma Invoice generated', deliveryChallanId, req, res);

        res.status(201).json({
            message: 'Invoice generated successfully',
            invoiceurl: invoice.pdfData,
        });
    } catch (error) {
      console.log(error)
      ControllerLogger.logError('Proforma Invoice generation', error, req, res);
      next(error);
      
       // res.status(500).json({ message: error });
    }
}
@httpPost("/generate/final/:deliveryChallanId")
  async generatefinalInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      console.log("in final invoice controller")
        const { deliveryChallanId } = req.params;
        const invoiceType='final';
        const invoice = await this.invoiceService.generateFinalInvoice(deliveryChallanId,invoiceType);
        if(!invoice){
          return next(new AppError(400 ,'Delivery Challan not found'))
        }

        // 🔔 Send notification for final invoice generation
        try {
          const userId = res.locals.user?.id;
          if (userId) {
            await this.notificationService.createNoti(
              `Final invoice generated for delivery challan ${deliveryChallanId}`,
              userId
            );
          }
        } catch (notifError) {
          console.log('Final invoice generation notification error:', notifError);
        }

        ControllerLogger.logSuccess('Final Invoice generated', deliveryChallanId, req, res);

        res.status(201).json({
            message: 'Invoice generated successfully',
            invoiceurl: invoice.pdfData,
        });
    } catch (error) {
      console.log(error)
      ControllerLogger.logError('Final Invoice generation', error, req, res);
      next(error);
    }
}
@httpGet("/getInvoice/:deliveryChallanId")
async getInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
      const { deliveryChallanId } = req.params;
      const invoice = await this.invoiceService.getInvoice(deliveryChallanId);
      
      // 🔔 Send notification for invoice view
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Viewed invoice for delivery challan ${deliveryChallanId}`,
            userId
          );
        }
      } catch (notifError) {
        console.log('Invoice view notification error:', notifError);
      }
      
      ControllerLogger.logView('Invoice', deliveryChallanId, req, res);

      res.status(200).json({
          data:invoice.pdfData,
      });
  } catch (error) {
    console.log(error);
    ControllerLogger.logError('Invoice view', error, req, res);
    next(error);
  }
}
@httpGet("/getproforma/all")
async getproformaInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
      const invoice = await this.invoiceService.getProformaInvoice();
      
      // 🔔 Send notification for proforma invoice list
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Retrieved ${invoice.length} proforma invoices`,
            userId
          );
        }
      } catch (notifError) {
        console.log('Proforma invoice list notification error:', notifError);
      }
      
      ControllerLogger.logList('Proforma Invoice', req, res);

      res.status(200).json({
          data:invoice,
      });
  } catch (error) {
    console.log(error);
    ControllerLogger.logError('Proforma Invoice list retrieval', error, req, res);
    next(error);
  }
}

@httpGet("/getfinal/all")
async getfinalInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
      const invoice = await this.invoiceService.getFinalInvoice();
      
      // 🔔 Send notification for final invoice list
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Retrieved ${invoice.length} final invoices`,
            userId
          );
        }
      } catch (notifError) {
        console.log('Final invoice list notification error:', notifError);
      }
      
      ControllerLogger.logList('Final Invoice', req, res);

      res.status(200).json({
          message: 'Invoice getting successfully',
          data:invoice,
      });
  } catch (error) {
    console.log(error);
    ControllerLogger.logError('Final Invoice list retrieval', error, req, res);
    next(error);
  }
}
@httpGet("/getAll")
async getAllInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
      const invoice = await this.invoiceService.getAllInvoice();
      
      // 🔔 Send notification for all invoices list
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Retrieved ${invoice.length} invoices`,
            userId
          );
        }
      } catch (notifError) {
        console.log('All invoices list notification error:', notifError);
      }
      
      ControllerLogger.logList('Invoice (All)', req, res);

      res.status(200).json({
          data:invoice,
      });
  } catch (error) {
    console.log(error);
    ControllerLogger.logError('All Invoice list retrieval', error, req, res);
    next(error);
  }
}

@httpPost("/update-returns/:deliveryChallanId")
async updateDeliveryChallanReturns(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
      const { deliveryChallanId } = req.params;
      await this.invoiceService.updateDeliveryChallanWithReturns(deliveryChallanId);
      
      // 🔔 Send notification for delivery challan returns update
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Delivery challan ${deliveryChallanId} updated with return data`,
            userId
          );
        }
      } catch (notifError) {
        console.log('Delivery challan returns update notification error:', notifError);
      }
      
      ControllerLogger.logSuccess('Delivery Challan returns updated', deliveryChallanId, req, res);

      res.status(200).json({
          message: 'Delivery challan updated with return data successfully',
      });
  } catch (error) {
    console.log(error);
    ControllerLogger.logError('Delivery Challan returns update', error, req, res);
    next(error);
  }
}
}
