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
import { EodStockService } from '../services/eodStock.service';
import { uploadNone } from '../middleware/multerConfig';
import { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger';
import AppError from '../utils/appError';
import { NotificationService } from '../services/notification.service';
import {
  captureUser,
  deserializeUser,
  requireUser,
} from '../middleware/deserializeUser';
import { PaginationOptions } from '../utils/pagination';

@controller('/eodStock', deserializeUser, requireUser)
export class EodStockController {
  constructor(
    @inject(TYPES.EodStockService)
    private eodStockService: EodStockService,
    @inject(TYPES.NotificationService)
    private notificationService: NotificationService,
  ) {}

  @httpPost('/')
  public async createEodStockReport(
    @request() req: Request<{}, {}, any>,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      console.log(req.body);
      logger.info('Attempting to create a new eodstockreport', {
        requestedBy: res.locals.user.id,
      });

      const stockData = req.body;
      console.log(req.body);

      stockData.submittedBy = res.locals.user.id;

      logger.debug('stock data prepared for creation', stockData);
      const stock = await this.eodStockService.createEodStock(stockData);
      console.log(stock);
      if (!stock) {
        logger.error('Failed to create stock', { stockData });
        return next(new AppError(400, 'stock could not be created'));
      }
      logger.info('Stock created successfully', stock);

      await this.notificationService.createNoti(
        `New stock created: ${stock} `,
        res.locals.user.id,
      );
      res.status(201).json({
        status: 'success',
        message: 'Eod Stock created successfully',
        data: stock.id,
      });
    } catch (err) {
      logger.error('Error occurred while creating farmer', { error: err });
      next(err);
    }
  }

   @httpGet('/view/:id')
  public async getEodStockReportForView(
     @requestParam('id') docId: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Attempting to fetch EOD stock report', {
        requestedBy: res.locals.user.id,
      });

      const stockId = req.params.id;

      if (!stockId) {
        return res.status(400).json({
          status: 'error',
          message: 'Stock ID is required',
        });
      }

      const stock = await this.eodStockService.getEodStockByIdForView(
        docId
      )

      if (!stock) {
        logger.error('Failed to fetch stock', { stockId });
        return next(new AppError(404, 'Stock report not found'));
      }

      logger.info('Stock report fetched successfully', { stockId });

      await this.notificationService.createNoti(
        `EOD stock report accessed: ${stock.companyName || 'Unnamed Report'}`,
        res.locals.user.id,
      );

      return res.status(200).json({
        status: 'success',
        message: 'EOD stock report fetched successfully',
        data: stock,
      });
    } catch (err) {
      logger.error('Error occurred while fetching EOD stock report', {
        error: err,
      });
      return next(err);
    }
  }
@httpGet('/update/:id')
  public async getEodStockReportForupdate(
     @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Attempting to fetch EOD stock report', {
        requestedBy: res.locals.user.id,
      });

      const id = req.params.id;

      if (!id) {
        return res.status(400).json({
          status: 'error',
          message: 'Stock ID is required',
        });
      }

      const stock = await this.eodStockService.getEodStockByIdForUpdate(
        id
      )

      if (!stock) {
        logger.error('Failed to fetch stock', { id });
        return next(new AppError(404, 'Stock report not found'));
      }

      logger.info('Stock report fetched successfully', { id });

      await this.notificationService.createNoti(
        `EOD stock report accessed: ${stock.companyName || 'Unnamed Report'}`,
        res.locals.user.id,
      );

      return res.status(200).json({
        status: 'success',
        message: 'EOD stock report fetched successfully',
        data: stock,
      });
    } catch (err) {
      logger.error('Error occurred while fetching EOD stock report', {
        error: err,
      });
      return next(err);
    }
  }


  @httpGet('/:id')
  public async getEodStockReport(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Attempting to fetch EOD stock report', {
        requestedBy: res.locals.user.id,
      });

      const stockId = req.params.id;

      if (!stockId) {
        return res.status(400).json({
          status: 'error',
          message: 'Stock ID is required',
        });
      }

      const stock = await this.eodStockService.getEodStockById(
        stockId as string,
      );

      if (!stock) {
        logger.error('Failed to fetch stock', { stockId });
        return next(new AppError(404, 'Stock report not found'));
      }

      logger.info('Stock report fetched successfully', { stockId });

      await this.notificationService.createNoti(
        `EOD stock report accessed: ${stock.companyName || 'Unnamed Report'}`,
        res.locals.user.id,
      );

      return res.status(200).json({
        status: 'success',
        message: 'EOD stock report fetched successfully',
        data: stock,
      });
    } catch (err) {
      logger.error('Error occurred while fetching EOD stock report', {
        error: err,
      });
      return next(err);
    }
  }

  @httpGet('/')
  public async getAllEodStockReports(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Attempting to fetch all EOD stock reports', {
        requestedBy: res.locals.user.id,
      });

      const userId = res.locals.user.id;
      if (!userId) {
        return res.status(400).json({
          status: 'error',
          message: 'User ID is required',
        });
      }

      const { page, limit, search, sort, eodStockId } = req.query;

      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        searchFields: ['eodStockId'],
        filters: {},
        sort: (sort as string) || undefined,
        search: (search as string) || '',
      };

      const stocks = await this.eodStockService.getAllEodStocks(queryOptions,userId);

      if (!stocks.data || stocks.data.length === 0) {
        logger.warn('No EOD stock reports found');
        return res.status(404).json({
          status: 'error',
          message: 'No EOD stock reports found',
        });
      }

      logger.info('All EOD stock reports fetched successfully', {
        totalReports: stocks.length,
      });

      return res.status(200).json({
        status: 'success',
        message: 'All EOD stock reports fetched successfully',
        data: stocks.data,
        allRecords: stocks.meta.total,
        totalPages: stocks.meta.pages,
        page: stocks.meta.page,
      });
    } catch (err) {
      logger.error('Error occurred while fetching all EOD stock reports', {
        error: err,
      });
      return next(err);
    }
  }
  @httpPatch('/:id', captureUser)
  async updateEodStock(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Updating EOD stock report', { stockId: id });

      const stockData = req.body;

      const updatedBy = res.locals.updatedBy;

      const updatedStock = await this.eodStockService.updateEodStock(
        id,
        stockData,
        updatedBy,
      );
      if (!updatedStock) {
        logger.warn('Stock report not found or could not be updated', {
          stockId: id,
        });
        return next(
          new AppError(404, 'Stock report not found or could not be updated'),
        );
      }

      logger.info('Stock report updated successfully', { updatedStock });

      res.status(200).json({
        status: 'success',
        message: 'Stock report updated successfully',
        data: updatedStock,
      });
    } catch (err) {
      logger.error('Error occurred while updating stock report', {
        stockId: id,
        error: err,
      });
      next(err);
    }
  }
   @httpGet('/recyclebin')
  public async getAllRecycleBinEodStockReports(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Attempting to fetch all EOD stock reports', {
        requestedBy: res.locals.user.id,
      });

      const userId = res.locals.user.id;
      if (!userId) {
        return res.status(400).json({
          status: 'error',
          message: 'User ID is required',
        });
      }

      const { page, limit, search, sort, eodStockId } = req.query;

      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        searchFields: ['eodStockId'],
        filters: {},
        sort: (sort as string) || undefined,
        search: (search as string) || '',
      };

      const stocks = await this.eodStockService.getAllRecycleBinEodStocks(queryOptions,userId);

      if (!stocks.data || stocks.data.length === 0) {
        logger.warn('No EOD stock reports found');
        return res.status(404).json({
          status: 'error',
          message: 'No EOD stock reports found',
        });
      }

      logger.info('All EOD stock reports fetched successfully', {
        totalReports: stocks.length,
      });

      return res.status(200).json({
        status: 'success',
        message: 'All EOD stock reports fetched successfully',
        data: stocks.data,
        allRecords: stocks.meta.total,
        totalPages: stocks.meta.pages,
        page: stocks.meta.page,
      });
    } catch (err) {
      logger.error('Error occurred while fetching all EOD stock reports', {
        error: err,
      });
      return next(err);
    }
  }
  @httpDelete('/:id')
  public async deleteEodStock(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Marking EOD Stock report for deletion', { eodStockId: id });

      const result = await this.eodStockService.deleteEodStock(id);

      if (!result) {
        return next(
          new AppError(
            404,
            'EOD Stock report not found or could not be deleted',
          ),
        );
      }

      logger.info('EOD Stock report marked for deletion successfully', {
        eodStockId: id,
      });
      res.status(204).send();
    } catch (err) {
      logger.error(
        'Error occurred while marking EOD Stock report for deletion',
        { eodStockId: id, error: err },
      );
      next(err);
    }
  }
}
