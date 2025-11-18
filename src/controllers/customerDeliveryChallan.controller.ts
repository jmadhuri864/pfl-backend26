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
import logger from '../utils/logger';
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
      console.log('in controller',req.body);
      if (req.file) {
        const imageUrl = (req.file as any).location;
        console.log('imageurl is ', imageUrl);
        if (imageUrl) {
          req.body.anyAttachment = imageUrl;
        }
      }

      const requestedBy = res.locals.user.id;

      logger.info('Received request to create customer delivery challan');
      const challan = await this.customerDeliveryChallanService.create(
        req.body,
        requestedBy
      );
      console.log(challan);
      if (!challan) {
        logger.warn('Customer delivery challan creation failed');
        return next(
          new AppError(400, 'Customer delivery challan could not be created'),
        );
      }

      logger.info('Customer delivery challan created successfully');
      res.status(201).json({
        status: 'success',
        message: 'Customer delivery challan created successfully',
        data: challan,
      });
    } catch (err) {
      console.log(err);
      logger.error('Error creating challan', { error: err });
      next(err);
    }
  }

  @httpGet('/update/:id')
  public async getChallanById(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      console.log("in update get by id controller")
      logger.info(`Fetching customer delivery challan with ID: ${id}`);
      const challan = await this.customerDeliveryChallanService.getByIdCustomerDeliveryChallanforUpdate(id);

      if (!challan) {
        logger.warn(`Customer delivery challan with ID: ${id} not found`);
        return next(new AppError(404, 'Customer delivery challan not found'));
      }

      logger.info(`Fetched challan with ID: ${id} successfully`);
      res.status(200).json({
        status: 'success',
        data: challan.data,
      });
    } catch (err) {
      console.log(err)
      logger.error('Error fetching challan by ID', { error: err });
      next(err);
    }
  }

   @httpGet('/view/:id')
  public async getChallanByIdforView(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      console.log("in update get by id controller")
      logger.info(`Fetching customer delivery challan with ID: ${id}`);
      const challan = await this.customerDeliveryChallanService.getByIdCustomerDeliveryChallanForView(id);

      if (!challan) {
        logger.warn(`Customer delivery challan with ID: ${id} not found`);
        return next(new AppError(404, 'Customer delivery challan not found'));
      }

      logger.info(`Fetched challan with ID: ${id} successfully`);
      res.status(200).json({
        status: 'success',
        data: challan.data,
      });
    } catch (err) {
      console.log(err)
      logger.error('Error fetching challan by ID', { error: err });
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
        sort: (sort as string) || undefined, // Adjust this line to match your sorting requirements
        search: (search as string) || '',
      };

      const userId = res.locals.user.id;

      logger.info('Fetching all customer delivery challans');
      const challans =
        await this.customerDeliveryChallanService.getAllCustomerDeliveryChallans(
          queryOptions,
          userId
        );

      if (!challans || challans.length === 0) {
        logger.warn('No customer delivery challans found');
        return next(new AppError(404, 'No customer delivery challans found'));
      }
    

      res.status(200).json({
        status: 'success',
          data: challans.data,
      allRecords: challans.meta.total,
      totalPages: challans.meta.pages,
      page: challans.meta.page,
    })}
      
    catch (err) {
      logger.error('Error fetching all challans', { error: err });
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
      logger.info(`Updating challan with ID: ${id}`);
      const updatedBy = res.locals.updatedBy;

      if(req.file){
      
        const imageUrl = (req.file as any).location;
        console.log("imageurl is ",imageUrl)
       if (imageUrl) {
         
        req.body.anyAttachment = imageUrl;
       }
   
     }
      const challan = await this.customerDeliveryChallanService.update(id, {
        ...req.body,
        updatedBy,
      });

      if (!challan) {
        logger.warn(`Challan with ID: ${id} not found or could not be updated`);
        return next(
          new AppError(404, 'Challan not found or could not be updated'),
        );
      }

      logger.info(`Challan with ID: ${id} updated successfully`);
      res.status(200).json({
        status: 'success',
        message: 'Customer delivery challan updated successfully',
      });
    } catch (err) {
      logger.error('Error updating challan', { error: err });
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

      logger.info(`Deleting challan with ID: ${id}`);
      const result = await this.customerDeliveryChallanService.delete(id);

      if (!result) {
        logger.warn(`Challan with ID: ${id} not found or could not be deleted`);
        return next(
          new AppError(404, 'Challan not found or could not be deleted'),
        );
      }

      logger.info(`Challan with ID: ${id} deleted successfully`);
      res.status(200).json({
        status: 'success',
        message: 'Customer delivery challan deleted successfully',
      });
    } catch (err) {
      logger.error('Error deleting challan', { error: err });
      next(err);
    }
  }
}
