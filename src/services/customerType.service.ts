import { inject, injectable } from 'inversify';

import { DataSource, In } from 'typeorm';

import { TYPES } from '../types';
import { CustomerType } from '../entities/customerType.entity';
import { CustomerTypeRepository } from '../repositories/customerType.repository';
import { AuditLogService } from './auditLog.service';
import AppError from '../utils/appError';
import { buildQuery, PaginationOptions } from '../utils/pagination';

@injectable()
export class CustomerTypeService {
  private customerTypeRepository: CustomerTypeRepository;

  constructor(
    @inject(TYPES.DataSource) private dataSource: DataSource,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService,
  ) {
    this.customerTypeRepository = this.dataSource.getRepository(
      CustomerType,
    ) as CustomerTypeRepository;
  }
 async getAllCustomerTypes(queryOptions: PaginationOptions): Promise<any> {
    let queryBuilder = await this.customerTypeRepository
      .createQueryBuilder('customerType')
      .orderBy('customerType.createdAt', 'DESC');
    const result = await buildQuery(
      queryBuilder,
      queryOptions,
      'productClassification',
    );

    //TODO:New Added code 
    const formattedData = result.data.map((cust: any) => {
      return{
      id:cust.id,
      name:cust.name
      } 
    })
    return {
    ...result,
    data: formattedData,
  };
    //return result;
  }


  async getCustomerTypeById(id: string): Promise<CustomerType | null> {
    return this.customerTypeRepository.findOne({ 
      where: {id},
      select: ["id", "name"]
     });
  }

  async createCustomerType(name: string): Promise<CustomerType> {
    const customerType = this.customerTypeRepository.create({ name });
    return this.customerTypeRepository.save(customerType);
  }

  public async updateCustomerType(
    id: string,
    name: string,
    updatedBy: string,
  ): Promise<CustomerType | null> {
    // Step 1: Fetch the existing CustomerType (before update)
    const customerType = await this.customerTypeRepository.findOneBy({ id });

    if (!customerType) {
      return null; // If the customer type doesn't exist, return null
    }

    // Step 2: Log the changes (audit log) before updating the CustomerType
    await this.auditLogService.logChange(
      'CustomerType', // entity name
      id, // entity id
      customerType, // old data
      { name }, // new data (only name is updated)
      updatedBy, // user who updated it
    );

    // Step 3: Update the name in the entity
    customerType.name = name;

    // Step 4: Save the updated CustomerType
    return this.customerTypeRepository.save(customerType);
  }
  public async deleteCustomerType(id: string): Promise<boolean> {
    // Find the customer type by ID
    const customerType = await this.customerTypeRepository.findOne({
      where: { id },
    });

    if (!customerType) {
      throw new AppError(404, `Customer Type with ID ${id} not found`);
    }

    // Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

    // Log the scheduled deletion
    console.log(
      `Customer Type with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`,
    );

    // Set the deletionScheduledAt field for the customer type
    customerType.deletionScheduledAt = sixMonthsFromNow;

    // Save the updated customer type with the scheduled deletion date
    await this.customerTypeRepository.save(customerType);

    console.log(`Customer Type with ID ${id} marked for deletion in 6 months.`);
    return true;
  }
  async softDeleteCustomerType(typeIds: string[]) {

  const result = await this.customerTypeRepository.softDelete({
    id: In(typeIds)
  });

  return result;
}
}
