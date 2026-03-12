import {
  controller,
  httpPost,
  httpGet,
  httpPatch,
  request,
  requestParam,
  response,
  next,
} from 'inversify-express-utils';
import { inject } from 'inversify';
import { TYPES } from '../types';
import { FinalInvoiceService } from '../services/finalInvoice.service';
import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/appError';
import { ControllerLogger } from '../utils/controllerLogger';
import {
  deserializeUser,
  requireUser,
  captureUser,
} from '../middleware/deserializeUser';
import { PaginationOptions } from '../utils/pagination';
import { NotificationService } from '../services/notification.service';
import { PdfGeneratorService } from '../utils/pdfGenerator';

@controller('/final-invoice', deserializeUser, requireUser)
export class FinalInvoiceController {
  constructor(
    @inject(TYPES.FinalInvoiceService)
    private finalInvoiceService: FinalInvoiceService,
    @inject(TYPES.NotificationService)
    private notificationService: NotificationService,
    @inject(TYPES.PdfGeneratorService)
    private pdfGeneratorService: PdfGeneratorService,
  ) {}

  @httpPost('/:deliveryChallanId')
  public async createInvoice(
    @requestParam('deliveryChallanId') deliveryChallanId: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const createdBy = res.locals.user.id;

      const invoice = await this.finalInvoiceService.create(
        deliveryChallanId,
        req.body,
        createdBy
      );

      if (!invoice) {
        ControllerLogger.logOperationFailed('Create', 'Final Invoice', 'Creation failed', req, res);
        return next(
          new AppError(400, 'Final invoice could not be created'),
        );
      }

      // 🔔 Send notification for invoice creation
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Final invoice "${invoice.invoiceNo}" created successfully`,
            userId
          );
        }
      } catch (notifError) {
        console.log('Final invoice creation notification error:', notifError);
      }

      ControllerLogger.logSuccess('Final Invoice created', invoice.id, req, res);
      res.status(201).json({
        status: 'success',
        message: 'Final invoice created successfully',
        data: invoice,
      });
    } catch (err) {
      ControllerLogger.logError('Create Final Invoice', err, req, res);
      next(err);
    }
  }

  @httpGet('/view/:id')
  public async getInvoiceByIdForView(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const invoice = await this.finalInvoiceService.getByIdForView(id);

      if (!invoice) {
        ControllerLogger.logNotFound('Final Invoice', id, req, res);
        return next(new AppError(404, 'Final invoice not found'));
      }

      // 🔔 Send notification for invoice view
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          const invoiceNo = invoice.data?.invoiceNo || 'Invoice';
          await this.notificationService.createNoti(
            `Viewed final invoice "${invoiceNo}" details`,
            userId
          );
        }
      } catch (notifError) {
        console.log('Final invoice view notification error:', notifError);
      }

      ControllerLogger.logView('Final Invoice', id, req, res);
      res.status(200).json({
        status: 'success',
        data: invoice.data,
      });
    } catch (err) {
      ControllerLogger.logError('Get Final Invoice for view', err, req, res);
      next(err);
    }
  }

  @httpGet('/update/:id')
  public async getInvoiceByIdForUpdate(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const invoice = await this.finalInvoiceService.getByIdForUpdate(id);

      if (!invoice) {
        ControllerLogger.logNotFound('Final Invoice', id, req, res);
        return next(new AppError(404, 'Final invoice not found'));
      }

      // 🔔 Send notification for invoice update view
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          const invoiceNo = invoice.data?.invoiceNo || 'Invoice';
          await this.notificationService.createNoti(
            `Final invoice "${invoiceNo}" opened for editing`,
            userId
          );
        }
      } catch (notifError) {
        console.log('Final invoice update view notification error:', notifError);
      }

      ControllerLogger.logView('Final Invoice (for update)', id, req, res);
      res.status(200).json({
        status: 'success',
        data: invoice.data,
      });
    } catch (err) {
      ControllerLogger.logError('Get Final Invoice for update', err, req, res);
      next(err);
    }
  }

  @httpGet('/')
  public async getAllInvoices(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const { page, limit, search, sort } = req.query;
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        filters: {},
        sort: (sort as string) || undefined,
        search: (search as string) || '',
      };

      const userId = res.locals.user.id;

      const invoices = await this.finalInvoiceService.getAll(
        queryOptions,
        userId
      );

      if (!invoices || invoices.length === 0) {
        ControllerLogger.logOperationFailed('Get All', 'Final Invoices', 'No records found', req, res);
        return next(new AppError(404, 'No final invoices found'));
      }

      // 🔔 Send notification for get all invoices
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Retrieved ${invoices.meta.total} final invoices`,
            userId
          );
        }
      } catch (notifError) {
        console.log('Get all final invoices notification error:', notifError);
      }

      ControllerLogger.logGetAllRecords('Final Invoices', req, res);
      res.status(200).json({
        status: 'success',
        data: invoices.data,
        allRecords: invoices.meta.total,
        totalPages: invoices.meta.pages,
        page: invoices.meta.page,
      });
    } catch (err) {
      ControllerLogger.logError('Get All Final Invoices', err, req, res);
      next(err);
    }
  }

  @httpPatch('/:id', captureUser)
  public async updateInvoice(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const updatedBy = res.locals.updatedBy;

      const invoice = await this.finalInvoiceService.update(id, {
        ...req.body,
        updatedBy,
      });

      if (!invoice) {
        ControllerLogger.logNotFound('Final Invoice', id, req, res);
        return next(
          new AppError(404, 'Invoice not found or could not be updated'),
        );
      }

      // 🔔 Send notification for invoice update
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Final invoice with ID ${id} updated successfully`,
            userId
          );
        }
      } catch (notifError) {
        console.log('Final invoice update notification error:', notifError);
      }

      ControllerLogger.logSuccess('Final Invoice updated', id, req, res);
      res.status(200).json({
        status: 'success',
        message: 'Final invoice updated successfully',
      });
    } catch (err) {
      ControllerLogger.logError('Update Final Invoice', err, req, res);
      next(err);
    }
  }

  @httpGet('/download-pdf/:id')
  public async downloadInvoicePdf(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      console.log(`📥 Downloading invoice PDF for ID: ${id}`);

      // Fetch invoice data with all relations
      const invoiceData = await this.finalInvoiceService.getByIdForPdf(id);

      if (!invoiceData) {
        ControllerLogger.logNotFound('Final Invoice', id, req, res);
        return next(new AppError(404, 'Final invoice not found'));
      }

      console.log('📄 Generating invoice PDF...');
      // Generate invoice PDF
      const pdfUrl = await this.pdfGeneratorService.generateInvoicePdf(invoiceData);

      if (!pdfUrl) {
        ControllerLogger.logOperationFailed('Download PDF', 'Final Invoice', 'PDF generation failed', req, res);
        return next(new AppError(500, 'Failed to generate invoice PDF'));
      }

      // 🔔 Send notification for PDF download
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          const invoiceNo = invoiceData.invoiceNo || 'Invoice';
          await this.notificationService.createNoti(
            `Invoice PDF "${invoiceNo}" generated successfully`,
            userId
          );
        }
      } catch (notifError) {
        console.log('Invoice PDF download notification error:', notifError);
      }

      console.log('✅ Invoice PDF generated successfully:', pdfUrl);
      ControllerLogger.logSuccess('Invoice PDF generated', id, req, res);
      
      res.status(200).json({
        status: 'success',
        message: 'Invoice PDF generated successfully',
        data: {
          pdfUrl,
          invoiceNo: invoiceData.invoiceNo,
        },
      });
    } catch (err) {
      ControllerLogger.logError('Download Invoice PDF', err, req, res);
      next(err);
    }
  }
}
