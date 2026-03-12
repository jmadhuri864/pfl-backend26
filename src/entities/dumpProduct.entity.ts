import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import Model from "./model.entity";
import { Product } from "./product.entity";
import { UOM } from "./uom.entity";
import { DumpRegister } from "./dumpRegister.entity";
import { ProductVarient } from "./productVarient.entity";

@Entity("dump_product")
export class DumpProduct extends Model {

   
  @ManyToOne(() => Product, { nullable: true,onDelete: "SET NULL" })
  @JoinColumn({ name: "product_id" })
  productName: Product;
@ManyToOne(() => ProductVarient, { onDelete: 'SET NULL', cascade: true ,nullable:true})
    @JoinColumn({ name: 'varient_id' })
    variant: ProductVarient;
    
    @ManyToOne(() => UOM, { nullable: true,onDelete: "SET NULL" })
    @JoinColumn({ name: "uom_id" })
    uom: UOM;
  
    @Column("decimal", { precision: 12, scale: 2, nullable: true })
    quantity: number; 
    @Column("decimal", { precision: 12, scale: 2, nullable: true })
    unitPrice: number;
    @Column("decimal", { precision: 12, scale: 2, nullable: true })
    amount: number; 
  //   @Column("character varying", { name: "count", nullable: true, length: 100 })
  // count: string;

  // @Column("character varying", { name: "size", nullable: true, length: 100 })
  // size: string;
  //   @Column("character varying", { name: "origin", nullable: true, length: 100 })
  //   origin: string;
  //   @Column("character varying", { name: "variety", nullable: true, length: 100 })
  //   variety:string;
 @ManyToOne(() => DumpRegister, (dumpRegister) => dumpRegister.dumpProducts, { nullable: false,onDelete: "SET NULL" })
 @JoinColumn({ name: "dump_register_id" })
 dumpRegister: DumpRegister;
}