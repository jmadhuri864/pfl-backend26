import { Entity,  Column, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import Model from './model.entity';
import { Address } from './address.entity';
import { Customer } from './customer.entity';
import { format, parse } from "date-fns";
@Entity('customer_delivery_details')
export class DeliveryDetails extends Model{
  

  @ManyToOne(() => Address, { cascade: true, nullable: true,onDelete: "SET NULL" })
  @JoinColumn()
  deliveryAddress: Address;
  @Column({ name: 'delivery_address_copy', nullable: true })
  deliveryAddressProofCopy:string
  // @Column({ nullable: true }) 
  // deliveryTime: Date ; 

   @Column({
        type: "time",
        nullable: true,
        transformer: {
          from: (value: string) => {
            if (!value) return null;
            try {
              //const parsedTime = parse(value, "HH:mm:ss", new Date());
              return format(new Date(`1970-01-01T${value}`), "hh:mm a");
  
              //return format(parsedTime, "hh:mm a"); // Convert to 12-hour format with AM/PM
            } catch (error) {
              console.error("Invalid time format for outTime:", value);
              return null;
            }
          },
          to: (value: string) => {
            if (!value) return null;
            try {
              //const parsedTime = parse(value, "hh:mm a", new Date());
              return format(new Date(`1970-01-01T${value}`), "hh:mm a");
  
            } catch (error) {
              console.error("Invalid time format for outTime:", value);
              return null;
            }
          },
        },
      })
      deliveryTime: string;

  @Column({ name: 'delivery_details_receiving_person_fname', nullable: true})
  receivingPersonFName: string;
  @Column({ name: 'delivery_details_receiving_person_mname', nullable: true})
  receivingPersonMName: string;
  
    @Column({ name: 'delivery_details_receiving_person_lname', nullable: true })
  receivingPersonLName: string;
  @Column({ name: 'delivery_details_receiving_person_primary_mobile_no', nullable: true })
  primaryContactNo: string;

  @Column({ name: 'delivery_details_receiving_person_alternate_no', nullable: true })
  secondaryContactNo: string;

  @Column({ name: 'delivery_details_email_primary', nullable: true })
  emailPrimary: string;

  @Column({ name: 'delivery_details_email_secondary', nullable: true })
  emailSecondary: string;

  @OneToOne(() => Customer, (customer) => customer.deliveryDetails,{ onDelete: "SET NULL" })
  customer: Customer;
}
