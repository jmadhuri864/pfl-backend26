import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { Product } from "./product.entity";

import Model from "./model.entity";

import { AqrParameter } from "./aqrQuality.entity";
import { DeliveryChallanPurchase } from "./deliveryChallan.entity";
import { User } from "./user.entity";
import { format } from "date-fns";

@Entity("aqr")
export class Aqr extends Model {
  // @Column({ nullable: true })
  // dcNo: string;

  @ManyToOne(() => DeliveryChallanPurchase, { nullable: true,onDelete: "SET NULL" })
      @JoinColumn({ name: "delivery_challan_id" }) // Define the foreign key column
      dcNo: DeliveryChallanPurchase;
  // @Column({ nullable: true })
  // dcDate: Date;


   @Column({ type: 'date', nullable: true, default: null , transformer: {
    to: (value: Date) => value, 
    from: (value: string) => value ? format(new Date(value), "dd-MM-yyyy") : null, // Convert to DD-MM-YYYY format
  },
  })
   dcDate: Date ;

  @Column({ nullable: true })
  arrivedQty: string;
  @Column({ nullable: true })
  aqrNo: string;
  
  @Column({ nullable: true })
  samplingQty: string;
  // @Column({ nullable: true })
  // sendBy: string;
  //  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  //   @JoinColumn({ name: 'send_id' })
  //   sendBy: User;
  // @Column({ nullable: true })
  // purchaseBy: string;
   @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'purchase_id' })
    purchaseBy: User;


  // @Column({ nullable: true })
  // receivedBy: string;

   @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'received_id' })
   receivedBy: User;
  
 

   @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'qccheck_id' })
   qcCheckBy: User;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'verified_id' })
 verifiedBy: User;
  
  // @Column({ nullable: true })
  // verifiedBy: string;
  
  @Column({ nullable: true ,type: "decimal", precision: 100, scale: 3})
  totalQty: number;

  @Column({ nullable: true ,type: "decimal", precision: 100, scale: 3})
  totalpercent: number;

  @Column({ nullable: true })
  supplierName: string;
  // @Column({ nullable: true })
  // arrivalDate: Date;

   @Column({ type: 'date', nullable: true, default: null , transformer: {
  to: (value: Date) => value, 
  from: (value: string) => value ? format(new Date(value), "dd-MM-yyyy") : null, 
},
})
 arrivalDate: Date ;

  @Column({ nullable: true })
  supplierLocation: string;
  // @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  // quantity: number; // Quantity of this quality parameter (e.g., 300 kg)

  // @Column({ type: "decimal", precision: 5, scale: 2, nullable: true })
  // percentage: number; // Percentage for this quality parameter (e.g., 60%)

  @Column({ type: "text", nullable: true })
  remark: string; 

 
  @ManyToOne(() => Product, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "product_id" })
  product: Product; 


  @OneToMany(() => AqrParameter, (aqrParameter) => aqrParameter.aqr, {
    cascade:true,
    onDelete: "SET NULL",
  })
  @JoinColumn({name:"parameter_id"})
  parameters: AqrParameter[]; 
}
