import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { LaborRepository } from "../repositories/labor.repository";
import { Labor } from "../entities/labor.entity";
import { AuditLogService } from "./auditLog.service";
import AppError from "../utils/appError";
import { buildQuery, PaginationOptions } from "../utils/pagination";

@injectable()
export class LaborService {
  constructor(
    @inject(TYPES.LaborRepository)
    private readonly laborRepository: LaborRepository,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService
  ) {}
  async createLabor(laborData: Partial<Labor>): Promise<Labor> {
    const labor = this.laborRepository.create(laborData);
    return this.laborRepository.save(labor);
  }

  async getLaborById(id: string): Promise<Labor | null> {
    return this.laborRepository.findOne({
      where: { id },
      relations: ["bankDetails", "familyDetails", "workExperience",'presentAddress','permanentAddress'],
    });
  }

  async getAllLabors(queryOptions:PaginationOptions): Promise<any> {

    let query= await this.laborRepository.createQueryBuilder("labor")
    .leftJoinAndSelect("labor.bankDetails", "bankDetails")
    .leftJoinAndSelect("labor.familyDetails", "familyDetails")
    .leftJoinAndSelect("labor.workExperience", "workExperience")
    .leftJoinAndSelect("labor.presentAddress","presentAddress")
    .leftJoinAndSelect('labor.permanentAddress',"permanentAddress")
    .orderBy("labor.createdAt", "DESC")
    const result = await buildQuery(query, queryOptions,"labor"); 
    return result;
  }

  async updateLabor(
    id: string,
    laborData: any,
    updatedBy: string
  ): Promise<any> {
    // Fetch the existing labor record
    // Fetch the existing labor record with relations
    console.log(laborData)
  const labor = await this.laborRepository.findOne({
    where: { id },
    relations: ["workExperience", "familyDetails", "bankDetails", "permanentAddress", "presentAddress"]
  });

    if (!labor) {
      return null; // Return null if no record is found
    }

    // Save the original data for audit logging
    const oldData = { ...labor };

    // Apply the updates to the existing labor record
    Object.assign(labor, laborData);

    // Save the updated labor record
    const updatedLabor = await this.laborRepository.save(labor);
console.log("after" ,updatedLabor)
    // Log the changes
    await this.auditLogService.logChange(
      "Labor", // Entity name
      id, // Entity ID
      oldData, // Original data
      updatedLabor, // Updated data
      updatedBy // User who performed the update
    );

    return updatedLabor;
  }

  // Delete a Labor with scheduled deletion (6 months)
  async deleteLabor(id: string): Promise<boolean> {
    const labor = await this.laborRepository.findOne({ where: { id } });

    if (!labor) {
      throw new AppError(404, `Labor with ID ${id} not found`);
    }

    // Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

    // Log the scheduled deletion
    console.log(
      `Labor with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`
    );

    // Set the deletionScheduledAt field for the labor
    labor.deletionScheduledAt = sixMonthsFromNow;

    // Save the updated labor with the scheduled deletion date
    await this.laborRepository.save(labor);

    console.log(`Labor with ID ${id} marked for deletion in 6 months.`);
    return true;
  }
}
