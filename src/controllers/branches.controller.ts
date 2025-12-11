import { inject } from 'inversify';
import {
  controller,
  httpPost,
  httpGet,
  
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

import { BranchessService } from '../services/branches.service';

import {
  captureUser,
  deserializeUser,
  requireUser,
} from '../middleware/deserializeUser';

import { PaginationOptions } from '../utils/pagination';
import { ControllerLogger } from '../utils/controllerLogger';

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
      

      const branchData = req.body;
      branchData.type = branchType;

      const branch = await this.branchesService.createBranch(branchData);
      if (!branch) {
        ControllerLogger.logOperationFailed('Create', 'Branch', 'could not be created', req, res);
        return next(new AppError(400, 'Branch could not be created'));
      }
      
      // Log successful creation
      ControllerLogger.logSuccess(`${branch.type} created`, branch.id, req, res);
      res.status(201).json({
        status: 'success',
        message: `${branch.type} created successfully`,
      });
    } catch (err) {
      ControllerLogger.logError('Branch creation', err, req, res);
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

      
      const branch = await this.branchesService.getBranchByIdAndType(id);
      if (!branch) {
        ControllerLogger.logNotFound('Branch', id, req, res);
        return next(new AppError(404, 'Branch not found'));
      }
      
      // Log successful view
      ControllerLogger.logView('Branch', id, req, res);
      res.status(200).json({
        status: 'success',
        data: branch,
      });
    } catch (err) {
      ControllerLogger.logError('Branch view', err, req, res);
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
     
      const branch = await this.branchesService.getAllByBranchType(
        branchType,
        queryOptions,
      );
      console.log(branch);
      if (!branch) {
        ControllerLogger.logNotFound('Branch', branchType, req, res);
        return next(new AppError(404, 'Branch not found'));
      }
      
      // Log successful data retrieval
      ControllerLogger.logGetAllRecords('Branch', req, res);
      
      res.status(200).json({
        status: 'success',
        data: branch.data,
        allRecords: branch.meta.total,
        totalPages: branch.meta.pages,
        page: branch.meta.page,
      });
    } catch (err) {
      ControllerLogger.logError('Branch retrieval', err, req, res);
      console.log(err);
      next(err);
    }
  }
  @httpGet('/filterData/filter/all')
  public async getAllFilterBranch(
    @request() req:Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
     

      const branches =
        await this.branchesService.getAllByFilterDataBranchType();

      if (!branches || branches.length === 0) {
        ControllerLogger.logNotFound('Branches', 'filter data', req, res);
        return next(new AppError(404, 'Branches not found'));
      }

      // Log successful data retrieval
      ControllerLogger.logGetAllRecords('Branch', req, res);
    
      res.status(200).json({
        status: 'success',
        data: branches,
      });
    } catch (err) {
      ControllerLogger.logError('Branch filter retrieval', err, req, res);
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
     

      const updatedBy = res.locals.updatedBy;
      const updateData = req.body;
      updateData.type = branchType;

      const branch = await this.branchesService.updateBranch(
        id,
        updateData,
        updatedBy,
      );
      if (!branch) {
        ControllerLogger.logOperationFailed('Update', 'Branch', 'not found or could not be updated', req, res);
        return next(
          new AppError(404, 'Branch not found or could not be updated'),
        );
      }
      
      // Log successful update
      ControllerLogger.logSuccess('Branch updated', id, req, res);
      
      res.status(200).json({
        status: 'success',
        message: `${branch.type} data updated successfully`,
      });
    } catch (err) {
      ControllerLogger.logError('Branch update', err, req, res);
      console.log(err);
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
      
      const result = await this.branchesService.deleteBranch(id, branchType);

      if (!result) {
        ControllerLogger.logOperationFailed('Delete', 'Branch', 'not found or could not be deleted', req, res);
        return next(
          new AppError(404, 'Branch not found or could not be deleted'),
        );
      }

      // Log successful deletion
      ControllerLogger.logSuccess('Branch deleted', id, req, res);
      
      res.status(200).json({
        status: 'success',
        message: `${branchType} deleted successfully`,
      });
    } catch (err) {
      ControllerLogger.logError('Branch deletion', err, req, res);
      next(err);
    }
  }
}
