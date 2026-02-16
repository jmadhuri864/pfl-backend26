import { inject } from 'inversify';
import {
  controller,
  httpDelete,
  httpGet,
  httpPatch,
  httpPost,
  next,
  request,
  requestParam,
  response,
} from 'inversify-express-utils';
import { TYPES } from '../types';
import { BillingDetailsCustService } from '../services/billing-detailsCust.service';

import { NextFunction, Request, Response } from 'express';
import { upload } from '../middleware/upload.middleware';


@controller('/customer-billing-details')
export class BillingDetailsCustController {
  constructor(
    @inject(TYPES.BillingDetailsCustService)
    private billingDetailsCustService: BillingDetailsCustService,
  ) {}

  // Create billing details with file uploads
  @httpPost(
    '/',
    upload.fields([
      { name: 'billingFormatCopy', maxCount: 1 },
      { name: 'billingAddressProofCopy', maxCount: 1 },
    ]),
  )
  public async createBillingDetails(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const billingDetailsData = req.body;
      console.log(req.body);
      //console.log(req.body)

      // Handling file uploads
      const files = req.files as {
        billingFormatCopy?: Express.Multer.File[];
        billingAddressProofCopy?: Express.Multer.File[];
      };

      if (files?.billingFormatCopy) {
        billingDetailsData.billingFormatCopy = files.billingFormatCopy[0].path;
      }

      if (files?.billingAddressProofCopy) {
        billingDetailsData.billingAddressProofCopy =
          files.billingAddressProofCopy[0].path;
      }

      const newBillingDetails = await this.billingDetailsCustService.create(
        billingDetailsData,
      );

      res.status(201).json({
        status: 'success',
        data: newBillingDetails,
      });
    } catch (err) {
      next(err);
    }
  }

  // Update billing details with file uploads
  @httpPatch(
    '/:id',
    upload.fields([
      { name: 'billingFormatCopy', maxCount: 1 },
      { name: 'billingAddressProofCopy', maxCount: 1 },
    ]),
  )
  public async updateBillingDetails(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const billingDetailsData = req.body;

      // Handling file uploads
      const files = req.files as {
        billingFormatCopy?: Express.Multer.File[];
        billingAddressProofCopy?: Express.Multer.File[];
      };

      if (files?.billingFormatCopy) {
        billingDetailsData.billingFormatCopy = files.billingFormatCopy[0].path;
      }

      if (files?.billingAddressProofCopy) {
        billingDetailsData.billingAddressProofCopy =
          files.billingAddressProofCopy[0].path;
      }

      const updatedBillingDetails = await this.billingDetailsCustService.update(
        id,
        billingDetailsData,
      );

      res.status(200).json({
        status: 'success',
        message: 'Billing details updated successfully',
        data: updatedBillingDetails,
      });
    } catch (err) {
      next(err);
    }
  }

  // Get all billing details
  @httpGet('/')
  public async getAllBillingDetails(
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const billingDetails = await this.billingDetailsCustService.getAll();
      res.status(200).json({
        status: 'success',
        data: billingDetails,
      });
    } catch (err) {
      next(err);
    }
  }

  // Get billing details by ID
  @httpGet('/:id')
  public async getBillingDetailsById(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const billingDetails = await this.billingDetailsCustService.getById(id);
      res.status(200).json({
        status: 'success',
        data: billingDetails,
      });
    } catch (err) {
      next(err);
    }
  }

  // Delete billing details
  @httpDelete('/:id')
  public async deleteBillingDetails(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      await this.billingDetailsCustService.delete(id);
      res.status(204).json({
        status: 'success',
        message: 'Billing details deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}
