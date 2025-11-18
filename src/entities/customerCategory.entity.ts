import { Entity, Column, OneToMany, ManyToOne } from "typeorm";

import Model from "./model.entity";
import { Customer } from "./customer.entity";
import { CustomerType } from "./customerType.entity";

@Entity("customer_category")
export class CustomerCategory extends Model {
  @Column()
  name: string;
  @OneToMany(() => Customer, (customer) => customer.customerCategory,{ onDelete: "SET NULL" })
  customers: Customer[];

}
