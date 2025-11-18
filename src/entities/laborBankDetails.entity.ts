import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import Model from "./model.entity";

@Entity()
export class BankDetails  extends Model {
  

  @Column()
  bankName: string;

  @Column()
  branchName: string;

  @Column()
  accountNumber: string;

  @Column()
  ifscCode: string;

  @Column()
  aadharNo: string;

  @Column()
  panNo: string;

  @Column({ nullable: true })
  electionCardNo: string;
}
