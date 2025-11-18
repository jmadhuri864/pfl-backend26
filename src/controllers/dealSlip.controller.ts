import { inject } from "inversify";
import { controller, httpGet, request, response, next, requestParam, httpPost, requestBody, httpPatch, httpDelete } from "inversify-express-utils";
import { TYPES } from "../types";
import { DealSlipService } from "../services/dealSlip.service";
import { Request, Response, NextFunction } from "express";
import AppError from "../utils/appError";
import { captureUser, deserializeUser, requireUser} from "../middleware/deserializeUser";

import logger from "../utils/logger";
import { PaginationOptions } from "../utils/pagination";

@controller('/dealSlip', deserializeUser, requireUser)
export class DealSlipController {
  
  constructor(
    @inject(TYPES.DealSlipService)
    private dealSlipService: DealSlipService
  ) {}

  // @httpGet("/")
  // public async getAllDealSlips(
  //   @request() req: Request,
  //   @response() res: Response,
  //   @next() next: NextFunction
  // ): Promise<void> {
  //   try {
  //     logger.info("Fetching all deal slips...");

  //     const { page, limit, search, sort,dealslipId} = req.query;
                
            
  //                 const queryOptions: PaginationOptions = {
  //                   page: page ? Number(page) : undefined,  
  //                   limit: limit ? Number(limit) : undefined,
  //                   searchFields: ['dealSlip.dealslipId'],
  //                   filters: {},
  //                   sort: sort as string || undefined, // Adjust this line to match your sorting requirements
  //                   search: search as string|| '',
  //                 };
  //     const deals = await this.dealSlipService.findAllDealSlip(queryOptions);

  //     // Check if no deal slips are found
  //     if (!deals || (Array.isArray(deals) && deals.length === 0)) {
  //       logger.warn("No deal slips found.");
  //       return next(new AppError(400, "No Deal Slips found"));
  //     }
      
  //     res.status(200).json({
  //       status: "success",
  //       data: deals.data,
  //       allRecords: deals.total,
  //       totalPages: deals.totalPages,
  //       page: deals.page,
  //     });
  //   } catch (error) {
  //     logger.error("Error fetching deal slips:", error);
  //     next(error); // Pass the error to the global error handler
  //   }
  // }
@httpGet('/recyclebin')
public async getRecycleBinDealSlips(
  @request() req: Request,
  @response() res: Response,
  @next() next: NextFunction,
) {
  try {
    logger.info('Fetching all DealSlips...');
    const {
      page,
      limit,
      search,
      sort,
      approvalStatus,
      loadingLocation,
      requestingDepartment,
      dealSlipNo
    } = req.query;

    const userId = res.locals.user.id;

    const filters: any = {};
    if (approvalStatus) filters.approvalStatus = approvalStatus;
    if (loadingLocation) filters.loadingLocation = loadingLocation;
    if (requestingDepartment) filters.requestingDepartment = requestingDepartment;
    if (dealSlipNo) filters.dealSlipNo = dealSlipNo;

    const queryOptions: PaginationOptions = {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      //searchFields: ['dealSlipNo'],
      filters,
      sort: (sort as string) || undefined,
      search: (search as string) || '',
    };

    const dealSlips = await this.dealSlipService.getRecycleBinDealSlips(queryOptions, userId);

    if (!dealSlips || dealSlips.data.length === 0) {
      logger.warn('No DealSlips found for this user.');
      return res.status(200).json({
        status: 'success',
        data: [],
        allRecords: 0,
        totalPages: 0,
        page: queryOptions.page,
      });
    }

    logger.info(`Total DealSlips fetched: ${dealSlips.data.length}`);

    res.status(200).json({
      status: 'success',
      data: dealSlips.data,
      allRecords: dealSlips.meta.total,
      totalPages: dealSlips.meta.pages,
      page: dealSlips.meta.page,
    });
  } catch (error) {
    console.error('Error fetching DealSlips:', error);
    next(error);
  }
}

  @httpGet('/')
public async getAllDealSlips(
  @request() req: Request,
  @response() res: Response,
  @next() next: NextFunction,
) {
  try {
    logger.info('Fetching all DealSlips...');
    const {
      page,
      limit,
      search,
      sort,
      approvalStatus,
      loadingLocation,
      requestingDepartment,
      dealSlipNo
    } = req.query;

    const userId = res.locals.user.id;

    const filters: any = {};
    if (approvalStatus) filters.approvalStatus = approvalStatus;
    if (loadingLocation) filters.loadingLocation = loadingLocation;
    if (requestingDepartment) filters.requestingDepartment = requestingDepartment;
    if (dealSlipNo) filters.dealSlipNo = dealSlipNo;

    const queryOptions: PaginationOptions = {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      //searchFields: ['dealSlipNo'],
      filters,
      sort: (sort as string) || undefined,
      search: (search as string) || '',
    };

    const dealSlips = await this.dealSlipService.getAllDealSlips(queryOptions, userId);

    if (!dealSlips || dealSlips.data.length === 0) {
      logger.warn('No DealSlips found for this user.');
      return res.status(200).json({
        status: 'success',
        data: [],
        allRecords: 0,
        totalPages: 0,
        page: queryOptions.page,
      });
    }

    logger.info(`Total DealSlips fetched: ${dealSlips.data.length}`);

    res.status(200).json({
      status: 'success',
      data: dealSlips.data,
      allRecords: dealSlips.meta.total,
      totalPages: dealSlips.meta.pages,
      page: dealSlips.meta.page,
    });
  } catch (error) {
    console.error('Error fetching DealSlips:', error);
    next(error);
  }
}


  @httpGet("/:id")
  public async getDealSlipById(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ): Promise<void> {
    try {
      logger.info(`Fetching deal slip with ID: ${id}`);
      const dealSlip = await this.dealSlipService.findDealSlipById(id);
      
      // Check if deal slip not found
      if (!dealSlip) {
        logger.warn(`Deal slip with ID: ${id} not found.`);
        return next(new AppError(404, "Deal Slip not found"));
      }
      logger.info(`Deal slip with ID: ${id} fetched successfully.`);
      res.status(200).json({
        status: "success",
        data: dealSlip,
      });
    } catch (error) {
      logger.error("Error fetching deal slip by ID:", error);
      next(error); // Pass the error to the global error handler
    }
  }
// @httpGet("/:id/view")
//   public async getDealSlipByIdForView(
//     @requestParam("id") id: string,
//     @response() res: Response,
//     @next() next: NextFunction
//   ): Promise<void> {
//     try {
//       logger.info(`Fetching deal slip with ID: ${id}`);
//       const dealSlip = await this.dealSlipService.findDealSlipByIdforView(id);
      
//       // Check if deal slip not found
//       if (!dealSlip) {
//         logger.warn(`Deal slip with ID: ${id} not found.`);
//         return next(new AppError(404, "Deal Slip not found"));
//       }
//       logger.info(`Deal slip with ID: ${id} fetched successfully.`);
//       res.status(200).json({
//         status: "success",
//         data: dealSlip,
//       });
//     } catch (error) {
//       logger.error("Error fetching deal slip by ID:", error);
//       next(error); // Pass the error to the global error handler
//     }
//   }

  @httpGet("/:id/update")
  public async findDealSlipByIdforUpdate(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ): Promise<void> {
    try {
      logger.info(`Fetching deal slip with ID: ${id}`);
      const dealSlip = await this.dealSlipService.findDealSlipByIdforUpdate(id);
      
      // Check if deal slip not found
      if (!dealSlip) {
        logger.warn(`Deal slip with ID: ${id} not found.`);
        return next(new AppError(404, "Deal Slip not found"));
      }
      logger.info(`Deal slip with ID: ${id} fetched successfully.`);
      res.status(200).json({
        status: "success",
        data: dealSlip,
      });
    } catch (error) {
      logger.error("Error fetching deal slip by ID:", error);
      next(error); // Pass the error to the global error handler
    }
  }



  @httpPost("/")
  public async createDealSlip(
    @requestBody() dealData: any,
     @request() req:Request,
    @response() res: Response,
    @next() next: NextFunction
  ): Promise<void> {
    try {

     
      logger.info("Creating a new deal slip with data: %o", dealData);
      console.log(dealData)

      Object.keys(dealData).forEach((key) => {
        if (dealData[key] === "null") dealData[key] = null;
      });
      const requestedBy = res.locals.user.id;
      console.log("requested by ",requestedBy)
      //const baseLocation = res.locals.user.relocationPlace;

       // Add requestedBy, baseLocation, and requestingDepartment to rfpaData
       dealData.requestedBy = requestedBy;
      // dealData.baseLocation = baseLocation;
       dealData.requestingDepartment = res.locals.user.selectDepartment;
      const dealSlip = await this.dealSlipService.createDealSlip(dealData);
      
      logger.info("Deal slip created successfully.");
      res.status(200).json({
        status: "success",
        data: dealSlip,
      });
    } catch (error) {
      logger.error("Error creating deal slip:", error);
      next(error); // Pass the error to the global error handler
    }
  }

  @httpPatch("/:id",captureUser)
public async updateDealSlip(
  @requestParam("id") dealSlipId: string,
  @requestBody() dealSlipData: any,
  @request() req: Request,
  @response() res: Response,
  @next() next: NextFunction
): Promise<void> {
  try {
    logger.info("Updating deal slip with ID and data");
    
    console.log(dealSlipData)
    Object.keys(dealSlipData).forEach((key) => {
      if (dealSlipData[key] === "null") dealSlipData[key] = null;
    });
    const updatedBy = res.locals.updatedBy;
    const updatedDealSlip = await this.dealSlipService.updateDealSlip(dealSlipId, dealSlipData,updatedBy);

    if (!updatedDealSlip) {
      return next(new AppError(404, "Deal Slip not found"));
    }
    logger.info("Deal slip updated successfully.");
    res.status(200).json({
      status: "success",
      message: "Deal Slip updated successfully",
    });
  } catch (error) {
    logger.error("Error updating deal slip", error);
    next(error);
  }
}
@httpPatch("/approve/:dealSlipId")
public async approveDealSlipHandler(
  @requestParam("dealSlipId") dealSlipId: string,
  @request() req: Request,
  @response() res: Response,
  @next() next: NextFunction
): Promise<void> {
  try {
    logger.info(`Approving deal slip with ID`);
    const userId = res.locals.user.id; // Assuming you're getting the logged-in user's ID
     
     const { approvalStatus,  approvalNote } = req.body;
    const result = await this.dealSlipService.approveDealSlip(dealSlipId, userId,  { approvalStatus,  approvalNote });

    if (!result) {
      logger.warn(`Deal slip with ID not found or cannot be approved.`);
      return next(new AppError(404, "Deal Slip not found or cannot be approved"));
    }
    logger.info("Deal slip approved successfully.");
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    logger.error("Error approving deal slip", error);
    next(error);
  }
}
@httpGet("/dealslipno/getAlldealslipNo")
 public async getAllDealSlipNumbers(
   @response() res: Response,
   @next() next: NextFunction
 ) {
   try {
    logger.info("Fetching all DealSlip numbers");
    console.log("dealSlipnumbers")
     const dealSlips = await this.dealSlipService.getAllDealSlipsNo(); // Call the service method
     if (!dealSlips || dealSlips.length === 0) {
      logger.warn("No DealSlip numbers found");
       return next(new AppError(404, "No RFPAs found"));
     }
     logger.info(`Found ${dealSlips.length} DealSlip numbers`);
     res.status(200).json({
       status: "success",
       data: dealSlips, // Respond with the fetched RFPA data
     });
   } catch (error) {
    logger.error("Error fetching dealSlip numbers:", error);
     next(error); // Pass any errors to the error-handling middleware
   }
 }


 @httpDelete("/:id")
  public async deleteDealSlip(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) 
  {
    try {
      logger.info("Deleting Deal Slip", { id });
      const success = await this.dealSlipService.deleteDealSlip(id);
      if (!success) {
        logger.warn("Deal Slip not found for delete", { id });
        return res.status(404).json({ message: 'Deal Slip not found' });
      }
      logger.info("Deleted  Deal Slip", { id });
      res.status(200).json({
        status: "success",
        message: "Deal Slip deleted successfully",
      });
      
    } catch (err) {
      logger.error("Error deleting Deal Slip", { id, error: err });
      next(err);
    }
  }

  

//TODO: Deal Slip get by id for view...BY Vaishali
  @httpGet('/view/:docid')
  public async getDealSlipByIdForView(
    @requestParam('docid') docid: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info(`Fetching Deal Slip with Document ID`);
      console.log("Shriiiiiiiiiii");
      
      console.log(docid);
      const userId = res.locals.user.id;
      const dealSlip = await this.dealSlipService.getDealSlipByIdForView(docid,userId);
      console.log(dealSlip);
      if (!dealSlip) {
        return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to view this Deal Slip',
      });
        //return next(new AppError(404, 'dealSlip not found'));
      }
      logger.info(`dealSlip with ID fetched successfully.`);
      const requestedBy = res.locals.user.id;
      console.log('user is ', requestedBy);
      // Send a notification when the user logs in successfully
      // const message = Welcome back! You have successfully logged in.;
      // await this.notificationService.createNoti(message, requestedBy);
      res.status(200).json({
        status: 'success',
        data: dealSlip,
      });
    } catch (error) {
      console.log(error);
      logger.error('Error fetching dealSlip by ID:', error);
      next(error);
    }
  }

  // TODO: filter DealSlips with pagination .....By Vaishali
@httpGet('/filter')
public async filterDealSlips(
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

      const result = await this.dealSlipService.filterDealSlips(page, limit, filters);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server Error" });
    }
}

  @httpDelete("/delete/multiple")
  public async deleteMultipleDealSlips(
    @requestBody() ids: { ids: string[] },
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Deleting multiple Deal Slips", { ids });
      const result = await this.dealSlipService.deleteMultipleDealSlips(ids.ids);
      res.status(200).json({
        message: result.message,
        //success: result.success,
        //failed: result.failed,
      });
    } catch (err) {
      logger.error("Error deleting multiple Deal Slips", { ids, error: err });
      next(err);
    }
  }

}
