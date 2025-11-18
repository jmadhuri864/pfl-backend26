import { Column, Entity, OneToMany } from "typeorm";
import Model from "./model.entity";
import { ApprovalLevel } from "./approvalLevel.entity";

@Entity('hierarchy')
export class ApprovalHierarchy  extends Model{
 

  @Column()
  name: string;

  @Column()
  description: string;

  @OneToMany(() => ApprovalLevel, level => level.hierarchy)
  levels: ApprovalLevel[];
}