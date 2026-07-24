import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GRN } from './grn.entity';
import { GrnProduct } from './grnProduct.entity';
import { Product } from './product.entity';
import { User } from './user.entity';

/**
 * Tracks edit history for GRN product line-items.
 *
 * A new record is created **only** when quantity or unitPrice actually changes.
 * Version is maintained per grn_product (not per GRN).
 */
@Entity({ name: 'grn_product_history' })
export class GrnProductHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── FK columns (stored as plain UUIDs for easy querying) ──────────────────

  @Column({ name: 'grn_id', type: 'uuid', nullable: true })
  grnId: string | null;

  @Column({ name: 'grn_product_id', type: 'uuid', nullable: true })
  grnProductId: string | null;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string | null;

  // ── Relations ─────────────────────────────────────────────────────────────

  @ManyToOne(() => GRN, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'grn_id' })
  grn: GRN;

  @ManyToOne(() => GrnProduct, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'grn_product_id' })
  grnProduct: GrnProduct;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  // ── Versioning (per grn_product) ──────────────────────────────────────────

  /**
   * Incremented per grn_product_id.
   * Version 1 = first edit after initial creation.
   */
  @Column({ type: 'int', default: 1 })
  version: number;

  // ── Quantity change ───────────────────────────────────────────────────────

  @Column({ name: 'old_quantity', type: 'decimal', precision: 10, scale: 2, nullable: true })
  oldQuantity: number | null;

  @Column({ name: 'new_quantity', type: 'decimal', precision: 10, scale: 2, nullable: true })
  newQuantity: number | null;

  // ── Rate (unitPrice) change ───────────────────────────────────────────────

  @Column({ name: 'old_rate', type: 'decimal', precision: 10, scale: 2, nullable: true })
  oldRate: number | null;

  @Column({ name: 'new_rate', type: 'decimal', precision: 10, scale: 2, nullable: true })
  newRate: number | null;

  // ── Audit ─────────────────────────────────────────────────────────────────

  @Column({ name: 'modified_by', type: 'uuid', nullable: true })
  modifiedBy: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'modified_by' })
  modifiedByUser: User;

  @CreateDateColumn({ name: 'modified_at' })
  modifiedAt: Date;
}
