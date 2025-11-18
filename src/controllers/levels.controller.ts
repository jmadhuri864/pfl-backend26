import { controller, httpDelete, httpGet, httpPatch, httpPost, next, request, requestParam, response } from "inversify-express-utils";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import { inject } from "inversify";
import { TYPES } from "../types";
import { LevelsService } from "../services/levels.service";
import { NextFunction ,Request,Response} from "express";
import logger from "../utils/logger";
import AppError from "../utils/appError";

@controller('/levels',deserializeUser,requireUser)
export class  LevelsController {
    constructor(
        @inject(TYPES.LevelsService) 
        private levelsService: LevelsService
      ) {}
    
      @httpPost("/")
      public async createLevel(
        @request() req: Request<{}, {}, any>, 
        @response() res: Response, 
        @next() next: NextFunction
      ) {
        try {
          logger.info("Attempting to create a new level", { requestedBy: res.locals.user.id });
          const levelData = req.body;
          console.log("levelData",levelData)
          const level = await this.levelsService.createLevel(levelData);
          console.log("after saved data",level)
          // if (!level) {
          //   logger.error("Failed to create level", { levelData });
          //   return next(new AppError(400, "Level could not be created"));
          // }
    
          logger.info("Level created successfully", { levelId: level.id });
          res.status(201).json({
            status: "success",
            message: "Level created successfully",
            data: level,
          });
        } catch (err) {
          console.log(err)
          logger.error("Error occurred while creating level", { error: err });
          next(err);
        }
      }
    
      @httpPatch("/:id")
      public async updateLevel(
        @requestParam("id") id: string,
        @request() req: Request<{}, {}, any>, 
        @response() res: Response, 
        @next() next: NextFunction
      ) {
        try {
          const updatedBy= res.locals.id
          logger.info("Attempting to update level", { levelId: id });
          const level = await this.levelsService.updateLevel(id, req.body,updatedBy);
    
          if (!level) {
            logger.warn("Level not found or could not be updated", { levelId: id });
            return next(new AppError(404, "Level not found or could not be updated"));
          }
    
          logger.info("Level updated successfully", { levelId: id });
          res.status(200).json({
            status: "success",
            message: "Level updated successfully",
            data: level,
          });
        } catch (err) {
          logger.error("Error occurred while updating level", { levelId: id, error: err });
          next(err);
        }
      }
    
      @httpDelete("/:id")
      public async deleteLevel(
        @requestParam("id") id: string,
        @response() res: Response, 
        @next() next: NextFunction
      ) {
        try {
         const levels= await this.levelsService.deleteLevel(id);
           if (!levels) {
                   return next(new AppError(404, "Level not found or could not be deleted"));
                 }
                 res.status(200).json({ 
                  status: "success", 
                  message: "Level deleted successfully" });
          //res.status(204).send();
        } catch (err) {
          logger.error("Error occurred while deleting level", { levelId: id, error: err });
          next(err);
        }
      }
    
      @httpGet("/:id")
      public async getLevelById(
        @requestParam("id") id: string, 
        @response() res: Response, 
        @next() next: NextFunction
      ) {
        try {
          logger.info("Fetching level details by ID", { levelId: id });
          const level = await this.levelsService.getLevelById(id);
    
          if (!level) {
            logger.warn("Level not found", { levelId: id });
            return next(new AppError(404, "Level not found"));
          }
    
          res.status(200).json({
            status: "success",
            data: level,
          });
        } catch (err) {
          logger.error("Error occurred while fetching level", { levelId: id, error: err });
          next(err);
        }
      }
    
      @httpGet("/")
      public async getAllLevels(
        @response() res: Response, 
        @next() next: NextFunction
      ) {
        try {
          logger.info("Fetching all levels");
          const levels = await this.levelsService.getAllLevels();
    
          if (!levels || levels.length === 0) {
            logger.error("No levels found");
            return next(new AppError(404, "No levels found"));
          }
    
          res.status(200).json({
            status: "success",
            data: levels,
          });
        } catch (err) {
          logger.error("Error occurred while fetching all levels", { error: err });
          next(err);
        }
      }

}