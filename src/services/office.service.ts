import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { OfficesRepository } from "../repositories/offices.repository";
import { AddressService } from "./address.service";
import { OFFICE_TYPE, OfficesData } from "../entities/offices.entity";
import { AuditLogService } from "./auditLog.service";
import AppError from "../utils/appError";
import { buildQuery, PaginationOptions } from "../utils/pagination";

@injectable()
export class OfficesService {
  constructor(
    @inject(TYPES.OfficesRepository)
    private readonly officesRepository: OfficesRepository,
    @inject(TYPES.AddressService)
    private readonly addressService: AddressService,
    @inject(TYPES.AuditLogService)private readonly auditLogService: AuditLogService,
  ) {}
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

    return this.officesRepository.save(office);
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
    return this.officesRepository.save(office);
  }

  async getOfficeByIdAndType(id: string, officeType: OFFICE_TYPE): Promise<OfficesData | null> {
    return this.officesRepository.findOne({
      where: {
        id,
        type: officeType,
      },
      relations: ['address'],
    });
  }
async getOfficeById(id: string): Promise<OfficesData | null> {
    return this.officesRepository.findOne({
      where: {
        id,
       
      },
      relations: ['address'],
    });
  }



  async getOfficesByType(officeType: OFFICE_TYPE): Promise<OfficesData[]> {
    console.log(`Fetching offices with type: ${officeType}`)
    return this.officesRepository.find({
      where: { type: officeType },
      relations: ['address'], // Include related address if needed
    });
  }

    async getAllByFilterDataOffice(): Promise<Pick<OfficesData, 'id' | 'name' | 'type'>[]> {
      
      return this.officesRepository.find({
        select: ['id', 'name', 'type'],  
      });
    }
    
  async getOfficesByType1(officeType: OFFICE_TYPE,queryOptions:PaginationOptions): Promise<any> {
    console.log(`Fetching offices with type: ${officeType}`)
    let queryBuilder=await this.officesRepository.createQueryBuilder('offices')
    .leftJoinAndSelect('offices.address','address')
    .where('offices.type = :officeType', { officeType })
    .orderBy('offices.createdAt', 'DESC');

   const result = await buildQuery(queryBuilder, queryOptions, "offices");
   return result;
  }
  async getAllOffice(): Promise<OfficesData[]> {
   
    return this.officesRepository.find({
     
      relations: ['address'], // Include related address if needed
    });
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
    return true;
  }
  
}
