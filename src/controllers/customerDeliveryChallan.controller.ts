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
} from 'inversify-express-utils';
import { inject } from 'inversify';
import { TYPES } from '../types';
import { CustomerDeliveryChallanService } from '../services/customerDeliveryChallan.service';
import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/appError';
import { ControllerLogger } from '../utils/controllerLogger';
import {
  deserializeUser,
  requireUser,
  captureUser,
} from '../middleware/deserializeUser';
import { PaginationOptions } from '../utils/pagination';
import { uploadFile } from '../middleware/uploadwithAWS';

@controller('/customer-delivery-challan', deserializeUser, requireUser)
export class CustomerDeliveryChallanController {
  constructor(
    @inject(TYPES.CustomerDeliveryChallanService)
    private customerDeliveryChallanService: CustomerDeliveryChallanService,
  ) {}

  @httpPost('/',uploadFile.single('anyAttachment'))
  public async createChallan(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      if (req.file) {
        const imageUrl = (req.file as any).location;
        if (imageUrl) {
          req.body.anyAttachment = imageUrl;
        }
      }

      const requestedBy = res.locals.user.id;

      const challan = await this.customerDeliveryChallanService.create(
        req.body,
        requestedBy
      );
      
      if (!challan) {
        ControllerLogger.logOperationFailed('Create', 'Customer Delivery Challan', 'Creation failed', req, res);
        return next(
          new AppError(400, 'Customer delivery challan could not be created'),
        );
      }

      ControllerLogger.logSuccess('Customer Delivery Challan created', challan.id, req, res);
      res.status(201).json({
        status: 'success',
        message: 'Customer delivery challan created successfully',
        data: challan,
      });
    } catch (err) {
      ControllerLogger.logError('Create Customer Delivery Challan', err, req, res);
      next(err);
    }
  }

  @httpGet('/update/:id')
  public async getChallanById(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const challan = await this.customerDeliveryChallanService.getByIdCustomerDeliveryChallanforUpdate(id);

      if (!challan) {
        ControllerLogger.logNotFound('Customer Delivery Challan', id, req, res);
        return next(new AppError(404, 'Customer delivery challan not found'));
      }

      ControllerLogger.logView('Customer Delivery Challan (for update)', id, req, res);
      res.status(200).json({
        status: 'success',
        data: challan.data,
      });
    } catch (err) {
      ControllerLogger.logError('Get Customer Delivery Challan for update', err, req, res);
      next(err);
    }
  }

   @httpGet('/view/:id')
  public async getChallanByIdforView(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const challan = await this.customerDeliveryChallanService.getByIdCustomerDeliveryChallanForView(id);

      if (!challan) {
        ControllerLogger.logNotFound('Customer Delivery Challan', id, req, res);
        return next(new AppError(404, 'Customer delivery challan not found'));
      }

      ControllerLogger.logView('Customer Delivery Challan', id, req, res);
      res.status(200).json({
        status: 'success',
        data: challan.data,
      });
    } catch (err) {
      ControllerLogger.logError('Get Customer Delivery Challan for view', err, req, res);
      next(err);
    }
  }


  @httpGet('/')
  public async getAllChallans(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const { page, limit, search, sort, deliveryChallanId } = req.query;
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
       // searchFields: ['deliveryChallanId'],
        filters: {},
        sort: (sort as string) || undefined,
        search: (search as string) || '',
      };

      const userId = res.locals.user.id;

      const challans =
        await this.customerDeliveryChallanService.getAllCustomerDeliveryChallans(
          queryOptions,
          userId
        );

      if (!challans || challans.length === 0) {
        ControllerLogger.logOperationFailed('Get All', 'Customer Delivery Challans', 'No records found', req, res);
        return next(new AppError(404, 'No customer delivery challans found'));
      }
    
      ControllerLogger.logGetAllRecords('Customer Delivery Challans', req, res);
      res.status(200).json({
        status: 'success',
          data: challans.data,
      allRecords: challans.meta.total,
      totalPages: challans.meta.pages,
      page: challans.meta.page,
    })}
      
    catch (err) {
      ControllerLogger.logError('Get All Customer Delivery Challans', err, req, res);
      next(err);
    }
  }

  @httpPatch('/:id', captureUser,uploadFile.single('anyAttachment'))
  public async updateChallan(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const updatedBy = res.locals.updatedBy;

      if(req.file){
        const imageUrl = (req.file as any).location;
       if (imageUrl) {
        req.body.anyAttachment = imageUrl;
       }
     }
      const challan = await this.customerDeliveryChallanService.update(id, {
        ...req.body,
        updatedBy,
      });

      if (!challan) {
        ControllerLogger.logNotFound('Customer Delivery Challan', id, req, res);
        return next(
          new AppError(404, 'Challan not found or could not be updated'),
        );
      }

      ControllerLogger.logSuccess('Customer Delivery Challan updated', id, req, res);
      res.status(200).json({
        status: 'success',
        message: 'Customer delivery challan updated successfully',
      });
    } catch (err) {
      ControllerLogger.logError('Update Customer Delivery Challan', err, req, res);
      next(err);
    }
  }

  @httpDelete('/')
  public async deleteChallan(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const id = req.query.id as string;

      const result = await this.customerDeliveryChallanService.delete(id);

      if (!result) {
        ControllerLogger.logNotFound('Customer Delivery Challan', id, req, res);
        return next(
          new AppError(404, 'Challan not found or could not be deleted'),
        );
      }

      ControllerLogger.logSuccess('Customer Delivery Challan deleted', id, req, res);
      res.status(200).json({
        status: 'success',
        message: 'Customer delivery challan deleted successfully',
      });
    } catch (err) {
      ControllerLogger.logError('Delete Customer Delivery Challan', err, req, res);
      next(err);
    }
  }

  @httpPost('/update-returns/:id')
  public async updateChallanWithReturns(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      await this.customerDeliveryChallanService.updateDeliveryChallanProductsWithReturns(id);

      ControllerLogger.logSuccess('Delivery Challan updated with returns', id, req, res);
      res.status(200).json({
        status: 'success',
        message: 'Delivery challan updated with return data successfully',
      });
    } catch (err) {
      ControllerLogger.logError('Update Delivery Challan with returns', err, req, res);
      next(err);
    }
  }

  @httpGet('/net-amounts/:id')
  public async getChallanWithNetAmounts(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const challan = await this.customerDeliveryChallanService.getDeliveryChallanWithNetAmounts(id);

      if (!challan) {
        ControllerLogger.logNotFound('Delivery Challan', id, req, res);
        return next(new AppError(404, 'Delivery challan not found'));
      }

      ControllerLogger.logView('Delivery Challan with net amounts', id, req, res);
      res.status(200).json({
        status: 'success',
        data: challan,
      });
    } catch (err) {
      ControllerLogger.logError('Get Delivery Challan with net amounts', err, req, res);
      next(err);
    }
  }
}
