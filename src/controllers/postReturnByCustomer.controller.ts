import { inject } from "inversify";
import { controller, httpGet, next, response,request, requestParam, httpPost, requestBody, httpPatch } from "inversify-express-utils";
import { TYPES } from "../types";
import { PostReturnByCustomerService } from "../services/postReturnByCustomer.service";
import { NextFunction,Request,Response } from "express";
import AppError from "../utils/appError";
import { captureUser, deserializeUser, requireUser } from "../middleware/deserializeUser";
import logger from "../utils/logger";
import { PaginationOptions } from "../utils/pagination";


@controller("/returns",deserializeUser,requireUser)
export class PostReturnByCustomerController {
  constructor(
    @inject(TYPES.PostReturnByCustomerService)
    private postReturnByCustomerService: PostReturnByCustomerService
  ) {}

  @httpGet("/")
  public async getAllPostReturns(
    @request() req:Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      console.log("Fetching all post returns");
      const { page, limit, search, sort,id} = req.query;
          
      
      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,  
        limit: limit ? Number(limit) : undefined,
        searchFields: ["postreturn.id"],
        filters: {},
        sort: sort as string || undefined, // Adjust this line to match your sorting requirements
        search: search as string|| '',
      };

      const userId = res.locals.user.id;
console.log("User ID:", userId);
      const postReturns = await this.postReturnByCustomerService.getAllPostReturnByCustomer(queryOptions, userId);
      // if(!postReturns || postReturns.data.length === 0) {
      //   return next(new AppError(404, "No post returns found"));
      // }
      res.status(200).json({
        status: "success",
        data: postReturns.data,
        allRecords: postReturns.meta.total,
        totalPages: postReturns.meta.pages,
        page:postReturns.meta.page,
        
      });
    } catch (error) {
      next(error);
    }
  }

  @httpGet("/:id")
  public async getPostReturnById(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const postReturn = await this.postReturnByCustomerService.getByIdPostReturnByCustomer(id);
      if (!postReturn) {
        return next(new AppError(404, "Post return not found"));
      }
      res.status(200).json({
        status: "success",
        data: postReturn,
      });
    } catch (error) {
      next(error);
    }
  }

  @httpGet("/view/:docid")
  public async getPostReturnByIdforview(
    @requestParam("docid") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const postReturn = await this.postReturnByCustomerService.getByIdPostReturnByCustomerforView(id);
      if (!postReturn) {
        return next(new AppError(404, "Post return not found"));
      }
      res.status(200).json({
        status: "success",
        data: postReturn,
      });
    } catch (error) {
      next(error);
    }
  }



  @httpGet("/update/:id")
  public async getPostReturnByIdforupdate(
    @requestParam("id") id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const postReturn = await this.postReturnByCustomerService.getByIdPostReturnByCustomerforupdate(id);
      if (!postReturn) {
        return next(new AppError(404, "Post return not found"));
      }
      res.status(200).json({
        status: "success",
        data: postReturn,
      });
    } catch (error) {
      next(error);
    }
  }



  @httpPost("/")
  public async createPostReturn(
    @requestBody() postReturnData: any,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      console.log(postReturnData)

      const requestedBy = res.locals.user.id;

      const newPostReturn = await this.postReturnByCustomerService.createReturn(postReturnData, requestedBy);
      console.log("data is saved successfully") 
      res.status(201).json({
        status: "success",
        data: newPostReturn.id,
        message: "Post return created successfully",
      });
    } catch (error) {
      console.log(error)
      next(error);
    }
  }

  @httpPatch("/:id" ,captureUser)
    public async update(
      @requestParam("id") id: string,
      @requestBody() data: any,
      @request()req:Request,
      @response() res: Response,
      @next() next: NextFunction
    ) {
      try {
      
        
        
        console.log(data)
       
      
        logger.info(`Updating postreturn with ID`);
        const updatedBy = res.locals.updatedBy;
        const postreturn = await this.postReturnByCustomerService.updatePostReturnByCustomer(id, data,updatedBy);
        if (!postreturn) {
          logger.warn(`postreturn with ID not found or update failed`);
          return next(new AppError(404, "postreturn not found or update failed"));
        }
        res.status(200).json({
          status: "success",
          message: "postreturn updated successfully",
          
        });
      } catch (err) {
        logger.error(`Error updating postreturn with ID: ${id}`, { error: err });
        console.log(err)
        next(err);
      }
    }
}
