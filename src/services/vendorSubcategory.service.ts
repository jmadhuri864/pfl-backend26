import "reflect-metadata";
import { inject, injectable } from "inversify";
import { DataSource, In } from "typeorm";
import { VendorSubcategoryRepository } from "../repositories/vendorSubcategory.repository";
import { VendorSubcategory } from "../entities/vendorSubcategory.entity";
import { TYPES } from "../types";
import { VendorCategory } from "../entities/vendorCategory.entity";
import { VendorCategoryRepository } from "../repositories/vendorCategory.repository";
import { AuditLogService } from "./auditLog.service";
import AppError from "../utils/appError";
import { buildQuery, PaginationOptions } from "../utils/pagination";

@injectable()
export class VendorSubcategoryService {
  constructor(
    @inject(TYPES.VendorSubcategoryRepository)
    private readonly vendorSubcategoryRepository: VendorSubcategoryRepository,
    @inject(TYPES.VendorCategoryRepository)
    private readonly vendorCategoryRepository: VendorCategoryRepository,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService
  ) {}

  public async create(subcategoryData: {
    name: string;
    category: string;
  }): Promise<VendorSubcategory | null> {
    console.log(
      "to create the category service",
      subcategoryData.name,
      subcategoryData.category
    );

    // Fetch the VendorCategory using the provided category ID
    const vendorCategory = await this.vendorCategoryRepository.findOne({
      where: { id: subcategoryData.category },
    });

    if (!vendorCategory) {
      throw new Error(
        `Vendor category with ID ${subcategoryData.category} not found`
      );
    }

    // Assign the fetched VendorCategory to the subcategory
    const subcategory = this.vendorSubcategoryRepository.create({
      name: subcategoryData.name,
      category: vendorCategory,
    });

    return this.vendorSubcategoryRepository.save(subcategory);
  }

 public async getSubcategories(
    categoryIdOrName?: string
  ): Promise<Partial<VendorSubcategory>[]> {
    const queryBuilder =
      this.vendorSubcategoryRepository.createQueryBuilder("subcategory")
      .leftJoinAndSelect("subcategory.category", "category");

    // Apply the filter if categoryIdOrName is provided
    if (categoryIdOrName) {
      // Check if it's a UUID (36 characters with hyphens) or a name
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryIdOrName);
      
      if (isUUID) {
        // If it's a UUID, search by category ID
        queryBuilder.where("subcategory.categoryId = :categoryId", {
          categoryId: categoryIdOrName,
        });
      } else {
        // If it's not a UUID, search by category name
        queryBuilder.where("category.name = :categoryName", {
          categoryName: categoryIdOrName,
        });
      }
    }

    // Select only the subcategory fields (excluding relations like category)
    queryBuilder.select(["subcategory.id", "subcategory.name"]);

    // Order by createdAt in descending order
    queryBuilder.orderBy("subcategory.createdAt", "DESC");

    return queryBuilder.getMany();
  }
  // public async getByall(): Promise<any> {
  //   const queryBuilder = this.vendorSubcategoryRepository.createQueryBuilder('vendorSubcategory')
  //     .leftJoinAndSelect('vendorSubcategory.category', 'category') // Include category
  //     .orderBy('vendorSubcategory.createdAt', 'DESC'); // Default sorting by createdAt
  // return queryBuilder
  //   // Return paginated results using the paginateQuery utility
  //   //return await paginateQuery(queryBuilder, queryOptions);
  // }
  
  public async getByall(queryOptions:PaginationOptions): Promise<any> {
   

    let baseQuery = await this.vendorSubcategoryRepository.createQueryBuilder('vendorSubcategory')
        .leftJoinAndSelect('vendorSubcategory.category', 'category')
        .orderBy('vendorSubcategory.createdAt', 'DESC');  

return await buildQuery(baseQuery, queryOptions, 'vendorSubcategory');
  }

  public async getById(id: string): Promise<VendorSubcategory | null> {
    return this.vendorSubcategoryRepository.findOne({
      where: { id },
      relations: ["category"], // Ensure correct relation name
    });
  }

  public async update(
    id: string,
    subcategoryData: { name?: string; category?: string },
    updatedBy: string // Added the updatedBy parameter
  ): Promise<VendorSubcategory | null> {
    //console.log("before update ",subcategoryData)
    // Step 1: Retrieve the existing VendorSubcategory to capture the original data
    const existingSubcategory = await this.vendorSubcategoryRepository.findOne({
      where: { id },
    });
    //console.log(existingSubcategory)
    if (!existingSubcategory) {
      return null;
    }

    // Step 2: Merge the new data into the existing VendorSubcategory
    Object.assign(existingSubcategory, subcategoryData);

    // Step 3: Save the updated VendorSubcategory
    const updatedSubcategory = await this.vendorSubcategoryRepository.save(
      existingSubcategory
    );
    //console.log("after update ",updatedSubcategory)
    // Step 4: Log the change using the audit log service
    await this.auditLogService.logChange(
      "VendorSubcategory", // Entity name
      id, // Entity ID
      existingSubcategory, // Original data (before update)
      updatedSubcategory, // Updated data (after update)
      updatedBy // User who made the update
    );

    // Return the updated VendorSubcategory
    return updatedSubcategory;
  }

  public async delete(id: string): Promise<boolean> {
    // Step 1: Find the vendor subcategory by ID
    const vendorSubcategory = await this.vendorSubcategoryRepository.findOne({
      where: { id },
    });

    // Step 2: If the vendor subcategory doesn't exist, return false
    if (!vendorSubcategory) {
      throw new AppError(404, "Vendor Subcategory not found");
    }

    // Step 3: Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

    // Log the scheduled deletion
    console.log(
      `Vendor Subcategory with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`
    );

    // Step 4: Set the deletionScheduledAt field for the vendor subcategory
    vendorSubcategory.deletionScheduledAt = sixMonthsFromNow;

    // Step 5: Save the updated vendor subcategory with the scheduled deletion date
    await this.vendorSubcategoryRepository.save(vendorSubcategory);

    // Step 6: Return true to indicate the deletion was scheduled
    console.log(
      `Vendor Subcategory with ID ${id} marked for deletion in 6 months.`
    );
    return true;
  }
  async softDeleteSubcategory(userIds: string[]) {
  const result = await this.vendorSubcategoryRepository.softDelete({
    id: In(userIds)
  });
  return result;
}


}
