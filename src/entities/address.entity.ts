import { Entity, Column, ManyToOne, OneToOne, OneToMany } from 'typeorm';
import { Customer } from './customer.entity';
import Model from './model.entity';
import { User } from './user.entity';
import { Farmer } from './farmer.entity';
import { Branches } from './branches.entity'; // Import the renamed entity
import { OfficesData } from './offices.entity';

import { DeliveryDetails } from './deliveryDetailsCust.entity';

@Entity('addresses')
export class Address extends Model {
  @Column({ name: 'address1',nullable:true})
  address1: string;

  @Column({ name: 'address2', nullable: true })
  address2: string;

  @Column({ name: 'location', nullable: true })
  location: string;

  @Column({ name: 'city', nullable: true })
  city: string;

  @Column({ name: 'state', nullable: true})
  state: string;

  @Column({ name: 'pincode', nullable: true })
  pincode: string;

  @OneToOne(() => Customer, (customer) => customer.customerAddress,{ onDelete: "SET NULL" })
  customer: Customer;
  
  @OneToOne(() => User, (user) => user.address, { nullable:true,onDelete: "SET NULL" })
  user?: User;

  
  // One-to-Many relationship with Branches
  @OneToMany(() => Branches, (branch) => branch.address, { onDelete: "SET NULL" })
  branches: Branches[];

  // One-to-Many relationship with OfficesData
  @OneToMany(() => OfficesData, (officeData) => officeData.address, { onDelete: "SET NULL" })
  officeData: OfficesData[];

  @OneToMany(() => DeliveryDetails, (deliveryDetails) => deliveryDetails.deliveryAddress,{ onDelete: "SET NULL" })
  deliveryDetails: DeliveryDetails[];
  @OneToOne(() => Farmer, (farmer) => farmer.residensialAddress,{ onDelete: "SET NULL" })
  farmer: Farmer;
}
