import { Request, Response, NextFunction } from 'express';
import { inject } from 'inversify';
import {
  controller,
  httpGet,
  httpPost,
 
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

import { PaginationOptions } from '../utils/pagination';
import { deserializeUser, requireUser } from '../middleware/deserializeUser';
import { ControllerLogger } from '../utils/controllerLogger';


@controller('/aqr',deserializeUser, requireUser)
export class AqrController {
  constructor(
    @inject(TYPES.AqrService) private aqrService: AqrService,
    @inject(TYPES.NotificationService)
    private notificationService: NotificationService,
  ) {}

  @httpPost('/')
  public async createAqr(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<Response | void> {
    try {
      const aqrData = req.body;
      aqrData.requestedBy = res.locals.user.id; 
console.log(aqrData)
      const createdAqr = await this.aqrService.createAqr(aqrData);
      console.log('created aqr in controller ', createdAqr);
      if (!createdAqr) {
        ControllerLogger.logOperationFailed('Create', 'AQR', 'not created', req, res);
        return next(new AppError(400, 'AQR not created'));
      }
      console.log('created aqr in controller ', createdAqr);

      // 🔔 Send notification for AQR creation
      try {
        const userId = res.locals.user.id;
        
       this.notificationService.createNoti(
          `AQR  created successfully and submitted for approval`,
          userId
        );
      } catch (notifError) {
        console.log('Notification error:', notifError);
      }

      ControllerLogger.logSuccess('AQR created', createdAqr.id, req, res);
      

      return res.status(201).json({ status: 'success', data: createdAqr });
    } catch (error) {
      
      ControllerLogger.logError('AQR creation', error, req, res);
      console.log(error);

       if (error instanceof Error) {
         return next(new AppError(400, error.message)); // ← sends 400 with real message
       }

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
          return res.status(200).json({
            status: 'success',
            data: [],
            allRecords: 0,
            totalPages: 0,
            page: queryOptions.page,
          });
        }

        // 🔔 Send notification for accessing recycle bin
        // try {
        //   this.notificationService.createNoti(
        //     `Accessed AQR recycle bin (${aqrs.data.length} items)`,
        //     userId
        //   );
        // } catch (notifError) {
        //   console.log('Notification error:', notifError);
        // }
        
        // Log successful retrieval with specific message
        ControllerLogger.logGetAllRecords('AQR', req, res);
     
    
        res.status(200).json({
          status: 'success',
          data: aqrs.data,
          allRecords: aqrs.meta.total,
          totalPages: aqrs.meta.pages,
          page: aqrs.meta.page,
        });
      } catch (error) {
       ControllerLogger.logError('Aqr Recycle Bin', error, req, res);
        next(error);
      }
    }
  
  @httpGet('/:id')
  public async getAqrById(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<Response | void> {
    try {
      const { id } = req.params;
      console.log("iddddddddd", id);
      
      const aqr = await this.aqrService.getAqrById(id);
      
      if (!aqr) {
        ControllerLogger.logNotFound('AQR', id, req, res);
        throw new AppError(404, "AQR not found");
      }

      // 🔔 Send notification for AQR access
      // try {
      //   const userId = res.locals.user.id;
      //   const aqrId = aqr.aqrId || id;
      //   // await this.notificationService.createNoti(
      //   //   `Viewed AQR ${aqrId} details`,
      //   //   userId
      //   // );
      // } catch (notifError) {
      //   console.log('Notification error:', notifError);
      // }

      // Log successful view
      ControllerLogger.logView('AQR', id, req, res);

      return res.status(200).json({ status: 'success', data: aqr });
    } catch (error) {
      ControllerLogger.logError('AQR Get', error, req, res);
      //logger.error('Error fetching AQR by ID', { id: req.params.id, error });
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
      
      if (!aqr) {
        ControllerLogger.logNotFound('AQR', id, req, res);
        throw new AppError(404, "AQR not found");
      }

      // 🔔 Send notification for AQR edit access
      // try {
      //   const userId = res.locals.user.id;
      //   const aqrId = aqr.aqrId || id;
      //   // await this.notificationService.createNoti(
      //   //   `Opened AQR ${aqrId} for editing`,
      //   //   userId
      //   // );
      // } catch (notifError) {
      //   console.log('Notification error:', notifError);
      // }
      
      // Log successful view for update
      ControllerLogger.logView('AQR', id, req, res);
      return res.status(200).json({ status: 'success', data: aqr });
    } catch (error) {
      ControllerLogger.logError('AQR Get', error, req, res)
      //logger.error('Error fetching AQR by ID', { id: req.params.id, error });
      next(error);
    }
  }


  /**
   * Update an AQR entry
   */
  @httpPatch('/:id')
  public async updateAqr(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
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
      
      if (!updatedAqr) {
        ControllerLogger.logOperationFailed('Update', 'AQR', 'not found or could not be updated', req, res);
        throw new AppError(404, 'AQR not found or could not be updated');
      }

      // 🔔 Send notification for AQR update
      try {
        const userId = res.locals.user.id;
        const aqrId = updatedAqr.aqrId || id;
        await this.notificationService.createNoti(
          `AQR updated successfully`,
          userId
        );
      } catch (notifError) {
        console.log('Notification error:', notifError);
      }

      //logger.info('AQR updated successfully', { aqrId: id });

      // Log successful update
      ControllerLogger.logSuccess('AQR updated', id, req, res);

      return res.status(200).json({ status: 'success', data: updatedAqr });
    } catch (error) {
      ControllerLogger.logError('AQR update', error, req, res);
      //logger.error('Error updating AQR', { error });
      console.log(error)
      next(error);
    }
  }

  /**
   * Delete an AQR entry
   */
  @httpDelete('/:id')
  public async deleteAqr(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<Response | void> {
    try {
      const { id } = req.params;

      const deleted = await this.aqrService.deleteAqr(id);

      if (!deleted) {
        ControllerLogger.logOperationFailed('Delete', 'AQR', 'not found or could not be deleted', req, res);
        throw new AppError(404, 'AQR not found or could not be deleted');
      }

      // 🔔 Send notification for AQR deletion
      // try {
      //   const userId = res.locals.user.id;
      //   await this.notificationService.createNoti(
      //     `AQR ${id} deleted successfully`,
      //     userId
      //   );
      // } catch (notifError) {
      //   console.log('Notification error:', notifError);
      // }

      //logger.info('AQR deleted successfully', { aqrId: id });
      
      // Log successful deletion
      ControllerLogger.logSuccess('AQR deleted', id, req, res);

      return res
        .status(200)
        .json({ status: 'success', message: 'AQR deleted successfully' });
    } catch (error) {
      ControllerLogger.logError('AQR deletion', error, req, res);
      //logger.error('Error deleting AQR', { id: req.params.id, error });
      next(error);
    }
  }
  @httpGet('/search/:search')
  public async searchAqr(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<Response | void> {
    try {
      const { search } = req.params;
      const aqr = await this.aqrService.searchAqr(search);
      
      if (!aqr) {
        ControllerLogger.logNotFound('AQR', search, req, res);
        throw new AppError(404, 'AQR not found');
      }

      // 🔔 Send notification for AQR search
      // try {
      //   const userId = res.locals.user.id;
      //   await this.notificationService.createNoti(
      //     `Searched for AQR: "${search}" - ${Array.isArray(aqr) ? aqr.length : 1} result(s) found`,
      //     userId
      //   );
      // } catch (notifError) {
      //   console.log('Notification error:', notifError);
      // }
      
      // Log successful search
      ControllerLogger.logView('AQR', search, req, res);
      
      return res.status(200).json({ status: 'success', data: aqr });
    } catch (error) {
      ControllerLogger.logError('AQR search', error, req, res);
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
        //logger.info('Fetching all AQR...');
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
          return res.status(200).json({
            status: 'success',
            data: [],
            allRecords: 0,
            totalPages: 0,
            page: queryOptions.page,
          });
        }

        // 🔔 Send notification for accessing AQR list
        // try {
        //   await this.notificationService.createNoti(
        //     `Accessed AQR list (${aqrs.data.length} items found)`,
        //     userId
        //   );
        // } catch (notifError) {
        //   console.log('Notification error:', notifError);
        // }
    
        logger.info(`Total AQR fetched: ${aqrs.data.length}`);
        
        // Log successful retrieval with specific message
        ControllerLogger.logGetAllRecords('AQR', req, res);
    
        res.status(200).json({
          status: 'success',
          data: aqrs.data,
          allRecords: aqrs.meta.total,
          totalPages: aqrs.meta.pages,
          page: aqrs.meta.page,
        });
      } catch (error) {
        ControllerLogger.logError('AQR retrieval', error, req, res);
        console.error('Error fetching AQR:', error);
        next(error);
      }
    }

     //TODO: AQR get by id for view...BY Vaishali
  @httpGet('/view/:docid')
  public async getAQRByIdForView(
    @requestParam('docid') docid: string,
    @request() req:Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
     
      console.log("Shriiiiiiiiiii");
      
      console.log(docid);
      const userId = res.locals.user.id;
      const aqr = await this.aqrService.getAQRByIdForView(docid,userId);
      console.log(aqr);
      
      if (!aqr) {
        ControllerLogger.logOperationFailed('View', 'AQR', 'permission denied or not found', req, res);
        return res.status(403).json({
          status: 'fail',
          message: 'You do not have permission to view this AQR',
        });
      }

      // 🔔 Send notification for AQR view access
      // try {
      //   const aqrId = aqr.aqrId || docid;
      //   await this.notificationService.createNoti(
      //     `Viewed AQR ${aqrId} for review`,
      //     userId
      //   );
      // } catch (notifError) {
      //   console.log('Notification error:', notifError);
      // }
      
      // Log successful view
      ControllerLogger.logView('AQR', docid, req, res);
      
      const requestedBy = res.locals.user.id;
      console.log('user is ', requestedBy);
      
      res.status(200).json({
        status: 'success',
        data: aqr,
      });
    } catch (error) {
      console.log(error);
      ControllerLogger.logError('AQR update', error, req, res);
      //logger.error('Error fetching AQR by ID:', error);
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

      // 🔔 Send notification for AQR filtering
      // try {
      //   const userId = res.locals.user.id;
      //   const filterCount = Object.keys(filters).length;
      //   await this.notificationService.createNoti(
      //     `Applied ${filterCount} filter(s) to AQR list - ${result.data?.length || 0} results found`,
      //     userId
      //   );
      // } catch (notifError) {
      //   console.log('Notification error:', notifError);
      // }

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error(error);
       ControllerLogger.logError('AQR', error, req, res);
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

      // 🔔 Send notification for bulk AQR deletion
      // try {
      //   const userId = res.locals.user.id;
      //  this.notificationService.createNoti(
      //     `Bulk delete operation completed: ${result.success} AQRs deleted successfully, ${result.failed} failed`,
      //     userId
      //   );
      // } catch (notifError) {
      //   console.log('Notification error:', notifError);
      // }

      res.status(200).json({
        message: result.message,
        success: result.success,
        failed: result.failed,
      });
    }
      catch (error) {
       ControllerLogger.logError('AQR deleteed', error, req, res);
      next(error);
    }
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

