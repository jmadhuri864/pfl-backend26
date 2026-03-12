import {
  controller,
  httpPost,
  request,
  response,
  next,
} from 'inversify-express-utils';
import { deserializeUser, requireUser } from '../middleware/deserializeUser';
import { inject } from 'inversify';
import { TYPES } from '../types';
import { Request, Response, NextFunction } from 'express';
import { DeliveryChallanReportService } from '../services/deliveryChallanReport.service';
import { NotificationService } from '../services/notification.service';
import { ControllerLogger } from '../utils/controllerLogger';
import AppError from '../utils/appError';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from '../middleware/spaces.config';
import { 
  IDeliveryChallanReportDownloadRequest, 
  IDeliveryChallanReportFilters 
} from '../interfaces/deliveryChallan-report.interface';

@controller('/delivery-challan-report', deserializeUser, requireUser)
export class DeliveryChallanReportController {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(
    @inject(TYPES.DeliveryChallanReportService)
    private readonly deliveryChallanReportService: DeliveryChallanReportService,
    @inject(TYPES.NotificationService)
    private readonly notificationService: NotificationService
  ) {
    this.s3Client = s3;
    this.bucketName = process.env.DO_SPACES_BUCKET || 'your-bucket-name';
  }

  @httpPost('/download')
  async downloadDeliveryChallanReport(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const body: IDeliveryChallanReportDownloadRequest = req.body;

      // Validate request
      this.validateRequest(body, req, res, next);

      // Transform request to filters
      const filters = this.transformToFilters(body);

      // Get logged-in user info
      const userId = res.locals.user?.id;
      const loggedInUser = userId ? res.locals.user : null;

      // Generate Excel report
      const excelBuffer = await this.deliveryChallanReportService.generateDeliveryChallanExcelReport(
        filters, 
        loggedInUser
      );

      if (!excelBuffer) {
        ControllerLogger.logOperationFailed(
          'Export', 
          'Delivery Challan Report', 
          'No data found for the given filters', 
          req, 
          res
        );
        return res.status(404).json({
          status: 'error',
          message: 'No data found for the given filters',
        });
      }

      // Upload to cloud and get URL
      const fileUrl = await this.uploadToCloud(excelBuffer);

      // Send notification
      await this.sendNotification(undefined, fileUrl, res);

      ControllerLogger.logSuccess(
        'Delivery Challan report stored in DigitalOcean Spaces', 
        fileUrl, 
        req, 
        res
      );

      res.status(200).json({
        status: 'success',
        message: 'Delivery Challan report generated and stored successfully',
        data: { fileUrl },
      });
    } catch (err) {
      ControllerLogger.logError('Export Delivery Challan Report', err, req, res);
      next(err);
    }
  }

  private validateRequest(
    body: IDeliveryChallanReportDownloadRequest,
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      ControllerLogger.logValidationError(
        'Export Delivery Challan Report', 
        'Missing date range', 
        req, 
        res
      );
      throw new AppError(400, 'startDate and endDate are required');
    }
  }

  private transformToFilters(body: IDeliveryChallanReportDownloadRequest): IDeliveryChallanReportFilters {
    const {
      startDate,
      endDate,
      company,
      office,
      customer,
      fromLocation,
      createdBy,
      product,
      challanNo,
      grnNo,
      approvalStatus,
      requestingDepartment,
      driverName,
      vehicleNo,
      licenseNo,
      rmn,
      receiverName,
      totalProductAmount,
      totalProductAmountOperator,
      netProductWeight,
      netProductWeightOperator,
      invoiceGenerated,
      invoiceType,
      isReturned,
    } = body;

    return {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      company: this.toArray(company),
      office: this.toArray(office),
      customer: this.toArray(customer),
      fromLocation: this.toArray(fromLocation),
      createdBy: this.toArray(createdBy),
      product: this.toArray(product),
      challanNo,
      grnNo,
      approvalStatus,
      requestingDepartment,
      driverName,
      vehicleNo,
      licenseNo,
      rmn,
      receiverName,
      totalProductAmount,
      totalProductAmountOperator,
      netProductWeight,
      netProductWeightOperator,
      invoiceGenerated,
      invoiceType,
      isReturned,
    };
  }

  private toArray(value: string | string[] | undefined): string[] | undefined {
    if (!value) return undefined;
    return Array.isArray(value) ? value : [value];
  }

  private async uploadToCloud(excelBuffer: Buffer): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `Delivery_Challan_Report_${timestamp}.xlsx`;
    const s3Key = `reports/delivery-challan/${fileName}`;

    const uploadParams = {
      Bucket: this.bucketName,
      Key: s3Key,
      Body: excelBuffer,
      ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ContentDisposition: `attachment; filename="${fileName}"`,
      ACL: 'public-read' as const,
    };

    await this.s3Client.send(new PutObjectCommand(uploadParams));

    return `https://${this.bucketName}.sgp1.digitaloceanspaces.com/${s3Key}`;
  }

  private async sendNotification(
    employeeId: string | undefined, 
    fileName: string, 
    res: Response
  ): Promise<void> {
    try {
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Delivery Challan report stored in cloud: ${fileName}`,
          userId
        );
      }
    } catch (error) {
      console.log('Delivery Challan report notification error:', error);
    }
  }
}
