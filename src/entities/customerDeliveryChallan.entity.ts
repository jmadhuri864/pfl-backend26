import { ChildEntity, ManyToOne, JoinColumn, Column } from 'typeorm';

import { Customer } from './customer.entity';
import { DeliveryChallanPurchase } from './deliveryChallan.entity';
import { Address } from './address.entity';
import { Branches } from './branches.entity';

@ChildEntity('customer_delivery_challan')
export class CustomerDeliveryChallan extends DeliveryChallanPurchase {
  @ManyToOne(() => Customer, {
    nullable: true,
    onDelete: 'SET NULL',
    cascade: true,
  })
  @JoinColumn({ name: 'customer_id' })
  customerName: Customer;

  @Column({ nullable: true })
  poNumber: string;

  @ManyToOne(() => Branches, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branch_id' })
  fromLocation: Branches;
  
  @ManyToOne(() => Address, {
    nullable: true,
    onDelete: 'SET NULL',
    cascade: true,
  })
  @JoinColumn({ name: 'billingAddres_id' })
  billingAddress: Address;

  @ManyToOne(() => Address, {
    nullable: true,
    onDelete: 'SET NULL',
    cascade: true,
  })
  @JoinColumn({ name: 'deliveryAddres_id' })
  deliveryAddress: Address;
}
