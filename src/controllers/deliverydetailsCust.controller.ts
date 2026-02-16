import { inject } from "inversify";
import { controller, httpDelete, httpGet, httpPatch, httpPost, next, request, requestParam, response } from "inversify-express-utils";
import { TYPES } from "../types";
import { DeliveryDetailsCustService } from "../services/DeliveryDetailsCust.service";

import { NextFunction ,Request,Response} from "express";
import AppError from "../utils/appError";
import { DeliveryDetails } from "../entities/deliveryDetailsCust.entity";
import path from "path";
import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import logger from "../utils/logger";
import { upload } from "../middleware/upload.middleware";


@controller('/delivery-details',deserializeUser, requireUser)
export class DeliveryDetailsCustController {
  constructor(
    @inject(TYPES.DeliveryDetailsCustService)
    private deliveryDetailsCustService: DeliveryDetailsCustService
  ) {}

  @httpPost('/', upload.fields([
    { name: 'deliveryAddressProofCopy', maxCount: 1 },
  ]))
  public async createDeliveryDetails(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const uploadedFiles = req.files as { [fieldname: string]: Express.Multer.File[] };

      // Extract file data from req.files
      const deliveryAddressProofFile = uploadedFiles['deliveryAddressProofCopy']?.[0];

      // Initialize delivery details data
      const deliveryDetailsData = req.body;
deliveryDetailsData.createdBy=res.locals.user.id;
      // Process address proof file if required
      if (deliveryAddressProofFile) {
        const ext = path.extname(deliveryAddressProofFile.originalname).toLowerCase();
        if (ext === '.pdf' || ext === '.jpeg' || ext === '.jpg' || ext === '.png') {
          deliveryDetailsData.deliveryAddressProofCopy = deliveryAddressProofFile.filename;
        } else {
          return next(new AppError(400, 'Invalid file type for address proof.'));
        }
      } else {
        return next(new AppError(400, 'Address proof copy is required.'));
      }

      // Create and save delivery details using the service
      const deliveryDetails = await this.deliveryDetailsCustService.create(deliveryDetailsData);

      res.status(201).json({
        status: 'success',
        message: 'Delivery details created successfully',
        data: deliveryDetails,
      });
    } catch (err: any) {
      next(err);
    }
  }

  @httpGet('/')
  public async getAllDeliveryDetails(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const deliveryDetails = await this.deliveryDetailsCustService.getAll();

      if (!deliveryDetails || deliveryDetails.length === 0) {
        return next(new AppError(404, 'No delivery details found'));
      }

      res.status(200).json({
        status: 'success',
        data: deliveryDetails,
      });
    } catch (err) {
      next(err);
    }
  }

  @httpGet('/:id')
  public async getDeliveryDetailsById(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const deliveryDetails = await this.deliveryDetailsCustService.getById(id);

      if (!deliveryDetails) {
        return next(new AppError(404, 'Delivery details not found'));
      }

      res.status(200).json({
        status: 'success',
        data: deliveryDetails,
      });
    } catch (err) {
      next(err);
    }
  }

  @httpPatch('/:id', upload.fields([
    { name: 'deliveryAddressProofCopy', maxCount: 1 },
  ]))
  public async updateDeliveryDetails(
    @requestParam('id') id: string,
    @request() req: Request<{}, {}, Partial<DeliveryDetails>>,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const deliveryDetailsData = req.body;
      const files = req.files as {
        deliveryAddressProofCopy?: Express.Multer.File[];
      };

      // Add the file paths (if available) to the delivery details data
      if (files?.deliveryAddressProofCopy) {
        deliveryDetailsData.deliveryAddressProofCopy = files.deliveryAddressProofCopy[0].filename;
      }

      const updatedDeliveryDetails = await this.deliveryDetailsCustService.update(id, deliveryDetailsData);

      if (!updatedDeliveryDetails) {
        return next(new AppError(404, 'Delivery details not found or could not be updated'));
      }

      res.status(200).json({
        status: 'success',
        message: 'Delivery details updated successfully',
        data: updatedDeliveryDetails,
      });
    } catch (err) {
      next(err);
    }
  }

//   @httpDelete('/:id')
//   public async deleteDeliveryDetails(
//     @requestParam('id') id: string,
//     @response() res: Response,
//     @next() next: NextFunction
//   ) {
//     try {
//       const result = await this.deliveryDetailsCustService.delete(id);

//       if (!result) {
//         return next(new AppError(404, 'Delivery details not found or could not be deleted'));
//       }

//       res.status(200).json({
//         status: 'success',
//         message: 'Delivery details deleted successfully',
//       });
//     } catch (err) {
//       next(err);
//     }
//   }
@httpDelete('/delete/multiple')
  public async deleteMultipleDCForCustomer(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction,
  ) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return next(new AppError(400, 'An array of Delivery Challan For Customer IDs is required'));
      }
      const result = await this.deliveryDetailsCustService.deleteMultipleDCForCustomer(ids);
      res.status(200).json({
        message: result.message,
        success: result.success,
        failed: result.failed,
      });
    }
      catch (error) {
      logger.error('Error deleting multiple Delivery Challan For Customer', { error });
      next(error);
    }
  }

}