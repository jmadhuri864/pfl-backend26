
import { Role } from "./entities/user.entity";

import { container } from "./inversify.config";

import { UserService } from "./services/user.service";
import { TYPES } from "./types";
import { seedDocumentDefDatabase } from "./seed/documentSeed";

export async function seedAdmin() {
  const userService = container.get<UserService>(TYPES.UserService);
  //const roleService = container.get<RoleService>(TYPES.RoleService);
 
  
  try {
   

    const existingAdmin = await userService.findUserByEmail("admin@example.com");
    if (!existingAdmin) {
      const employeeId = await userService.generateEmployeeId(); // Use role ID
      console.log("Generated employee ID:", employeeId);

      const adminData = {
        firstName: "Admin",
        lastName: "Admin",
        username: "Admin",
        workEmail: "admin@example.com",
        password: "Admin@1234",
        status: "ACTIVE",
        primaryMobNo: "7030639160",
        roles:[Role.EMPLOYEE,Role.ADMIN],
        //selectDepartment: adminDept,
        department:["admin"],
        joiningDate: new Date("2022-01-12"),
        employeeId: employeeId,
        permanentAddress: {
          address1: "123 Main St",
          address2: "Suite 100",
          location: "City Center",
          city: "Admin City",
          state: "Admin State",
          pincode: "123456",
        },
      };

      try {
        //reateUserSchema.parse(adminData);
        const admin = await userService.createUser(adminData);
        console.log("Admin user created:", admin);
      } catch (validationError) {
        console.error("Validation failed:", validationError);
      }
    } else {
      console.log("Admin user already exists.");
    }
  } catch (error) {
    console.error("Error during seeding admin user:", error);
  }
}
