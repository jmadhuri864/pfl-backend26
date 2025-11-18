import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { DataSource, In } from "typeorm";
import { UOM } from "../entities/uom.entity";
import { UOMRepository } from "../repositories/uom.repository";
import { AuditLogService } from "./auditLog.service";
import { buildQuery, PaginationOptions } from "../utils/pagination";
@injectable()
export class UOMService {
  private UOMRepository: UOMRepository;

  constructor(@inject(TYPES.DataSource) private dataSource: DataSource,
  @inject(TYPES.AuditLogService) private auditLogService: AuditLogService
) {
    this.UOMRepository = this.dataSource.getRepository(UOM) as UOMRepository;
  }
  public async getAll( queryOptions:PaginationOptions): Promise<any> {
    
    let queryBuilder = await  this.UOMRepository.createQueryBuilder('uom')
    .orderBy('uom.createdAt', 'DESC');
  const result = await buildQuery(queryBuilder, queryOptions, 'productClassification');
  return result;
  }
  public async getAllPartial():Promise<any>{
    const uoms = await this.UOMRepository.find({select:{
      id:true,
      unit:true
    }})
    return uoms;
  }

  public async getById(id: string): Promise<UOM | null> {
    return this.UOMRepository.findOneBy({ id });
  }

  public async create(uomData: Partial<UOM>): Promise<UOM> {
    const uom = this.UOMRepository.create(uomData);
    return this.UOMRepository.save(uom);
  }

  public async update(
    id: string,
    uomData: Partial<UOM>,
    updatedBy: string
  ): Promise<UOM | null> {
    // Step 1: Fetch the existing UOM record
    const existingUOM = await this.UOMRepository.findOne({ where: { id } });
  
    if (!existingUOM) {
      throw new Error(`UOM with ID ${id} not found`);
    }
  
    // Step 2: Capture the previous data for audit log
    const oldData = { ...existingUOM };
  
    // Step 3: Update the UOM entity with the new data
    Object.assign(existingUOM, uomData);
  
    // Step 4: Log the changes using the AuditLogService
    await this.auditLogService.logChange(
      'UOM', // Entity name
      id, // Entity ID
      oldData, // Old data
      uomData, // New data
      updatedBy // User who made the update
    );
  
    // Step 5: Save the updated UOM and return it
    await this.UOMRepository.save(existingUOM);
    return this.getById(id); // Assuming `getById` method fetches the UOM by ID
  }
  
  public async delete(id: string): Promise<boolean> {
    // Step 1: Find the UOM by ID
    const uom = await this.UOMRepository.findOne({
        where: { id },
    });

    // Step 2: If the UOM doesn't exist, return false
    if (!uom) {
        return false;
    }

    // Step 3: Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

    // Log the scheduled deletion
    console.log(`UOM with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`);

    // Step 4: Set the deletionScheduledAt field for the UOM
    uom.deletionScheduledAt = sixMonthsFromNow;

    // Step 5: Save the updated UOM with the scheduled deletion date
    await this.UOMRepository.save(uom);

    // Step 6: Return true to indicate the deletion was scheduled
    console.log(`UOM with ID ${id} marked for deletion in 6 months.`);
    return true;
}

public async multipledelete(ids: string[]): Promise<boolean> {
  try {
    const result = await this.UOMRepository.softDelete(ids);

    return result.affected !== 0;
  } catch(err) {
    console.log(err)
    return false;
  }
}



}
