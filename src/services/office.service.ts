import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { OfficesRepository } from "../repositories/offices.repository";
import { AddressService } from "./address.service";
import { OFFICE_TYPE, OfficesData } from "../entities/offices.entity";
import { AuditLogService } from "./auditLog.service";
import AppError from "../utils/appError";
import { buildQuery, PaginationOptions } from "../utils/pagination";
import { In } from "typeorm";
import { CacheService } from "./cache.service";

@injectable()
export class OfficesService {
  constructor(
    @inject(TYPES.OfficesRepository)
    private readonly officesRepository: OfficesRepository,
    @inject(TYPES.AddressService)
    private readonly addressService: AddressService,
    @inject(TYPES.AuditLogService) private readonly auditLogService: AuditLogService,
    @inject(TYPES.CacheService)
    private readonly cacheService: CacheService,
  ) {}

  private readonly CACHE_PREFIX = 'office';
  private readonly CACHE_TTL = 180;

  private async invalidateCache(id?: string): Promise<void> {
    const tasks: Promise<any>[] = [
      this.cacheService.invalidatePattern(`${this.CACHE_PREFIX}:list:*`),
      this.cacheService.invalidatePattern(`${this.CACHE_PREFIX}:type:*`),
      this.cacheService.del(`${this.CACHE_PREFIX}:all`),
      this.cacheService.del(`${this.CACHE_PREFIX}:filter`),
    ];
    if (id) {
      tasks.push(
        this.cacheService.del(`${this.CACHE_PREFIX}:id:${id}`),
        this.cacheService.del(`${this.CACHE_PREFIX}:idtype:${id}`),
      );
    }
    await Promise.all(tasks);
  }
  async createOffice(officeData: any): Promise<any> {
    const { address, capacity, ...data } = officeData;

    // Create the address
    const newAddress = await this.addressService.create(address);

    // Create the office with provided data
    const office = this.officesRepository.create({
      ...data,
      address: newAddress,
      capacity,
    });

    const saved = await this.officesRepository.save(office);
    await this.invalidateCache();
    return saved;
  }

  public async updateOffice(
    id: string,
    officeData: any,
    updatedBy: string
  ): Promise<OfficesData | null> {
    // Step 1: Find the office with relations to its address
    const office = await this.officesRepository.findOne({
      where: { id },
      relations: ['address'],
    });

    if (!office) return null;

    // Step 2: Prepare the previous data for audit logging
    const previousOfficeData = { ...office }; // Copy the current state of the office
    
    // Log the changes for the office entity
    await this.auditLogService.logChange(
      'Office',
      id,
      previousOfficeData,
      officeData,
      updatedBy
    );

    // Step 3: If address is provided in the update, update it
    if (officeData.address) {
      // Log the previous address data before updating
      const previousAddressData = { ...office.address };

      // Update the address using the address service
      const updatedAddress = await this.addressService.update(office.address.id, officeData.address);
      console.log("Updated office data in update service", updatedAddress);

      if (!updatedAddress) {
        throw new Error("Failed to update address");
      }

      // Log the changes to the address
      await this.auditLogService.logChange(
        'Address',
        office.address.id,
        previousAddressData,
        officeData.address,
        updatedBy
      );

      // Update the office's address field with the new address
      office.address = updatedAddress;
    }

    // Step 4: Update the office fields with the new office data
    Object.assign(office, officeData);

    // Step 5: Save the updated office
    const saved = await this.officesRepository.save(office);
    await this.invalidateCache(id);
    return saved;
  }
async softDeleteOffices(userIds: string[], officeType: OFFICE_TYPE) {
  const result = await this.officesRepository.softDelete({
    id: In(userIds),
    type: officeType,
  });
  await this.invalidateCache();
  return result;
}
  async getOfficeByIdAndType(id: string, officeType: OFFICE_TYPE): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}:idtype:${id}:${officeType}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const result = await this.officesRepository
      .createQueryBuilder('offices')
      .leftJoin('offices.address', 'address')
      .select([
        'offices.id',
        'offices.name',
        'offices.officeEmail',
        'offices.contactNumber',
        'offices.cFirstName',
        'offices.cMiddleName',
        'offices.cLastName',
        'offices.notes',
        'offices.type',
        'address.id',
        'address.address1',
        'address.address2',
        'address.location',
        'address.city',
        'address.state',
        'address.pincode',
      ])
      .where('offices.id = :id AND offices.type = :officeType', { id, officeType })
      .getOne();

    if (result) await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }
  async getOfficeById(id: string): Promise<OfficesData | null> {
    const cacheKey = `${this.CACHE_PREFIX}:id:${id}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const result = await this.officesRepository.findOne({
      where: { id },
      relations: ['address'],
    });
    if (result) await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }



  async getOfficesByType(officeType: OFFICE_TYPE): Promise<OfficesData[]> {
    const cacheKey = `${this.CACHE_PREFIX}:type:${officeType}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    console.log(`Fetching offices with type: ${officeType}`);
    const result = await this.officesRepository.find({
      where: { type: officeType },
      relations: ['address'],
    });
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  async getAllByFilterDataOffice(): Promise<Pick<OfficesData, 'id' | 'name' | 'type'>[]> {
    const cacheKey = `${this.CACHE_PREFIX}:filter`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const result = await this.officesRepository.find({
      select: ['id', 'name', 'type'],
    });
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }
    
  async getOfficesByType1(officeType: OFFICE_TYPE, queryOptions: PaginationOptions): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}:list:${officeType}:${JSON.stringify(queryOptions)}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    let queryBuilder = this.officesRepository
      .createQueryBuilder('offices')
      .leftJoin('offices.address', 'address')
      .select([
        'offices.id',
        'offices.name',
        'offices.officeEmail',
        'offices.contactNumber',
        'offices.cFirstName',
        'offices.cMiddleName',
        'offices.cLastName',
        'offices.notes',
        'offices.type',
        'address.id',
        'address.location',
        'address.city',
        'address.state',
        'address.pincode',
      ])
      .where('offices.type = :officeType', { officeType })
      .orderBy('offices.createdAt', 'DESC');

    const result = await buildQuery(queryBuilder, queryOptions, 'offices');
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }
  async getAllOffice(): Promise<OfficesData[]> {
    const cacheKey = `${this.CACHE_PREFIX}:all`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const result = await this.officesRepository.find({
      relations: ['address'],
    });
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }
  async deleteOffice(id: string, officeType: OFFICE_TYPE): Promise<boolean> {
    // Find the office by ID and type
    const office = await this.officesRepository.findOne({
      where: { id, type: officeType },
    });
  
    if (!office) {
      throw new AppError(404, `Office with ID ${id} and type ${officeType} not found`);
    }
  
    // Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)
  
    // Log the scheduled deletion
    console.log(`Office with ID ${id} and type ${officeType} marked for deletion in 6 months at ${sixMonthsFromNow}`);
  
    // Set the deletionScheduledAt field for the office
    office.deletionScheduledAt = sixMonthsFromNow;
  
    // Save the updated office with the scheduled deletion date
    await this.officesRepository.save(office);
  
    console.log(`Office with ID ${id} and type ${officeType} marked for deletion in 6 months.`);
    await this.invalidateCache(id);
    return true;
  }
  
}
