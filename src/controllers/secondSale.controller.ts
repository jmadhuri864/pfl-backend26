import { inject } from 'inversify';
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
import { TYPES } from '../types';
import { NextFunction, Request, Response } from 'express';
import AppError from '../utils/appError';
import { SecondSaleService } from '../services/secondSale.service';
import {
  captureUser,
  deserializeUser,
  requireUser,
} from '../middleware/deserializeUser';
import { NotificationService } from '../services/notification.service';
import logger from '../utils/logger';
import { uploadAny, uploadNone } from '../middleware/multerConfig';
import { PaginationOptions } from '../utils/pagination';
import { ControllerLogger } from '../utils/controllerLogger';

@controller('/secondSales', deserializeUser, requireUser)
export class SecondSaleController {
  constructor(
    @inject(TYPES.SecondSaleService)
    private secondSaleService: SecondSaleService,
    @inject(TYPES.NotificationService)
    private notificationService: NotificationService, // Inject NotificationService
  ) {}

  // Create a new second sale
  @httpPost('/')
  public async createSecondSale(
    @request() req: Request<{}, {}, any>,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      //console.log(req.body)
      logger.info('Attempting to create a new second sale', {
        requestedBy: res.locals.user.id,
      });
      const secondSaleData = req.body;
      const requestedBy= res.locals.user.id;
      console.log(req.body);
      if (secondSaleData.dcNo === '') {
        secondSaleData.dcNo = null;
      }
      const secondSale = await this.secondSaleService.createSecondSale(
        secondSaleData,
        requestedBy
      );
      console.log('after creating', secondSale);
      if (!secondSale) {
        logger.error('Failed to create second sale', { secondSaleData });
        ControllerLogger.logError('Second Sale creation', new AppError(400, 'Second sale could not be created'), req, res);
        return next(new AppError(400, 'Second sale could not be created'));
      }

      logger.info('Second sale created successfully', {
        secondSaleId: secondSale.id,
      });

      // Trigger a notification
      await this.notificationService.createNoti(
        `New second sale created with ID: ${secondSale.id}`,
        res.locals.user.id,
      );

      ControllerLogger.logSuccess('Second Sale created', secondSale.id, req, res);
      res.status(201).json({
        status: 'success',
        message: 'Second sale created successfully',
        data: secondSale.id,
      });
    } catch (err) {
      console.log(err);
      logger.error('Error occurred while creating second sale', { error: err });
      ControllerLogger.logError('Second Sale creation', err, req, res);
      next(err);
    }
  }

  // Get second sale by ID
  @httpGet('/:id')
  public async getSecondSaleById(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Fetching second sale details by ID', { secondSaleId: id });
      const secondSale = await this.secondSaleService.getSecondSaleById(id);
      if (!secondSale) {
        logger.warn('Second sale not found', { secondSaleId: id });
        ControllerLogger.logError('Second Sale view', new AppError(404, 'Second sale not found'), req, res);
        return next(new AppError(404, 'Second sale not found'));
      }
      logger.info('Second sale details retrieved successfully', { secondSale });

      // Trigger a notification
      await this.notificationService.createNoti(
        `Second sale details retrieved for ID: ${secondSale.id}`,
        res.locals.user.id,
      );

      ControllerLogger.logView('Second Sale', id, req, res);
      res.status(200).json({
        status: 'success',
        data: secondSale,
      });
    } catch (err) {
      logger.error('Error occurred while fetching second sale details', {
        secondSaleId: id,
        error: err,
      });
      ControllerLogger.logError('Second Sale view', err, req, res);
      next(err);
    }
  }

  @httpGet('/:id/view')
  public async getSecondSaleByIdForView(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Fetching second sale details by ID', { secondSaleId: id });
      const secondSale = await this.secondSaleService.getSecondSaleByIdForView(
        id,
      );
      if (!secondSale) {
        logger.warn('Second sale not found', { secondSaleId: id });
        ControllerLogger.logError('Second Sale view', new AppError(404, 'Second sale not found'), req, res);
        return next(new AppError(404, 'Second sale not found'));
      }
      logger.info('Second sale details retrieved successfully', { secondSale });

      // Trigger a notification
      await this.notificationService.createNoti(
        `Second sale details retrieved for ID: ${secondSale.id}`,
        res.locals.user.id,
      );

      ControllerLogger.logView('Second Sale (for view)', id, req, res);
      res.status(200).json({
        status: 'success',
        data: secondSale,
      });
    } catch (err) {
      logger.error('Error occurred while fetching second sale details', {
        secondSaleId: id,
        error: err,
      });
      ControllerLogger.logError('Second Sale view', err, req, res);
      next(err);
    }
  }

  @httpGet('/:id/update')
  public async getSecondSaleByIdForUpdate(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Fetching second sale details by ID', { secondSaleId: id });
      const secondSale =
        await this.secondSaleService.getSecondSaleByIdForUpdate(id);
      if (!secondSale) {
        logger.warn('Second sale not found', { secondSaleId: id });
        ControllerLogger.logError('Second Sale retrieval for update', new AppError(404, 'Second sale not found'), req, res);
        return next(new AppError(404, 'Second sale not found'));
      }
      logger.info('Second sale details retrieved successfully', { secondSale });

      // Trigger a notification
      await this.notificationService.createNoti(
        `Second sale details retrieved for ID: ${secondSale.id}`,
        res.locals.user.id,
      );

      ControllerLogger.logView('Second Sale (for update)', id, req, res);
      res.status(200).json({
        status: 'success',
        data: secondSale,
      });
    } catch (err) {
      logger.error('Error occurred while fetching second sale details', {
        secondSaleId: id,
        error: err,
      });
      ControllerLogger.logError('Second Sale retrieval for update', err, req, res);
      next(err);
    }
  }

  // Get all second sales
  @httpGet('/')
  public async getAllSecondSales(
    @response() res: Response,
    @request() req: Request,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Fetching all second sales');
      const { page, limit, search, sort, secondSaleId } = req.query;

      const userId = res.locals.user.id;

      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        searchFields: ['secondSale.id'],
        filters: {},
        sort: (sort as string) || undefined, // Adjust this line to match your sorting requirements
        search: (search as string) || '',
      };
     // console.log("Query option: ", queryOptions);
      
      const secondSales = await this.secondSaleService.getAllSecondSales(
        queryOptions,
        userId
      );
      if (!secondSales) {
        logger.error('No second sales found');
        ControllerLogger.logError('Second Sale list retrieval', new AppError(404, 'No second sales found'), req, res);
        return next(new AppError(404, 'No second sales found'));
      }
      logger.info('Second sales retrieved successfully');

      // Send notification for second sale list access
      await this.notificationService.createNoti(
        'Second Sale records list accessed successfully',
        userId
      );

      ControllerLogger.logList('Second Sale', req, res);
      res.status(200).json({
        status: 'success',
        data: secondSales.data,
        allRecords: secondSales.meta.total,
        totalPages: secondSales.meta.pages,
        page: secondSales.meta.page,
      });
    } catch (err) {
      logger.error('Error occurred while fetching all second sales', {
        error: err,
      });
      ControllerLogger.logError('Second Sale list retrieval', err, req, res);
      next(err);
    }
  }

  // Update a second sale
  @httpPatch('/:id', captureUser, uploadAny)
  public async updateSecondSale(
    @requestParam('id') id: string,
    @request() req: Request<{}, {}, any>,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Updating second sale details', { secondSaleId: id });
      const updatedBy = res.locals.updatedBy;
      console.log(req.body);
      const secondSale = await this.secondSaleService.updateSecondSale(
        id,
        req.body,
        updatedBy,
      );
      if (!secondSale) {
        logger.warn('Second sale not found or could not be updated', {
          secondSaleId: id,
        });
        ControllerLogger.logError('Second Sale update', new AppError(404, 'Second sale not found or could not be updated'), req, res);
        return next(
          new AppError(404, 'Second sale not found or could not be updated'),
        );
      }

      logger.info('Second sale updated successfully', { secondSale });

      // Trigger a notification
      await this.notificationService.createNoti(
        `Second sale updated for ID: ${secondSale.id}`,
        res.locals.user.id,
      );

      ControllerLogger.logSuccess('Second Sale updated', id, req, res);
      res.status(200).json({
        status: 'success',
        message: 'Second sale updated successfully',
        //data: secondSale,
      });
    } catch (err) {
      logger.error('Error occurred while updating second sale', {
        secondSaleId: id,
        error: err,
      });
      ControllerLogger.logError('Second Sale update', err, req, res);
      next(err);
    }
  }

  // Delete a second sale
  @httpDelete('/:id')
  public async deleteSecondSale(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      if (!id) {
        logger.warn('Role ID not provided');
        ControllerLogger.logError('Second Sale deletion', new AppError(400, 'Role ID is required'), req, res);
        return next(new AppError(400, 'Role ID is required'));
      }
      const result = await this.secondSaleService.deleteSecondSale(id);
      if (!result) {
        ControllerLogger.logError('Second Sale deletion', new AppError(404, 'Second sale not found or could not be deleted'), req, res);
        return next(
          new AppError(404, 'Second sale not found or could not be deleted'),
        );
      }
      ControllerLogger.logSuccess('Second Sale deleted', id, req, res);

      // Send notification for second sale deletion
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Second Sale deleted successfully: ${id}`,
          userId
        );
      }

      res.status(200).json({
        status: 'success',
        message: 'Second Sale deleted successfully',
      });
    } catch (err) {
      logger.error('Error occurred while deleting second sale', {
        secondSaleId: id,
        error: err,
      });
      ControllerLogger.logError('Second Sale deletion', err, req, res);
      next(err);
    }
  }
  @httpDelete('/delete/multiple')
      public async deleteMultipleSecondSale(
        @request() req: Request,
        @response() res: Response,
        @next() next: NextFunction,
      ) {
        try {
          const { ids } = req.body;
          if (!Array.isArray(ids) || ids.length === 0) {
            ControllerLogger.logError('Second Sale multiple deletion', new AppError(400, 'An array of Second Sale IDs is required'), req, res);
            return next(new AppError(400, 'An array of Second Sale IDs is required'));
          }
          const result = await this.secondSaleService.deleteMultipleSecondSale(ids);
          ControllerLogger.logSuccess('Second Sale multiple deletion', `${ids.length} records`, req, res);

          // Send notification for multiple second sale deletion
          const userId = res.locals.user?.id;
          if (userId) {
            await this.notificationService.createNoti(
              `Multiple Second Sales deleted successfully: ${ids.length} records`,
              userId
            );
          }

          res.status(200).json({
            message: result.message,
            success: result.success,
            failed: result.failed,
          });
        }
          catch (error) {
          logger.error('Error deleting multiple Second Sale', { error });
          ControllerLogger.logError('Second Sale multiple deletion', error, req, res);
          next(error);
        }
      }
  
}
