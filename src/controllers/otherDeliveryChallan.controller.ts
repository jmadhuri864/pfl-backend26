import {
  controller,
  httpGet,
  httpPatch,
  httpPost,
  next,
  request,
  response,
} from 'inversify-express-utils';
import { deserializeUser, requireUser } from '../middleware/deserializeUser';
import { TYPES } from '../types';
import { OtherDeliveryChallanService } from '../services/otherDeliveryChallan.service';
import { inject } from 'inversify';
import { NextFunction, Response, Request } from 'express';
import { PaginationOptions } from '../utils/pagination';
import { uploadFile } from '../middleware/uploadwithAWS';

@controller('/other-delivery-challan', deserializeUser, requireUser)
export class OtherDeliveryChallanController {
  constructor(
    @inject(TYPES.OtherDeliveryChallanService)
    private readonly otherDeliveryChallanService: OtherDeliveryChallanService,
  ) {}

  @httpPost('/', uploadFile.single('anyAttachment'))
  public async createOtherDeliveryChallan(
    @response() res: Response,
    @request() req: Request,
    @next() next: NextFunction,
  ) {
    try {
      const otherDeliveryChallanData = req.body;
otherDeliveryChallanData.createdBy=res.locals.user.id;
      if (req.file) {
        const imageUrl = (req.file as any).location;
        console.log('imageurl is ', imageUrl);
        if (imageUrl) {
          req.body.anyAttachment = imageUrl;
        }
      }
      const otherDeliveryChallan =
        await this.otherDeliveryChallanService.create(otherDeliveryChallanData);
      if (!otherDeliveryChallan) {
        return next(new Error('Other Delivery Challan could not be created'));
      }
      res.status(201).json({
        status: 'success',
        message: 'Other Delivery Challan created successfully',
        data: otherDeliveryChallan,
      });
    } catch (err) {
      next(err);
    }
  }

  @httpGet('/')
  public async getAllOtherDeliveryChallan(
    @response() res: Response,
    @request() req: Request,
    @next() next: NextFunction,
  ) {
    try {
      const { page, limit, search, sort, otherId } = req.query;

      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        searchFields: ['challan.id'],
        filters: {},
        sort: (sort as string) || undefined,
        search: (search as string) || '',
      };
      const otherDeliveryChallans =
        await this.otherDeliveryChallanService.getAll(queryOptions);
      res.status(200).json({
        status: 'success',
        data: otherDeliveryChallans.data,
        allRecords: otherDeliveryChallans.meta.total,
        totalPages: otherDeliveryChallans.meta.pages,
        page: otherDeliveryChallans.meta.page,
      });
    } catch (err) {
      next(err);
    }
  }

  @httpGet('/:id')
  public async getOtherDeliveryChallanById(
    @response() res: Response,
    @request() req: Request,
    @next() next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      const otherDeliveryChallan =
        await this.otherDeliveryChallanService.getById(id);
      if (!otherDeliveryChallan) {
        return next(new Error('Other Delivery Challan not found'));
      }
      res.status(200).json({
        status: 'success',
        data: otherDeliveryChallan.data,
      });
    } catch (err) {
      next(err);
    }
  }

  @httpGet('/view/:id')
  public async getOtherDeliveryChallanByIdForView(
    @response() res: Response,
    @request() req: Request,
    @next() next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      const otherDeliveryChallan =
        await this.otherDeliveryChallanService.getByIdChallanforView(id);
      if (!otherDeliveryChallan) {
        return next(new Error('Other Delivery Challan not found'));
      }
      res.status(200).json({
        status: 'success',
        data: otherDeliveryChallan,
      });
    } catch (err) {
      next(err);
    }
  }
  @httpGet('/update/:id')
  public async getOtherDeliveryChallanByIdForUpdate(
    @response() res: Response,
    @request() req: Request,
    @next() next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      const otherDeliveryChallan =
        await this.otherDeliveryChallanService.getByIdChallanforUpdate(id);
      if (!otherDeliveryChallan) {
        return next(new Error('Other Delivery Challan not found'));
      }
      res.status(200).json({
        status: 'success',
        data: otherDeliveryChallan,
      });
    } catch (err) {
      next(err);
    }
  }

  @httpPatch('/:id', uploadFile.single('anyAttachment'))
  public async updateOtherDeliveryChallan(
    @response() res: Response,
    @request() req: Request,
    @next() next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      const otherDeliveryChallanData = req.body;

      if (req.file) {
        const imageUrl = (req.file as any).location;
        console.log('imageurl is ', imageUrl);
        if (imageUrl) {
          req.body.anyAttachment = imageUrl;
        }
      }

      const updatedOtherDeliveryChallan =
        await this.otherDeliveryChallanService.update(
          id,
          otherDeliveryChallanData,
        );
      if (!updatedOtherDeliveryChallan) {
        return next(new Error('Other Delivery Challan could not be updated'));
      }
      res.status(200).json({
        status: 'success',
        message: 'Other Delivery Challan updated successfully',
        data: updatedOtherDeliveryChallan,
      });
    } catch (err) {
      next(err);
    }
  }
}
