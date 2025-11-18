import { controller, httpGet, next, queryParam, request, requestParam, response } from "inversify-express-utils";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import { inject } from "inversify";
import { TYPES } from "../types";
import { InventoryStockService } from "../services/inventoryStock.service";
import { NextFunction,Request,Response } from "express";
import logger from "../utils/logger";
import { PaginationOptions } from "../utils/pagination";
import AppError from "../utils/appError";




@controller("/inventoryStock", deserializeUser, requireUser)
export class InventoryStockController {

    constructor(
        @inject(TYPES.InventoryStockService)
        private readonly inventoryStockService: InventoryStockService,
      ) {}

      @httpGet("/")
      public async getAllInventoryStocks(
        @request() req: Request,
        @response() res: Response,
        @next() next: NextFunction
      ) {
        try {
          logger.info("Fetching all Inventory Stock...");
    
          const { page, limit, search, sort } = req.query;
    
          const queryOptions: PaginationOptions = {
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            //searchFields: ["product.name", "location.name", "varients.name"],
            filters: {},
            sort: sort as string || undefined,
            search: search as string || "",
          };
    
          const stocks = await this.inventoryStockService.getAllInventoryStocks(queryOptions);
    
          if (!stocks) {
            logger.error("No Inventory Stock found.");
            return next(new AppError(404, "No Inventory Stock found"));
          }
    
          logger.info(`Total inventory stock items fetched: ${stocks.data.length}`);
          res.status(200).json({
            status: "success",
            data: stocks.data,
            allRecords: stocks.meta.total,
            totalPages: stocks.meta.pages,
            page: stocks.meta.page,
          });
        } catch (error) {
          logger.error("Error fetching Inventory Stock list:", error);
          next(error);
        }
      }
    
      @httpGet("/:id")
      public async getInventoryStockById(
        @requestParam("id") id: string,
        @response() res: Response,
        @next() next: NextFunction
      ) {
        try {
          logger.info(`Fetching Inventory Stock with ID: ${id}`);
          const stock = await this.inventoryStockService.getInventoryStockById(id);
    
          if (!stock) {
            return next(new AppError(404, "Inventory Stock not found"));
          }
    
          logger.info(`Inventory Stock with ID ${id} fetched successfully`);
          res.status(200).json({
            status: "success",
            data: stock,
          });
        } catch (error) {
          logger.error("Error fetching Inventory Stock by ID:", error);
          next(error);
        }
      }

  
    @httpGet("/search")
    public async searchStock(
      @request() req: Request,
      @response() res: Response,
      @next() next: NextFunction
    ) {
      try {
        const { id, varientId, productId, locationId, companyId } = req.query;
    
        if (!id) {
          return next(new AppError(400, "Inventory Stock ID is required"));
        }
    
        logger.info(`Searching Inventory Stock with filters:`, {
          id,
          varientId,
          productId,
          locationId,
          companyId,
        });
    
        const stock = await this.inventoryStockService.searchStock(
          id ? String(id) : undefined,
          varientId ? String(varientId) : undefined,
          productId ? String(productId) : undefined,
          locationId ? String(locationId) : undefined,
          companyId ? String(companyId) : undefined
        );
     
        if (!stock) {
          return next(new AppError(404, "Inventory Stock not found with given filters"));
        }
    
        logger.info(`Inventory Stock found for ID: ${id}`);
        return res.status(200).json({
          status: "success",
          data: stock,
        });
    
      } catch (error) {
        logger.error("Error searching Inventory Stock:", error);
        next(error);
      }
    }
    @httpGet("/filter/all/stock")
    public async filterStock(
      @request() req: Request,
      @response() res: Response,
      @next() next: NextFunction
    ) {
      try {
        console.log(req.query.companyName);
       
   
       
     
        const stock = await this.inventoryStockService.filterStock(
          req.query

          )
     
        if (!stock) {
          return next(new AppError(404, "Inventory Stock not found with given filters"));
        }
    
      
        return res.status(200).json({
          status: "success",
          data: stock,
        });
    
      } catch (error) {
        console.log(error)
        logger.error("Error searching Inventory Stock:", error);
        next(error);
      }
    }
    @httpGet("/stock/location-wise")
    public async gettingStockForCompanyOrLocation(
      @request() req: Request,
      @response() res: Response,
      @next() next: NextFunction
    ) {
      try {
       logger.info(`Getting Stock Location wise`);
       
        const stock = await this.inventoryStockService.getGroupedInventoryStock()
     
        if (!stock) {
          return next(new AppError(404, "Inventory Stock not found with given filters"));
        }
    
        logger.info(`Inventory Stock found `);
        return res.status(200).json({
          status: "success",
          data: stock,
        });
    
      } catch (error) {
        logger.error("Error searching Inventory Stock:", error);
        next(error);
      }
    }

    @httpGet("/stock/accesslocation-wise")
    public async gettingStockaccessLocation(
      @request() req: Request,
      @response() res: Response,
      @next() next: NextFunction
    ) {
      try {
       logger.info(`Getting Stock Location wise`);
       const id = res.locals.id
       
        const stock = await this.inventoryStockService.getInventoryStockbyuserAccesslocation(id)
     
        if (!stock) {
          return next(new AppError(404, "Inventory Stock not found with given filters"));
        }
    console.log(stock)
        logger.info(`Inventory Stock found `);
        return res.status(200).json({
          status: "success",
          data: stock,
        });
    
      } catch (error) {
        logger.error("Error searching Inventory Stock:", error);
        next(error);
      }
    }

@httpGet("/stock/accesslocation")
public async gettingStocksaccessLocation(
  @request() req: Request,
  @response() res: Response,
  @next() next: NextFunction
) {
  try {
    const location = req.query.location as string | undefined;
    const id = res.locals.id;

    logger.info(`Getting Stock Access Location wise`);

    const stock = await this.inventoryStockService.getProductbyaccesslocation(location, id);

    if (!stock.length) {
      return next(new AppError(404, "Inventory Stock not found with given filters"));
    }

    logger.info(`Inventory Stock found`);
    return res.status(200).json({
      status: "success",
      data: stock,
    });
  } catch (error) {
    logger.error("Error searching Inventory Stock:", error);
    next(error);
  }
}

        @httpGet("/stock/product-wise")
    public async gettingStockProductWise(
      @request() req: Request,
      @response() res: Response,
      @next() next: NextFunction
    ) {
      try {
        const {  locationName, companyName} = req.query;
       logger.info(`Getting Stock Location wise and Company wise`);
       
        const stock = await this.inventoryStockService.getProductGroupedInventoryStock( locationName ? String(locationName) : undefined,
        companyName ? String(companyName) : undefined)
     
        if (!stock) {
          return next(new AppError(404, "Inventory Stock not found with given filters"));
        }
    
        logger.info(`Inventory Stock found `);
        return res.status(200).json({
          status: "success",
          data: stock,
        });
    
      } catch (error) {
        logger.error("Error searching Inventory Stock:", error);
        next(error);
      }
    }

    @httpGet("/stock/varient-wise")
    public async gettingStockVarientWise(
      @request() req: Request,
      @response() res: Response,
      @next() next: NextFunction
    ) {
      try {
        const {  locationName, companyName,productName } = req.query;
       logger.info(`Getting Stock Location wise and Company wise`);
       
        const stock = await this.inventoryStockService.getVarientGroupedInventoryStock( 
          locationName ? String(locationName) : undefined,
        companyName ? String(companyName) : undefined,
        productName ? String(productName) : undefined,)
     
        if (!stock) {
          return next(new AppError(404, "Inventory Stock not found with given filters"));
        }
    
        logger.info(`Inventory Stock found `);
        return res.status(200).json({
          status: "success",
          data: stock,
        });
    
      } catch (error) {
        logger.error("Error searching Inventory Stock:", error);
        next(error);
      }
    }




     @httpGet("/stock/filter/report")
  public async getStockReport(
    @queryParam("companyName") companyName: string,
    @queryParam("locationId") locationId: string,
    @queryParam("startDate") startDate: string,
    @queryParam("endDate") endDate: string,
  @request() req: Request,
      @response() res: Response,
      @next() next: NextFunction
  ) {
    try {
      //console.log(companyName, locationId, startDate, endDate);
      const report = await this.inventoryStockService.getStockReport(
        companyName,
        locationId,
        startDate,
        endDate
      );
      return res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch stock report",
      });
    }
  }
    }