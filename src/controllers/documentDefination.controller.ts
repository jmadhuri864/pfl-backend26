import { controller, httpGet, httpPatch, httpPost, next, response } from "inversify-express-utils";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import { TYPES } from "../types";
import { DocumentDefinitionService } from "../services/documentDefinition.service";
import { inject } from "inversify";
import { NextFunction,Response } from "express";
import logger from "../utils/logger";
import AppError from "../utils/appError";


@controller('/document-details',deserializeUser,requireUser)
export class  DocumentDefinitionController {

    constructor(
        @inject(TYPES.DocumentDefinitionService) private documentDefinitionService: DocumentDefinitionService,
    ){

    }

    @httpGet('/')
    public async getAllDocumentDef(
        @response() res: Response,
        @next() next: NextFunction
      ) {
        try {
          logger.info("Fetching all documents");
          const document = await this.documentDefinitionService.getAllDocumentDefinitions();
          if (!document) {
            logger.warn("No document found");
            return next(new AppError(404, "No documents found"));
          }
          logger.info("DocumentDef retrieved successfully");
          res.status(200).json({
            status: "success",
            data: document,
          });
        } catch (err) {
          logger.error("Error occurred while fetching all documentdef", { error: err });
          next(err);
        }
      }
    
    @httpGet('/:id')
    public async getDocumentDefById(
        @response() res: Response,
        @next() next: NextFunction,
        id: string
      ) {
        try {
          logger.info("Fetching document by id");
          const document = await this.documentDefinitionService.getDocumentDefinitionById(id);
          if (!document) {
            logger.warn("No document found with this id");
            return next(new AppError(404, "No documents found with this id"));
          }
          logger.info("DocumentDef retrieved successfully");
          res.status(200).json({
            status: "success",
            data: document,
          });
        } catch (err) {
          logger.error("Error occurred while fetching documentdef by id", { error: err });
          next(err);
        }
      }

      @httpPost('/')
      public async createDocumentDef(
        @response() res: Response,
        @next() next: NextFunction,
        data: any
      ) {
        try {
          console.log(data, "in controller");
          
          logger.info("Creating new documentDef");
          const document = await this.documentDefinitionService.createDocumentDefinition(data);
          if (!document) {
            logger.warn("Failed to create documentDef");
            return next(new AppError(400, "Failed to create documentDef"));
          }
          logger.info("DocumentDef created successfully");
          res.status(201).json({
            status: "success",
            data: document,
          });
        } catch (err) {
          logger.error("Error occurred while creating documentdef", { error: err });
          next(err);
        }
      }

      @httpPatch('/:id')
      public async updateDocumentDef(
        @response() res: Response,
        @next() next: NextFunction,
        id: string,
        data: any
      ) {
        try {
          logger.info("Updating documentDef");
          const document = await this.documentDefinitionService.updateDocumentDefinition(id, data);
          if (!document) {
            logger.warn("No document found with this id");
            return next(new AppError(404, "No documents found with this id"));
          }
          logger.info("DocumentDef updated successfully");
          res.status(200).json({
            status: "success",
            data: document,
          });
        } catch (err) {
          logger.error("Error occurred while updating documentdef", { error: err });
          next(err);
        }
      }
}