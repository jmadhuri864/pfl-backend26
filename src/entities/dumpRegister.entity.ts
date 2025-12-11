import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import Model from "./model.entity";
import { GRN } from "./grn.entity";
import { User } from "./user.entity";
import { DumpProduct } from "./dumpProduct.entity";
import { Branches } from "./branches.entity";
import { Company } from "./company.entity";
import { format } from "date-fns";

export enum DumpType {
  Purchase = 'purchase',
  Transferred = 'transferred',
  ReturnedByCustomer = 'returned-by-customer',
}
@Entity("dump_register")
export class DumpRegister extends Model {
 
  @ManyToOne(() => Company, {cascade: true,nullable: true,onDelete: "SET NULL" })
  @JoinColumn({name: "company_id"})
   companyName: Company;

  @ManyToOne(() => Branches, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "branch_id" })
  location: Branches;

  @Column({ type: 'date', nullable: true , transformer: {
    to: (value: Date) => value, 
    from: (value: string) => value ? format(new Date(value), "dd-MM-yyyy") : null, // Convert to DD-MM-YYYY format
  },
})
  date: Date;
  @ManyToOne(() => GRN, { nullable: true, cascade:true,onDelete: "SET NULL" })
  @JoinColumn({ name: "grn_id" })
  grn: GRN;
  
   @Column({
    type: 'enum',
    nullable: true,
    enum: DumpType,
  })
  dumpType: DumpType;
  @Column({ nullable: true })
  batchNo: string; 
  @Column({ nullable: true })
  totalQty: number; 
  @Column({ nullable: true })
  totalDumpCost: number;
  @Column({ nullable: true })
    totalCostInWords: string;
  @Column({ type: "text", nullable: true })
  remark: string; 
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "requested_by_employee_id" })
  requestedBy: User;
 
  @OneToMany(() => DumpProduct, (dumpProduct) => dumpProduct.dumpRegister, {
    cascade: true,
    onDelete: "SET NULL",
  })
  dumpProducts: DumpProduct[];
}
