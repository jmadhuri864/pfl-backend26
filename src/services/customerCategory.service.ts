// customerCategory.service.ts
import { inject, injectable } from 'inversify';
import { CustomerCategoryRepository } from '../repositories/customerCategory.repository';
import { CustomerCategory } from '../entities/customerCategory.entity';
import { DataSource } from 'typeorm';
import { TYPES } from '../types';
import { AuditLogService } from './auditLog.service';
import AppError from '../utils/appError';
import { buildQuery, PaginationOptions } from '../utils/pagination';

@injectable()
export class CustomerCategoryService {
  private customerCategoryRepository: CustomerCategoryRepository;

  constructor(
    @inject(TYPES.DataSource) private dataSource: DataSource,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService,
  ) {
    this.customerCategoryRepository = this.dataSource.getRepository(
      CustomerCategory,
    ) as CustomerCategoryRepository;
  }

  public async getAll(queryOptions: PaginationOptions): Promise<any> {
    // return await this.customerCategoryRepository.find({
    //   order: {
    //     createdAt: 'DESC', // Assuming createdAt is a timestamp field
    //   },
    // });
    let queryBuilder = await this.customerCategoryRepository
      .createQueryBuilder('customerCategory')
      .orderBy('customerCategory.createdAt', 'DESC');
    const result = await buildQuery(
      queryBuilder,
      queryOptions,
      'customerCategory',
    );
    return result;
  }

  public async getById(id: string): Promise<CustomerCategory | null> {
    return await this.customerCategoryRepository.findOneBy({ id });
  }

  public async create(
    categoryData: Partial<CustomerCategory>,
  ): Promise<CustomerCategory> {
    const category = this.customerCategoryRepository.create(categoryData);
    return await this.customerCategoryRepository.save(category);
  }

  public async update(
    id: string,
    categoryData: Partial<CustomerCategory>,
    updatedBy: string,
  ): Promise<CustomerCategory | null> {
    const existingCategory = await this.customerCategoryRepository.findOne({
      where: { id },
    });

    if (!existingCategory) {
      throw new Error('Customer Category not found');
    }

    await this.auditLogService.logChange(
      'CustomerCategory',
      id,
      existingCategory,
      categoryData,
      updatedBy,
    );

    await this.customerCategoryRepository.update(id, categoryData);

    return this.getById(id);
  }

  public async deleteCustomerCategory(id: string): Promise<boolean> {
    const customerCategory = await this.customerCategoryRepository.findOne({
      where: { id },
    });

    if (!customerCategory) {
      throw new AppError(404, `Customer Category with ID ${id} not found`);
    }

    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6);
    sixMonthsFromNow.setHours(0, 0, 0, 0);

    console.log(
      `Customer Category with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`,
    );

    customerCategory.deletionScheduledAt = sixMonthsFromNow;

    await this.customerCategoryRepository.save(customerCategory);

    console.log(
      `Customer Category with ID ${id} marked for deletion in 6 months.`,
    );
    return true;
  }
}
