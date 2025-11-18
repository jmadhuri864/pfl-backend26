import { inject } from 'inversify';
import {
  controller,
  httpPost,
  httpGet,
  httpPut,
  httpDelete,
  request,
  requestParam,
  response,
  next,
  httpPatch,
} from 'inversify-express-utils';
import { TYPES } from '../types';
import { BranchType } from '../entities/branches.entity';
import { NextFunction, Request, Response } from 'express';
import AppError from '../utils/appError';
import {
  CreateBranchBodySchema,
  UpdateBranchBodySchema,
} from '../schemas/branch.schema';
import { BranchessService } from '../services/branches.service';
import { uploadNone } from '../middleware/multerConfig';
import {
  captureUser,
  deserializeUser,
  requireUser,
} from '../middleware/deserializeUser';
import logger from '../utils/logger';
import { PaginationOptions } from '../utils/pagination';

@controller('/location-branches', deserializeUser, requireUser)
export class BranchessController {
  constructor(
    @inject(TYPES.BranchessService)
    private branchesService: BranchessService,
  ) {}

  @httpPost('/:branchType')
  public async createBranch(
    @request() req: Request<{ branchType: string }, {}, any>,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const branchType = req.params.branchType as BranchType;
      logger.info(`Received request to create branch of type: ${branchType}`);

      const branchData = req.body;
      branchData.type = branchType;

      const branch = await this.branchesService.createBranch(branchData);
      if (!branch) {
        logger.warn('Branch creation failed');
        return next(new AppError(400, 'Branch could not be created'));
      }
      logger.info(`${branch.type} created successfully`);
      res.status(201).json({
        status: 'success',
        message: `${branch.type} created successfully`,
      });
    } catch (err) {
      logger.error('Error creating branch', { error: err });
      next(err);
    }
  }

  @httpGet('/:id')
  public async getBranch(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const id = req.params.id as string;

      logger.info(`Received request to get branch with ID: ${id}`);
      const branch = await this.branchesService.getBranchByIdAndType(id);
      if (!branch) {
        logger.warn(`Branch with ID: ${id}  not found`);
        return next(new AppError(404, 'Branch not found'));
      }
      logger.info(`Fetched branch with ID: ${id} successfully`);

      res.status(200).json({
        status: 'success',
        data: branch,
      });
    } catch (err) {
      logger.error('Error fetching branch', { error: err });
      next(err);
    }
  }
  @httpGet('/getall/:branchType')
  public async getAllBranch(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      //const branchType = req.query.search as BranchType;
      const branchType = req.params.branchType as BranchType;
      console.log(branchType);
      const { page, limit, search, sort, } = req.query;
console.log("serach data is ",search)
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      
        filters: {},
        sort: (sort as string) || undefined,
        search: (search as string) || '',
      };
      console.log(queryOptions.search);
      logger.info(
        `Received request to fetch all branches of type: ${branchType}`,
      );
      const branch = await this.branchesService.getAllByBranchType(
        branchType,
        queryOptions,
      );
      console.log(branch);
      if (!branch) {
        logger.warn(`No branches found for type: ${branchType}`);
        return next(new AppError(404, 'Branch not found'));
      }
      logger.info(`Fetched all branches of type: ${branchType} successfully`);
      res.status(200).json({
        status: 'success',
        data: branch.data,
        allRecords: branch.meta.total,
        totalPages: branch.meta.pages,
        page: branch.meta.page,
      });
    } catch (err) {
      logger.error('Error fetching branches', { error: err });
      console.log(err);
      next(err);
    }
  }
  @httpGet('/filterData/filter/all')
  public async getAllFilterBranch(
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info(`Received request to fetch all branches`);

      const branches =
        await this.branchesService.getAllByFilterDataBranchType();

      if (!branches || branches.length === 0) {
        logger.warn(`No branches found`);
        return next(new AppError(404, 'Branches not found'));
      }

      logger.info(`Fetched all branches successfully`);
      res.status(200).json({
        status: 'success',
        data: branches,
      });
    } catch (err) {
      logger.error('Error fetching branches', { error: err });
      next(err);
    }
  }

  @httpPatch('/:branchType/:id', captureUser)
  public async updateBranch(
    @requestParam('id') id: string,
    @requestParam('branchType') branchType: string,
    @request() req: Request<{}, {}, any>,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      console.log(branchType);
      console.log(id);
      logger.info(
        `Received request to update branch with ID: ${id} and type: ${branchType}`,
      );

      const updatedBy = res.locals.updatedBy;
      const updateData = req.body;
      updateData.type = branchType;

      const branch = await this.branchesService.updateBranch(
        id,
        updateData,
        updatedBy,
      );
      if (!branch) {
        logger.warn(
          `Branch with ID: ${id} and type: ${branchType} not found or could not be updated`,
        );
        return next(
          new AppError(404, 'Branch not found or could not be updated'),
        );
      }
      logger.info(`${branch.type} with ID: ${id} updated successfully`);
      res.status(200).json({
        status: 'success',
        message: `${branch.type} data updated successfully`,
      });
    } catch (err) {
      console.log(err);
      logger.error('Error updating branch', { error: err });
      next(err);
    }
  }

  @httpDelete('/')
  public async deleteBranch(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const id = req.query.id as string;
      const branchType = req.query.branchType as BranchType;
      logger.info(
        `Received request to delete branch with ID: ${id} and type: ${branchType}`,
      );
      const result = await this.branchesService.deleteBranch(id, branchType);

      if (!result) {
        logger.warn(
          `Branch with ID: ${id} and type: ${branchType} not found or could not be deleted`,
        );
        return next(
          new AppError(404, 'Branch not found or could not be deleted'),
        );
      }

      logger.info(
        `Branch with ID: ${id} and type: ${branchType} deleted successfully`,
      );
      res.status(200).json({
        status: 'success',
        message: `${branchType} deleted successfully`,
      });
    } catch (err) {
      logger.error('Error deleting branch', { error: err });
      next(err);
    }
  }
}
