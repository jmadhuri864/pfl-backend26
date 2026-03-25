// src/services/product_classification.service.ts
import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { DataSource, In } from "typeorm";
import { ProductClassificationRepository } from "../repositories/product_classification.repository";
import { ProductClassification } from "../entities/product_classification.entity";
import { AuditLogService } from "./auditLog.service";
import AppError from "../utils/appError";
import { buildQuery, PaginationOptions } from "../utils/pagination";

@injectable()
export class ProductClassificationService {
  constructor(
    
    @inject(TYPES.ProductClassificationRepository)
    private readonly productClassificationRepository: ProductClassificationRepository,
    @inject(TYPES.AuditLogService)private readonly auditLogService: AuditLogService,
    
  ) {}

  
 async findAll(queryOptions: PaginationOptions): Promise<any> {
    const queryBuilder = await this.productClassificationRepository.createQueryBuilder('productClassification');
//console.log(queryBuilder)
    // Use the buildQuery function to apply pagination, filters, search, and sorting
    const result = await buildQuery(queryBuilder, queryOptions, 'productClassification');
//console.log("result is ",result)

return{
  data:result.data.map((pro)=>{
    return{
      id:pro.id,
      name:pro.name
    }
  }
),
meta:result.meta
}
    //return result;
  }
  async findById(id: string): Promise<ProductClassification | null> {
    return this.productClassificationRepository.findOne({
      where: { id },
     
    });
  }
  async getById(id: string): Promise<ProductClassification | null> {
    return this.productClassificationRepository.findOne({
      where: { id },
       // Load related entities
    });
  }
  async create(productClassificationData:any): Promise<any> {
    const productClassification = this.productClassificationRepository.create(productClassificationData);
    return this.productClassificationRepository.save(productClassification);
  }

  public async update(
    id: string,
    productClassificationData: Partial<ProductClassification>,
    updatedBy: string
  ): Promise<ProductClassification | null> {
    // Step 1: Retrieve the existing classification
    const existingProductClassification = await this.productClassificationRepository.findOneBy({ id });

    if (!existingProductClassification) {
      throw new Error(`Product classification with ID ${id} not found`);
    }

    // Step 2: Capture the current state for audit purposes
    const oldData = { ...existingProductClassification };

    // Step 3: Update the classification with new data
    Object.assign(existingProductClassification, productClassificationData);

    // Step 4: Log changes to the audit log
    await this.auditLogService.logChange(
      'ProductClassification',
      id,
      oldData,
      productClassificationData,
      updatedBy
    );

    // Step 5: Save the updated classification
    return this.productClassificationRepository.save(existingProductClassification);
  }

  public async delete(id: string): Promise<boolean> {
    // Step 1: Find the product classification by ID
    const classification = await this.productClassificationRepository.findOne({
      where: { id },
    });
  
    // Step 2: If the classification doesn't exist, throw an error
    if (!classification) {
      throw new AppError(400,`Product classification with ID ${id} not found`);
    }
  
    // Step 3: Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)
  
    // Log the scheduled deletion
    console.log(`Product classification with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`);
  
    // Set the deletionScheduledAt field for the classification
    classification.deletionScheduledAt = sixMonthsFromNow;
  
    // Step 4: Save the classification with the scheduled deletion date
    await this.productClassificationRepository.save(classification);
  
    // Step 5: Return true to indicate the deletion was scheduled
    console.log(`Product classification with ID ${id} marked for deletion in 6 months.`);
    return true;
  }
  async softDeleteClassification(userIds: string[]) {

  const result = await this.productClassificationRepository.softDelete({
    id: In(userIds)
  });

  return result;
}
  
}
