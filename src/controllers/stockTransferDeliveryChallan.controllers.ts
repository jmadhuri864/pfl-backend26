import { controller, httpDelete, httpGet, httpPatch, httpPost, next, request, requestParam, response } from "inversify-express-utils";
import { captureUser, deserializeUser, requireUser } from "../middleware/deserializeUser";
import { inject } from "inversify";
import { TYPES } from "../types";
import { StockTransferDeliveryChallanService } from "../services/stockTransferDeliveryChallan.service";
import { NextFunction ,Request,Response} from "express";
import logger from "../utils/logger";
import AppError from "../utils/appError";
import { PaginationOptions } from "../utils/pagination";
import { uploadFile } from "../middleware/uploadwithAWS";

@controller('/tranfer-delivery-challan', deserializeUser, requireUser)
export class StockTranferDeliveryChallanController {

 constructor(
        @inject(TYPES.StockTransferDeliveryChallanService)
        private readonly stockTransferDeliveryChallanService: StockTransferDeliveryChallanService
      ) {}
 @httpPost('/',uploadFile.single('anyAttachment'))
  public async create(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      console.log('in controller',req.body);

      if(req.file){
      
        const imageUrl = (req.file as any).location;
        console.log("imageurl is ",imageUrl)
       if (imageUrl) {
         
        req.body.anyAttachment = imageUrl;
       }
   
     }
      logger.info('Creating stock transfer delivery challan');
      const requestedBy = res.locals.user.id;
      req.body.createdBy = requestedBy;
      const challan = await this.stockTransferDeliveryChallanService.create(req.body, requestedBy);
      if (!challan) {
        return next(new AppError(400, 'Stock transfer delivery challan could not be created'));
      }

      res.status(201).json({
        status: 'success',
        message: 'Stock transfer delivery challan created successfully',
        data: challan,
      });
    } catch (err) {
      logger.error('Error creating stock transfer delivery challan', { error: err });
      next(err);
    }
  }

  @httpGet('/:id')
  public async getById(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const challan = await this.stockTransferDeliveryChallanService.getById(id);
      if (!challan) {
        return next(new AppError(404, 'Stock transfer delivery challan not found'));
      }

      res.status(200).json({
        status: 'success',
        data: challan,
      });
    } catch (err) {
      logger.error('Error fetching challan by ID', { error: err });
      next(err);
    }
  }
@httpDelete('/delete/multiple')
  public async deleteMultipleDCForStockTransfer(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return next(new AppError(400, 'An array of DC for Stock Transfer IDs is required'));
      }
      const result = await this.stockTransferDeliveryChallanService.deleteMultipleDCForStockTransfer(ids);
      res.status(200).json({
        message: result.message,
        success: result.success,
        failed: result.failed,
      });
    }
      catch (error) {
      logger.error('Error deleting multiple DC for Stock Transfer', { error });
      next(error);
    }
  }
  @httpGet('/update/:id')
  public async getByIdforupdate(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const challan = await this.stockTransferDeliveryChallanService.getByIdChallanforUpdate(id);
      if (!challan) {
        return next(new AppError(404, 'Stock transfer delivery challan not found'));
      }

      res.status(200).json({
        status: 'success',
        data: challan,
      });
    } catch (err) {
      logger.error('Error fetching challan by ID', { error: err });
      next(err);
    }
  }

  @httpGet('/view/:id')
  public async getByIdforview(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const challan = await this.stockTransferDeliveryChallanService.getByIdChallanforView(id);
      if (!challan) {
        return next(new AppError(404, 'Stock transfer delivery challan not found'));
      }

      res.status(200).json({
        status: 'success',
        data: challan,
      });
    } catch (err) {
      logger.error('Error fetching challan by ID', { error: err });
      next(err);
    }
  }


  @httpGet('/')
  public async getAll(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const { page, limit, search, sort } = req.query;
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        searchFields: ['challanNo'], // adjust based on your searchable fields
        filters: {},
        sort: (sort as string) || undefined,
        search: (search as string) || '',
      };

      const userId = res.locals.user.id;

      const challans = await this.stockTransferDeliveryChallanService.getAll(queryOptions, userId);

      if (!challans || challans.data.length === 0) {
        return next(new AppError(404, 'No stock transfer delivery challans found'));
      }

      res.status(200).json({
        status: 'success',
        ...challans,
      });
    } catch (err) {
      logger.error('Error fetching all challans', { error: err });
      next(err);
    }
  }

  @httpPatch('/:id', captureUser,uploadFile.single('anyAttachment'))
  public async update(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const updatedBy = res.locals.updatedBy;
      if(req.file){
      
        const imageUrl = (req.file as any).location;
        console.log("imageurl is ",imageUrl)
       if (imageUrl) {
         
        req.body.anyAttachment = imageUrl;
       }
   
     }
      const updated = await this.stockTransferDeliveryChallanService.update(id, {
        ...req.body,
        updatedBy,
      });

      if (!updated) {
        return next(new AppError(404, 'Challan not found or could not be updated'));
      }

      res.status(200).json({
        status: 'success',
        message: 'Stock transfer delivery challan updated successfully',
      });
    } catch (err) {
      logger.error('Error updating challan', { error: err });
      next(err);
    }
  }

  @httpDelete('/')
  public async delete(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const id = req.query.id as string;

      const deleted = await this.stockTransferDeliveryChallanService.delete(id);
      if (!deleted) {
        return next(new AppError(404, 'Challan not found or could not be deleted'));
      }

      res.status(200).json({
        status: 'success',
        message: 'Stock transfer delivery challan deleted successfully',
      });
    } catch (err) {
      logger.error('Error deleting challan', { error: err });
      next(err);
    }
  }
}