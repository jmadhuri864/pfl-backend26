import { Column, Entity, OneToMany } from "typeorm";
import { Product } from "./product.entity";
import Model from "./model.entity";
import { ProductCategory } from "./product_category.entity";

@Entity("product_classification")
export class ProductClassification extends Model {
  @Column()
  name: string;

  @OneToMany(() => ProductCategory, (category) => category.productClassification,{ onDelete: "SET NULL" ,cascade:true})
  categories: ProductCategory[];
  
}