import { inject, injectable } from "inversify"
import { DepartmentforApproveRepository } from "../repositories/departmentforapprove.repository";
import { Departments } from "../entities/deparmentforapproval.entity";
import { TYPES } from "../types";
import { AuditLogService } from "./auditLog.service";
import AppError from "../utils/appError";

@injectable()
export class DepartmentforApproveService {
    constructor(
        @inject(TYPES.DepartmentforApproveRepository)
        private readonly departmentRepository: DepartmentforApproveRepository,
         @inject(TYPES.AuditLogService)
            private readonly auditLogService: AuditLogService
    ) {}

    // Get all departments
    async getAllDepartments(): Promise<Departments[]> {
        return await this.departmentRepository.find();
    }

    // Get a single department by ID
    async getDepartmentById(id: string): Promise<Departments | null> {
        return await this.departmentRepository.findOne({where:{id}});
    }

    // Create a new department
    async createDepartment(name: string): Promise<Departments> {
        const department = new Departments();
        department.name = name;
        return await this.departmentRepository.save(department);
    }

    async updateDepartment(id: string, name: string, updatedBy: string): Promise<Departments | null> {
        const department = await this.departmentRepository.findOne({ where: { id } });
    
        if (department) {
            // Capture the original value before the update
            const originalName = department.name;
    
            // Update the department's name
            department.name = name;
    
            // Save the updated department to the database
            const updatedDepartment = await this.departmentRepository.save(department);
    
            // Log the changes using AuditLogService
            await this.auditLogService.logChange(
                'Department',               // Entity name
                id,                         // Entity ID
                { name: originalName },     // Original value
                { name },                   // Updated value
                updatedBy                   // User who made the change
            );
    
            return updatedDepartment;
        }
    
        return null; // If no department is found, return null
    }
    
   // Delete a department with scheduled deletion
async deleteDepartment(id: string): Promise<boolean> {
    // Find the department by ID
    const department = await this.departmentRepository.findOne({
      where: { id },
    });
  
    if (!department) {
      throw new AppError(404, `Department with ID ${id} not found`);
    }
  
    // Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)
  
    // Log the scheduled deletion
    console.log(`Department with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`);
  
    // Set the deletionScheduledAt field for the Department
    department.deletionScheduledAt = sixMonthsFromNow;
  
    // Save the updated Department with the scheduled deletion date
    await this.departmentRepository.save(department);
  
    console.log(`Department with ID ${id} marked for deletion in 6 months.`);
    return true;
  }
  
}