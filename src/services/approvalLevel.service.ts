
import { inject, injectable } from "inversify";
import { ApprovalLevel } from "../entities/approvalLevel.entity";
import { ApprovalLevelRepository } from "../repositories/approvalLevel.repository";
import { TYPES } from "../types";
import { UserRepository } from "../repositories/user.repository";
import { Department } from "../utils/status.enum";

@injectable()
export class ApprovalLevelService {
 

  constructor(
    @inject(TYPES.ApprovalLevelRepository) private approvalLevelRepository: ApprovalLevelRepository,
    @inject(TYPES.UserRepository) private userRepository: UserRepository,
  ) {}

  // Method to create a single approval level for one employee in a department
  async createApprovalLevelForEmployee(employeeId: string, department: Department,level:number): Promise<void> {
    try {
      // Fetch the employee from the database
      const employee = await this.userRepository.findOne({ where: { id: employeeId } });

      if (!employee) {
        throw new Error(`Employee not found for ID: ${employeeId} in department: ${department}`);
      }

      // Check if an approval level already exists for this employee and department
      const existingApprovalLevel = await this.approvalLevelRepository.findOne({
        where: { employee: employee, department: department },
      });

      if (existingApprovalLevel) {
        console.log(`Approval level already exists for employee: ${employee.firstName}, department: ${department}`);
        return; // Skip if approval level already exists
      }

      // Create approval level for employee
      const approvalLevel = new ApprovalLevel();
      approvalLevel.level = level;  // You can customize this to match the level system you have
      approvalLevel.department = department;
      approvalLevel.employee = employee;
      approvalLevel.isCompleted = false;
     
      // Save the new approval level
      await this.approvalLevelRepository.save(approvalLevel);
      console.log(`Created approval level for employee: ${employee.firstName}, department: ${department}`);

    } catch (error) {
      console.error("Error creating approval level: ", error);
      throw new Error("Failed to create approval level");
    }
  }
}
