import { inject, injectable } from 'inversify';
import * as fs from 'fs';
import * as XLSX from "xlsx";
import { TYPES } from '../types';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../entities/product.entity';

import { AuditLogService } from './auditLog.service';
import { QualityParameterRepository } from '../repositories/qualityParameter.repository';

import { ProductCategory } from '../entities/product_category.entity';
import { ProductSubcategory } from '../entities/product_subcategory.entity';
import { ProductClassification } from '../entities/product_classification.entity';
import { UOM } from '../entities/uom.entity';
import csvParser from 'csv-parser';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import { ProductVarientsRepository } from '../repositories/productVarients.repository';
import { ProductVarientRepository } from '../repositories/varients.repository';
import {
  generateVariantCode,
  getVariantIdentifier,
  ProductVarientsService,
} from './varients.service';
import { AppDataSource } from '../utils/data-source';
import { ProductVarient } from '../entities/productVarient.entity';
import { QualityParameter } from '../entities/quantityParameter.entity';

@injectable()
export class ProductService {
  private productRepository = this.dataSource.getRepository(Product);

  private categoryRepository: Repository<ProductCategory>;
  private subcategoryRepository: Repository<ProductSubcategory>;
  private classificationRepository: Repository<ProductClassification>;
  private uomRepository: Repository<UOM>;

  constructor(
    @inject(TYPES.DataSource)
    private dataSource: DataSource,
    @inject(TYPES.AuditLogService)
    private auditLogService: AuditLogService,
    @inject(TYPES.ProductVarientsService)
    private productVarientService: ProductVarientsService,
    @inject(TYPES.QualityParameterRepository)
    private qualityParameterRepository: QualityParameterRepository,
    // @inject(TYPES.ProductVarientsRepository)
    // private productVarientsRepository: ProductVarientsRepository,

    @inject(TYPES.ProductVarientRepository)
    private productVarientsRepository: ProductVarientRepository,
  ) {
    this.categoryRepository = this.dataSource.getRepository(ProductCategory);
    this.subcategoryRepository =
      this.dataSource.getRepository(ProductSubcategory);
    this.classificationRepository = this.dataSource.getRepository(
      ProductClassification,
    );
    this.uomRepository = this.dataSource.getRepository(UOM);
  }

  public generateCombinations(
    counts: string[] = [],
    sizes: string[] = [],
    varieties: string[] = [],
    origins: string[] = [],
  ) {
    const c = Array.isArray(counts) && counts.length ? counts : [null];
    const s = Array.isArray(sizes) && sizes.length ? sizes : [null];
    const v = Array.isArray(varieties) && varieties.length ? varieties : [null];
    const o = Array.isArray(origins) && origins.length ? origins : [null];

    const combinations = [];

    for (const count of c) {
      for (const size of s) {
        for (const variety of v) {
          for (const productOrigin of o) {
            combinations.push({ count, size, variety, productOrigin });
          }
        }
      }
    }

    return combinations;
  }

  private async generateProductCode(prefix: string): Promise<string> {
    const existing = await this.productRepository
      .createQueryBuilder('product')
      .where(
        'product.prefix = :prefix AND product.productCode LIKE :likePattern',
        {
          prefix,
          likePattern: `${prefix}%`,
        },
      )
      .orderBy('product.productCode', 'DESC')
      .getOne();

    let nextNumber = 1;

    if (existing?.productCode) {
      const numberPart = existing.productCode.replace(prefix, '');
      const parsed = parseInt(numberPart, 10);
      if (!isNaN(parsed)) {
        nextNumber = parsed + 1;
      }
    }

    const padded = nextNumber.toString().padStart(4, '0');
    return `${prefix}${padded}`;
  }

  async create(dto: any): Promise<any> {
    const prefix = dto.prefix?.toUpperCase();
    if (!prefix) {
      throw new Error('Prefix is required for generating product code');
    }

    const productCode = await this.generateProductCode(prefix);
    dto.productCode = productCode;

    const product = this.productRepository.create(dto);
    const savedProduct = await this.productRepository.save(product);

    const savedProduct1 = Array.isArray(savedProduct)
      ? savedProduct[0]
      : savedProduct;

    if (dto.varient) {
      dto.varient.product = savedProduct;
      (dto.varient.variantName = await getVariantIdentifier(
        savedProduct1.name,
        dto.varient.count,
        dto.varient.size,
        dto.varient.variety,
        dto.varient.origin,
        dto.varient.brand,
      )),
        (dto.varient.variantCode = await generateVariantCode(
          savedProduct1.id,
          savedProduct1.prefix,
          dto.varient.count,
          dto.varient.size,
        ));
      const variantEntity = this.productVarientsRepository.create(dto.varient);

      await this.productVarientsRepository.save(variantEntity);
    }

    return savedProduct;
  }

  async getAll(options: PaginationOptions): Promise<any> {
    const queryBuilder = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.classification', 'classification')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.subcategory', 'subcategory')
      .leftJoinAndSelect('product.uom', 'uom')
      .leftJoinAndSelect('product.qualityParameters', 'qualityParameters')
      .orderBy('product.createdAt', 'DESC');

    return await buildQuery(queryBuilder, options, 'product');
  }

  async getAllwithSearch(search?: string): Promise<any> {
    console.log(search);
    const queryBuilder = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.classification', 'classification')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.subcategory', 'subcategory')
      .leftJoinAndSelect('product.uom', 'uom')
      .leftJoinAndSelect('product.qualityParameters', 'qualityParameters');

    if (search) {
      queryBuilder.andWhere('product.name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    return await queryBuilder.getMany();
  }

  async getById(id: string): Promise<any> {
    try {
      const product = await this.productRepository
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.classification', 'classification')
        .leftJoinAndSelect('product.variant', 'variants')
        .leftJoinAndSelect('product.category', 'category')
        .leftJoinAndSelect('product.subcategory', 'subcategory')
        .leftJoinAndSelect('product.uom', 'uom')
        .leftJoinAndSelect('product.qualityParameters', 'qualityParameters')
        .select([
          'product.id',
          'product.name',
          'product.image',
          'product.description',
          'product.prefix',
          'product.packingType',
          'product.shelfLife',
          'product.storageTemp',
          'classification.id',
          'category.id',
          'subcategory.id',
          'uom.id',
          'qualityParameters',
          //'variants.varientName',
          'variants.count',
          'variants.size',
          'variants.variety',
          'variants.origin',
          'variants.brand',
          'variants.thresholdStock',
        ])
        .where('product.id = :id', { id })
        .getOne();

      if (!product) {
        throw new Error('Product not found');
      }

      const response = {
        id: product.id,
        name: product.name,
        image: product.image,
        description: product.description,
        prefix: product.prefix,
        packingType: product.packingType,
        shelfLife: product.shelfLife,
        storageTemp: product.storageTemp,
        classification: product.classification?.id || null,
        category: product.category?.id || null,
        subcategory: product.subcategory?.id || null,
        uom: product.uom?.id || null,
        qualityParameters: product.qualityParameters,
        variant:
          product.variant?.map((v) => ({
            variantCode: v.variantCode,
            count: v.count,
            size: v.size,
            variety: v.variety,
            origin: v.origin,
            brand: v.brand,
            thresholdStock: v.thresholdStock,
          })) || [],
      };

      return response;
    } catch (error) {
      console.error('Error fetching product by ID:', error);
      throw new Error('Unable to fetch the product.');
    }
  }

  async getAllByFilter(queryOptions: PaginationOptions): Promise<any> {
    try {
      const queryBuilder = this.productRepository
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.classification', 'classification')
        .leftJoinAndSelect('product.category', 'category')
        .leftJoinAndSelect('product.subcategory', 'subcategory')
        .leftJoinAndSelect('product.uom', 'uom')
        .leftJoinAndSelect('product.qualityParameters', 'qualityParameters')
        .select([
          'product.id',
          'product.name',
          'product.description',
          'product.productCode',
        ]);

      return await buildQuery(queryBuilder, queryOptions, 'product');
    } catch (error) {
      console.error('Error fetching products:', error);
      throw new Error('Unable to fetch the products.');
    }
  }

  async getVarientByProductId(id: string): Promise<any> {
    const product = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.variant', 'variants')
      .where('product.id = :id', { id })
      .getOne();

    if (!product) {
      throw new Error('Product not found');
    }

    
    return {
     
      variants: product.variant?.map((v) => ({
        id: v.id,
        variantName: v.variantName,
        variantCode: v.variantCode,
        count: v.count,
        size: v.size,
        variety: v.variety,
        origin: v.origin,
        brand: v.brand,
      
      })) || [],
    };
  }

  async getPartialByID(id: string): Promise<any> {
    try {
      const product = await this.productRepository
        .createQueryBuilder('product')
        .select(['product.id', 'product.name', 'product.description','product.productCode'])
        .where('product.id = :id', { id })
        .getOne();

      if (!product) {
        throw new Error('Product not found');
      }
      return product;
      // Transforming the response to match the desired structure
      // const response = {

      //     id: product.id,
      //     name: product.name,
      //     image: product.image,
      //     description: product.description,
      //     productCode: product.productCode,
      //     productOrigin: product.productOrigin,
      //     count: product.count,
      //     size: product.size,
      //     variety: product.variety,
      //     brand: product.brand

      // };

      // return response;
    } catch (error) {
      console.error('Error fetching product by ID:', error);
      throw new Error('Unable to fetch the product.');
    }
  }
  async getByproductNameFilter(search: string): Promise<any> {
    try {
      console.log(search);
      const product = await this.productRepository
        .createQueryBuilder('product')
        .select(['product.id', 'product.name', 'product.description'])
        .where('product.name ILIKE :search', { search: `%${search}%` })
        .getMany();

      return product;
    } catch (error) {
      throw new Error(`Error fetching product: ${error}`);
    }
  }
  async createProductWithExcel(filePath: string): Promise<any> {
  console.log("In create product");
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  console.log("Sheet names found:", sheetNames);

  const productRepository = AppDataSource.getRepository(Product);
  const uomRepository = AppDataSource.getRepository(UOM);
  const categoryRepository = AppDataSource.getRepository(ProductCategory);
  const subcategoryRepository = AppDataSource.getRepository(ProductSubcategory);

  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    console.log("Processing sheet:", sheetName);

    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

    if (jsonData.length < 2) {
      console.warn("Sheet does not have enough rows:", sheetName);
      continue;
    }

    const headers: string[] = (jsonData[0] as any[]).map((h: any) =>
      h ? String(h).trim() : `UNKNOWN`
    );
    console.log("Headers found:", headers);

    const dataRows = jsonData.slice(1); // Skip header row
    console.log("Number of data rows:", dataRows.length);

    for (const rowUntyped of dataRows) {
      if (!Array.isArray(rowUntyped) || rowUntyped.length === 0) continue;

      const rowData: Record<string, any> = {};
      headers.forEach((header, index) => {
        rowData[header] = rowUntyped[index];
      });

      console.log("Mapped Row:", rowData);

      if (!rowData["Product Name"]) {
        console.warn("Skipping incomplete row:", rowData);
        continue;
      }

      const productCode = await this.generateProductCode(rowData["Product Code Prefix"]);

      // --- Product Base ---
      const product = new Product();
      product.name = rowData["Product Name"];
      product.productCode = productCode;
      product.description = rowData["Description"];
      product.image = rowData["Product Image"];
      product.prefix = rowData["Product Code Prefix"];
      product.packingType = rowData["Packing Type"];
      product.shelfLife = rowData["Shelf Life (Days)"];
      product.storageTemp = rowData["Storage Temp (°C)"];

      // --- Classification ---
      if (rowData["Classification"]) {
        let classification = await this.classificationRepository.findOne({ where: { name: rowData["Classification"] } });
        if (!classification) {
          classification = this.classificationRepository.create({ name: rowData["Classification"] });
          classification = await this.classificationRepository.save(classification);
        }
        product.classification = classification;
      }

      // --- UOM ---
      if (rowData["UOM"]) {
        let uom = await uomRepository.findOne({ where: { unit: rowData["UOM"] } });
        if (!uom) {
          uom = uomRepository.create({
            unit: rowData["UOM"],
            abbreviation: rowData["UOM Abbreviation"] || null,
            description: rowData["UOM Description"] || null,
          });
          uom = await uomRepository.save(uom);
        }
        product.uom = uom;
      }

      // --- Category & Subcategory ---
      const categoryName = rowData["Category"];
      const subcategoryName = rowData["Subcategory"];

      if (categoryName) {
        let category = await categoryRepository.findOne({ where: { name: categoryName } });
        if (!category) {
          category = categoryRepository.create({ name: categoryName });
          category = await categoryRepository.save(category);
        }
        product.category = category;

        if (subcategoryName) {
          let subcategory = await subcategoryRepository.findOne({
            where: { name: subcategoryName, category: { id: category.id } },
          });
          if (!subcategory) {
            subcategory = subcategoryRepository.create({ name: subcategoryName, category });
            subcategory = await subcategoryRepository.save(subcategory);
          }
          product.subcategory = subcategory;
        }
      }

      // --- Variants ---
      product.variant = [];
      let i = 1;
      while (rowData[`Variant${i}.Count`]) {
        const pv = new ProductVarient();
        pv.count = rowData[`Variant${i}.Count`] || null;
        pv.size = rowData[`Variant${i}.Size`] || null;
        pv.variety = rowData[`Variant${i}.Variety`] || null;
        pv.origin = rowData[`Variant${i}.Origin`] || null;
        pv.brand = rowData[`Variant${i}.Brand`] || null;
        pv.thresholdStock = rowData[`Variant${i}.Threshold Stock`] || null;
        product.variant.push(pv);
        i++;
      }

      // --- Quality Parameters ---
      product.qualityParameters = [];
      let j = 1;
      while (rowData[`Parameter${j}.Name`]) {
        const qp = new QualityParameter();
        qp.name = rowData[`Parameter${j}.Name`] || null;
        qp.type = rowData[`Parameter${j}.Type`] || "good";
        product.qualityParameters.push(qp);
        j++;
      }

      // --- Save Product ---
      console.log("Saving product:", product.name);
      const result = await productRepository.save(product);
      console.log("Saved product with ID:", result.id);
    }
  }
}

  //   async update(id: string, productData: any, updatedBy: string): Promise<any> {
  //     const product = await this.productRepository.findOne({
  //       where: { id },
  //       relations: ['qualityParameters', 'category', 'subcategory', 'uom','variant'],
  //     });
  //     console.log(product);
  //     if (productData?.qualityParameters) {
  //       let paramets = await this.qualityParameterRepository.save(
  //         productData.qualityParameters,
  //       );
  //     }
  //     if (productData?.variant) {
  //       productData.varient.product = savedProduct;
  //       productData.varient.variantCode = await generateVariantCode(

  //     productData.prefix,
  //     productData.varient.count,
  //     productData.varient.size
  // );

  //       let variants = await this.productVarientsRepository.save(productData.variant);

  //     }

  //     if (product) {
  //       const oldData = { ...product };
  //       Object.assign(product, productData);

  //       const updatedProduct = await this.productRepository.save(product);

  //       // Log changes
  //       await this.auditLogService.logChange(
  //         'Product',
  //         id,
  //         oldData,
  //         updatedProduct,
  //         updatedBy,
  //       );

  //       return updatedProduct;
  //     }
  //     return null;
  //   }

  // async update(id: string, productData: any, updatedBy: string): Promise<any> {
  //   console.log("product data received for update is ",productData);
  //   const product = await this.productRepository.findOne({
  //     where: { id },
  //     relations: ['qualityParameters', 'category', 'subcategory', 'uom', 'variant'],
  //   });

  //   if (!product) {
  //     throw new Error(`Product with ID ${id} not found`);
  //   }

  //   // Keep old data for audit log
  //   const oldData = { ...product };

  //   // Handle quality parameters update
  //   if (productData?.qualityParameters) {
  //     await this.qualityParameterRepository.save(
  //       productData.qualityParameters.map((qp: any) => ({
  //         ...qp,
  //         product,
  //       })),
  //     );
  //   }

  // console.log("product data is ",product.variant);
  //   // Update product base fields
  //   //Object.assign(product, productData);
  //   const updatedProduct = await this.productRepository.save(product);
  // console.log("product id is ",updatedProduct.id);

  // for (const variantData of productData.variant) {
  //   const existingVariant = await this.productVarientsRepository.findOne({
  //     where: {
  //       product: { id: updatedProduct.id },
  //       count: variantData.count,
  //       size: variantData.size,
  //       variety: variantData.variety,
  //       origin: variantData.origin,
  //       brand: variantData.brand,
  //     },
  //   });

  //   if (existingVariant) {
  //     // ✅ Update and keep relation
  //     await this.productVarientsRepository.save({
  //       ...existingVariant,
  //       ...variantData,
  //       product: updatedProduct,  // make sure relation is not null
  //       productName: updatedProduct.name,
  //       variantName: await getVariantIdentifier(
  //         updatedProduct.name,
  //         variantData.count,
  //         variantData.size,
  //         variantData.variety,
  //         variantData.origin,
  //         variantData.brand,
  //       ),
  //     });
  //   } else {
  //     // ✅ Create new with relation
  //     const newVariant = this.productVarientsRepository.create({
  //       ...variantData,
  //       product: updatedProduct,  // important!
  //       productName: updatedProduct.name,
  //       variantName: await getVariantIdentifier(
  //         updatedProduct.name,
  //         variantData.count,
  //         variantData.size,
  //         variantData.variety,
  //         variantData.origin,
  //         variantData.brand,
  //       ),
  //       variantCode: await generateVariantCode(
  //         updatedProduct.id,
  //         updatedProduct.prefix,
  //         variantData.count,
  //         variantData.size,
  //       ),
  //     });

  //     await this.productVarientsRepository.save(newVariant);
  //   }
  // }

  //   // Log audit changes
  //   await this.auditLogService.logChange(
  //     'Product',
  //     id,
  //     oldData,
  //     updatedProduct,
  //     updatedBy,
  //   );

  //   // No need to save product again (already done)
  //   return updatedProduct;
  // }

  // async update(id: string, productData: any, updatedBy: string): Promise<any> {
  //   const product = await this.productRepository.findOne({
  //     where: { id },
  //     relations: [
  //       'qualityParameters',
  //       'category',
  //       'subcategory',
  //       'uom',
  //       'variant',
  //     ],
  //   });

  //   if (!product) {
  //     throw new Error(`Product with ID ${id} not found`);
  //   }

  //   const oldData = { ...product };

  //   if (productData?.qualityParameters) {
  //     await this.qualityParameterRepository.save(
  //       productData.qualityParameters.map((qp: any) => ({
  //         ...qp,
  //         product,
  //       })),
  //     );
  //   }

  //   console.log('existing product variants are:', product.variant);

  //   const updatedProduct = await this.productRepository.save({
  //     ...product,
  //     ...productData,
  //   });
  //   console.log('product id is ', updatedProduct.id);

  //   for (const variantData of productData.variant) {
  //     const existingVariant = await this.productVarientsRepository.findOne({
  //       where: {
  //         product: { id: updatedProduct.id },
  //         count: variantData.count,
  //         size: variantData.size,
  //         variety: variantData.variety,
  //         origin: variantData.origin,
  //         brand: variantData.brand,
  //       },
  //     });

  //     console.log('Existing variant found:', existingVariant?.id);
  //     if (existingVariant) {
  //       const updatedVariant = {
  //         ...variantData,
  //         ...existingVariant,
  //         product: updatedProduct,
  //         productName: updatedProduct.name,
  //         variantName: await getVariantIdentifier(
  //           updatedProduct.name,
  //           variantData.count,
  //           variantData.size,
  //           variantData.variety,
  //           variantData.origin,
  //           variantData.brand,
  //         ),
  //         variantCode: await generateVariantCode(
  //           updatedProduct.id,
  //           updatedProduct.prefix,
  //           variantData.count,
  //           variantData.size,
  //         ),
  //       };

  //       await this.productVarientsRepository.save(updatedVariant);
  //     } else {
  //       const newVariant = this.productVarientsRepository.create({
  //         ...variantData,
  //         product: updatedProduct,
  //         productName: updatedProduct.name,
  //         variantName: await getVariantIdentifier(
  //           updatedProduct.name,
  //           variantData.count,
  //           variantData.size,
  //           variantData.variety,
  //           variantData.origin,
  //           variantData.brand,
  //         ),
  //         variantCode: await generateVariantCode(
  //           updatedProduct.id,
  //           updatedProduct.prefix,
  //           variantData.count,
  //           variantData.size,
  //         ),
  //       });

  //       await this.productVarientsRepository.save(newVariant);
  //     }
  //   }

  //   await this.auditLogService.logChange(
  //     'Product',
  //     id,
  //     oldData,
  //     updatedProduct,
  //     updatedBy,
  //   );

  //   return updatedProduct;
  // }
  async update(id: string, productData: any, updatedBy: string): Promise<any> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: [
        'qualityParameters',
        'category',
        'subcategory',
        'uom',
        'variant',
      ],
    });

    if (!product) {
      throw new Error(`Product with ID ${id} not found`);
    }

    const oldData = { ...product };

    if (productData?.qualityParameters) {
      await this.qualityParameterRepository.save(
        productData.qualityParameters.map((qp: any) => ({
          ...qp,
          product,
        })),
      );
    }

    console.log('existing product variants are:', product.variant);


    console.log("product data received for update is ",productData.prefix);
    


    if(productData.prefix !== product.prefix){
    const productCode = await this.generateProductCode(productData.prefix);
      productCode.toUpperCase();
      product.productCode = productCode;
    }


    oldData.productCode = productData.productCode;

    const updatedProduct = await this.productRepository.save({
      ...product,
      ...productData,
    });
    console.log('product id is ', updatedProduct.id);

    for (const variantData of productData.variant) {
      const existingVariant = await this.productVarientsRepository.findOne({
        where: {
          product: { id: updatedProduct.id },
          count: variantData.count,
          size: variantData.size,
          variety: variantData.variety,
          origin: variantData.origin,
          brand: variantData.brand,
        },
      });

      console.log('Existing variant found:', existingVariant?.id);
      if (existingVariant) {
        const updatedVariant = {
          ...variantData,
          ...existingVariant,
          product: updatedProduct,
          productName: updatedProduct.name,
          variantName: await getVariantIdentifier(
            updatedProduct.name,
            variantData.count,
            variantData.size,
            variantData.variety,
            variantData.origin,
            variantData.brand,
          ),
          variantCode: await generateVariantCode(
            updatedProduct.id,
            updatedProduct.prefix,
            variantData.count,
            variantData.size,
          ),
        };

        await this.productVarientsRepository.save(updatedVariant);
      } else {
        const newVariant = this.productVarientsRepository.create({
          ...variantData,
          product: updatedProduct,
          productName: updatedProduct.name,
          variantName: await getVariantIdentifier(
            updatedProduct.name,
            variantData.count,
            variantData.size,
            variantData.variety,
            variantData.origin,
            variantData.brand,
          ),
          variantCode: await generateVariantCode(
            updatedProduct.id,
            updatedProduct.prefix,
            variantData.count,
            variantData.size,
          ),
        });

        await this.productVarientsRepository.save(newVariant);
      }
    }

    await this.auditLogService.logChange(
      'Product',
      id,
      oldData,
      updatedProduct,
      updatedBy,
    );

    return updatedProduct;
  }


  async delete(id: string): Promise<boolean> {
    const product = await this.productRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new Error(`Product with ID ${id} not found`);
    }

    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

    // Log the scheduled deletion
    console.log(
      `Product with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`,
    );

    // Set the deletionScheduledAt field for the product
    product.deletionScheduledAt = sixMonthsFromNow;

    // Step 4: Save the updated product with the scheduled deletion date
    await this.productRepository.save(product);

    // Step 5: Soft delete the product
    //await this.productRepository.softDelete(id);

    // Step 6: Return true to indicate the deletion was scheduled and performed
    console.log(`Product with ID ${id} marked for deletion in 6 months.`);
    return true;
  }

  //   async uploadProducts(filePath: string): Promise<void> {
  //     const products: Product[] = [];
  //     let sequenceNumber = await this.productRepository.count(); // Get initial count once

  //     await new Promise<void>((resolve, reject) => {
  //       fs.createReadStream(filePath)
  //         .pipe(csvParser())
  //         .on("data", async (row) => {
  //           try {
  //             console.log("Row Data:", row);

  //             // Fetch related entities
  //             const [category, subcategory, classification, uom] = await Promise.all([
  //               row["Category"] ? this.categoryRepository.findOne({ where: { name: row["Category"] } }):null ,
  //               row["Subcategory"] ? this.subcategoryRepository.findOne({ where: { name: row["Subcategory"] } }):null,
  //               row["Classification"] ? this.classificationRepository.findOne({ where: { name: row["Classification"] } }):null,
  //               row["UOM"] ? this.uomRepository.findOne({ where: { unit: row["UOM"] } }) : null,
  //             ]);

  //             // Create a new Product instance
  //             const product = new Product();
  //             product.name = row["Product Name"];
  //             product.description = row["Description"];
  //             product.productOrigin = row["Origin"];
  //             product.brand = row["Brand"];
  //             product.packingType = row["Packing Type"];
  //             product.shelfLife = row["Shelf Life"] ? parseInt(row["Shelf Life"]) : 0;
  //             product.storageTemp = row["Storage Temp"] ? parseFloat(row["Storage Temp"]) : 0;
  //             product.count = row["Count"] ? row["Count"].split(",").map((item: string) => item.trim()) : [];
  //             product.size = row["Size"] ? row["Size"].split(",").map((item: string) => item.trim()) : [];
  //             product.variety = row["Variety"] ? row["Variety"].split(",").map((item: string) => item.trim()) : [];

  // // Assign relations (ensure they are either null or an entity, not undefined)
  // product.category = category;
  // product.subcategory = subcategory ;
  // product.classification = classification
  // product.uom = uom ;

  //             // Generate product code
  //             product.productCode = await this.getNextProductCode("ARG", product.name);

  //             // Add product to the batch list
  //             products.push(product);
  //           } catch (error) {
  //             console.error("Error processing row:", row, error);
  //           }
  //         })
  //         .on("end", async () => {
  //           try {
  //             // Save all products in a batch
  //             await this.productRepository.save(products);
  //             resolve();
  //           } catch (error) {
  //             console.error("Error saving products:", error);
  //             reject(error);
  //           }
  //         })
  //         .on("error", (error) => reject(error));
  //     });

  //     // Cleanup the uploaded file
  //     fs.unlinkSync(filePath);
  //   }

  async uploadProducts(filePath: string): Promise<void> {
    const results: any[] = [];

    const getOrCreate = async (repo: any, field: string, value: string) => {
      let entity = await repo.findOne({ where: { [field]: value } });
      if (!entity) {
        entity = repo.create({ [field]: value });
        await repo.save(entity);
      }
      return entity;
    };

    try {
      const readStream = fs.createReadStream(filePath).pipe(csvParser());

      for await (const row of readStream) {
        const productName = row['Product Name'];
        if (!productName) continue;

        const classificationId = await getOrCreate(
          this.classificationRepository,
          'name',
          row['Product Classification'],
        );

        const categoryName = row['Product Category'];
        let categoryId = await this.categoryRepository.findOne({
          where: {
            name: categoryName,
            productClassification: classificationId,
          },
        });

        if (!categoryId) {
          categoryId = this.categoryRepository.create({
            name: categoryName,
            productClassification: classificationId,
          });
          await this.categoryRepository.save(categoryId);
        }

        
        const subcategoryName = row['Product Subcategory'];
        let subcategoryId = await this.subcategoryRepository.findOne({
          where: { name: subcategoryName, category: categoryId },
        });

        if (!subcategoryId) {
          subcategoryId = this.subcategoryRepository.create({
            name: subcategoryName,
            category: categoryId,
          });
          await this.subcategoryRepository.save(subcategoryId);
        }

        const uomId = await getOrCreate(this.uomRepository, 'unit', row['UOM']); 

        results.push({
          name: productName,
          classification: classificationId.id, 
          category: categoryId.id, 
          subcategory: subcategoryId.id,
          uom: uomId.id,

          count: row['Count']
            ? row['Count'].split(',').map((c: string) => c.trim())
            : null,
          variety: row['Variety']
            ? row['Variety'].split(',').map((v: string) => v.trim())
            : null,
          size: row['Size']
            ? row['Size'].split(',').map((s: string) => s.trim())
            : null,
          productOrigin: row['Origin']
            ? row['Origin'].split(',').map((o: string) => o.trim())
            : null,
          brand: row['Brand'] || null,
        });
      }

      if (results.length > 0) {
        await this.productRepository.save(results);
      }
    } catch (error) {
      console.error('Error processing CSV:', error);
      throw new Error('Failed to process CSV file');
    } finally {
      fs.unlinkSync(filePath);
    }
  }
  async getVarientsByProductId(id: string): Promise<any> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['variant'],
    });
    if (!product) {
      throw new Error('Product not found');
    }

    const formattedproduct = {
      id: product.id,
      name: product.name,
      variant: product.variant.map((v) => ({
        id: v.id,
        variantName: v.variantName,
        variantCode: v.variantCode,
        count: v.count,
        size: v.size,
        variety: v.variety,
        origin: v.origin,
        brand: v.brand,
        thresholdStock: v.thresholdStock,
      })),
    };

    return formattedproduct;
  }
}
