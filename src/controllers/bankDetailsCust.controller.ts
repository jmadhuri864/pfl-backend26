import { Request, Response, NextFunction } from 'express';
import {
  controller,
  httpGet,
  httpPost,
  request,
  response,
  requestParam,
  next,
  httpDelete,
  httpPatch,
} from 'inversify-express-utils';
import { inject } from 'inversify';

import { TYPES } from '../types';
import AppError from '../utils/appError';
import { BankDetailsCustService } from '../services/bank-deatilsCust.service';
import { BankDetailsCust } from '../entities/bankDetailsCust.entity';

import { FileType } from '../utils/status.enum';
import path from 'path';
import { upload } from '../middleware/upload.middleware';

interface FileFields {
  bankStatementCopy?: Express.Multer.File[];
  cancelledChequeCopy?: Express.Multer.File[];
}
@controller('/customer-bank-details')
export class BankDetailsCustController {
  constructor(
    @inject(TYPES.BankDetailsCustService)
    private bankDetailsCustService: BankDetailsCustService,
  ) {}

  @httpPost(
    '/',
    upload.fields([
      { name: 'bankStatementCopy', maxCount: 1 },
      { name: 'cancelledChequeCopy', maxCount: 1 },
    ]),
  )
  public async createCustomerBankDetails(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      // Type assertion to handle file fields
      const uploadedFiles = req.files as {
        [fieldname: string]: Express.Multer.File[];
      };

      // Extract file data from req.files
      const bankStatementFile = uploadedFiles['bankStatementCopy']?.[0];
      const cancelledChequeFile = uploadedFiles['cancelledChequeCopy']?.[0];

      // Initialize bank details data
      const bankDetailsData = req.body;

      // Process bank statement file
      if (bankStatementFile) {
        const ext = path.extname(bankStatementFile.originalname).toLowerCase();
        if (ext === '.pdf') {
          bankDetailsData.bankStatementCopy = bankStatementFile.filename;
          bankDetailsData.chequeType = FileType.PDF;
        } else if (ext === '.jpeg' || ext === '.jpg' || ext === '.png') {
          bankDetailsData.bankStatementCopy = bankStatementFile.filename;
          bankDetailsData.chequeType = FileType.IMAGE;
        } else {
          return next(
            new AppError(400, 'Invalid file type for bank statement.'),
          );
        }
      } else {
        return next(new AppError(400, 'Bank statement copy is required.'));
      }

      // Process cancelled cheque file if required
      if (bankDetailsData.ifCancelledCheque) {
        if (cancelledChequeFile) {
          bankDetailsData.cancelledChequeCopy = cancelledChequeFile.filename;
        } else {
          return next(
            new AppError(
              400,
              'A copy of the cancelled cheque must be provided.',
            ),
          );
        }
      } else {
        // Ensure reason is provided if no cheque is given
        if (
          !bankDetailsData.notCancelledChequereason ||
          bankDetailsData.notCancelledChequereason.trim() === ''
        ) {
          return next(
            new AppError(
              400,
              'Reason for not providing the copy of the cancelled cheque is required.',
            ),
          );
        }
      }

      // Handle 'other' type of account
      if (bankDetailsData.accType === 'Other' && bankDetailsData.otherAccType) {
        bankDetailsData.accType = bankDetailsData.otherAccType;
      } else if (
        bankDetailsData.accType === 'Other' &&
        !bankDetailsData.otherAccType
      ) {
        return next(new AppError(400, 'Other account type must be specified.'));
      }

      // Create and save bank details using the service
      const bankDetails = await this.bankDetailsCustService.createBankDetails(
        bankDetailsData,
      );

      res.status(201).json({
        status: 'success',
        message: 'Customer bank details created successfully',
        //data: bankDetails,
      });
    } catch (err: any) {
      next(err); // Pass the error to the error handler
    }
  }

  @httpGet('/')
  public async getAllCustomerBankDetails(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const bankDetails = await this.bankDetailsCustService.findAll();

      if (!bankDetails || bankDetails.length === 0) {
        return next(new AppError(404, 'No customer bank details found'));
      }

      res.status(200).json({
        status: 'success',
        data: bankDetails,
      });
    } catch (err) {
      next(err);
    }
  }

  @httpGet('/:id')
  public async getCustomerBankDetailsById(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const bankDetails = await this.bankDetailsCustService.findById(id);

      if (!bankDetails) {
        return next(new AppError(404, 'Customer bank details not found'));
      }

      res.status(200).json({
        status: 'success',
        data: bankDetails,
      });
    } catch (err) {
      next(err);
    }
  }

  @httpPatch(
    '/:id',
    upload.fields([
      { name: 'bankStatementCopy', maxCount: 1 },
      { name: 'cancelledChequeCopy', maxCount: 1 },
    ]),
  )
  public async updateCustomerBankDetails(
    @requestParam('id') id: string,
    @request() req: Request<{}, {}, BankDetailsCust>,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const bankDetailsData = req.body;
      // Handling file uploads
      const files = req.files as {
        bankStatementCopy?: Express.Multer.File[];
        cancelledChequeCopy?: Express.Multer.File[];
      };

      // Add the file paths (if available) to the bank details data
      if (files?.bankStatementCopy) {
        bankDetailsData.bankStatementCopy = files.bankStatementCopy[0].path; // or save to cloud storage
      }

      if (files?.cancelledChequeCopy) {
        bankDetailsData.cancelledChequeCopy = files.cancelledChequeCopy[0].path; // or save to cloud storage
      }

      const updatedBankDetails = await this.bankDetailsCustService.update(
        id,
        bankDetailsData,
      );

      if (!updatedBankDetails) {
        return next(
          new AppError(
            404,
            'Customer bank details not found or could not be updated',
          ),
        );
      }

      res.status(200).json({
        status: 'success',
        message: 'Customer bank details updated successfully',
        data: updatedBankDetails,
      });
    } catch (err) {
      next(err);
    }
  }

  @httpDelete('/:id')
  public async deleteCustomerBankDetails(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const result = await this.bankDetailsCustService.delete(+id);

      if (!result) {
        return next(
          new AppError(
            404,
            'Customer bank details not found or could not be deleted',
          ),
        );
      }

      res.status(200).json({
        status: 'success',
        message: 'Customer bank details deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}
