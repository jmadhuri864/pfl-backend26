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
import { CustomerService } from '../services/customer.service';
import { TYPES } from '../types';
import AppError from '../utils/appError';
import { NextFunction, Request, Response } from 'express';
import { upload } from '../middleware/multifileupload';
import logger from '../utils/logger';
import { PaginationOptions } from '../utils/pagination';
import { uploadFileMultiple } from '../middleware/multiFileWithAWS';
import { deserializeUser, requireUser } from '../middleware/deserializeUser';
import { generateIncrementalCode } from '../utils/codeGeneration';
import { Status } from '../utils/status.enum';

@controller('/customers', deserializeUser, requireUser)
export class CustomerController {
  constructor(
    @inject(TYPES.CustomerService)
    private customerService: CustomerService,
  ) {}

  @httpPost(
    '/',
    uploadFileMultiple.fields([
      { name: 'customerImage', maxCount: 1 },
      { name: 'cancelledChequeCopy', maxCount: 1 },
      { name: 'bankStatementCopy', maxCount: 1 },
      { name: 'panCopy', maxCount: 1 },
      { name: 'aadharCopy', maxCount: 1 },
      { name: 'billBookCopy', maxCount: 1 },
      { name: 'incorpoCertificateCopy', maxCount: 1 },
      { name: 'regiCertificateCopy', maxCount: 1 },
      { name: 'billingFormatCopy', maxCount: 1 },
      { name: 'billingAddressProofCopy', maxCount: 1 },
      { name: 'deliveryAddressProofCopy', maxCount: 1 },
      { name: 'docEvidenceCopy', maxCount: 1 },
      { name: 'mandiLicenceCopy', maxCount: 1 },
      { name: 'regiCopy', maxCount: 1 },
      { name: 'electricityBillCopy', maxCount: 1 },
      { name: 'visitingCardCopy', maxCount: 1 },
      { name: 'lc', maxCount: 1 },
      { name: 'bg', maxCount: 1 },
    ]),
  )
  public async create(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      // Parse the customer data using Zod schema
      console.log('inthe customer', req.body);
      logger.info('Creating a new customer');

      const files = req.files as {
        [fieldname: string]: Express.MulterS3.File[];
      };

      const customerData = req.body;
customerData.createdBy = res.locals.user.id;
      customerData.bankDetailsCust = customerData.bankDetailsCust || {};
      customerData.statutoryDetails = customerData.statutoryDetails || {};
      customerData.billingDetails = customerData.billingDetails || {};
      customerData.deliveryDetails = customerData.deliveryDetails || {};
      customerData.paymentTerms = customerData.paymentTerms || {};
      customerData.keyMobileNumbers = customerData.keyMobileNumbers || {};
      if (files.customerImage?.[0])
        customerData.customerImage = files.customerImage[0].location;
      if (files.cancelledChequeCopy?.[0])
        customerData.bankDetailsCust.cancelledChequeCopy =
          files.cancelledChequeCopy[0].location;
      if (files.bankStatementCopy?.[0])
        customerData.bankDetailsCust.bankStatementCopy =
          files.bankStatementCopy[0].location;
      if (files.panCopy?.[0])
        customerData.statutoryDetails.panCopy = files.panCopy[0].location;
      if (files.aadharCopy?.[0])
        customerData.statutoryDetails.aadharCopy = files.aadharCopy[0].location;
      if (files.billBookCopy?.[0])
        customerData.statutoryDetails.billBookCopy =
          files.billBookCopy[0].location;
      if (files.incorpoCertificateCopy?.[0])
        customerData.statutoryDetails.incorpoCertificateCopy =
          files.incorpoCertificateCopy[0].location;
      if (files.regiCertificateCopy?.[0])
        customerData.statutoryDetails.regiCertificateCopy =
          files.regiCertificateCopy[0].location;
      if (files.billingFormatCopy?.[0])
        customerData.billingDetails.billingFormatCopy =
          files.billingFormatCopy[0].location;
      if (files.billingAddressProofCopy?.[0])
        customerData.billingDetails.billingAddressProofCopy =
          files.billingAddressProofCopy[0].location;
      if (files.deliveryAddressProofCopy?.[0])
        customerData.deliveryDetails.deliveryAddressProofCopy =
          files.deliveryAddressProofCopy[0].location;
      if (files.lc?.[0]) customerData.paymentTerms.lc = files.lc[0].location;
      if (files.bg?.[0]) customerData.paymentTerms.bg = files.bg[0].location;
      if (files.docEvidenceCopy?.[0])
        customerData.paymentTerms.docEvidenceCopy =
          files.docEvidenceCopy[0].location;
      if (files.mandiLicenceCopy?.[0])
        customerData.keyMobileNumbers.mandiLicenceCopy =
          files.mandiLicenceCopy[0].location;
      if (files.regiCopy?.[0])
        customerData.keyMobileNumbers.regiCopy = files.regiCopy[0].location;
      if (files.electricityBillCopy?.[0])
        customerData.keyMobileNumbers.electricityBillCopy =
          files.electricityBillCopy[0].location;
      if (files.visitingCardCopy?.[0])
        customerData.keyMobileNumbers.visitingCardCopy =
          files.visitingCardCopy[0].location;

customerData.customerCode = await generateIncrementalCode('customer')
      const customer = await this.customerService.create(customerData);
      console.log('customer is ', customer);

      logger.info('Customer created successfully', { customer });
      res.status(201).json({
        status: 'success',
        message: 'Customer created successfully',
        data: customer,
      });
    } catch (err) {
      console.log(err);
      logger.error('Error creating customer', { error: err });
      next(err);
    }
  }

  // @httpGet('/')
  // public async getAllCustomers(
  //   @request() req: Request,
  //   @response() res: Response,
  //   @next() next: NextFunction,
  // ) {
  //   try {
  //     logger.info('Fetching all customers');
  //     const { page, limit, search, sort, organisationName } = req.query;

  //     const queryOptions: PaginationOptions = {
  //       page: page ? Number(page) : undefined,
  //       limit: limit ? Number(limit) : undefined,
  //       //searchFields: ['cutomer.organisationName'],
  //       filters: {},
  //       sort: (sort as string) || undefined,
  //       search: (search as string) || '',
  //     };
  //     const customers = await this.customerService.findAllCustomers(
  //       queryOptions,
  //     );
  //     logger.info('Customers retrieved successfully', { customers });

  //     res.status(200).json({
  //       status: 'success',
  //       data: customers.data,
  //       allRecords: customers.meta.total,
  //       totalPages: customers.meta.pages,
  //       page: customers.meta.page,
  //     });
  //   } catch (err) {
  //     logger.error('Error fetching customers', { error: err });
  //     next(err);
  //   }
  // }

@httpPatch("/approve/:id")
async approveCustomer(req: Request, res: Response, next: NextFunction) {
try {
const customerId = req.params.id;
const adminUser = res.locals.user.id;
const status = req.query.status as Status;


const approvedCustomer = await this.customerService.approveCustomer(customerId, adminUser,status);
return res.status(200).json({ message: "customer approved successfully", customer: approvedCustomer });
} catch (error: any) {
  next(error);

}
}
  @httpGet('/')
  public async getAllCustomers(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Fetching all customers');
      const { page, limit, search, sort } = req.query;

      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        searchFields: ['organisationName', 'customerCategory.name', 'customerTypes.name'],
        filters: {},
        sort: (sort as string) || undefined,
        search: (search as string) || '',
      };
      const customers = await this.customerService.findAllCustomers(
        queryOptions,
      );
      logger.info('Customers retrieved successfully', { customers });

      res.status(200).json({
        status: 'success',
        data: customers.data,
        allRecords: customers.meta.total,
        totalPages: customers.meta.pages,
        page: customers.meta.page,
      });
    } catch (err) {
      logger.error('Error fetching customers', { error: err });
      next(err);
    }
  }

  @httpGet('/names/all')
  public async getAllCustomersNames(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Fetching all customers');
      const customers = await this.customerService.getCustomersName();
      logger.info('Customers retrieved successfully', { customers });

      res.status(200).json({
        status: 'success',
        data: customers,
      });
    } catch (err) {
      logger.error('Error fetching customers', { error: err });
      next(err);
    }
  }

  @httpGet('/partial/all/:id')
  public async getCustomerByIdName(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Fetching customer by ID', { id });
      const customer = await this.customerService.getCustomerFilterById(id);

      if (!customer) {
        logger.warn('Customer not found', { id });
        throw new AppError(404, 'Customer not found');
      }
      logger.info('Customer retrieved successfully', { customer });

      res.status(200).json({
        status: 'success',
        data: customer.customer,
      });
    } catch (err) {
      logger.error('Error fetching customer by ID', { error: err });
      next(err);
      console.log(err);
    }
  }

  @httpGet('/:id')
  public async getCustomerById(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Fetching customer by ID', { id });
      const customer = await this.customerService.findCustomerById(id);

      if (!customer) {
        logger.warn('Customer not found', { id });
        throw new AppError(404, 'Customer not found');
      }
      logger.info('Customer retrieved successfully', { customer });

      res.status(200).json({
        status: 'success',
        data: customer,
      });
    } catch (err) {
      logger.error('Error fetching customer by ID', { error: err });
      next(err);
      console.log(err);
    }
  }


  @httpGet('/view/:id')
  public async getCustomerByIdforview(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Fetching customer by ID', { id });
      const customer = await this.customerService.findCustomerByIdforview(id);

      if (!customer) {
        logger.warn('Customer not found', { id });
        throw new AppError(404, 'Customer not found');
      }
      logger.info('Customer retrieved successfully', { customer });

      res.status(200).json({
        status: 'success',
        data: customer,
      });
    } catch (err) {
      logger.error('Error fetching customer by ID', { error: err });
      next(err);
      console.log(err);
    }
  }



  @httpGet('/update/:id')
  public async getCustomerByIdforUpdate(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Fetching customer by ID', { id });
      const customer = await this.customerService.findCustomerByIdforupdate(id);

      if (!customer) {
        logger.warn('Customer not found', { id });
        throw new AppError(404, 'Customer not found');
      }
      logger.info('Customer retrieved successfully', { customer });

      res.status(200).json({
        status: 'success',
        data: customer,
      });
    } catch (err) {
      logger.error('Error fetching customer by ID', { error: err });
      next(err);
      console.log(err);
    }
  }


  @httpPatch(
    '/:id',
    uploadFileMultiple.fields([
      { name: 'customerImage', maxCount: 1 },
      { name: 'cancelledChequeCopy', maxCount: 1 },
      { name: 'bankStatementCopy', maxCount: 1 },
      { name: 'panCopy', maxCount: 1 },
      { name: 'aadharCopy', maxCount: 1 },
      { name: 'billBookCopy', maxCount: 1 },
      { name: 'incorpoCertificateCopy', maxCount: 1 },
      { name: 'regiCertificateCopy', maxCount: 1 },
      { name: 'billingFormatCopy', maxCount: 1 },
      { name: 'billingAddressProofCopy', maxCount: 1 },
      { name: 'deliveryAddressProofCopy', maxCount: 1 },
      { name: 'docEvidenceCopy', maxCount: 1 },
      { name: 'mandiLicenceCopy', maxCount: 1 },
      { name: 'regiCopy', maxCount: 1 },
      { name: 'electricityBillCopy', maxCount: 1 },
      { name: 'visitingCardCopy', maxCount: 1 },
      { name: 'lc', maxCount: 1 },
      { name: 'bg', maxCount: 1 },
    ]),
  )
  public async updateCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      logger.info('Updating customer');
      const { id } = req.params;
      console.log(id);
      console.log(req.body);
      const updatedBy = res.locals.updatedBy;
      const customerData = req.body;
      const files = req.files as {
        [fieldname: string]: Express.MulterS3.File[];
      };
      if (files) {
        // if (files.customerImage?.[0]) customerData.customerImage = files.customerImage[0].location;
        if (files.cancelledChequeCopy?.[0])
          customerData.bankDetailsCust.cancelledChequeCopy =
            files.cancelledChequeCopy[0].location;
        if (files.bankStatementCopy?.[0])
          customerData.bankDetailsCust.bankStatementCopy =
            files.bankStatementCopy[0].location;
        if (files.panCopy?.[0])
          customerData.statutoryDetails.panCopy = files.panCopy[0].location;
        if (files.aadharCopy?.[0])
          customerData.statutoryDetails.aadharCopy =
            files.aadharCopy[0].location;
        if (files.billBookCopy?.[0])
          customerData.statutoryDetails.billBookCopy =
            files.billBookCopy[0].location;
        if (files.incorpoCertificateCopy?.[0])
          customerData.statutoryDetails.incorpoCertificateCopy =
            files.incorpoCertificateCopy[0].location;
        if (files.regiCertificateCopy?.[0])
          customerData.statutoryDetails.regiCertificateCopy =
            files.regiCertificateCopy[0].location;
        if (files.billingFormatCopy?.[0])
          customerData.billingDetails.billingFormatCopy =
            files.billingFormatCopy[0].location;
        if (files.billingAddressProofCopy?.[0])
          customerData.billingDetails.billingAddressProofCopy =
            files.billingAddressProofCopy[0].location;
        if (files.deliveryAddressProofCopy?.[0])
          customerData.deliveryDetails.deliveryAddressProofCopy =
            files.deliveryAddressProofCopy[0].location;
        if (files.lc?.[0]) customerData.paymentTerms.lc = files.lc[0].location;
        if (files.bg?.[0]) customerData.paymentTerms.bg = files.bg[0].location;
        if (files.docEvidenceCopy?.[0])
          customerData.paymentTerms.docEvidenceCopy =
            files.docEvidenceCopy[0].location;
        if (files.mandiLicenceCopy?.[0])
          customerData.keyMobileNumbers.mandiLicenceCopy =
            files.mandiLicenceCopy[0].location;
        if (files.regiCopy?.[0])
          customerData.keyMobileNumbers.regiCopy = files.regiCopy[0].location;
        if (files.electricityBillCopy?.[0])
          customerData.keyMobileNumbers.electricityBillCopy =
            files.electricityBillCopy[0].location;
        if (files.visitingCardCopy?.[0])
          customerData.keyMobileNumbers.visitingCardCopy =
            files.visitingCardCopy[0].location;
      }
      const updatedCustomer = await this.customerService.updateCustomer(
        id,
        customerData,
        updatedBy,
      );

      if (!updatedCustomer) {
        logger.warn('Customer not found for update', { id });
        return res.status(404).json({ message: 'Customer not found' });
      }
      logger.info('Customer updated successfully', { updatedCustomer });
      return res.status(200).json({
        message: 'Customer updated successfully',
        data: updatedCustomer,
      });
    } catch (error) {
      logger.error('Error updating customer', { error });
      console.log(error);
      next(error);
    }
  }

  @httpDelete(':/id')
  public async deleteCustomer(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> {
    try {
      logger.info('Deleting customer');
      const { id } = req.params;

      const deletedCustomer = await this.customerService.deleteCustomer(id);
      if (!deletedCustomer) {
        logger.warn('Customer not found for delete', { id });
        return res.status(404).json({ message: 'Customer not found' });
      }
      logger.info('Customer deleted successfully', { deletedCustomer });
      return res.status(200).json({
        message: 'Customer deleted successfully',
        //data: ,
      });
    } catch (error) {
      logger.error('Error deleting customer', { error });
      next(error);
    }
  }
  @httpPost("/upload/customerdata", upload.single('file'))
    public uploadFile(@request() req: Request, @response() res: Response) {
            if (!req.file) {
                return res.status(400).send("No file uploaded");
            }
            try {
                this.customerService.upload(req.file.path);
                return res.status(200).send("Customers uploaded successfully");
            } catch (error) {
                console.error(error);
                return res.status(500).send("Error uploading file");
            }
        }
}
function validateDate(date: string | null): Date | null {
  if (!date || date.trim() === '') {
    return null;
  }
  const parsedDate = new Date(date);
  return isNaN(parsedDate.getTime()) ? null : parsedDate;
}
