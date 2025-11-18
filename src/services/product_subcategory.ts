import { inject, injectable } from "inversify";
import { DataSource } from "typeorm";
import { TYPES } from "../types";
import { ProductSubcategoryRepository } from "../repositories/product_subcategory.repository";
import { ProductSubcategory } from "../entities/product_subcategory.entity";
import { ProductCategory } from "../entities/product_category.entity";
import { AuditLogService } from "./auditLog.service";
import { buildQuery, PaginationOptions } from "../utils/pagination";

@injectable()
export class ProductSubcategoryService {
  private productSubcategoryRepository: ProductSubcategoryRepository;

  constructor(@inject(TYPES.DataSource) private dataSource: DataSource,
  @inject(TYPES.AuditLogService)private readonly auditLogService: AuditLogService,) {
    this.productSubcategoryRepository = this.dataSource.getRepository(
      ProductSubcategory
    ) as ProductSubcategoryRepository;
  }

  // async getAll(): Promise<ProductSubcategory[]> {
  //   return this.productSubcategoryRepository.find({
  //     relations: ["category", "category.productClassification"], // Load category and productClassification
  //     order: {
  //       createdAt: 'DESC', // Order by createdAt field, assuming it's a timestamp
  //     },
  //   });
  // }

  async getAll(queryOptions: PaginationOptions): Promise<{ data: any[]; meta: any }> {
    let baseQuery = await this.productSubcategoryRepository.createQueryBuilder('productSubcategory')
        .leftJoinAndSelect('productSubcategory.category', 'category')
        .leftJoinAndSelect('category.productClassification', 'productClassification')
        .orderBy('productSubcategory.createdAt', 'DESC');

    // Execute query with pagination
    const subcategories = await buildQuery(baseQuery, queryOptions, 'productSubcategory');

    return {
        data: subcategories.data.map((subcategory) => ({
            id: subcategory.id,
            name: subcategory.name,
            category: subcategory.category
                ? {
                    id: subcategory.category.id,
                    name: subcategory.category.name,
                }
                : null, // Handle case where category is null
            classification: subcategory.category?.productClassification
                ? {
                    id: subcategory.category.productClassification.id,
                    name: subcategory.category.productClassification.name,
                }
                : null, // Handle case where productClassification is null
        })),
        meta: subcategories.meta, // Ensure meta data is returned properly
    };
}


  
  

  async getById(id: string): Promise<ProductSubcategory | null> {
    return this.productSubcategoryRepository.findOne({
      where: { id },
      relations: ["category"], // Ensure category is loaded
    });
  }

  async create(name: string, category: string): Promise<ProductSubcategory> {
    const subcategory = this.productSubcategoryRepository.create({
      name,
      category: { id: category } as ProductCategory, // Correctly assign the category
    });
    return this.productSubcategoryRepository.save(subcategory);
  }

  async update(
    id: string,
    subcategoryData: any,
    updatedBy: string
  ): Promise<ProductSubcategory | null> {
    // Step 1: Retrieve the existing subcategory
    const existingSubcategory = await this.productSubcategoryRepository.findOne({
      where: { id },
      relations: ['category'], // Include relations if needed
    });
  
    if (!existingSubcategory) {
      throw new Error(`Product subcategory with ID ${id} not found`);
    }
  
    // Step 2: Capture current state for audit purposes
    const oldData = { ...existingSubcategory };
  
    // Step 3: Update the subcategory data
    if (subcategoryData.name) {
      existingSubcategory.name = subcategoryData.name;
    }
    if (subcategoryData.category) {
      existingSubcategory.category = { id: subcategoryData.category} as ProductCategory;
    }
  
    // Step 4: Log the changes
    await this.auditLogService.logChange(
      'ProductSubcategory',
      id,
      oldData,
      subcategoryData,
      updatedBy
    );
  
    // Step 5: Save and return the updated subcategory
    return this.productSubcategoryRepository.save(existingSubcategory);
  }
  
  async delete(id: string): Promise<boolean> {
    // Step 1: Find the product subcategory by ID
    const subcategory = await this.productSubcategoryRepository.findOne({
      where: { id },
    });
  
    // Step 2: If the subcategory doesn't exist, throw an error
    if (!subcategory) {
      throw new Error(`Product subcategory with ID ${id} not found`);
    }
  
    // Step 3: Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)
  
    // Log the scheduled deletion
    console.log(`Product subcategory with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`);
  
    // Set the deletionScheduledAt field for the subcategory
    subcategory.deletionScheduledAt = sixMonthsFromNow;
  
    // Step 4: Save the updated subcategory with the scheduled deletion date
    await this.productSubcategoryRepository.save(subcategory);
  
    
  
    // Step 6: Return true to indicate the deletion was scheduled and performed
    console.log(`Product subcategory with ID ${id} marked for deletion in 6 months.`);
    return true;
  }
  
}
