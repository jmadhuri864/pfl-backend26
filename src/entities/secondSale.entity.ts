import { Entity, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import Model from './model.entity';
import { SecondSaleProduct } from './secondSaleProduct.entity';
import { DeliveryChallanPurchase } from './deliveryChallan.entity';
import { Branches } from './branches.entity';
import { join } from 'path/posix';
import { Company } from './company.entity';
import { format } from 'date-fns';

@Entity({ name: 'second_sale_document' })
export class SecondSale extends Model {
  @ManyToOne(() => Company, {
    cascade: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'company_id' })
  companyName: Company;

  @ManyToOne(() => Branches, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branch_id' })
  location: Branches;



  @ManyToOne(() => DeliveryChallanPurchase, {
    nullable: true,
    onDelete: 'SET NULL',
    cascade: true, // Enable cascade save
  })
  @JoinColumn({ name: 'delivery_challan_id'}) // Define the foreign key column
  dcNo: DeliveryChallanPurchase;

  @Column({
    type: 'date',
    transformer: {
      to: (value: Date) => value,
      from: (value: string) =>
        value ? format(new Date(value), 'dd-MM-yyyy') : null, // Convert to DD-MM-YYYY format
    },
  })
  saleDate: string;

  @Column({ type: 'text', nullable: true })
  buyerName: string;

  @Column({ type: 'text', nullable: true })
  buyerMobNo: string;

  @Column({ type: 'text', nullable: true })
  reasonForSale: string;

  @Column({ type: 'text', nullable: true })
  approvedBy: string;

  @Column({ type: 'text', nullable: true })
  soldBy: string;

  @OneToMany(() => SecondSaleProduct, (product) => product.secondSaleRegister, {
    onDelete: 'SET NULL',
    cascade: true,
  })
  @JoinColumn({ name: 'second_sale_id' })
  secondSaleProducts: SecondSaleProduct[];

  @Column({ nullable: true, type: 'decimal', precision: 100, scale: 3 })
  totalNetWeight: number;

  @Column({ nullable: true, type: 'decimal', precision: 100, scale: 3 })
  totalAmt: number;

  @Column({ nullable: true, type: 'text' })
   totalAmtInWords: string;
   
  @Column({ type: 'decimal', nullable: true })
  paidAmount: number;

  @Column({ nullable: true })
  paymentMode: string;

  @Column({ type: 'decimal', nullable: true })
  pendingAmt: number;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'text', nullable: true })
  comments: string;

  @Column({ type: 'text', nullable: true })
  submittedBy: string;

  @Column({ type: 'text', nullable: true })
  mobileNo: string;

  
}
