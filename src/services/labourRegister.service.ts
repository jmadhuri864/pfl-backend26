import { inject, injectable } from "inversify";
import { Repository } from "typeorm";
import { TYPES } from "../types";
import { LaborRegisterRepository } from "../repositories/labourRegister.repository";
import AppError from "../utils/appError";
import { LaborRegister } from "../entities/labourregister.entity";
import { AuditLogService } from "./auditLog.service";
import { buildQuery, PaginationOptions } from "../utils/pagination";


@injectable()
export class LaborRegisterService {
  constructor(
    @inject(TYPES.LaborRegisterRepository) // Assuming you have set up a repository binding for the Labor entity
    private laborRepository: LaborRegisterRepository,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService
  ) {}

  /**
   * Create a new labor record.
   * @param data - Labor details
   * @returns Created labor record
   */
  async createLabor(data: any): Promise<any> {
    const existingLabor = await this.laborRepository.findOne({
      where: {
        laborName: data.laborName,
        contactNo: data.contactNo,
      
      },
    });

    if (existingLabor) {
      throw new AppError(400, "Laborer with this name and contact already exists.");
    }

    const labor = this.laborRepository.create(data);
    return await this.laborRepository.save(labor);
  }

  /**
   * Find a laborer by name, contact, and location.
   * @param name - Labor name
   * @param contactNo - Contact number
   * @param location - Location
   * @returns Found labor record or null
   */
  async findLaborByNameAndContact(laborName: string, contactNo: string): Promise<LaborRegister | null> {
    return await this.laborRepository.findOne({
      where: { laborName, contactNo},
    });
  }

  /**
   * Update an existing labor record.
   * @param id - Labor ID
   * @param updateData - Data to update
   * @returns Updated labor record
   */
  async updateLabor(
    id: string,
    updateData: any,
    updatedBy: string
  ): Promise<LaborRegister> {
    // Fetch the existing labor record
    const labor = await this.laborRepository.findOne({ where: { id } });
  
    if (!labor) {
      throw new AppError(404, "Laborer not found.");
    }
  
    // Save the original data for audit logging
    const oldData = { ...labor };
  
    // Apply the updates to the existing labor record
    Object.assign(labor, updateData);
  
    // Save the updated labor record
    const updatedLabor = await this.laborRepository.save(labor);
  
    // Log the changes using AuditLogService
    await this.auditLogService.logChange(
      'LaborRegister',   // Entity name
      id,                // Entity ID
      oldData,           // Original data
      updatedLabor,      // Updated data
      updatedBy          // User performing the update
    );
  
    return updatedLabor;
  }
  

  /**
   * Delete a labor record by ID.
   * @param id - Labor ID
   * @returns Boolean indicating success or failure
   */
  async deleteLabor(id: string): Promise<boolean> {
    // Find the laborer by ID
    const labor = await this.laborRepository.findOne({ where: { id } });
  
    if (!labor) {
      throw new AppError(404, `Laborer with ID ${id} not found`);
    }
  
    // Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)
  
    // Log the scheduled deletion
    console.log(`Laborer with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`);
  
    // Set the deletionScheduledAt field for the laborer
    labor.deletionScheduledAt = sixMonthsFromNow;
  
    // Save the updated laborer with the scheduled deletion date
    await this.laborRepository.save(labor);
  
    console.log(`Laborer with ID ${id} marked for deletion in 6 months.`);
    return true;
  }
  

  /**
   * Get all laborers.
   * @returns List of all labor records
   */
  async getAllLaborers(queryOptions:PaginationOptions): Promise<any> {
    let query = await this.laborRepository.createQueryBuilder("labor");
    const result = await buildQuery(query, queryOptions,"labor");
   return result; 
  }

 /**
 * Get a labor record by ID.
 * @param id - Labor ID
 * @returns Found labor record or null
 */
async getLaborById(id: string): Promise<LaborRegister | null> {
  const labor = await this.laborRepository.findOne({
    where: { id },
    relations: ['attendances'], // Correct relation name
  });

  if (!labor) {
    throw new AppError(404, `Laborer with ID ${id} not found.`);
  }

  return labor;
}


public async deleteMultipleLabourRegister(ids: string[]): Promise<{ success: string[]; failed: { id: string; reason: string }[]; message: string }> {
  const success: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      const labourRegister = await this.laborRepository.findOne({
        where: { id },
      });
      if (!labourRegister) {
        failed.push({ id, reason: 'Labour Register not found' });
        continue;
      }
      

      const deleteAqr = await this.laborRepository.delete(labourRegister.id);
      if (!deleteAqr) {
        throw new Error(`Failed to delete Labour Register with ID ${id}`);
      }
      success.push(id);
    } catch (error: any) {
      failed.push({ id, reason: error.message || 'Unknown error' });
    }
  }
  const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
  return { success, failed, message };
}


}
