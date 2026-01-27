import { Request, Response, NextFunction } from "express";
import {
  controller,
  httpGet,
  httpPost,
  request,
  response,
  requestParam,
  next,
  httpDelete,
  httpPatch,
  httpPut,
} from "inversify-express-utils";
import { inject } from "inversify";
import AppError from "../utils/appError";
import { UserService } from "../services/user.service";
import { NotificationService } from "../services/notification.service";
import { TYPES } from "../types";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import logger from "../utils/logger";
import { ControllerLogger } from "../utils/controllerLogger";
import { PaginationOptions } from "../utils/pagination";
import { OfficesService } from "../services/office.service";
import { BranchessService } from "../services/branches.service";
import { Branches } from "../entities/branches.entity";
import { OfficesData } from "../entities/offices.entity";
import { parseExcel } from "../utils/excelParser";
import { upload } from "../middleware/multerConfig";

 @controller("/employee" , deserializeUser, requireUser)
//@controller("/employee")
export class UserController {
  constructor(@inject(TYPES.UserService) private userService: UserService,
  @inject(TYPES.OfficesService) private officeService: OfficesService,
  @inject(TYPES.BranchessService) private branchService: BranchessService,
  @inject(TYPES.NotificationService) private notificationService: NotificationService
) {}
async resolveLocation(id: string): Promise<{
  type: 'BRANCH' | 'OFFICE';
  entity: Branches | OfficesData;
}> {
  const branch = await this.branchService.getBranchByIdAndType(id);
  if (branch) {
    return { type: 'BRANCH', entity: branch };
  }

  const office = await this.officeService.getOfficeById(id);
  if (office) {
    return { type: 'OFFICE', entity: office };
  }

  throw new AppError(400, 'Invalid Branch/Office ID');
}

  @httpPost("/")
  public async createUser(
    @request() req: Request<{}, {}, any>,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Creating a new Employee");
      const result = req.body;
      console.log(req.body);
     // Handle joining location
if (result.joiningLocation) {
  try {
    const resolved = await this.resolveLocation(result.joiningLocation);
    if (resolved.type === 'BRANCH') {
      result.joiningLocation = resolved.entity.id;
      result.joiningOffice = null;
    } else {
      result.joiningOffice = resolved.entity.id;
      result.joiningLocation = null;
    }
  } catch (err) {
    logger.warn("Invalid joining location ID provided. Setting to null.");
    result.joiningLocation = null;
    result.joiningOffice = null;
  }
}

// Handle current work location
if (result.currentWorkLocation) {
  try {
    const resolved = await this.resolveLocation(result.currentWorkLocation);
    if (resolved.type === 'BRANCH') {
      result.currentWorkLocation = resolved.entity.id;
      result.currentOfficeLocation = null;
    } else {
      result.currentOfficeLocation = resolved.entity.id;
      result.currentWorkLocation = null;
    }
  } catch (err) {
    logger.warn("Invalid current work location ID provided. Setting to null.");
    result.currentWorkLocation = null;
    result.currentOfficeLocation = null;
  }
}

console.log("joining location",result.joiningLocation);
console.log("current location",result.currentWorkLocation);
console.log("current office",result.currentOfficeLocation);
console.log("joining office",result.joiningOffice)

      
      const user = await this.userService.createUser(result);
     // console.log(user);
      if (!user) {
        logger.error("Failed to create Employee");
        ControllerLogger.logError('Employee creation', new AppError(400, "Employee could not be created"), req, res);
        return next(new AppError(400, "Employee could not be created"));
      }
      // logger.info("Employee created successfully", { userId: user.id });
      ControllerLogger.logSuccess('Employee created', user.id, req, res);

      // Send notification for employee creation
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Employee created successfully: ${user.id}`,
          userId
        );
      }

      res.status(201).json({
        status: "success",
        message: "Employee created successfully",
        data: user,
      });
    } catch (err) {
      logger.error("Error in create Employee", { error: err });
      console.log(err);
      ControllerLogger.logError('Employee creation', err, req, res);
      next(err);
    }
  }

  @httpGet("/")
  public async getAllUsers(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      logger.info("Getting All Employee");
      const { page, limit, search, sort,firstName} = req.query;
    

      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,  
        limit: limit ? Number(limit) : undefined,
        searchFields: ['user.firstName'],
        filters: {},
        sort: sort as string || undefined, // Adjust this line to match your sorting requirements
        search: search as string|| '',
      };
      const users = await this.userService.getAllUsers(queryOptions);
      if (!users || users.length === 0) {
        logger.error("Employee Not Found");
        ControllerLogger.logError('Employee list retrieval', new AppError(404, "Employee Not Found"), req, res);
        return next(new AppError(404, "Employee Not Found"));
      }
      logger.info("Employee Getting successfully");
      ControllerLogger.logList('Employee', req, res);

      // Send notification for employee list access
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          'Employee records list accessed successfully',
          userId
        );
      }

      res.status(200).json({
        status: "success",
        data: users.data,
        allRecords: users.meta.total,
        totalPages: users.meta.pages,
        page: users.meta.page,
        
      });
    } catch (err) {
      logger.error("Error To Get Employee", { error: err });
      ControllerLogger.logError('Employee list retrieval', err, req, res);
      next(err);
    }
  }

  @httpGet("/:id")
  public async getUserById(
    @requestParam("id") id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const user = await this.userService.findUserById(id);

      if (!user) {
        ControllerLogger.logError('Employee view', new AppError(404, "User not found"), req, res);
        return next(new AppError(404, "User not found"));
      }

      ControllerLogger.logView('Employee', id, req, res);

      // Send notification for employee view
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Employee viewed: ${id}`,
          userId
        );
      }

      res.status(200).json({
        status: "success",
        data:user,
        
      });
    } catch (err) {
      ControllerLogger.logError('Employee view', err, req, res);
      next(err);
    }
  }


  @httpGet("/:id/view")
  public async getUserByIdForView(
    @requestParam("id") id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const user = await this.userService.findUserByIdForView(id);

      if (!user) {
        ControllerLogger.logError('Employee view', new AppError(404, "User not found"), req, res);
        return next(new AppError(404, "User not found"));
      }

      ControllerLogger.logView('Employee (for view)', id, req, res);
      res.status(200).json({
        status: "success",
        data:user,
        
      });
    } catch (err) {
      ControllerLogger.logError('Employee view', err, req, res);
      next(err);
    }
  }

  @httpGet("/:id/update")
  public async getUserByIdForUpdate(
    @requestParam("id") id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const user = await this.userService.findUserByIdForUpdate(id);

      if (!user) {
        ControllerLogger.logError('Employee retrieval for update', new AppError(404, "User not found"), req, res);
        return next(new AppError(404, "User not found"));
      }

      ControllerLogger.logView('Employee (for update)', id, req, res);
      res.status(200).json({
        status: "success",
        data:user,
        
      });
    } catch (err) {
      ControllerLogger.logError('Employee retrieval for update', err, req, res);
      next(err);
    }
  }

  // @httpPatch("/:id")
  // public async updateUser(
  //   @requestParam("id") id: string,
  //   @request() req: Request,
  //   @response() res: Response,
  //   @next() next: NextFunction
  // ) {
  //   try {
  //     // console.log("handler id is ", id);
  //    console.log("handler body is ", req.body);
  //  if(Object.keys(req.body).length === 0)
  //  {
  //   return next(new AppError(400, "User Data is Empty"));
  //  }
  
  //     const updateBy=res.locals.user.id;

  //       const joiningLocationId = req.body.joiningLocation;
  //   const currentLocationId = req.body.currentWorkLocation;

  //   // Handle joining location
  //   if (joiningLocationId !== undefined) {
  //     try {
  //       const resolved = await this.resolveLocation(joiningLocationId);
  //       if (resolved.type === 'BRANCH') {
  //         req.body.joiningLocation = resolved.entity.id;
  //         req.body.joiningOffice = null;
  //       } else {
  //         req.body.joiningOffice = resolved.entity.id;
  //         req.body.joiningLocation = null;
  //       }
  //     } catch (err) {
  //       logger.warn("Invalid joining location ID during update. Setting both to null.");
  //       req.body.joiningLocation = null;
  //       req.body.joiningOffice = null;
  //     }
  //   }

  //   // Handle current work location
  //   if (currentLocationId !== undefined) {
  //     try {
  //       const resolved = await this.resolveLocation(currentLocationId);
  //       if (resolved.type === 'BRANCH') {
  //         req.body.currentWorkLocation = resolved.entity.id;
  //         req.body.currentOfficeLocation = null;
  //       } else {
  //         req.body.currentOfficeLocation = resolved.entity.id;
  //         req.body.currentWorkLocation = null;
  //       }
  //     } catch (err) {
  //       logger.warn("Invalid current work location ID during update. Setting both to null.");
  //       req.body.currentWorkLocation = null;
  //       req.body.currentOfficeLocation = null;
  //     }
  //   }
  //     console.log("joining location",req.body.joiningLocation); 
  //     console.log("current location",req.body.currentWorkLocation);
  //     console.log("current office",req.body.currentOfficeLocation);
  //     console.log("joining office",req.body.joiningOffice)
  //     const updatedUser = await this.userService.updateUser(id, req.body,updateBy);
        

  //     if (!updatedUser) {
  //       return next(
  //         new AppError(404, "User not found or could not be updated")
  //       );
  //     }

  //     res.status(200).json({
  //       status: "success",
  //       message: "User updated successfully",
  //       //user: updatedUser,
  //     });
  //   } catch (err) {
  //     next(err);
  //   }
  // }

  @httpPut("/:id")
public async updateUser(
  @requestParam("id") id: string,
  @request() req: Request,
  @response() res: Response,
  @next() next: NextFunction
) {
  try {
    console.log("handler body is ", req.body);

    if (Object.keys(req.body).length === 0) {
      ControllerLogger.logError('Employee update', new AppError(400, "User Data is Empty"), req, res);
      return next(new AppError(400, "User Data is Empty"));
    }

    const updateBy = res.locals.user.id;

    const joiningLocationId = req.body.joiningLocation;
    const currentLocationId = req.body.currentWorkLocation;

    // Handle joining location
    if (joiningLocationId !== undefined) {
      try {
        const resolved = await this.resolveLocation(joiningLocationId);
        if (resolved.type === "BRANCH") {
          req.body.joiningLocation = resolved.entity.id;
          req.body.joiningOffice = null;
        } else {
          req.body.joiningOffice = resolved.entity.id;
          req.body.joiningLocation = null;
        }
      } catch (err) {
        logger.warn("Invalid joining location ID during update. Setting both to null.");
        req.body.joiningLocation = null;
        req.body.joiningOffice = null;
      }
    }

    // Handle current work location
    if (currentLocationId !== undefined) {
      try {
        const resolved = await this.resolveLocation(currentLocationId);
        if (resolved.type === "BRANCH") {
          req.body.currentWorkLocation = resolved.entity.id;
          req.body.currentOfficeLocation = null;
        } else {
          req.body.currentOfficeLocation = resolved.entity.id;
          req.body.currentWorkLocation = null;
        }
      } catch (err) {
        logger.warn("Invalid current work location ID during update. Setting both to null.");
        req.body.currentWorkLocation = null;
        req.body.currentOfficeLocation = null;
      }
    }

    const updatedUser = await this.userService.updateUser(id, req.body, updateBy);

    if (!updatedUser) {
      ControllerLogger.logError('Employee update', new AppError(404, "User not found or could not be updated"), req, res);
      return next(new AppError(404, "User not found or could not be updated"));
    }

    ControllerLogger.logSuccess('Employee updated', id, req, res);

    // Send notification for employee update
    const userId = res.locals.user?.id;
    if (userId) {
      await this.notificationService.createNoti(
        `Employee updated successfully: ${id}`,
        userId
      );
    }

    res.status(200).json({
      status: "success",
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    ControllerLogger.logError('Employee update', err, req, res);
    next(err);
  }
}


  @httpDelete("/:id")
  public async deleteUser(
    @requestParam("id") id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      if (!id) {
        logger.warn("User ID not provided");
        ControllerLogger.logError('Employee deletion', new AppError(400, "User ID is required"), req, res);
        return next(new AppError(400, "User ID is required"));
      }
      const result = await this.userService.deleteUser(id);

      if (!result) {
        ControllerLogger.logError('Employee deletion', new AppError(404, "User not found or could not be deleted"), req, res);
        return next(
          new AppError(404, "User not found or could not be deleted")
        );
      }

      ControllerLogger.logSuccess('Employee deleted', id, req, res);

      // Send notification for employee deletion
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Employee deleted successfully: ${id}`,
          userId
        );
      }

      res.status(200).json({
        status: "success",
        message: "Employee has been deleted",
      });
    } catch (err) {
      ControllerLogger.logError('Employee deletion', err, req, res);
      next(err);
    }
  }
@httpPatch("/status/:id")
  public async updateEmployeeStatus  (
    @request() req: Request, 
    @response() res: Response,
  @next() next: NextFunction) {
  try {
    const { id } = req.params;
   

     const status = req.query.status as string;
     console.log("status",status,id)
     const allowedStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
     if (!allowedStatuses.includes(status as any)) {
       ControllerLogger.logError('Employee status update', new Error('Invalid status value'), req, res);
       return res.status(400).json({ message: 'Invalid status value' });
     }
     const updatedUser = await this.userService.updateStatus(id, status as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED');

    ControllerLogger.logSuccess('Employee status updated', id, req, res);

    // Send notification for employee status update
    const userId = res.locals.user?.id;
    if (userId) {
      await this.notificationService.createNoti(
        `Employee status updated to ${status}: ${id}`,
        userId
      );
    }

    return res.status(200).json({ message: 'Status updated', user: updatedUser });
  } 
  catch (err:any) 
  {
    ControllerLogger.logError('Employee status update', err, req, res);
    next(err);
  }
};
@httpGet("/all/partial")
public async partialAllUser(
  @request() req :Request,
  @response() res:Response,
  @next() next: NextFunction,
){
  try{
     const { page, limit, search, sort, id} = req.query;
    
    // If id is provided, return workflow hierarchy
    if (id) {
      const workflowHierarchy = await this.userService.getWorkflowHierarchy(id as string);
      
      if(!workflowHierarchy || workflowHierarchy.length === 0){
        logger.error("Workflow hierarchy not found for the given employee");
        ControllerLogger.logError('Workflow hierarchy retrieval', new AppError(404, "Workflow hierarchy not found"), req, res);
        return next(new AppError(404, "Workflow hierarchy not found"));
      }
      
      logger.info("Workflow hierarchy retrieved successfully");
      ControllerLogger.logView('Workflow hierarchy', id as string, req, res);
      
      return res.status(200).json({
        status: "success",
        data: workflowHierarchy,
      });
    }

    // If no id, return all employees (existing behavior)
    const queryOptions: PaginationOptions = {
      page: page ? Number(page) : undefined,  
      limit: limit ? Number(limit) : undefined,
      searchFields: ['user.firstName'],
      filters: {},
      sort: sort as string || undefined,
      search: search as string|| '',
    };
    
    const users = await this.userService.filterUser(queryOptions);
    if(!users || users.length === 0){
      logger.error("Employee Not Found");
      ControllerLogger.logError('Employee partial list retrieval', new AppError(404, "Employee Not Found"), req, res);
      return next(new AppError(404, "Employee Not Found"));
    }
    logger.info("Employee Getting successfully");
    ControllerLogger.logList('Employee (partial)', req, res);
    res.status(200).json({
      status: "success",
      data: users.data,
      allRecords: users.meta.total,
      totalPages: users.meta.pages,
      page: users.meta.page,
    })

  }
  catch(err){
    ControllerLogger.logError('Employee partial list retrieval', err, req, res);
    next(err);
  }
}

@httpPost("/user/upload", upload.single('file'))
public async upload(req: Request, res: Response) {
    try {
      if (!req.file) {
        ControllerLogger.logError('Employee upload', new Error("No file uploaded"), req, res);
        return res.status(400).json({ message: "No file uploaded." });
      }
      const rawData:any = parseExcel(req.file.path);
      console.log("Parsed Data:", rawData);
      
       const user = [];
    for (const row of rawData) {
      const mappedRow = {
        firstName: row["First Name"],
        lastName: row["Last Name"],
        username: row["Username"],
        primaryMobNo: row["Primary MobiLe Number"],
        primaryEmail: row["Primary Email"],
        residentialAddress: {
          address1: row["Residential Address"],
          location: row["Location"],
          city: row["City"],
          state: row["State"],
          pincode: row["Pincode"]
        },
        permanentAddress: {
          address1: row["Permanent Adress"],
          location: row["Location.1"],
          city: row["City.1"],
          state: row["State.1"],
          pincode: row["Pincode.1"]
        },
        department: row["Department"],
        companyName: {
          name: row["Company Name"],
          officeAddress: row["Office Address"]
        },
        joiningDate: row["Joining Date"],
        workEmail: row["Work Email"],
        joiningLocation: {
          name: row["Joining Location"]
        },
        currentWorkLocation: {
          name: row["Current Work Location"]
        },
        accessLocation: row["Access Location"],
        permissions: {
          documentDefinition: {
            name: row["Document Name"],
            documentType: row["Document Type"]
          },
          canCreate: row["Can Create"] === "true",
          canView: row["Can View"] === "true",
          canEdit: row["Can Edit"] === "true",
          canDelete: row["Can Delete"] === "true",
          canDownload: row["Can Dwonload"] === "true"
        }
      };
      user.push(mappedRow);
    }

      const users = await this.userService.createUsersWithRelations(user);
      ControllerLogger.logSuccess('Employee bulk upload', `${users.length} users`, req, res);

      // Send notification for employee bulk upload
      const userId = res.locals.user?.id;
      if (userId) {
        await this.notificationService.createNoti(
          `Employee bulk upload completed successfully: ${users.length} users`,
          userId
        );
      }

      return res.status(200).json({ message: "Users uploaded successfully", users });
    } catch (error) {
      console.error(error);
      ControllerLogger.logError('Employee upload', error, req, res);
      return res.status(500).json({ message: "Internal server error" });
    }
  };
}
