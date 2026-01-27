import { controller, httpGet, request, response, next } from 'inversify-express-utils';
import { deserializeUser, requireUser } from '../middleware/deserializeUser';
import { inject } from 'inversify';
import { TYPES } from '../types';
import { CompanyService } from '../services/company.service';
import { NextFunction, Request, Response } from 'express';
import AppError from '../utils/appError';
import { ControllerLogger } from '../utils/controllerLogger';
import { NotificationService } from '../services/notification.service';

@controller('/company', deserializeUser, requireUser)
export class CompanyController {
  constructor(
    @inject(TYPES.CompanyService)
    private readonly companyService: CompanyService,
    @inject(TYPES.NotificationService)
    private notificationService: NotificationService,
  ) {}

  @httpGet('/')
  async getCompany(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<void> {
    try {
      const companies = await this.companyService.getAllCompanies();
      
      if (!companies || companies.length === 0) {
        ControllerLogger.logNotFound('Company', 'all', req, res);
        return next(new AppError(404, 'Companies not found'));
      }
      
      // 🔔 Send notification for get all companies
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Retrieved ${companies.length} companies`,
            userId
          );
        }
      } catch (notifError) {
        console.log('Get all companies notification error:', notifError);
      }
      
      // Log successful retrieval with specific message
      ControllerLogger.logGetAllRecords('Company', req, res);
      
      res.status(200).json({
        status: 'success',
        data: companies,
      });
    } catch (error) {
      ControllerLogger.logError('Company retrieval', error, req, res);
      next(error);
    }
  }
  @httpGet('/update/getall')
  async getAllCompany(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<void> {
    try {
      const companies = await this.companyService.getAllforupdateCompanies();
      
      if (!companies || companies.length === 0) {
        ControllerLogger.logNotFound('Company', 'update list', req, res);
        return next(new AppError(404, 'Companies not found'));
      }
      
      // 🔔 Send notification for get companies update list
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Retrieved ${companies.length} companies for update`,
            userId
          );
        }
      } catch (notifError) {
        console.log('Get companies update list notification error:', notifError);
      }
      
      // Log successful retrieval with specific message
      ControllerLogger.logGetAllRecords('Company', req, res);
      
      res.status(200).json({
        status: 'success',
        data: companies,
      });
    } catch (error) {
      ControllerLogger.logError('Company update list retrieval', error, req, res);
      next(error);
    }
  }

  @httpGet('/:id')
  async getByIdCompany(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params.id;
      const companies = await this.companyService.getCompanyById(id);
      
      if (!companies) {
        ControllerLogger.logNotFound('Company', id, req, res);
        return next(new AppError(404, 'Company not found'));
      }
      
      // 🔔 Send notification for company view
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Viewed company "${companies.name}" details`,
            userId
          );
        }
      } catch (notifError) {
        console.log('Company view notification error:', notifError);
      }
      
      // Log successful view
      ControllerLogger.logView('Company', id, req, res);
      
      res.status(200).json({
        status: 'success',
        data: companies,
      });
    } catch (error) {
      ControllerLogger.logError('Company view', error, req, res);
      next(error);
    }
  }
  @httpGet('/partial/details')
  async getPartialCompany(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<void> {
    try {
      const companies = await this.companyService.getPartialCompanyDeatils();
      
      if (!companies || companies.length === 0) {
        ControllerLogger.logNotFound('Company', 'partial details', req, res);
        return next(new AppError(404, 'Company partial details not found'));
      }
      
      // 🔔 Send notification for partial company details
      try {
        const userId = res.locals.user?.id;
        if (userId) {
          await this.notificationService.createNoti(
            `Retrieved ${companies.length} company partial details`,
            userId
          );
        }
      } catch (notifError) {
        console.log('Company partial details notification error:', notifError);
      }
      
      // Log successful retrieval with specific message
      ControllerLogger.logGetAllRecords('Company', req, res);
      
      res.status(200).json({
        status: 'success',
        data: companies,
      });
    } catch (error) {
      ControllerLogger.logError('Company partial details retrieval', error, req, res);
      next(error);
    }
  }
}
