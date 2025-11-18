import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import Model from './model.entity';
import { DeliveryChallanPurchase } from './deliveryChallan.entity';
import { UOM } from './uom.entity';
import { Product } from './product.entity';
import { PackingMaterial } from './packingMaterial.entity';
import { ProductVarient } from './productVarient.entity';

@Entity('item')
export class Item extends Model {
 
  @ManyToOne(() => Product, {
    cascade: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'product_id' })
  productName: Product;

   @ManyToOne(() => ProductVarient, { onDelete: 'SET NULL', cascade: true })
      @JoinColumn({ name: 'varient_id' })
      variant: ProductVarient;

  
  @ManyToOne(() => UOM, { cascade: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uom_id' })
  uom: UOM;
  @Column('decimal', { precision: 20, scale: 3, nullable: true })
  quantity: number;
  // @Column({ nullable: true })
  // size: string;
  // @Column({ nullable: true })
  // count: string;
  // @Column({ nullable: true })
  // origin: string;

  // @Column({ nullable: true })
  // variety: string;
@Column({ type: 'decimal', precision: 20, scale: 4, nullable: true })
  acceptedQty?: number | null;
  @Column({ type: 'decimal', precision: 20, scale: 4, nullable: true })
  rejectedQty?: number | null;
  @Column({ type: 'decimal', precision: 20, scale: 4, nullable: true })
  returnedQty?: number | null;
  @ManyToOne(() => UOM, { cascade: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'saleuom_id' })
  saleUoM: UOM;

  // @Column({ nullable: true })
  // saleCount: string;

 
  // @Column({ nullable: true })
  // packagingMaterialUoM: string;

  @ManyToOne(() => UOM, { cascade: true, nullable: true, onDelete: 'SET NULL' })
  packagingMaterialUoM: UOM;
  @Column({ nullable: true })
  packagingMaterialQuantity: number;
  @Column({ nullable: true })
  packagingMaterialUnitPrice: number;

  @Column({ nullable: true })
  packagingMaterialAmount: number;
  @Column({ nullable: true })
  packagingMaterialTotalWeight: number;
  @ManyToOne(() => PackingMaterial, {
    cascade: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'packing_material_id' })
  packagingMaterial: PackingMaterial;

  @Column('decimal', { precision: 20, scale: 3, nullable: true })
  packingMaterialQuantity: number;
  @Column('decimal', { precision: 20, scale: 4, nullable: true })
  amount: number;

  @Column('decimal', { precision: 20, scale: 4, nullable: true })
  unitPrice: number;

  @Column('decimal', { precision: 20, scale: 4, nullable: true })
  grossWeight: number;

  @Column('decimal', { precision: 20, scale: 4, nullable: true })
  packingMaterialWeight: number;

  @Column('decimal', { precision: 20, scale: 4, nullable: true })
  netWeight: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, nullable: true })
  changedQty: number;

  @Column({ type: 'decimal', precision: 20, scale: 4, nullable: true })
  changedPrice: number;

  @ManyToOne(
    () => DeliveryChallanPurchase,
    (deliveryChallan) => deliveryChallan.deliveryChallanProducts,
    { onDelete: 'SET NULL' },
  )
  deliveryChallan: DeliveryChallanPurchase;
}
