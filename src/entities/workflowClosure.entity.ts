import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import Model from "./model.entity";
import { User } from "./user.entity";

export enum DepartmentEnum {
  PURCHASE = "purchase",
  SALE = "sale",
  OPERATIONS = "operations",
  QUALITY_CHECKING = "quality_checking",
  BUSINESS_DEVELOPMENT = "business_development",
  BRANDING_MARKETING = "Branding_&_Marketing",
  EXPORTS = "exports",
  FARMING = "farming",
  ACCOUNTS = "accounts",
  FINANCE = "finance",
  HR = "hr",
  IT = "it",
  ADMIN = "admin",
  SUPERADMIN="superAdmin"
}


@Entity("workflow_hierarchy")
export class WorkflowHierarchy extends Model
 {
    


  @Column({
    type: "enum",
    enum: DepartmentEnum
  })
  department: DepartmentEnum;


  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "ancestor_id" })
  ancestor: User;


  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "descendant_id" })
  descendant: User;


    @Column()
    depth: number; // 0=self, 1=direct, 2=indirect
}
