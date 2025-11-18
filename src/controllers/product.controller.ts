import { inject } from 'inversify';
import {
  controller,
  httpGet,
  httpPost,
  httpPatch,
  httpDelete,
  requestBody,
  requestParam,
  response,
  next,
  request,
  httpPut,
} from 'inversify-express-utils';
import { TYPES } from '../types';
import { ProductService } from '../services/product.service';
import AppError from '../utils/appError';
import { NextFunction, Request, Response } from 'express';
import {
  captureUser,
  deserializeUser,
  requireUser,
} from '../middleware/deserializeUser';
import logger from '../utils/logger';
import { uploadFile } from '../middleware/uploadwithAWS';
import { uploads } from '../middleware/muterConfigCSV';
import { PaginationOptions } from '../utils/pagination';
import { PdfGeneratorService } from '../utils/pdfGenerator';
import { upload } from '../middleware/multerConfig';

 @controller('/products', deserializeUser, requireUser)
export class ProductController {
  constructor(
    @inject(TYPES.ProductService) private productService: ProductService,
    @inject(TYPES.PdfGeneratorService)
            private readonly pdfGeneratorService: PdfGeneratorService,

  ) {}

  @httpGet('/')
  public async getAll(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const { page, limit, search, sort } = req.query;

      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        //searchFields: ['product.name'],
        filters: {},
        sort: (sort as string) || undefined,
        search: (search as string) || '',
      };
      logger.info('Fetching all products');
      const products = await this.productService.getAll(queryOptions);
      logger.info(`Fetched ${products.length} products successfully`);
      res
        .status(200)
        .json({
          status: 'success',
          data: products.data,
          allRecords: products.meta.total,
          totalPages: products.meta.pages,
          page: products.meta.page,
        });
    } catch (err) {
      logger.error('Error fetching all products', { error: err });
      next(err);
    }
  }
  @httpGet('/partial/data')
  public async getAllPartial(
    @response() res: Response,
    @next() next: NextFunction,
    @request() req: Request,
  ) {
    try {
      logger.info('Fetching all products');
      const { page, limit, search, sort } = req.query;

      const queryOptions: PaginationOptions = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        // searchFields: ['product.name'],
        filters: {},
        sort: (sort as string) || undefined,
        search: (search as string) || '',
      };
      const products = await this.productService.getAllByFilter(queryOptions);
      logger.info(`Fetched ${products.length} products successfully`);
      res
        .status(200)
        .json({
          status: 'success',
          data: products.data,
          totalRecords: products.meta.total,
          totalPages: products.meta.pages,
          page: products.meta.page,
        });
    } catch (err) {
      logger.error('Error fetching all products', { error: err });
      next(err);
    }
  }
  @httpGet('/serachData/product')
  public async getAllBySearch(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Fetching all products');
      const search = req.query.search as string;
      const products = await this.productService.getAllwithSearch(search);
      logger.info(`Fetched ${products.length} products successfully`);
      res.status(200).json({ status: 'success', data: products });
    } catch (err) {
      logger.error('Error fetching all products', { error: err });
      next(err);
    }
  }
  @httpGet('/partial/:id')
  public async getPartialById(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Fetching all products');
      const products = await this.productService.getPartialByID(id);
      logger.info(`Fetched ${products.length} products successfully`);
      res.status(200).json({ status: 'success', data: products });
    } catch (err) {
      logger.error('Error fetching all products', { error: err });
      next(err);
    }
  }
  @httpGet('/productname/')
  async searchProductByName(req: Request, res: Response): Promise<any> {
    try {
      console.log('in serch controller');
      logger.info('searching  all products');
      const { search } = req.query; 
      console.log(search);
      if (!search || typeof search !== 'string') {
        return res
          .status(400)
          .json({ message: 'Search query is required and must be a string' });
      }

      const products = await this.productService.getByproductNameFilter(search);
      //console.log(products)
      return res.status(200).json({ success: true, data: products });
    } catch (error) {
      return res.status(500).json({ success: false, message: error });
    }
  }

  @httpGet('/getVarient/:id')
  async getVarientWithProductId(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ): Promise<any> {
    try {
      console.log('in serch controller');
      logger.info('searching  all products');
      const { id } = req.params;
      console.log(id);
      if (!id || typeof id !== 'string') {
        return res
          .status(400)
          .json({ message: 'Product ID is required and must be a string' });
      }

      const products = await this.productService.getVarientsByProductId(id);

      return res.status(200).json({ status: 'success', data: products });
    } catch (error) {
      logger.error('Error fetching product variants', { error });
      next(error);
    }
  }

  @httpGet('/:id')
  public async getById(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info(`Fetching product with ID`);
      const product = await this.productService.getById(id);
      if (!product) {
        logger.warn(`Product with ID not found`);
        return next(new AppError(404, 'Product not found'));
      }
      logger.info(`Product with ID fetched successfully`);
      res.status(200).json({ status: 'success', data: product });
    } catch (err) {
      logger.error(`Error fetching product with ID`, { error: err });
      next(err);
    }
  }

  @httpGet('/getall/getvarient/:id')
  public async getvarientByID(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info(`Fetching product with ID`);
      const product = await this.productService.getVarientByProductId(id);
      if (!product) {
        logger.warn(`Product with ID not found`);
        return next(new AppError(404, 'Product not found'));
      }
      logger.info(`Product with ID fetched successfully`);
      res.status(200).json({ status: 'success', data: product });
    } catch (err) {
      logger.error(`Error fetching product with ID`, { error: err });
      next(err);
    }
  }

  @httpPost('/', uploadFile.single('image'))
  public async create(
    @requestBody() productData: any,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info('Creating a new product');
      console.log('req   ', productData);

      if (req.file) {
        const imageUrl = (req.file as any).location;
        console.log('imageurl is ', imageUrl);
        if (imageUrl) {
          productData.image = imageUrl;
        }
      }

      const product = await this.productService.create(productData);
      console.log('successfully created');
      logger.info('Product created successfully');
      res.status(201).json({
        status: 'success',
        message: 'Product created successfully',
        data: product.id,
        image: product.image,
      });
    } catch (err) {
      logger.error('Error creating product', { error: err });
      console.log(err);
      next(err);
    }
  }

  // @httpPatch('/:id', uploadFile.single('image'), captureUser)
  // public async update(
  //   @requestParam('id') id: string,
  //   @requestBody() productData: any,
  //   @request() req: Request,
  //   @response() res: Response,
  //   @next() next: NextFunction,
  // ) {
  //   try {
  //     //console.log(productData);
  //     if (req.file) {
  //       const imageUrl = (req.file as any).location;
  //       productData.image = imageUrl;
  //     }
  //     const updatedData = {
  //       ...productData,
  //       //   qualityParameters: Array.isArray(productData.qualityParameters)
  //       // ? productData.qualityParameters
  //       // : JSON.parse(productData.qualityParameters), // Convert back to array
  //     };

  //     logger.info(`Updating product with ID`);
  //     const updatedBy = res.locals.updatedBy;
  //     const product = await this.productService.update(
  //       id,
  //       updatedData,
  //       updatedBy,
  //     );
  //     if (!product) {
  //       logger.warn(`Product with ID not found or update failed`);
  //       return next(new AppError(404, 'Product not found or update failed'));
  //     }
  //     res.status(200).json({
  //       status: 'success',
  //       message: 'Product updated successfully',
  //       data: product,
  //     });
  //   } catch (err) {
  //     logger.error(`Error updating product with ID: ${id}`, { error: err });
  //     console.log(err);
  //     next(err);
  //   }
  // }
  @httpPut('/:id', uploadFile.single('image'), captureUser)
  public async update(
    @requestParam('id') id: string,
    @requestBody() productData: any,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      //console.log(productData);
      if (req.file) {
        const imageUrl = (req.file as any).location;
        productData.image = imageUrl;
      }
      const updatedData = {
        ...productData,
        //   qualityParameters: Array.isArray(productData.qualityParameters)
        // ? productData.qualityParameters
        // : JSON.parse(productData.qualityParameters), // Convert back to array
      };

      logger.info(`Updating product with ID`);
      const updatedBy = res.locals.updatedBy;
      const product = await this.productService.update(
        id,
        updatedData,
        updatedBy,
      );
      if (!product) {
        logger.warn(`Product with ID not found or update failed`);
        return next(new AppError(404, 'Product not found or update failed'));
      }
      res.status(200).json({
        status: 'success',
        message: 'Product updated successfully',
        data: product,
      });
    } catch (err) {
      logger.error(`Error updating product with ID: ${id}`, { error: err });
      console.log(err);
      next(err);
    }
  }

  @httpPost("/upload-product", uploads.single('file'))
  public async uploadProductsExcel(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      console.log('in upload excel controller');
      let filepath: string = '';
      if (req.file) {
        
        filepath = req.file.path;
        console.log('File path is ', filepath);
      }
      //console.log(filepath)
      if (!filepath) {
        return next(new AppError(400, 'File path is required'));
      }
      const success = await this.productService.createProductWithExcel(filepath);
      res.status(200).json({
        message: 'Successfully uploaded product data from Excel',
      });
    } catch (err) {
      console.log(err);
      next(err);
    }
  }


  @httpDelete('/:id')
  public async delete(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      logger.info(`Deleting product with ID: ${id}`);
      const success = await this.productService.delete(id);
      if (!success) {
        logger.warn(`Product with ID: ${id} not found`);
        return next(new AppError(404, 'Product not found'));
      }
      logger.info(`Product with ID: ${id} deleted successfully`);
      res.status(200).json({
        status: 'success',
        message: 'Product deleted successfully',
      });
    } catch (err) {
      logger.error(`Error deleting product with ID: ${id}`, { error: err });
      next(err);
    }
  }
  // @httpPost("/uploadcsv",upload.single('file'))
  // public async postallproduct(
  //   @request() req: Request,
  //   @response() res: Response,
  //   @next() next: NextFunction
  // ){
  //   try{
  //     const file=req.file?.path
  //     if (!file) {
  //       return next(new AppError(400, "File path is required"));
  //     }
  //     const success = await this.productService.uploadProducts(file);
  //   }catch{

  //   }
  // }
  @httpPost('/uploadcsv', uploads.single('file'))
  public async uploadProducts(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      console.log('in upload csv controller');
      let filepath: string = '';
      if (req.file) {
        
        filepath = req.file.path;
        console.log('File path is ', filepath);
      }
      //console.log(filepath)
      if (!filepath) {
        return next(new AppError(400, 'File path is required'));
      }
      const success = await this.productService.uploadProducts(filepath);
      res.status(200).json({
        mesaaage: 'successfully product data uploaded',
      });
    } catch (err) {
      console.log(err);
      next(err);
    }
  }

  
 
}


function jsonStringify(data: any): string {
  try {
    return JSON.stringify(data);
  } catch (error) {
    logger.error('Error stringifying data', { error });
    throw new Error('Failed to stringify data');
  }

}