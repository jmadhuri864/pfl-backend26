import { inject } from "inversify";
import { controller, httpDelete, httpGet, httpPatch, httpPost, request, requestParam, response, next } from "inversify-express-utils";
import { TYPES } from "../types";
import { StatutoryDetailsCustService } from "../services/statutoryDetails.service";
import { NextFunction, Request, Response } from "express";
import { upload } from "../middleware/multifileupload";

@controller('/statutory-details')
export class StatutoryDetailsCustController {
  constructor(
    @inject(TYPES.StatutoryDetailsCustService)
    private statutoryDetailsService: StatutoryDetailsCustService
  ) {}

  // Create statutory details with file uploads
  @httpPost('/', upload.fields([
    { name: 'aadharCopy', maxCount: 1 },
    { name: 'panCopy', maxCount: 1 },
    { name: 'regiCertificateCopy', maxCount: 1 },
    { name: 'incorpoCertificateCopy', maxCount: 1 },
    {name:'billBookCopy',maxCount:1}
  ]))
  public async createStatutoryDetails(
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const statutoryDetailsData = req.body;
 console.log(req.body);
 console.log(req.files)
      // Handling file uploads
      const files = req.files as {
        aadharCopy?: Express.Multer.File[];
        panCopy?: Express.Multer.File[];
        regiCertificateCopy?: Express.Multer.File[];
        incorpoCertificateCopy?: Express.Multer.File[];
        billBookCopy?:Express.Multer.File[];
      };

      if (files?.aadharCopy) {
        statutoryDetailsData.aadharCopy = files.aadharCopy[0].path;
      }

      if (files?.panCopy) {
        statutoryDetailsData.panCopy = files.panCopy[0].path;
      }

      if (files?.regiCertificateCopy) {
        statutoryDetailsData.regiCertificateCopy = files.regiCertificateCopy[0].path;
      }

      if (files?.incorpoCertificateCopy) {
        statutoryDetailsData.incorpoCertificateCopy = files.incorpoCertificateCopy[0].path;
      }
      if (files?.billBookCopy) {
        statutoryDetailsData.billBookCopy = files.billBookCopy[0].path;
      }

      const newStatutoryDetails = await this.statutoryDetailsService.create(statutoryDetailsData);

      res.status(201).json({
        status: 'success',
        data: newStatutoryDetails,
      });
    } catch (err) {
      next(err);
    }
  }

  // Update statutory details with file uploads
  @httpPatch('/:id', upload.fields([
    { name: 'aadharCopy', maxCount: 1 },
    { name: 'panCopy', maxCount: 1 },
    { name: 'regiCertificateCopy', maxCount: 1 },
    { name: 'incorpoCertificateCopy', maxCount: 1 },
    {name:'billBookCopy',maxCount:1}
  ]))
  public async updateStatutoryDetails(
    @requestParam('id') id: string,
    @request() req: Request,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const statutoryDetailsData = req.body;

      // Handling file uploads
      const files = req.files as {
        aadharCopy?: Express.Multer.File[];
        panCopy?: Express.Multer.File[];
        regiCertificateCopy?: Express.Multer.File[];
        incorpoCertificateCopy?: Express.Multer.File[];
        billBookCopy?:Express.Multer.File[];
      };

      if (files?.aadharCopy) {
        statutoryDetailsData.aadharCopy = files.aadharCopy[0].path;
      }

      if (files?.panCopy) {
        statutoryDetailsData.panCopy = files.panCopy[0].path;
      }

      if (files?.regiCertificateCopy) {
        statutoryDetailsData.regiCertificateCopy = files.regiCertificateCopy[0].path;
      }

      if (files?.incorpoCertificateCopy) {
        statutoryDetailsData.incorpoCertificateCopy = files.incorpoCertificateCopy[0].path;
      }
      if (files?.billBookCopy) {
        statutoryDetailsData.billBookCopy = files.billBookCopy[0].path;
      }
      const updatedStatutoryDetails = await this.statutoryDetailsService.update(id, statutoryDetailsData);

      res.status(200).json({
        status: 'success',
        message: 'Statutory details updated successfully',
        data: updatedStatutoryDetails,
      });
    } catch (err) {
      next(err);
    }
  }

  // Get all statutory details
  @httpGet('/')
  public async getAllStatutoryDetails(
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const statutoryDetails = await this.statutoryDetailsService.getAll();
      res.status(200).json({
        status: 'success',
        data: statutoryDetails,
      });
    } catch (err) {
      next(err);
    }
  }

  // Get statutory details by ID
  @httpGet('/:id')
  public async getStatutoryDetailsById(
    @requestParam('id') id: string,
    @response() res: Response,
    @next() next: NextFunction
  ) {
    try {
      const statutoryDetails = await this.statutoryDetailsService.getById(id);
      res.status(200).json({
        status: 'success',
        data: statutoryDetails,
      });
    } catch (err) {
      next(err);
    }
  }

//   // Delete statutory details
//   @httpDelete('/:id')
//   public async deleteStatutoryDetails(
//     @requestParam('id') id: string,
//     @response() res: Response,
//     @next() next: NextFunction
//   ) {
//     try {
//       await this.statutoryDetailsService.delete(id);
//       res.status(204).json({
//         status: 'success',
//         message: 'Statutory details deleted successfully',
//       });
//     } catch (err) {
//       next(err);
//     }
//   }
}
