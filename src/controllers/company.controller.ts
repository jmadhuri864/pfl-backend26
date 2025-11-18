import { controller, httpGet } from 'inversify-express-utils';
import { deserializeUser, requireUser } from '../middleware/deserializeUser';
import { inject } from 'inversify';
import { TYPES } from '../types';
import { CompanyService } from '../services/company.service';
import { NextFunction, Request, Response } from 'express';
import AppError from '../utils/appError';

@controller('/company', deserializeUser, requireUser)
export class CompanyController {
  constructor(
    @inject(TYPES.CompanyService)
    private readonly companyService: CompanyService,
  ) {}

  @httpGet('/')
  async getCompany(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companies = await this.companyService.getAllCompanies();
      if (!companies) {
        return next(new AppError(404, 'Companies not found'));
      }
      res.status(200).json({
        status: 'success',
        data: companies,
      });
    } catch (error) {
      next(error);
    }
  }
  @httpGet('/update/getall')
  async getAllCompany(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companies = await this.companyService.getAllforupdateCompanies();
      if (!companies) {
        return next(new AppError(404, 'Companies not found'));
      }
      res.status(200).json({
        status: 'success',
        data: companies,
      });
    } catch (error) {
      next(error);
    }
  }

  @httpGet('/:id')
  async getByIdCompany(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params.id;
      const companies = await this.companyService.getCompanyById(id);
      if (!companies) {
        return next(new AppError(404, 'Companies not found'));
      }
      res.status(200).json({
        status: 'success',
        data: companies,
      });
    } catch (error) {
      next(error);
    }
  }
  @httpGet('/partial/details')
  async getPartialCompany(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const companies = await this.companyService.getPartialCompanyDeatils();
      if (!companies) {
        return next(new AppError(404, 'Companies not found'));
      }
      res.status(200).json({
        status: 'success',
        data: companies,
      });
    } catch (error) {
      next(error);
    }
  }
}
