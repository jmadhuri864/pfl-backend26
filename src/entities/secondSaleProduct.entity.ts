import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import Model from './model.entity';
import { SecondSale } from './secondSale.entity';
import { Product } from './product.entity';
import { UOM } from './uom.entity';
import { ProductVarient } from './productVarient.entity';

@Entity({ name: 'second_sale_product' })
export class SecondSaleProduct extends Model {
  @ManyToOne(() => Product, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'product_id' })
  productName: Product;

   @ManyToOne(() => ProductVarient, { onDelete: 'SET NULL', cascade: true })
      @JoinColumn({ name: 'varient_id' })
      variant: ProductVarient;

  @ManyToOne(() => UOM, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'uom_id' })
  uom: UOM;

  // @Column('character varying', { name: 'count', nullable: true, length: 100 })
  // count: string;

  // @Column('character varying', { name: 'size', nullable: true, length: 100 })
  // size: string;
  // @Column("character varying", { name: "origin", nullable: true, length: 100 })
  // origin: string;
  // @Column("character varying", { name: "variety", nullable: true, length: 100 })
  // variety:string;
  @Column('int', { nullable: true })
  quantity: number;

  @Column('decimal', { nullable: true })
  unitPrice: number;

  @Column('decimal', { nullable: true })
  amount: number;
  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 3 })
  netWeight: number;
  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 3 })
  packingMaterialWeight: number;
  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 3 })
  grossWeight: number;
  @ManyToOne(
    () => SecondSale,
    (saleRegister) => saleRegister.secondSaleProducts,
    { onDelete: 'SET NULL' },
  )
  @JoinColumn({ name: 'second_sale_register_id' })
  secondSaleRegister: SecondSale;
}
