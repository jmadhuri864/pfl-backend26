import { inject } from "inversify";
import { controller, httpDelete, httpGet, httpPatch, httpPost, httpPut, next, requestBody, requestParam, response } from "inversify-express-utils";
import { TYPES } from "../types";
import { ProductSpecificationCustService } from "../services/productSpecification.service";
import { NextFunction ,Response,Request} from "express";
import AppError from "../utils/appError";
import logger from "../utils/logger";

@controller("/productSpecification")
export class ProductSpecificationCustController {
    constructor(
        @inject(TYPES.ProductSpecificationCustService)
        private readonly productSpecService: ProductSpecificationCustService
      ) {}
    
      @httpPost('/')
      public async create(
        @requestBody() body: any,
        @response() res: Response,
        @next() next: NextFunction
      ) {
        try {
          const productSpec = await this.productSpecService.create(body);
          res.status(201).json({
            status: 'success',
            message: 'Product specification created successfully',
            data: productSpec,
          });
        } catch (error) {
          next(error)
        }
      }
    
      @httpGet('/')
      public async getAll(
        @response() res: Response,
        @next() next: NextFunction
      ) {
        try {
          const productSpecs = await this.productSpecService.getAll();
          if (productSpecs.length === 0) {
            return next(new AppError(404,"No product specifications found"));
          }
          res.status(200).json({
            status: 'success',
            data: productSpecs,
          });
        } catch (error) {
          next(error);
        }
      }
    
      @httpGet('/:id')
      public async getById(
        @requestParam('id') id: string,
        @response() res: Response,
        @next() next: NextFunction
      ) {
        try {
          const productSpec = await this.productSpecService.getById(id);
          if (productSpec) {
            res.status(200).json({
              status: 'success',
              data: productSpec,
            });
          } else {
            next(new AppError( 404,'Product specification not found',));
          }
        } catch (error) {
          next(error);
        }
      }
    
      @httpPatch('/:id')
      public async update(
        @requestParam('id') id: string,
        @requestBody() body: any,
        @response() res: Response,
        @next() next: NextFunction
      ) {
        try {
          const updatedBy= res.locals.id
          const updatedSpec = await this.productSpecService.update(id, body,updatedBy);
          if (updatedSpec) {
            res.status(200).json({
              status: 'success',
              message: 'Product specification updated successfully',
              data: updatedSpec,
            });
          } else {
            next(new AppError( 404,'Product specification not found'));
          }
        } catch (error) {
          next(new AppError( 500,'Failed to update product specification'));
        }
      }
    
      @httpDelete('/:id')
      public async delete(
        @requestParam('id') id: string,
        @response() res: Response,
        @next() next: NextFunction
      ) {
        try {
          const success=await this.productSpecService.delete(id);
          if (!success) {
            logger.warn(`Product Specification with ID: ${id} not found for deletion`);
            return res.status(404).json({ status: "fail", message: "Product Specification not found" });
          }
          logger.info(`Product Specification with ID: ${id} deleted successfully`);
          res.status(200).json({ 
            status: "success",
             message: "Product Specification deleted successfully" });
          res.status(204).send();
        } catch (error) {
          next(new AppError( 500,'Failed to delete product specification'));
        }
      }
    }