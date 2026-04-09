import { inject, injectable } from 'inversify';
import { DataSource, In } from 'typeorm';
import { TYPES } from '../types';
import { CustomerType } from '../entities/customerType.entity';
import { CustomerTypeRepository } from '../repositories/customerType.repository';
import { AuditLogService } from './auditLog.service';
import AppError from '../utils/appError';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import { CacheService } from './cache.service';

const CACHE_PREFIX = 'customerType';
const CACHE_TTL = 300;        // 5 min for lists
const CACHE_TTL_DETAIL = 300; // 5 min for single record

@injectable()
export class CustomerTypeService {
  private customerTypeRepository: CustomerTypeRepository;

  constructor(
    @inject(TYPES.DataSource) private dataSource: DataSource,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService,
    @inject(TYPES.CacheService)
    private readonly cacheService: CacheService,
  ) {
    this.customerTypeRepository = this.dataSource.getRepository(
      CustomerType,
    ) as CustomerTypeRepository;
  }

  // ─── Cache Helpers ────────────────────────────────────────────────────────

  private async invalidateCache(id?: string): Promise<void> {
    const tasks: Promise<any>[] = [
      this.cacheService.invalidatePattern(`${CACHE_PREFIX}:list:*`),
    ];
    if (id) {
      tasks.push(this.cacheService.del(`${CACHE_PREFIX}:id:${id}`));
    }
    await Promise.all(tasks);
  }

  // ─── Methods ──────────────────────────────────────────────────────────────

  async getAllCustomerTypes(queryOptions: PaginationOptions): Promise<any> {
    const key = `${CACHE_PREFIX}:list:${JSON.stringify(queryOptions)}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const queryBuilder = this.customerTypeRepository
      .createQueryBuilder('customerType')
      .select(['customerType.id', 'customerType.name'])
      .orderBy('customerType.createdAt', 'DESC');

    const result = await buildQuery(queryBuilder, queryOptions, 'productClassification');

    const formatted = {
      ...result,
      data: result.data.map((cust: any) => ({
        id: cust.id,
        name: cust.name,
      })),
    };

    await this.cacheService.set(key, formatted, CACHE_TTL);
    return formatted;
  }

  async getCustomerTypeById(id: string): Promise<CustomerType | null> {
    const key = `${CACHE_PREFIX}:id:${id}`;
    const cached = await this.cacheService.get<CustomerType>(key);
    if (cached) return cached;

    const customerType = await this.customerTypeRepository
      .createQueryBuilder('customerType')
      .select(['customerType.id', 'customerType.name'])
      .where('customerType.id = :id', { id })
      .getOne();

    if (customerType) await this.cacheService.set(key, customerType, CACHE_TTL_DETAIL);
    return customerType;
  }

  async createCustomerType(name: string): Promise<CustomerType> {
    const customerType = this.customerTypeRepository.create({ name });
    const saved = await this.customerTypeRepository.save(customerType);
    await this.invalidateCache();
    return saved;
  }

  public async updateCustomerType(
    id: string,
    name: string,
    updatedBy: string,
  ): Promise<CustomerType | null> {
    const customerType = await this.customerTypeRepository.findOneBy({ id });

    if (!customerType) {
      return null;
    }

    await this.auditLogService.logChange(
      'CustomerType',
      id,
      customerType,
      { name },
      updatedBy,
    );

    customerType.name = name;
    const saved = await this.customerTypeRepository.save(customerType);
    await this.invalidateCache(id);
    return saved;
  }

  public async deleteCustomerType(id: string): Promise<boolean> {
    const customerType = await this.customerTypeRepository.findOne({
      where: { id },
    });

    if (!customerType) {
      throw new AppError(404, `Customer Type with ID ${id} not found`);
    }

    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6);
    sixMonthsFromNow.setHours(0, 0, 0, 0);

    customerType.deletionScheduledAt = sixMonthsFromNow;
    await this.customerTypeRepository.save(customerType);
    await this.invalidateCache(id);

    return true;
  }

  async softDeleteCustomerType(typeIds: string[]) {
    const result = await this.customerTypeRepository.softDelete({
      id: In(typeIds),
    });
    await this.invalidateCache();
    return result;
  }
}
