import { controller, httpGet, httpPost } from "inversify-express-utils";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import { NextFunction, Request, Response } from "express";
import { inject } from "inversify";
import { TYPES } from "../types";
import { InvoiceService } from "../services/invoice.service";
import AppError from "../utils/appError";

@controller("/invoice", deserializeUser, requireUser)
export class InvoiceController {
  constructor(
    @inject(TYPES.InvoiceService)
    private readonly invoiceService: InvoiceService
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
      res.status(201).json(newCrop);
    } catch (error) {
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

        res.status(201).json({
            message: 'Invoice generated successfully',
            invoiceurl: invoice.pdfData,
        });
    } catch (error) {
      console.log(error)
      next(error);
      
       // res.status(500).json({ message: error });
    }
}
@httpPost("/generate/final/:deliveryChallanId")
  async generatefinalInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { deliveryChallanId } = req.params;
        const invoiceType='final';
        const invoice = await this.invoiceService.generateInvoiceq(deliveryChallanId,invoiceType);
        if(!invoice){
          return next(new AppError(400 ,'Delivery Challan not found'))
        }

        res.status(201).json({
            message: 'Invoice generated successfully',
            invoiceurl: invoice.pdfData,
        });
    } catch (error) {
      console.log(error)
      next(error);
      
       // res.status(500).json({ message: error });
    }
}
@httpGet("/getInvoice/:deliveryChallanId")
async getInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
      const { deliveryChallanId } = req.params;
      const invoice = await this.invoiceService.getInvoice(deliveryChallanId);

      res.status(200).json({
          //message: 'Invoice generated successfully',
          data:invoice.pdfData,
      });
  } catch (error) {
    console.log(error);
      res.status(500).json({ message: error });
  }
}
@httpGet("/getproforma/all")
async getproformaInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
     
      const invoice = await this.invoiceService.getProformaInvoice();

      res.status(200).json({
          //message: 'Invoice generated successfully',
          data:invoice,
      });
  } catch (error) {
    console.log(error);
      res.status(500).json({ message: error });
  }
}

@httpGet("/getfinal/all")
async getfinalInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
     
      const invoice = await this.invoiceService.getFinalInvoice();

      res.status(200).json({
          message: 'Invoice getting successfully',
          data:invoice,
      });
  } catch (error) {
    console.log(error);
      res.status(500).json({ message: error });
  }
}
@httpGet("/getAll")
async getAllInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
     
      const invoice = await this.invoiceService.getAllInvoice();

      res.status(200).json({
          //message: 'Invoice generated successfully',
          data:invoice,
      });
  } catch (error) {
    console.log(error);
      res.status(500).json({ message: error });
  }
}
}
