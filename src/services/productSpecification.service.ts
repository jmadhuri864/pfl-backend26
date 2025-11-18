import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { ProductSpecificationCustRepository } from '../repositories/productspecification.repository';
import { ProductSpecification } from '../entities/productSpecificationCust.entity';
import { AuditLogService } from './auditLog.service';
 // Adjust the path as needed

@injectable()
export class ProductSpecificationCustService {
  constructor(
    @inject(TYPES.ProductSpecificationCustRepository)
    private readonly productSpecificationCustRepository: ProductSpecificationCustRepository,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService
  ) {}

  // Create a new product specification
  public async create(data: Partial<ProductSpecification>): Promise<ProductSpecification> {
    const productSpec = this.productSpecificationCustRepository.create(data);
    return await this.productSpecificationCustRepository.save(productSpec);
  }

  // Get all product specifications
  public async getAll(): Promise<ProductSpecification[]> {
    return await this.productSpecificationCustRepository.find({  order: {
      createdAt: 'DESC', // Assuming createdAt is a timestamp field 
    },});
  }

  // Get a product specification by ID
public async getById(id: string): Promise<ProductSpecification | null> {
    return await this.productSpecificationCustRepository.findOne({
      where: { id }
    });
  }
  

 // Update a product specification by ID
public async update(
  id: string,
  data: Partial<ProductSpecification>,
  updatedBy: string
): Promise<ProductSpecification | undefined> {
  // Retrieve the existing product specification
  const existingSpec = await this.productSpecificationCustRepository.findOne({ where: { id } });

  if (!existingSpec) {
    throw new Error(`ProductSpecification with ID ${id} not found`);
  }

  // Save the original data for audit logging
  const oldData = { ...existingSpec };

  // Apply updates to the product specification
  Object.assign(existingSpec, data);

  // Save the updated product specification
  const updatedSpec = await this.productSpecificationCustRepository.save(existingSpec);

  // Log the changes using AuditLogService
  await this.auditLogService.logChange(
    'ProductSpecification', // Entity name
    id,                     // Entity ID
    oldData,                // Original data
    updatedSpec,            // Updated data
    updatedBy               // User performing the update
  );

  return updatedSpec;
}

  

async delete(id: string): Promise<boolean> {
  // Step 1: Find the product by ID
  const product = await this.productSpecificationCustRepository.findOne({
    where: { id },
  });

  // Step 2: If the product doesn't exist, throw an error
  if (!product) {
    throw new Error(`ProductSpecification with ID ${id} not found`);
  }

  // Step 3: Calculate the date 6 months ahead
  const now = new Date();
  const sixMonthsFromNow = new Date(now);
  sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
  sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

  // Log the scheduled deletion
  console.log(`ProductSpecification with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`);

  // Set the deletionScheduledAt field for the product
  product.deletionScheduledAt = sixMonthsFromNow;

  // Step 4: Save the updated product with the scheduled deletion date
  await this.productSpecificationCustRepository.save(product);

  // Step 5: Soft delete the product (commented out to keep it scheduled)
  // await this.productRepository.softDelete(id);

  // Step 6: Return true to indicate the deletion was scheduled and performed
  console.log(`ProductSpecification with ID ${id} marked for deletion in 6 months.`);
  return true;
}

}
