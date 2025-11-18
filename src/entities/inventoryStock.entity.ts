import { Column, Entity, JoinColumn, ManyToOne, Unique } from "typeorm";
import Model from "./model.entity";
import { Branches } from "./branches.entity";
import { Product } from "./product.entity";
import { Company } from "./company.entity";
import { ProductVarient } from "./productVarient.entity";

@Entity("inventory_stock")
export class InventoryStock extends Model {

    @ManyToOne(() => Branches, { nullable: true,onDelete: "SET NULL" })
     @JoinColumn({ name: "location_id" })
     location: Branches;

     
    @ManyToOne(() => Company, { nullable: true,onDelete: "SET NULL" })
    @JoinColumn({ name: "company_id" })
    companyName: Company;

      @ManyToOne(() => Product, { nullable: true,onDelete: "SET NULL" })
       @JoinColumn({ name: "product_id" })
       product: Product;

      
      @ManyToOne(() => ProductVarient, { onDelete: 'SET NULL', cascade: true })
        @JoinColumn({ name: 'varient_id' })
        varients: ProductVarient;

      @Column('decimal', { name: "onhandQty", nullable: true, precision: 10, scale: 2 })
      onHandQty: number;

      @Column('decimal', { name: "countedQty", nullable: true, precision: 10, scale: 2 })
        countedQty: number;

        @Column('decimal', { name: "amount", nullable: true, precision: 10, scale: 2 })
        amount: number;

       
}