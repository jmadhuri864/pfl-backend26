import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { PackingMaterialRepository } from '../repositories/packingMaterial.repository';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import AppError from '../utils/appError';
import { AuditLogService } from './auditLog.service';
import { CacheService } from './cache.service';

const CACHE_PREFIX = 'packingMaterial';
const CACHE_TTL = 300; // 5 minutes

@injectable()
export class PackingMaterialService {
  constructor(
    @inject(TYPES.PackingMaterialRepository)
    private readonly packingMaterialRepository: PackingMaterialRepository,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService,
    @inject(TYPES.CacheService)
    private readonly cacheService: CacheService,
  ) {}

  // ─── Cache Helpers ────────────────────────────────────────────────────────

  private async invalidateCache(id?: string): Promise<void> {
    const tasks: Promise<any>[] = [
      this.cacheService.invalidatePattern(`${CACHE_PREFIX}:list:*`),
      this.cacheService.del(`${CACHE_PREFIX}:partial`),
      this.cacheService.del(`${CACHE_PREFIX}:dropdown`),
    ];
    if (id) {
      tasks.push(this.cacheService.del(`${CACHE_PREFIX}:id:${id}`));
    }
    await Promise.all(tasks);
  }

  // ─── Methods ──────────────────────────────────────────────────────────────

  async getAll(queryOptions: PaginationOptions): Promise<any> {
    const key = `${CACHE_PREFIX}:list:${JSON.stringify(queryOptions)}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const queryBuilder = this.packingMaterialRepository
      .createQueryBuilder('post_packaging_material')
      .leftJoin('post_packaging_material.uom', 'uom')
      .select([
        'post_packaging_material.id',
        'post_packaging_material.packagingMaterialName',
        'post_packaging_material.packagingMaterialWeight',
        'post_packaging_material.packagingMaterialDescription',
        'post_packaging_material.containsQuantity',
        'uom.id',
        'uom.unit',
      ])
      .orderBy('post_packaging_material.createdAt', 'DESC');

    const data = await buildQuery(queryBuilder, queryOptions, 'post_packaging_material');

    const formatted = {
      formatResponse: data.data.map((material) => ({
        id: material.id,
        packagingMaterialName: material.packagingMaterialName,
        packagingMaterialWeight: material.packagingMaterialWeight,
        packagingMaterialDescription: material.packagingMaterialDescription,
        uom: material.uom?.unit ?? null,
        containsQuantity: material.containsQuantity,
      })),
      data1: data.meta,
    };

    await this.cacheService.set(key, formatted, CACHE_TTL);
    return formatted;
  }

  async getMaterialById(id: string): Promise<any> {
    const key = `${CACHE_PREFIX}:id:${id}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const material = await this.packingMaterialRepository
      .createQueryBuilder('post_packaging_material')
      .leftJoin('post_packaging_material.uom', 'uom')
      .select([
        'post_packaging_material.id',
        'post_packaging_material.packagingMaterialName',
        'post_packaging_material.packagingMaterialWeight',
        'post_packaging_material.packagingMaterialDescription',
        'post_packaging_material.useFor',
        'post_packaging_material.containsQuantity',
        'uom.id',
      ])
      .where('post_packaging_material.id = :id', { id })
      .getOne();

    if (!material) {
      throw new Error('Material not found');
    }

    const formatted = {
      id: material.id,
      packagingMaterialName: material.packagingMaterialName,
      packagingMaterialWeight: material.packagingMaterialWeight,
      packagingMaterialDescription: material.packagingMaterialDescription,
      useFor: material.useFor,
      uom: material.uom?.id ?? null,
      containsQuantity: material.containsQuantity,
    };

    await this.cacheService.set(key, formatted, CACHE_TTL);
    return formatted;
  }

  async findAllPackingMaterial(): Promise<{ id: string; name: string }[]> {
    const key = `${CACHE_PREFIX}:dropdown`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const materials = await this.packingMaterialRepository
      .createQueryBuilder('post_packaging_material')
      .select([
        'post_packaging_material.id',
        'post_packaging_material.packagingMaterialName',
      ])
      .orderBy('post_packaging_material.packagingMaterialName', 'ASC')
      .getMany();

    const formatted = materials.map((mat) => ({
      id: mat.id,
      name: mat.packagingMaterialName,
    }));

    await this.cacheService.set(key, formatted, CACHE_TTL);
    return formatted;
  }

  async getAllPartial(): Promise<any[]> {
    const key = `${CACHE_PREFIX}:partial`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const data = await this.packingMaterialRepository
      .createQueryBuilder('post_packaging_material')
      .select([
        'post_packaging_material.id',
        'post_packaging_material.packagingMaterialName',
        'post_packaging_material.packagingMaterialWeight',
      ])
      .orderBy('post_packaging_material.packagingMaterialName', 'ASC')
      .getMany();

    const formatted = data.map((material) => ({
      id: material.id,
      packagingMaterialName: material.packagingMaterialName,
      packagingMaterialWeight: material.packagingMaterialWeight,
    }));

    await this.cacheService.set(key, formatted, CACHE_TTL);
    return formatted;
  }

  async createPackingMaterial(data: any): Promise<any> {
    const material = this.packingMaterialRepository.create(data);
    const saved = await this.packingMaterialRepository.save(material);
    await this.invalidateCache();
    return saved;
  }

  async updatePackingMaterial(id: string, data: any, updatedBy: string): Promise<any> {
    const material = await this.packingMaterialRepository.findOne({ where: { id } });

    if (!material) {
      throw new AppError(404, `packing material with ID ${id} not found`);
    }

    const oldData = { ...material };
    Object.assign(material, data);

    const updated = await this.packingMaterialRepository.save(material);

    await this.auditLogService.logChange(
      'post_packaging_material',
      id,
      oldData,
      updated,
      updatedBy,
    );

    await this.invalidateCache(id);
    return updated;
  }
}
