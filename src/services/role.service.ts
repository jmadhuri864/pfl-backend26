import { inject, injectable } from "inversify";
import { DataSource, Repository, Like } from "typeorm";
import { Role } from "../entities/role.entity";
import { TYPES } from "../types";
import { RoleRepository } from "../repositories/role.repository";
import { AuditLogService } from "./auditLog.service";

@injectable()
export class RoleService {
  
  constructor(
    @inject(TYPES.RoleRepository)
    private readonly roleRepository:  RoleRepository,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService
   
  ) {}

  async findAllRoles(): Promise<Role[]> {
    return this.roleRepository.find({  order: {
      createdAt: 'DESC', // Assuming createdAt is a timestamp field 
    },});
  }

  async findRoleById(id: string): Promise<Role | null> {
  
    const role = await this.roleRepository.findOne({ where: { id } });
    
  return role;
  }

  async findRoleByName(name: string): Promise<Role | null> {
    const uppercasedName = name.toUpperCase();
    return this.roleRepository
    .createQueryBuilder('role')
    .where('UPPER(role.name) = :name', { name: uppercasedName })
    .getOne();
  }

  async createRole(roleData: Partial<Role>): Promise<Role> {
    if (roleData.name) {
      roleData.name = roleData.name.toUpperCase();
    }
    const role = this.roleRepository.create(roleData);
    return this.roleRepository.save(role);
  }

  public async updateRole(
    id: string,
    roleData: Partial<Role>,
    updatedBy: string
): Promise<Role | null> {
    // Retrieve the existing role to log the old data
    const existingRole = await this.roleRepository.findOneBy({ id });
    if (!existingRole) {
        throw new Error("Role not found");
    }

    // If the roleData contains a name, convert it to uppercase
    if (roleData.name) {
        roleData.name = roleData.name.toUpperCase();
    }

    // Merge the new data into the existing role
    Object.assign(existingRole, roleData);

    // Save the updated role
    const updatedRole = await this.roleRepository.save(existingRole);

    // Log the changes with the audit service
    await this.auditLogService.logChange(
        'Role',           // Entity name
        id,               // Entity ID
        existingRole,     // Old data
        updatedRole,      // Updated data
        updatedBy         // User who made the update
    );

    return updatedRole;
}


async deleteRole(id: string): Promise<boolean> {
  // Step 1: Find the Role by ID
  const role = await this.roleRepository.findOne({
    where: { id },
  });

  // Step 2: If the Role doesn't exist, throw an error
  if (!role) {
    throw new Error(`Role with ID ${id} not found`);
  }

  // Step 3: Calculate the date 6 months ahead
  const now = new Date();
  const sixMonthsFromNow = new Date(now);
  sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
  sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

  // Log the scheduled deletion

  // Step 4: Set the deletionScheduledAt field for the Role
  role.deletionScheduledAt = sixMonthsFromNow;

  // Step 5: Save the updated Role with the scheduled deletion date
  await this.roleRepository.save(role);

  // Step 6: Return true to indicate the deletion was scheduled
  return true;
}

async findOneRole(id:string):Promise<Role|null>{
  return this.roleRepository.findOne({ where: { id} })
}
}