import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import Model from './model.entity';
import { Company } from './company.entity';


@Entity("bank_details_from_company")
export class BankDetails extends Model {
   
   

    @Column({nullable:true})
    accountNo: string;
    @Column({nullable:true})
    bankName: string;

    @Column({nullable:true})
    branch: string;

    @Column({nullable:true})
    ifscCode: string;

    @ManyToOne(() => Company, (company) => company.bankDetails)
    company: Company;
}
