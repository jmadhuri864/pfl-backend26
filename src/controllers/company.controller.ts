import { controller, httpGet, request, response, next } from 'inversify-express-utils';
import { deserializeUser, requireUser } from '../middleware/deserializeUser';
import { inject } from 'inversify';
import { TYPES } from '../types';
import { CompanyService } from '../services/company.service';
import { NextFunction, Request, Response } from 'express';
import AppError from '../utils/appError';
import { ControllerLogger } from '../utils/controllerLogger';

@controller('/company', deserializeUser, requireUser)
export class CompanyController {
  constructor(
    @inject(TYPES.CompanyService)
    private readonly companyService: CompanyService,
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
