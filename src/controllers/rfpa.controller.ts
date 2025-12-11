import { inject } from 'inversify';
import {
  controller,
  httpGet,
  httpPatch,
  httpPost,
  request,
  response,
  next,
  requestParam,
  requestBody,
  httpDelete,
} from 'inversify-express-utils';
import { TYPES } from '../types';
import { RfpaService } from '../services/rfpa.service';
import { NextFunction, Request, Response } from 'express';
import AppError from '../utils/appError';
import { deserializeUser, requireUser } from '../middleware/deserializeUser';
import { Source } from '../utils/status.enum';
import logger from '../utils/logger';
import { PaginationOptions } from '../utils/pagination';
import { checkPermission } from '../middleware/checkPermission';
import { ControllerLogger } from '../utils/controllerLogger';


@controller('/rfpa', deserializeUser, requireUser)
export class RfpaController {
  constructor(
    @inject(TYPES.RfpaService)
    private readonly rfpaService: RfpaService,
   
  ) {}

  // @httpGet('/')
  // @httpGet('/get')
  // public async getAllRfpas(
  //   @request() req: Request,
  //   @response() res: Response,
  //   @next() next: NextFunction,
  // ): Promise<void> {
  //   try {
  //     logger.info('Fetching all RFPAs');

  //     const { page, limit, search, sort, rfpaId } = req.query;

  //     const queryOptions: PaginationOptions = {
  //       page: page ? Number(page) : undefined,
  //       limit: limit ? Number(limit) : undefined,
  //       searchFields: ['rfpa.rfpaId'],
  //       filters: {},
  //       sort: (sort as string) || undefined,
  //       search: (search as string) || '',
  //     };
  //     const rfpas = await this.rfpaService.findAllRfpas(queryOptions);

  //     if (!rfpas || (Array.isArray(rfpas) && rfpas.length === 0)) {
  //       logger.warn('No RFPAs found');
  //       return next(new AppError(400, 'No RFPAs found'));
  //     }
  //     logger.info('Successfully fetched all RFPAs');
  //     res.status(200).json({
  //       status: 'success',

  //       data: rfpas.data,
  //       allRecords: rfpas.meta.total,
  //       totalPages: rfpas.meta.pages,
  //       page: rfpas.meta.page,
  //     });
  //   } catch (error) {
  //     console.log(error);
  //     logger.error('Error fetching all RFPAs', error);
  //     next(error);
  //   }
  // }

  // @httpGet('/:id', checkPermission('rfpa', 'view'))
  // public async getRfpaById(
  //   @requestParam('id') rfpaId: string,
  //   @request() req: Request,
  //   @response() res: Response,
  //   @next() next: NextFunction,
  // ): Promise<void> {
  //   try {
  //     logger.info(`Fetching RFPA with ID: ${rfpaId}`);
  //     const rfpa = await this.rfpaService.getRFQById(rfpaId);

  //     if (!rfpa) {
  //       logger.warn(`RFPA with ID ${rfpaId} not found`);
  //       throw new AppError(404, 'RFPA not found');
  //     }
  //     logger.info(`Successfully fetched RFPA with ID: ${rfpaId}`);
  //     res.status(200).json({
  //       status: 'success',
  //       data: rfpa,
  //       //message:"rfpa is created"
  //     });
  //   } catch (error) {
  //     console.log(error);
  //     logger.error(`Error fetching RFPA with ID ${rfpaId}:`, error);
  //     next(error);
  //   }
  // }


  @httpGet('/:id/view')
  public async getRfpaByIdByView(
    @requestParam('id') rfpaId: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<void> {
    try {
      logger.info(`Fetching RFPA with ID: ${rfpaId}`);
      const rfpa = await this.rfpaService.getRFQByIdByView(rfpaId);

      if (!rfpa) {
        logger.warn(`RFPA with ID ${rfpaId} not found`);
        throw new AppError(404, 'RFPA not found');
      }
      logger.info(`Successfully fetched RFPA with ID: ${rfpaId}`);
      res.status(200).json({
        status: 'success',
        data: rfpa,
        //message:"rfpa is created"
      });
    } catch (error) {
      console.log(error);
      logger.error(`Error fetching RFPA with ID ${rfpaId}:`, error);
      next(error);
    }
  }

  
  @httpGet('/recyclebin')
public async getRecycleBinRfpa(
  @request() req: Request,
  @response() res: Response,
  @next() next: NextFunction,
) {
  try {
    //logger.info('Fetching all RFPA...');
    const {
      page,
      limit,
      search,
      sort,
      selectedVendor,
      source,
      companyName,
      requestingDepartment,
      rfpaId
    } = req.query;

    const userId = res.locals.user.id;

    const filters: any = {};
    // if (selectedVendor) filters.selectedVendor = selectedVendor;
    // if (source) filters.source = source;
    // if (requestingDepartment) filters.requestingDepartment = requestingDepartment;
    // if (companyName) filters.companyName = companyName;
    // if (rfpaId) filters.rfpaId = rfpaId;

    const queryOptions: PaginationOptions = {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      //searchFields: [''],
      filters,
      sort: (sort as string) || undefined,
      search: (search as string) || '',
    };

    const rfpas = await this.rfpaService.getRecycleBinRfpa(queryOptions, userId);

    if (!rfpas || rfpas.data.length === 0) {
      logger.warn('No RFPAS found for this user.');
      return res.status(200).json({
        status: 'success',
        data: [],
        allRecords: 0,
        totalPages: 0,
        page: queryOptions.page,
      });
    }

    logger.info(`Total RFPAS fetched: ${rfpas.data.length}`);

    // Log successful retrieval with specific message
    ControllerLogger.logRfpaData(req, res);

    res.status(200).json({
      status: 'success',
      data: rfpas.data,
      allRecords: rfpas.meta.total,
      totalPages: rfpas.meta.pages,
      page: rfpas.meta.page,
    });
  } catch (error) {
    console.error('Error fetching rfpas:', error);
    next(error);
  }
}
  @httpGet('/:id/update')
  public async getRfpaByIdByUpdate(
    @requestParam('id') rfpaId: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<void> {
    try {
      logger.info(`Fetching RFPA with ID: ${rfpaId}`);
      const rfpa = await this.rfpaService.getRFQByIdForUpdate(rfpaId);

      if (!rfpa) {
        logger.warn(`RFPA with ID ${rfpaId} not found`);
        throw new AppError(404, 'RFPA not found');
      }
      logger.info(`Successfully fetched RFPA with ID: ${rfpaId}`);
      res.status(200).json({
        status: 'success',
        data: rfpa,
        //message:"rfpa is created"
      });
    } catch (error) {
      console.log(error);
      logger.error(`Error fetching RFPA with ID ${rfpaId}:`, error);
      next(error);
    }
  }

  //TODO: Create RFPA
  @httpPost('/', checkPermission('rfpa', 'create'))
  public async createRfpa(
    @requestBody() rfpaData: any,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<void> {
    try {
      logger.info('Creating a new RFPA:', rfpaData);
      console.log(req.body);

      const requestedBy = res.locals.user.id;

      if (!rfpaData) {
        logger.warn('Invalid RFPA data');
        return next(
          new AppError(400, 'RFPA could not be created, no data provided'),
        );
      }

      rfpaData.requestedBy = requestedBy;

      rfpaData.requestingDepartment = res.locals.user.selectDepartment;

      if (rfpaData.source === Source.VENDOR) {
        if (!rfpaData.selectedParty) {
          logger.warn('Vendor source selected, but no vendor provided');
          return next(
            new AppError(
              400,
              'Vendor must be provided when the source is vendor',
            ),
          );
        }
        rfpaData.selectedVendor = { id: rfpaData.selectedParty };
      } else if (rfpaData.source === Source.FARMER) {
        if (!rfpaData.selectedParty) {
          logger.warn('Farmer source selected, but no farmer provided');
          return next(
            new AppError(
              400,
              'Farmer must be provided when the source is farmer',
            ),
          );
        }
        rfpaData.selectedFarmer = { id: rfpaData.selectedParty };
      } else {
        logger.warn('Invalid source provided');
        return next(
          new AppError(
            400,
            'Invalid source: Either vendor or farmer must be provided',
          ),
        );
      }

      const newRfpa = await this.rfpaService.createRfpa(rfpaData);
      logger.info('RFPA created successfully: %o', newRfpa);

      res.status(201).json({
        status: 'success',
        message: 'RFPA created successfully',
        data: newRfpa,
      });
    } catch (error) {
      logger.error('Error creating RFPA:', error);
      next(error);
    }
  }

  @httpPatch('/:id', checkPermission('rfpa', 'edit'))
  public async updateRfpa(
    @requestParam('id') rfpaId: string,
    @requestBody() rfpaData: any,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<void> {
    try {
      console.log(rfpaData);

      logger.info(`Updating RFPA with ID`);
      const updatedBy = res.locals.user.id;
      console.log(rfpaData);
      rfpaData.requestedBy = res.locals.user.id;
      const updatedRfpa = await this.rfpaService.updateRfpa(
        rfpaId,
        rfpaData,
        updatedBy,
      );
      console.log(updatedRfpa);
      if (!updatedRfpa) {
        logger.warn(`RFPA with ID ${rfpaId} not found`);
        return next(new AppError(404, 'RFPA not found'));
      }
      logger.info(`RFPA with ID ${rfpaId} updated successfully`);
      res.status(200).json({
        status: 'success',
        //data: updatedRfpa,
        message: 'RFPA updated successfully',
      });
    } catch (error) {
      console.log(error);
      logger.error(`Error updating RFPA with ID ${rfpaId}:`, error);
      next(error);
    }
  }

  @httpPatch('/approve/:rfpaId')
  public async approveRFPAHandler(
    @requestParam('rfpaId') rfpaId: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<void> {
    try {
      logger.info(`Approving RFPA with ID`);
      const userId = res.locals.user.id;
      console.log(req.body);
      const { approvalStatus, note } = req.body;
      const result = 10;
      // await this.rfpaService.approveRFPA(
      //   rfpaId,
      //   userId,
      //   req.body,
      // );

      if (!result) {
        logger.warn(`RFPA with ID: ${rfpaId} not found or cannot be approved`);
        return next(new AppError(404, 'RFPA not found or cannot be approved'));
      }
      logger.info(`Successfully approved RFPA with ID: ${rfpaId}`);
      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      logger.error(`Error approving RFPA with ID ${rfpaId}:`, error);
      next(error);
    }
  }

  @httpGet('/rfpas/approved')
  public async getAllApprovedRfpas(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<void> {
    try {
      logger.info(`Fetching All approved RFPA`);
      const rfpas = 10;
      //await this.rfpaService.findAllApprovedRfpas();

      if (!rfpas || (Array.isArray(rfpas) && rfpas.length === 0)) {
        logger.warn('No approved RFPAs found');
        return next(new AppError(400, 'No RFPAs found'));
      }
      //logger.info(`Found ${rfpas.length} approved RFPAs`);
      res.status(200).json({
        status: 'success',
        data: rfpas,
      });
    } catch (error) {
      logger.error('Error fetching approved RFPAs:', error);
      next(error);
    }
  }
  @httpGet('/rfpanumbers/getAllRfpaNo')
  public async getAllRFPANumbers(
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Fetching all RFPA numbers');
      console.log('rfpanumbers');
      const rfpas = await this.rfpaService.getAllRFPANumbers();
      if (!rfpas || rfpas.length === 0) {
        logger.warn('No RFPA numbers found');
        return next(new AppError(404, 'No RFPAs found'));
      }
      logger.info(`Found ${rfpas.length} RFPA numbers`);
      res.status(200).json({
        status: 'success',
        data: rfpas,
      });
    } catch (error) {
      logger.error('Error fetching RFPA numbers:', error);
      next(error);
    }
  }

  @httpDelete('/:id', checkPermission('rfpa', 'delete'))
  public async deleteRfpas(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<void> {
    try {
      logger.info('Deleting RFPA ......');
      const { id } = req.params;
      if (!id) {
        logger.warn('RFPA ID not provided');
        return next(new AppError(400, 'RFPA ID is required'));
      }
      const success = await this.rfpaService.deleteRfpa(id);
      if (!success) {
        logger.warn('No RFPA numbers found');
        return next(new AppError(404, 'No RFPAs found'));
      }
      res.status(200).json({
        status: 'success',
        message: 'RFPA deleted Successfully',
      });
    } catch (error) {
      logger.error('Error to Delete rfpa');
      next(error);
    }
  }


//   //TODO:By Vaishali
//   //TODO: get All RFPA
// @httpGet('/')
// public async getAllRfpa(
//   @request() req: Request,
//   @response() res: Response,
//   @next() next: NextFunction,
// ) {
//   try {
//     logger.info('Fetching all RFPA...');
//     const {
//       page,
//       limit,
//       search,
//       sort,
//       selectedVendor,
//       source,
//       companyName,
//       requestingDepartment,
//       rfpaId
//     } = req.query;

//     const userId = res.locals.user.id;

//     const filters: any = {};
//     if (selectedVendor) filters.selectedVendor = selectedVendor;
//     if (source) filters.source = source;
//     if (requestingDepartment) filters.requestingDepartment = requestingDepartment;
//     if (companyName) filters.companyName = companyName;
//     if (rfpaId) filters.rfpaId = rfpaId;

//     const queryOptions: PaginationOptions = {
//       page: page ? Number(page) : 1,
//       limit: limit ? Number(limit) : 10,
//       searchFields: ['rfpaId'],
//       filters,
//       sort: (sort as string) || undefined,
//       search: (search as string) || '',
//     };

//     const rfpas = await this.rfpaService.getAllRfpa(queryOptions, userId);

//     if (!rfpas || rfpas.data.length === 0) {
//       logger.warn('No RFPAS found for this user.');
//       return res.status(200).json({
//         status: 'success',
//         data: [],
//         allRecords: 0,
//         totalPages: 0,
//         page: queryOptions.page,
//       });
//     }

//     logger.info(`Total RFPAS fetched: ${rfpas.data.length}`);

//     res.status(200).json({
//       status: 'success',
//       data: rfpas.data,
//       allRecords: rfpas.meta.total,
//       totalPages: rfpas.meta.pages,
//       page: rfpas.meta.page,
//     });
//   } catch (error) {
//     console.error('Error fetching rfpas:', error);
//     next(error);
//   }
// }

// //TODO:By Vaishali
//  //TODO: RPFA get by id for view
//   @httpGet('/view/:docid')
//   public async getRfpaByIdForView(
//     @requestParam('docid') docid: string,
//     @response() res: Response,
//     @next() next: NextFunction,
//   ) {
//     try {
//       logger.info(`Fetching RFPA with Document ID`);
//       console.log("Shriiiiiiiiiii");
      
//       console.log(docid);
//       const userId = res.locals.user.id;
//       const rfpa = await this.rfpaService.getRfpaByIdForView(docid,userId);
//       console.log(rfpa);
//       if (!rfpa) {
//         return res.status(403).json({
//         status: 'fail',
//         message: 'You do not have permission to view this RFPA',
//       });
//         //return next(new AppError(404, 'dealSlip not found'));
//       }
//       logger.info(`rfpa with ID fetched successfully.`);
//       const requestedBy = res.locals.user.id;
//       console.log('user is ', requestedBy);
//       // Send a notification when the user logs in successfully
//       // const message = Welcome back! You have successfully logged in.;
//       // await this.notificationService.createNoti(message, requestedBy);
//       res.status(200).json({
//         status: 'success',
//         data: rfpa,
//       });
//     } catch (error) {
//       console.log(error);
//       logger.error('Error fetching RFPA by ID:', error);
//       next(error);
//     }
//   }


   //TODO:By Vaishali
  //TODO: get All RFPA
// @httpGet('/')
// public async getAllRfpa(
//   @request() req: Request,
//   @response() res: Response,
//   @next() next: NextFunction,
// ) {
//   try {
//     logger.info('Fetching all RFPA...');
//     const {
//       page,
//       limit,
//       search,
//       sort,
//       selectedVendor,
//       source,
//       companyName,
//       requestingDepartment,
//       rfpaId
//     } = req.query;

//     const userId = res.locals.user.id;

//     const filters: any = {};
//     if (selectedVendor) filters.selectedVendor = selectedVendor;
//     if (source) filters.source = source;
//     if (requestingDepartment) filters.requestingDepartment = requestingDepartment;
//     if (companyName) filters.companyName = companyName;
//     if (rfpaId) filters.rfpaId = rfpaId;

//     const queryOptions: PaginationOptions = {
//       page: page ? Number(page) : 1,
//       limit: limit ? Number(limit) : 10,
//       searchFields: ['rfpaId'],
//       filters,
//       sort: (sort as string) || undefined,
//       search: (search as string) || '',
//     };

//     const rfpas = await this.rfpaService.getAllRfpa(queryOptions, userId);
// console.log("rrrrrfffffppppppaaaassss",rfpas)
//     if (!rfpas || rfpas.data.length === 0) {
//       logger.warn('No RFPAS found for this user.');
//       return res.status(200).json({
//         status: 'success',
//         data: [],
//         allRecords: 0,
//         totalPages: 0,
//         page: queryOptions.page,
//       });
//     }

//     logger.info(`Total RFPAS fetched: ${rfpas.data.length}`);

//     res.status(200).json({
//       status: 'success',
//       data: rfpas.data,
//       allRecords: rfpas.meta.total,
//       totalPages: rfpas.meta.pages,
//       page: rfpas.meta.page,
//     });
//   } catch (error) {
//     console.error('Error fetching rfpas:', error);
//     next(error);
//   }
// }

//TODO:By Vaishali
  //TODO: get All RFPA
@httpGet('/')
public async getAllRfpa(
  @request() req: Request,
  @response() res: Response,
  @next() next: NextFunction,
) {
  try {
    //logger.info('Fetching all RFPA...');
    const {
      page,
      limit,
      search,
      sort,
      selectedVendor,
      source,
      companyName,
      requestingDepartment,
      rfpaId
    } = req.query;

    const userId = res.locals.user.id;

    const filters: any = {};
    // if (selectedVendor) filters.selectedVendor = selectedVendor;
    // if (source) filters.source = source;
    // if (requestingDepartment) filters.requestingDepartment = requestingDepartment;
    // if (companyName) filters.companyName = companyName;
    // if (rfpaId) filters.rfpaId = rfpaId;

    const queryOptions: PaginationOptions = {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      //searchFields: [''],
      filters,
      sort: (sort as string) || undefined,
      search: (search as string) || '',
    };

    const rfpas = await this.rfpaService.getAllRfpa(queryOptions, userId);

    if (!rfpas || rfpas.data.length === 0) {
      logger.warn('No RFPAS found for this user.');
      return res.status(200).json({
        status: 'success',
        data: [],
        allRecords: 0,
        totalPages: 0,
        page: queryOptions.page,
      });
    }

    logger.info(`Total RFPAS fetched: ${rfpas.data.length}`);

    // Log successful retrieval with specific message
    ControllerLogger.logRfpaData(req, res);

    res.status(200).json({
      status: 'success',
      data: rfpas.data,
      allRecords: rfpas.meta.total,
      totalPages: rfpas.meta.pages,
      page: rfpas.meta.page,
    });
  } catch (error) {
    console.error('Error fetching rfpas:', error);
    next(error);
  }
}


//TODO:By Vaishali
 //TODO: RPFA get by id for view
  @httpGet('/view/:docid')
  public async getRfpaByIdForView(
    @requestParam('docid') docid: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info(`Fetching RFPA with Document ID`);
      console.log("Shriiiiiiiiiii");
      
      console.log(docid);
      const userId = res.locals.user.id;
      const rfpa = await this.rfpaService.getRfpaByIdForView(docid,userId);
      console.log(rfpa);
      if (!rfpa) {
        return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to view this RFPA',
      });
        //return next(new AppError(404, 'dealSlip not found'));
      }
      logger.info(`rfpa with ID fetched successfully.`);
      const requestedBy = res.locals.user.id;
      console.log('user is ', requestedBy);
      // Send a notification when the user logs in successfully
      // const message = Welcome back! You have successfully logged in.;
      // await this.notificationService.createNoti(message, requestedBy);
      res.status(200).json({
        status: 'success',
        data: rfpa,
      });
    } catch (error) {
      console.log(error);
      logger.error('Error fetching RFPA by ID:', error);
      next(error);
    }
  }


  @httpGet('/filter')
public async filterRfpas(
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

      const result = await this.rfpaService.filterRfpas(page, limit, filters);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server Error" });
    }
}

//pest in rfpa controller  
@httpDelete('/delete/multiple')
  public async deleteMultipleRfpas(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<void> {
    try {
      console.log(req.body);
      logger.info('Deleting multiple RFPAs ......', req.body);
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        logger.warn('RFPA IDs not provided or invalid');
        return next(new AppError(400, 'An array of RFPA IDs is required'));
      }
      const result = await this.rfpaService.deleteMultipleRFPA(ids);
      
      res.status(200).json({
        message: result.message,
      });

    } catch (error) {
      logger.error('Error deleting multiple RFPAs:', error);
      next(error);
    }
  }



}
