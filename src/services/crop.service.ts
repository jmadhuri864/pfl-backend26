import { inject, injectable } from "inversify";
import { Crop } from "../entities/crop.entity";
import { CropRepository } from "../repositories/crop.repository";
import { TYPES } from "../types";
import { AuditLogService } from "./auditLog.service";
import AppError from "../utils/appError";


@injectable()
export class CropService {
 

  constructor(
     @inject(TYPES.CropRepository)private readonly cropRepository: CropRepository,
     @inject(TYPES.AuditLogService)private readonly auditLogService: AuditLogService,
    )
    {}

  public async getAllCrops(): Promise<Crop[]> {
    return this.cropRepository.find({ relations: ["farmer"] ,
      order: {
        createdAt: 'DESC', 
      },
    });
  }

  public async getCropById(id: string): Promise<Crop | null> {
    return this.cropRepository.findOne({
      where: { id },
      relations: ["farmer"],
    });
  }

  public async createCrop(cropData: Partial<Crop>): Promise<Crop> {
    const crop = this.cropRepository.create(cropData);
    return this.cropRepository.save(crop);
  }

  public async updateCrop(
    id: string,
    cropData: Partial<Crop>,
    updatedBy: string
  ): Promise<Crop | null> {
    // Find the existing crop by ID
    const crop = await this.cropRepository.findOne({ where: { id } });
  
    if (!crop) return null;
  
    // Store the original crop data for audit logging
    const originalCrop = { ...crop };
  
    // Apply updates to the crop
    Object.assign(crop, cropData);
  
    // Save the updated crop
    const updatedCrop = await this.cropRepository.save(crop);
  
    // Log the changes made to the crop
    await this.auditLogService.logChange(
      'Crop',            // Entity name
      id,                // Entity ID
      originalCrop,      // Original data
      updatedCrop,       // Updated data
      updatedBy          // User who made the update
    );
  
    return updatedCrop;
  }
  

  public async deleteCrop(id: string): Promise<boolean> {
    const crop = await this.cropRepository.findOne({ where: { id } });
  
    if (!crop) {
      throw new AppError(404, `Crop with ID ${id} not found`);
    }
  
    const now = new Date();
  
    // Calculate the date 6 months ahead
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)
  
   // console.log(sixMonthsFromNow); // Log the calculated date
  
    // Set the deletionScheduledAt field for the crop
    crop.deletionScheduledAt = sixMonthsFromNow;
  
    //console.log("In delete service for Crop", crop.deletionScheduledAt);
  
    // Save the updated crop with the scheduled deletion date
    await this.cropRepository.save(crop);
  
    //console.log(`Crop with ID ${id} marked for deletion in 6 months.`);
  
    return true;
  }
  
}