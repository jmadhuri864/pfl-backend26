import { inject, injectable } from "inversify";



import { TYPES } from "../types";
import { ProductCategoryRepository } from "../repositories/product_category.repository";
import { ProductCategory } from "../entities/product_category.entity";

import { ProductClassificationRepository } from "../repositories/product_classification.repository";
import { AuditLogService } from "./auditLog.service";
import AppError from "../utils/appError";
import { buildQuery, PaginationOptions } from "../utils/pagination";
import { In } from "typeorm";


@injectable()
export class ProductCategoryService {
  constructor(
    @inject(TYPES.ProductCategoryRepository)
    private readonly productCategoryRepository:ProductCategoryRepository,
    @inject(TYPES.ProductClassificationRepository)
    private readonly productClassificationRepository: ProductClassificationRepository,
    @inject(TYPES.AuditLogService)private readonly auditLogService: AuditLogService,
    
  ) {}
  async getAll(queryOptions:PaginationOptions): Promise<any> {
    // return this.productCategoryRepository.find({
    //   relations: ["productClassification"],
    //  order: {
    //   createdAt: 'DESC', // Assuming createdAt is a timestamp field 
    // },
    // });

     const queryBuilder = await this.productCategoryRepository.createQueryBuilder('productCategory')
     .leftJoinAndSelect('productCategory.productClassification', 'productClassification')
     .orderBy('productCategory.createdAt', 'DESC');
    
        const result = await buildQuery(queryBuilder, queryOptions, 'productClassification');
        return{
            data:result.data.map((pro)=>{
              return{
                id:pro.id,
                name:pro.name,
                classification: pro?.productClassification
                ? {
                    id: pro.productClassification.id,
                    name: pro.productClassification.name,
                }
                : null,
              }
            }
          ),
          meta:result.meta
          }

        //return result;
      }

  async getById(id: string): Promise<ProductCategory | null> {
    return this.productCategoryRepository.findOne({
      where: { id },
      relations: ["productClassification"],
    });
  }

  
  async create(data: any): Promise<any> {
   // Find the ProductClassification entity by ID
  const productClassification = await this.productClassificationRepository.findOneBy({
    id: data.productClassification
  });

  if (!productClassification) {
    throw new Error('Product Classification not found');
  }
 
    const productCategory = this.productCategoryRepository.create({
      ...data
      });

    return this.productCategoryRepository.save(productCategory);
  }


  public async update(
    id: string,
    categoryData: any, // Dynamic data for updating the category
    updatedBy: string
  ): Promise<ProductCategory | null> {
    // Step 1: Retrieve the existing category
    const category = await this.productCategoryRepository.findOne({
      where: { id },
      relations: ['productClassification'], // Assuming 'classification' is a relation
    });
  
    if (!category) {
      throw new Error(`Product category with ID ${id} not found`);
    }
  
    // Step 2: Capture the current state for audit purposes
    const oldData = {
      name: category.name,
      classificationId: category.productClassification?.id,
    };
  
    // Step 3: Update the category with new data
    if (categoryData.name) {
      category.name = categoryData.name;
    }
  
    // Step 4: Update classification if provided
    if (categoryData.productClassification) {
      const classification = await this.productClassificationRepository.findOne({
        where: { id: categoryData.productClassification},
      });
  
      if (!classification) {
        throw new Error(`Product classification with ID ${categoryData.classificationId} not found`);
      }
  
      category.productClassification = classification;
    }
  
    // Step 5: Log the changes to the audit log
    const newData = {
      name: category.name,
      productClassification: category.productClassification.id,
    };
  
    await this.auditLogService.logChange('ProductCategory', id, oldData, newData, updatedBy);
  
    // Step 6: Save the updated category
    return this.productCategoryRepository.save(category);
  }
  public async delete(id: string): Promise<boolean> {
    // Step 1: Find the product category by ID
    const category = await this.productCategoryRepository.findOne({
      where: { id },
      relations: ['productClassification'], // Include relations if necessary
    });
  
    // Step 2: If the category doesn't exist, throw an error
    if (!category) {
      throw new AppError(400, `Product category with ID ${id} not found`);
    }
  
    // Step 3: Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)
  
    // Log the scheduled deletion
    console.log(`Product category with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`);
  
    // Set the deletionScheduledAt field for the category
    category.deletionScheduledAt = sixMonthsFromNow;
  
    // Step 4: Save the category with the scheduled deletion date
    await this.productCategoryRepository.save(category);
  
    // Step 5: Return true to indicate the deletion was scheduled
    console.log(`Product category with ID ${id} marked for deletion in 6 months.`);
    return true;
  }
  async softDeleteCategory(userIds: string[]) {

  const result = await this.productCategoryRepository.softDelete({
    id: In(userIds)
  });

  return result;
}
}


