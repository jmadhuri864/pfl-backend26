import { Request, Response, NextFunction } from 'express';
import { inject } from 'inversify';
import {
  controller,
  httpGet,
  httpPost,
  httpPut,
  httpDelete,
  httpPatch,
  request,
  response,
  next,
  requestParam,
} from 'inversify-express-utils';
import { TYPES } from '../types';
import { AqrService } from '../services/aqr.service';
import { NotificationService } from '../services/notification.service';
import logger from '../utils/logger';
import AppError from '../utils/appError';
import { uploadAny, uploadNone } from '../middleware/multerConfig';
import { PaginationOptions } from '../utils/pagination';
import { deserializeUser, requireUser } from '../middleware/deserializeUser';


@controller('/aqr',deserializeUser, requireUser)
export class AqrController {
  constructor(
    @inject(TYPES.AqrService) private aqrService: AqrService,
    @inject(TYPES.NotificationService)
    private notificationService: NotificationService,
  ) {}

  @httpPost('/')
  public async createAqr(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> {
    try {
      const aqrData = req.body;
      aqrData.requestedBy = res.locals.user.id; 
console.log(aqrData)
      const createdAqr = await this.aqrService.createAqr(aqrData);
      console.log('created aqr in controller ', createdAqr);
      if (!createdAqr) {
        logger.warn('AQR not created', { aqrData });
        return next(new AppError(400, 'AQR not created'));
      }
      console.log('created aqr in controller ', createdAqr);
      logger.info('AQR created successfully', { aqrId: createdAqr.id });

      return res.status(201).json({ status: 'success', data: createdAqr });
    } catch (error) {
      logger.error('Error creating AQR', { error });
      console.log(error);
      next(error);
    }
  }
@httpGet('/recycle-bin')
    public async getAllRecycleBinAqrs(
      @request() req: Request,
      @response() res: Response,
      @next() next: NextFunction,
    ) {
      try {
        logger.info('Fetching all AQR...');
        const {
          page,
          limit,
          search,
          sort,
          supplierName,
          arrivalDate,
          // requestingDepartment,
          // dealSlipNo
        } = req.query;
    
        const userId = res.locals.user.id;
    
        const filters: any = {};
        if (supplierName) filters.supplierName = supplierName;
        if (arrivalDate) filters.arrivalDate = arrivalDate;
        // if (requestingDepartment) filters.requestingDepartment = requestingDepartment;
        // if (dealSlipNo) filters.dealSlipNo = dealSlipNo;
    
        const queryOptions: PaginationOptions = {
          page: page ? Number(page) : 1,
          limit: limit ? Number(limit) : 10,
          //searchFields: ['batchNo'],
          filters,
          sort: (sort as string) || undefined,
          search: (search as string) || '',
        };
    
        const aqrs = await this.aqrService.getAllRecycleBinAqrs(queryOptions, userId);
    
        if (!aqrs || aqrs.data.length === 0) {
          logger.warn('No AQR found for this user.');
          return res.status(200).json({
            status: 'success',
            data: [],
            allRecords: 0,
            totalPages: 0,
            page: queryOptions.page,
          });
        }
    
      //  logger.info(Total AQR fetched: ${aqrs.data.length});
    
        res.status(200).json({
          status: 'success',
          data: aqrs.data,
          allRecords: aqrs.meta.total,
          totalPages: aqrs.meta.pages,
          page: aqrs.meta.page,
        });
      } catch (error) {
        console.error('Error fetching AQR:', error);
        next(error);
      }
    }
  // @httpGet('/')
  // public async getAllAqr(
  //   req: Request,
  //   res: Response,
  //   next: NextFunction,
  // ): Promise<Response | void> {
  //   try {
  //     logger.info('Fetching all AQR entries');

  //     const { page, limit, search, sort, aqrId } = req.query;

  //     const queryOptions: PaginationOptions = {
  //       page: page ? Number(page) : undefined,
  //       limit: limit ? Number(limit) : undefined,
  //       searchFields: ['aqrId'],
  //       filters: {},
  //       sort: (sort as string) || undefined, // Adjust this line to match your sorting requirements
  //       search: (search as string) || '',
  //     };
  //     const aqrs = await this.aqrService.getAllAqr(queryOptions);
  //     console.log('in agrs', aqrs);
  //     if (aqrs.data.length === 0) {
  //       logger.warn('No AQR entries found');
  //       return next(new AppError(404, 'No AQR entries found'));
  //     }

  //     logger.info('AQR entries retrieved successfully', {
  //       count: aqrs.data.length,
  //     });
  //     return res.status(200).json({
  //       status: 'success',
  //       message: 'AQR entries retrieved successfully',
  //       data: aqrs.data,
  //       allRecords: aqrs.meta.total,
  //       totalPages: aqrs.meta.pages,
  //       page: aqrs.meta.page,
  //     });
  //   } catch (error) {
  //     logger.error('Error fetching all AQR entries', { error });
  //     next(error);
  //   }
  // }

  @httpGet('/:id')
  public async getAqrById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> {
    try {
      //console.log(req.params)
      const { id } = req.params;
      console.log("iddddddddd", id);
      
      const aqr = await this.aqrService.getAqrById(id);
      //console.log(aqr)
      // if (!aqr.) {
      //     throw new AppError(404, "AQR not found");
      // }

      return res.status(200).json({ status: 'success', data: aqr });
    } catch (error) {
      logger.error('Error fetching AQR by ID', { id: req.params.id, error });
      next(error);
    }
  }

  @httpGet('/update/:id')
  public async getAqrByIdForUpdate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> {
    try {
      //console.log(req.params)
      const { id } = req.params;
      const aqr = await this.aqrService.getAqrByIdForUpdate(id);
      //console.log(aqr)
      if (!aqr) {
          throw new AppError(404, "AQR not found");
      }

      return res.status(200).json({ status: 'success', data: aqr });
    } catch (error) {
      logger.error('Error fetching AQR by ID', { id: req.params.id, error });
      next(error);
    }
  }
// @httpGet('/view/:id')
//   public async getAqrByIdForview(
//     req: Request,
//     res: Response,
//     next: NextFunction,
//   ): Promise<Response | void> {
//     try {
//       //console.log(req.params)
//       const { id } = req.params;
//       console.log("iddddddddddd", id);
      
//       const aqr = await this.aqrService.getAqrByIdForView(id);
//       //console.log(aqr)
//       if (!aqr) {
//           throw new AppError(404, "AQR not found");
//       }

//       return res.status(200).json({ status: 'success', data: aqr.data });
//     } catch (error) {
//       logger.error('Error fetching AQR by ID', { id: req.params.id, error });
//       next(error);
//     }
//   }

  /**
   * Update an AQR entry
   */
  @httpPatch('/:id')
  public async updateAqr(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> {
    try {
      const { id } = req.params;
      console.log(id)
      const updatedBy=res.locals.updatedBy;
      const updateData = req.body;
      console.log(updateData)
      console.log(updatedBy)
      const updatedAqr = await this.aqrService.updateAqr(
        id,
        updateData,
        updatedBy,
      );
      //console.log("after saving updated aqr in controller ", updatedAqr)
      if (!updatedAqr) {
        throw new AppError(404, 'AQR not found or could not be updated');
      }

      // // Notify related parties
      // await this.notificationService.createNoti({
      //     message: "AQR has been updated",
      //     details: updatedAqr,
      // });
      // await this.notificationService.createNoti(
      //   `AQR entry updated successfully: ${updatedAqr}`,
      //   updatedBy,
      // );

      logger.info('AQR updated successfully', { aqrId: id });

      return res.status(200).json({ status: 'success', data: updatedAqr });
    } catch (error) {
      logger.error('Error updating AQR', { error });
      console.log(error)
      next(error);
    }
  }

  /**
   * Delete an AQR entry
   */
  @httpDelete('/:id')
  public async deleteAqr(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> {
    try {
      const { id } = req.params;

      const deleted = await this.aqrService.deleteAqr(id);

      if (!deleted) {
        throw new AppError(404, 'AQR not found or could not be deleted');
      }

      logger.info('AQR deleted successfully', { aqrId: id });
console.log('AQR deleted successfully', { aqrId: id });
      return res
        .status(200)
        .json({ status: 'success', message: 'AQR deleted successfully' });
    } catch (error) {
      logger.error('Error deleting AQR', { id: req.params.id, error });
      next(error);
    }
  }
  @httpGet('/search/:search')
  public async searchAqr(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> {
    try {
      const { search } = req.params;
      const aqr = await this.aqrService.searchAqr(search);
      if (!aqr) {
        throw new AppError(404, 'AQR not found');
      }
      return res.status(200).json({ status: 'success', data: aqr });
    } catch (error) {
      logger.error('Error fetching AQR by ID', { id: req.params.id, error });
      next(error);
    }
  }


  //TODO: get All AQR.....By Vaishali
    @httpGet('/')
    public async getAllAqrs(
      @request() req: Request,
      @response() res: Response,
      @next() next: NextFunction,
    ) {
      try {
        logger.info('Fetching all AQR...');
        const {
          page,
          limit,
          search,
          sort,
          supplierName,
          arrivalDate,
          // requestingDepartment,
          // dealSlipNo
        } = req.query;
    
        const userId = res.locals.user.id;
    
        const filters: any = {};
        if (supplierName) filters.supplierName = supplierName;
        if (arrivalDate) filters.arrivalDate = arrivalDate;
        // if (requestingDepartment) filters.requestingDepartment = requestingDepartment;
        // if (dealSlipNo) filters.dealSlipNo = dealSlipNo;
    
        const queryOptions: PaginationOptions = {
          page: page ? Number(page) : 1,
          limit: limit ? Number(limit) : 10,
          //searchFields: ['batchNo'],
          filters,
          sort: (sort as string) || undefined,
          search: (search as string) || '',
        };
    
        const aqrs = await this.aqrService.getAllAqrs(queryOptions, userId);
    
        if (!aqrs || aqrs.data.length === 0) {
          logger.warn('No AQR found for this user.');
          return res.status(200).json({
            status: 'success',
            data: [],
            allRecords: 0,
            totalPages: 0,
            page: queryOptions.page,
          });
        }
    
      //  logger.info(Total AQR fetched: ${aqrs.data.length});
    
        res.status(200).json({
          status: 'success',
          data: aqrs.data,
          allRecords: aqrs.meta.total,
          totalPages: aqrs.meta.pages,
          page: aqrs.meta.page,
        });
      } catch (error) {
        console.error('Error fetching AQR:', error);
        next(error);
      }
    }

     //TODO: AQR get by id for view...BY Vaishali
  @httpGet('/view/:docid')
  public async getAQRByIdForView(
    @requestParam('docid') docid: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
     // logger.info(Fetching AQR with Document ID);
      console.log("Shriiiiiiiiiii");
      
      console.log(docid);
      const userId = res.locals.user.id;
      const aqr = await this.aqrService.getAQRByIdForView(docid,userId);
      console.log(aqr);
      if (!aqr) {
        return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to view this Inward Register',
      });
        //return next(new AppError(404, 'dealSlip not found'));
      }
     // logger.info(AQR with ID fetched successfully.);
      const requestedBy = res.locals.user.id;
      console.log('user is ', requestedBy);
      // Send a notification when the user logs in successfully
      // const message = Welcome back! You have successfully logged in.;
      // await this.notificationService.createNoti(message, requestedBy);
      res.status(200).json({
        status: 'success',
        data: aqr,
      });
    } catch (error) {
      console.log(error);
      logger.error('Error fetching AQR by ID:', error);
      next(error);
    }
  }

@httpGet('/filter')
public async filterAqrs(
  @request() req: Request,
  @response() res: Response,
  @next() next: NextFunction,
) {
try {
      // Extract pagination
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;

      // Remove pagination keys and treat the rest as filters
      const { page: _p, limit: _l, ...restQuery } = req.query;

      // Always initialize filters as a Record
      const filters: Record<string, any> = {};

      for (const [key, value] of Object.entries(restQuery ?? {})) {
        if (value !== undefined && value !== "") {
          filters[key] = value;
        }
      }

      const result = await this.aqrService.filterAqrs(page, limit, filters);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server Error" });
    }
}

@httpDelete('/delete/multiple')
  public async deleteMultipleAqrs(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return next(new AppError(400, 'An array of AQR IDs is required'));
      }
      const result = await this.aqrService.deleteMultipleAqrs(ids);
      res.status(200).json({
        message: result.message,
        success: result.success,
        failed: result.failed,
      });
    }
      catch (error) {
      logger.error('Error deleting multiple AQRs', { error });
      next(error);
    }
  }


}
