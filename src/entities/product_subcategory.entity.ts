import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import Model from "./model.entity";
import { ProductCategory } from "./product_category.entity";
import { Product } from "./product.entity";


@Entity("product_subcategory")
export class ProductSubcategory extends Model {
  @Column()
  name: string;

  @ManyToOne(() => ProductCategory, (category) => category.subcategories,{ onDelete: "SET NULL" ,cascade:true})
  @JoinColumn({ name: "category_id" })  // Foreign key column for category
  category: ProductCategory;

  @OneToMany(() => Product, (product) => product.subcategory, {
    //cascade: true,
    onDelete: "SET NULL",
  })
  products: Product[];
}
