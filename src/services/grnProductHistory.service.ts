import { inject, injectable } from 'inversify';
import { DataSource, QueryRunner } from 'typeorm';
import { TYPES } from '../types';
import { GrnProductHistory } from '../entities/grnProductHistory.entity';
import { GrnProduct } from '../entities/grnProduct.entity';
import { GrnProductHistoryRepository } from '../repositories/grnProductHistory.repository';
import { GrnProductRepository } from '../repositories/grnProduct.repository';

export interface ProductEditData {
  /** grn_products.id */
  id: string;
  quantity?: number;
  unitPrice?: number;
}

@injectable()
export class GrnProductHistoryService {
  constructor(
    @inject(TYPES.GrnProductHistoryRepository)
    private readonly grnProductHistoryRepository: GrnProductHistoryRepository,
    @inject(TYPES.GrnProductRepository)
    private readonly grnProductRepository: GrnProductRepository,
    @inject(TYPES.DataSource)
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Compare each incoming product with its current DB state.
   * Create a history record **only** when quantity or unitPrice actually changed.
   * Version is incremented per grn_product, not per GRN.
   *
   * @param grnId      - The parent GRN's UUID
   * @param products   - Array of product data from the update payload
   * @param modifiedBy - User ID performing the edit
   * @param queryRunner - Optional external QR (caller is responsible for commit/rollback)
   */
  async trackProductEdits(
    grnId: string,
    products: ProductEditData[],
    modifiedBy: string,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const qr = queryRunner ?? this.dataSource.createQueryRunner();
    const ownsTransaction = queryRunner == null;

    if (ownsTransaction) {
      await qr.connect();
      await qr.startTransaction();
    }

    try {
      for (const incoming of products) {
        // 1. Fetch the current state of the product
        const current = await qr.manager.findOne(GrnProduct, {
          where: { id: incoming.id },
          relations: ['productName'],
        });

        if (!current) {
          console.warn(`[GrnProductHistory] Product ${incoming.id} not found — skipping.`);
          continue;
        }

        // 2. Detect actual changes (use Number() to handle decimal-string comparisons)
        const quantityChanged =
          incoming.quantity !== undefined &&
          Number(current.quantity) !== Number(incoming.quantity);

        const rateChanged =
          incoming.unitPrice !== undefined &&
          Number(current.unitPrice) !== Number(incoming.unitPrice);

        // 3. Skip if nothing changed (Req 3 & 12)
        if (!quantityChanged && !rateChanged) {
          continue;
        }

        // 4. Determine next version for this grn_product (Req 9)
        const latest = await qr.manager
          .createQueryBuilder(GrnProductHistory, 'h')
          .where('h.grn_product_id = :id', { id: current.id })
          .orderBy('h.version', 'DESC')
          .getOne();

        const nextVersion = latest ? latest.version + 1 : 1;

        // 5. Build and persist the history record
        const record = qr.manager.create(GrnProductHistory, {
          grnId,
          grn: { id: grnId },
          grnProductId: current.id,
          grnProduct: { id: current.id },
          productId: current.productName?.id ?? null,
          product: current.productName ? { id: current.productName.id } : undefined,
          version: nextVersion,
          oldQuantity: quantityChanged ? Number(current.quantity) : null,
          newQuantity: quantityChanged ? Number(incoming.quantity) : null,
          oldRate: rateChanged ? Number(current.unitPrice) : null,
          newRate: rateChanged ? Number(incoming.unitPrice) : null,
          modifiedBy,
          modifiedByUser: { id: modifiedBy },
        });

        await qr.manager.save(GrnProductHistory, record);
      }

      if (ownsTransaction) {
        await qr.commitTransaction();
      }
    } catch (error) {
      if (ownsTransaction) {
        await qr.rollbackTransaction();
      }
      throw error;
    } finally {
      if (ownsTransaction) {
        await qr.release();
      }
    }
  }

  /**
   * Get the full edit history for a single GRN product, ordered by version ASC.
   */
  async getProductHistory(grnProductId: string): Promise<GrnProductHistory[]> {
    return this.grnProductHistoryRepository.find({
      where: { grnProductId },
      relations: ['modifiedByUser', 'product'],
      order: { version: 'ASC' },
    });
  }

  /**
   * Get the edit history for all products within a GRN, grouped by product and version.
   */
  async getGrnHistory(grnId: string): Promise<GrnProductHistory[]> {
    return this.grnProductHistoryRepository.find({
      where: { grnId },
      relations: ['grnProduct', 'product', 'modifiedByUser'],
      order: { grnProductId: 'ASC', version: 'ASC' },
    });
  }

  /**
   * Returns the latest version number for a specific GRN product (0 = no history yet).
   */
  async getLatestVersion(grnProductId: string): Promise<number> {
    const latest = await this.grnProductHistoryRepository
      .createQueryBuilder('h')
      .where('h.grn_product_id = :id', { id: grnProductId })
      .orderBy('h.version', 'DESC')
      .getOne();

    return latest?.version ?? 0;
  }
}
