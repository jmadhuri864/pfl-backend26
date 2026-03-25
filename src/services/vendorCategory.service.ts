import { inject, injectable } from "inversify";

import { VendorCategoryRepository } from "../repositories/vendorCategory.repository";
import { VendorCategory } from "../entities/vendorCategory.entity";
import { TYPES } from "../types";
import { AuditLogService } from "./auditLog.service";
import AppError from "../utils/appError";
import { buildQuery, PaginationOptions } from "../utils/pagination";
import { In } from "typeorm";


@injectable()
export class VendorCategoryService {
  constructor(
    @inject(TYPES.VendorCategoryRepository)
    private readonly vendorCategoryRepository: VendorCategoryRepository,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService
  ) {}

  
  public async create(
    categoryData: Partial<VendorCategory>
  ): Promise<VendorCategory | null> {
    console.log("in the service", categoryData);
    const category = this.vendorCategoryRepository.create(categoryData);
    console.log("after saving", category);
    return this.vendorCategoryRepository.save(category);
  }

  // public async getCategories(): Promise<VendorCategory[]> {
  //   return this.vendorCategoryRepository.find({
  //     relations: ["vendorSubcategories"], // Adjust relations if needed

  //     order: {
  //       createdAt: "DESC", // Assuming createdAt is a timestamp field
  //     },
  //   });
  // }

  // public async getCategories(queryOptions: any): Promise<any> {
  //   const queryBuilder = this.vendorCategoryRepository.createQueryBuilder('vendorCategory')
  //     .leftJoinAndSelect('vendorCategory.subCategory', 'subCategory') // Include category
  //     .orderBy('vendorCategory.createdAt', 'DESC'); // Default sorting by createdAt
  // return queryBuilder;
  //   // Return paginated results using the paginateQuery utility
  //  // return await paginateQuery(queryBuilder, queryOptions);
  // }
 public async getCategories(queryOptions:PaginationOptions): Promise<any> {
   

    let baseQuery = await this.vendorCategoryRepository.createQueryBuilder('vendorCategory')
        .leftJoinAndSelect('vendorCategory.vendorSubcategories', 'vendorSubcategories')
        .orderBy('vendorCategory.createdAt', 'DESC'); 

 const result=await buildQuery(baseQuery, queryOptions, 'vendorCategory');
 return{
  data:result.data.map((category)=>{
    return{
      id:category.id,
      name:category.name,

    }
  }),
  meta:result.meta
 }
  }
  
  
  public async getById(id: string): Promise<VendorCategory | null> {
    return this.vendorCategoryRepository.findOne({
      where: { id },
      relations: ["vendorSubcategories"], // Adjust relations if needed
    });
  }

  public async update(
    id: string,
    categoryData: Partial<VendorCategory>,
    updatedBy: string
  ): Promise<VendorCategory | null> {
    // Retrieve the existing VendorCategory to log the old data
    const existingCategory = await this.vendorCategoryRepository.findOne({
      where: { id },
    });

    if (!existingCategory) {
      throw new AppError(404, `VendorCategory with id ${id} not found`);
    }

    // Merge and update the category data
    await this.vendorCategoryRepository.update(id, categoryData);

    // Retrieve the updated category for logging purposes
    const updatedCategory = await this.getById(id);

    if (!updatedCategory) {
      throw new AppError(500, "Error retrieving updated category");
    }

    // Log the changes with the audit service
    await this.auditLogService.logChange(
      "VendorCategory", // Entity name
      id, // Entity ID
      existingCategory, // Old data
      updatedCategory, // Updated data
      updatedBy // User who made the update
    );

    return updatedCategory;
  }

  public async delete(id: string): Promise<boolean> {
    // Step 1: Find the vendor category by ID
    const vendorCategory = await this.vendorCategoryRepository.findOne({
      where: { id },
    });

    // Step 2: If the vendor category doesn't exist, return false
    if (!vendorCategory) {
      throw new AppError(404, "Vendor Category not found");
    }

    // Step 3: Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

    // Log the scheduled deletion
    console.log(
      `Vendor Category with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`
    );

    // Step 4: Set the deletionScheduledAt field for the vendor category
    vendorCategory.deletionScheduledAt = sixMonthsFromNow;

    // Step 5: Save the updated vendor category with the scheduled deletion date
    await this.vendorCategoryRepository.save(vendorCategory);

    // Step 6: Return true to indicate the deletion was scheduled
    console.log(
      `Vendor Category with ID ${id} marked for deletion in 6 months.`
    );
    return true;
  }
  async softDeleteCategory(userIds: string[]) {

  const result = await this.vendorCategoryRepository.softDelete({
    id: In(userIds)
  });

  return result;
}
}
