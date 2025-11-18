import { Entity, Column, OneToMany } from "typeorm";

import Model from "./model.entity";
import { Customer } from "./customer.entity";
import { CustomerCategory } from "./customerCategory.entity";

@Entity("customer_type")
export class CustomerType extends Model {
  @Column()
  name: string;

  
  @OneToMany(() => Customer, (customer) => customer.customerTypes,{ onDelete: "SET NULL" })
  customers: Customer[];
}
