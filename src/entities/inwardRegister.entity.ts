import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import Model from './model.entity';
import { DeliveryChallanPurchase } from './deliveryChallan.entity';
import { GRN } from './grn.entity';
import { Farmer } from './farmer.entity';
import { Vendor } from './vendor.entity';
import { Source } from '../utils/status.enum';
import { InwardProduct } from './inwardProduct.entity';
import { Branches } from './branches.entity';
import { Company } from './company.entity';
import { format, toZonedTime } from 'date-fns-tz';
import { User } from './user.entity';

@Entity('inward_register')
export class InwardRegister extends Model {
  @ManyToOne(() => GRN, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'grn_id' })
  grnNo: GRN;
  @ManyToOne(() => DeliveryChallanPurchase, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'delivery_challan_id' })
  deliveryChallanNo: DeliveryChallanPurchase;
  @Column({ nullable: true })
  inwardType: string;


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
  @Column({
    type: 'date',
    nullable: true,
    transformer: {
      to: (value: Date) => value,

      from: (value: string) => {
        if (!value || isNaN(new Date(value).getTime())) return null;
        return format(
          toZonedTime(value, 'Asia/Kolkata'),
          'dd-MM-yyyy hh:mm a',
          { timeZone: 'Asia/Kolkata' },
        );
      },
    },
  })
  date: Date;

  @Column({ nullable: true })
  batchNo: string;

  @ManyToOne(() => Vendor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vendor_id' })
  selectedVendor: Vendor;

  @ManyToOne(() => Farmer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'farmer_id' })
  selectedFarmer: Farmer;

  @OneToMany(
    () => InwardProduct,
    (inwardProduct) => inwardProduct.inwardRegister,
    { nullable: true, onDelete: 'SET NULL', cascade: true },
  )
  @JoinColumn({ name: 'inward_register_id' })
  inwardProducts: InwardProduct[];
  @Column({
    type: 'enum',
    enum: Source,
    nullable: true,
  })
  source: Source;

  @Column({ nullable: true, type: 'decimal', precision: 100, scale: 3 })
  purchasedQty: number;

  @Column({ nullable: true, type: 'decimal', precision: 100, scale: 3 })
  inwardQtyInKg: number;

  @Column({ nullable: true, type: 'decimal', precision: 100, scale: 3 })
  inwardCost: number;

  @Column({ nullable: true, type: 'decimal', precision: 100, scale: 3 })
  totalWeightInKg: number;

  @Column({ nullable: true })
  remarks: string;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'purchase_id' })
  purchasedBy: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  inwardBy: User;
}
