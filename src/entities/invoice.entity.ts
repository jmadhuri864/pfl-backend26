import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne } from "typeorm";
import Model from "./model.entity";
import { DeliveryChallanPurchase } from "./deliveryChallan.entity";
import { Branches } from "./branches.entity";
import { format } from "date-fns-tz";


@Entity("invoices")
export class Invoice extends Model {
 
  @Column()
  invoiceNo: string;
  @Column({  type: 'date',nullable:true, transformer: {
    to: (value: Date) => value, 
    from: (value: string) => value ? format(new Date(value), "dd-MM-yyyy") : null, 
  },
})
  invoiceDate: Date;
  

  @Column({ type: 'enum', enum: ['proforma', 'final'], default: 'proforma' })
  type: string;

  @ManyToOne(() => Branches, {
      nullable: true,
      onDelete: "SET NULL",
      cascade: true,
    })
    @JoinColumn({ name: "invoicelocation_id" })
    location: Branches;

  @Column({  nullable: false }) 
  pdfData: string;

  @Column('decimal', { precision: 20, scale: 4, nullable: true })
  totalAmount: number;

  @CreateDateColumn({ type :'date' ,transformer: {
    to: (value: Date) => value, 
    from: (value: string) => value ? format(new Date(value), "dd-MM-yyyy") : null, 
  },
})
  createdAt: Date;

  @ManyToOne(() => DeliveryChallanPurchase, (dc) => dc.invoices, { onDelete: "SET NULL" })
  @JoinColumn({ name: "delivery_challan_id" })
  deliveryChallan: DeliveryChallanPurchase;
  
}

