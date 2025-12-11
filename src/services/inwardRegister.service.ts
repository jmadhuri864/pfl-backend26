import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { InwardRepository } from '../repositories/inwardRegister.repository';
import { InwardRegister } from '../entities/inwardRegister.entity';
import AppError from '../utils/appError';

import { LessThanOrEqual, DataSource, SelectQueryBuilder, In } from 'typeorm';
import { AuditLogService } from './auditLog.service';
import { buildQuery, PaginationOptions } from '../utils/pagination';

import { formatDateTime } from '../utils/dateUtils';

import { ProductVarientService } from './productVarient.service';

import { ProductRepository } from '../repositories/product.repository';
import { InventoryStockRepository } from '../repositories/inventoryStock.repository';

import { DocSingalApproverService } from './DocSingalApproverService.service';
import { DocumentbService, DocumentWithRelatedData } from './documentb.service';
import { DocumentStatus, DocumentTypeEnum } from '../entities/docuemnt.entity';
import { DocumentTypeEnum as DocDefEnum } from '../entities/documentdef.entity';
import { ApprovalFlowService } from './approvalFlow.service';
import { InwardProductRepository } from '../repositories/inwardProduct.repository';
import { ProductVarientRepository } from '../repositories/varients.repository';
import { DocumentbRepository } from '../repositories/documentb.repository';


@injectable()
export class InwardRegisterService {
  constructor(
    @inject(TYPES.InwardRepository)
    private readonly inwardRegisterRepo: InwardRepository,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService,

     @inject(TYPES.ProductVarientRepository)
      private productVarientsRepository: ProductVarientRepository,
 

   
    @inject(TYPES.InventoryStockRepository)
    private readonly inventoryStockRepository: InventoryStockRepository,
 
   
     @inject(TYPES.DocSingalApproverService)
        private readonly docSingalApproverService: DocSingalApproverService,
        @inject(TYPES.DocumentbService)
        private readonly documentbService: DocumentbService,
        @inject(TYPES .DocumentbRepository) private documentbRepository: DocumentbRepository,
     
  ) {}

public async createInwardRegister(data: any): Promise<any> {
  try {
    // 1. Normalize variant IDs
    let variantIds: string[] = [];
    if (Array.isArray(data.variants)) {
      variantIds = data.variants;
    } else if (data.variants) {
      variantIds = [data.variants];
    }

    // 2. Fetch variants with product relation
    const variants = await this.productVarientsRepository.find({
      where: { id: In(variantIds) },
      relations: ['product'],
    });

    // 3. Extract product IDs from variants
    const productIds = variants.map(v => v.product?.id).filter(Boolean);

    // 4. Create Inward Register
    const inward = this.inwardRegisterRepo.create({
      ...data,
      variants: variants.map(v => ({ id: v.id })),
      products: productIds.map(id => ({ id })),
    });

    const savedInward = await this.inwardRegisterRepo.save(inward);

    // 5. Auto-create document
    const savedInwardId =
      Array.isArray(savedInward) ? (savedInward[0] as InwardRegister).id : (savedInward as InwardRegister).id;

    const document = await this.documentbService.createDocument({
      type: DocumentTypeEnum.INWARD_REGISTER,
      docDef: DocDefEnum.OPERATION,
      status: DocumentStatus.HOLD,
      remarks: 'Document auto-created with Inward Register',
      lastActionBy: { id: data.requestedBy },
      document_type_id: savedInwardId
    });

    await this.documentbService.startApprovalFlow(document.id);

    // 6. Process inward products into inventory stock
    for (const item of data.inwardProducts) {
      const { variant, quantity, unitPrice, netWeight, productName } = item;

      // Amount calculation
      const amount = +(unitPrice * quantity).toFixed(2);

      // FIND existing stock for (company + product + variant + location)
      const existingStock = await this.inventoryStockRepository.findOne({
        where: {
          company: { id: data.companyName },
          product: { id: productName },
          variant: { id: variant },
          location: { id: data.location },
        },
      });

      if (existingStock) {
        // UPDATE inward stock movement
        existingStock.inwardQty = +(existingStock.inwardQty + netWeight);
        existingStock.inwardAmt = +(existingStock.inwardAmt + amount);

        

        await this.inventoryStockRepository.save(existingStock);

      } else {
        // NEW STOCK ENTRY
        const newStock = this.inventoryStockRepository.create({
          company: { id: data.companyName },
          location: { id: data.location },
          product: { id: productName },
          variant: { id: variant },

          // Inward stock values
          inwardQty: netWeight,
          inwardAmt: amount,

         
        });

        await this.inventoryStockRepository.save(newStock);
      }
    }

    return savedInward;

  } catch (error: any) {
    throw new Error(`Failed to create inward register: ${error.message}`);
  }
}



public async getAllRecycleBinInwardRegisters(queryOptions: PaginationOptions, userId: string): Promise<any> {
    const data = await this.docSingalApproverService.getAllSingleApprovalDocumentsByUserId(
      userId,
      DocumentTypeEnum.INWARD_REGISTER,
    );
    const { search } = queryOptions;
  //  console.log('Fetched documents:', data);
  
    const typedDocuments = data as DocumentWithRelatedData[];
    // Exclude soft-deleted documents
  const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === true);
  
    // if (typedDocuments.length > 0) {
    //   console.log("doc.relatedData", typedDocuments[0].relatedData);
    // } else {
    //   console.log("No documents found for user.");
    // }
  
    for (const doc of activeDocuments) {
      console.log('doc_id', doc.document_type_id);
      
      if (!doc.document_type_id) continue;
  
      try {
        console.log('---------------------');
        
        doc.relatedData = await this.inwardRegisterRepo.findOne({
          where: { id: doc.document_type_id ,isDeleted:true},
        //  relations: ['grnNo', 'deliveryChallanNo', 'companyName', 'location', 'selectedVendor', 'selectedFarmer', 'purchasedBy', 'inwardBy', 'inwardProducts', 'inwardProducts.productName', 'inwardProducts.uom'],
        });
        console.log('Related data fetched for document:', doc.id, doc.relatedData);
        
      } catch (e) {
        console.log("in catch block", e);
        doc.relatedData = null;
      }
    }
 // console.log('Related data fetched for documents:', typedDocuments);
  
    let relatedDataOnly = activeDocuments.map((doc) => {
      const rd = doc.relatedData || {};
      return {
        documentId: doc.id,
        overAllStatus: doc.status,
        createdBy: `${doc.lastActionBy.firstName || null}  ${doc.lastActionBy.lastName || null}`,
        createdDate: formatDateTime(doc.createdAt).createdDate,
        createdTime: formatDateTime(doc.createdAt).createdTime,
        // From relatedData
      id: rd.id || null,
      batchNo: rd.batchNo || null,
      inwardType: rd.inwardType || null,
      remarks: rd.remarks || null,
      purchasedQty: rd.purchasedQty || null,
      inwardQtyInKg: rd.inwardQtyInKg || null,
      inwardCost: rd.inwardCost || null,
      totalWeightInKg: rd.totalWeightInKg || null,
      source: rd.source || null,

      grnNo: rd.grnNo?.grnNo || null,
      deliveryChallanNo: rd.deliveryChallanNo?.id || null,
      companyName: rd.companyName?.name || null,
      location: rd.location?.name || null,
      vendorName: rd.selectedVendor?.companyName || null,
      farmerName: rd.selectedFarmer?.farmerfName || null,
      purchasedBy: rd.purchasedBy?.name || null,
      inwardBy: rd.inwardBy?.name || null,

      // Products
      inwardProducts: rd.inwardProducts ? rd.inwardProducts.map((p: any) => ({
        productName: p.productName?.name || null,
        grade: p.grade || null,
        quantity: p.quantity || null,
        uom: p.uom?.unit || null,
        unitPrice: p.unitPrice || null,
        amount: p.amount || null,
        purchaseDate: p.purchaseDate || null,
        expectedHarvestDate: p.expectedHarvestDate || null,
        dispatchDate: p.dispatchDate || null,
        deliveryDate: p.deliveryDate || null,
        deliveryLocation: p.deliveryLocation || null,
        count: p.count || null,
        size: p.size || null,
        origin: p.origin || null,
        variety: p.variety || null,
      })) : [],
      };
    });
   // 🔍 Deep Search
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj).map((v) => objectToString(v)).join(' ');
    }
    return String(obj);
  };

  if (search && search.trim()) {
    const term = search.toLowerCase();
    relatedDataOnly = relatedDataOnly.filter((item) =>
      objectToString(item).toLowerCase().includes(term)
    );
  }
   // 🔄 Sorting
  if (queryOptions.sort) {
    const [field, direction] = queryOptions.sort.split(':');
    const sortOrder = direction?.toUpperCase() === 'DESC' ? -1 : 1;

    const getNestedValue = (obj: any, path: string) =>
      path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);

    relatedDataOnly.sort((a, b) => {
      const valA = getNestedValue(a, field);
      const valB = getNestedValue(b, field);

      if (valA == null && valB == null) return 0;
      if (valA == null) return -1 * sortOrder;
      if (valB == null) return 1 * sortOrder;

      if (!isNaN(valA) && !isNaN(valB)) {
        return (Number(valA) - Number(valB)) * sortOrder;
      }
      return String(valA).localeCompare(String(valB)) * sortOrder;
    });
  }

    return {
      data: relatedDataOnly,
      meta: {
        total: relatedDataOnly.length,
        page: queryOptions.page || 1,
        pages: Math.ceil(relatedDataOnly.length / (queryOptions.limit || 10)),
      }
    };
  } 

async filterInwardRegisters(
  page: number,
  limit: number,
  filters: Record<string, any>
) {
  const queryBuilder: SelectQueryBuilder<InwardRegister> =
    this.inwardRegisterRepo.createQueryBuilder("inwardRegister");

  // ✅ Select all fields from InwardRegister
  queryBuilder.select("inwardRegister");

  // ✅ Join relations but select only specific fields
  queryBuilder
    .leftJoin("inwardRegister.deliveryChallanNo", "deliveryChallanNo")
    .addSelect(["deliveryChallanNo.challanNo", "deliveryChallanNo.vehicleNo"])
    .leftJoin("inwardRegister.companyName", "companyName")
    .addSelect(["companyName.name"])
    .leftJoin("inwardRegister.location", "location")
    .addSelect(["location.name"])
    .leftJoin("inwardRegister.selectedVendor", "selectedVendor")
    .addSelect(["selectedVendor.companyName"])
    .leftJoin("inwardRegister.selectedFarmer", "selectedFarmer")
    .addSelect([
      "selectedFarmer.farmerlName",
      "selectedFarmer.farmermName",
      "selectedFarmer.farmerfName",
    ])
    .leftJoinAndSelect("inwardRegister.inwardProducts", "inwardProducts")
    .leftJoinAndSelect("inwardProducts.productName", "product")
    .addSelect(["product.name"]);

  // ✅ Apply dynamic filters (including deep relations)
  Object.entries(filters).forEach(([key, value], index) => {
    const paramKey = `param_${index}`; // avoid param conflicts

    const parts = key.split(".");
    if (parts.length > 1) {
      // Example: inwardProducts.productName.name
      const aliasPath = parts.slice(0, -1).join(".");
      const field = parts[parts.length - 1];
      const alias = parts[parts.length - 2]; // e.g. productName -> alias "product"

      if (typeof value === "string" && isNaN(Number(value))) {
        queryBuilder.andWhere(`${alias}.${field} ILIKE :${paramKey}`, {
          [paramKey]: `%${value}%`,
        });
      } else {
        queryBuilder.andWhere(`${alias}.${field} = :${paramKey}`, {
          [paramKey]: value,
        });
      }
    } else {
      // Normal InwardRegister field filter
      if (typeof value === "string" && isNaN(Number(value))) {
        queryBuilder.andWhere(`inwardRegister.${key} ILIKE :${paramKey}`, {
          [paramKey]: `%${value}%`,
        });
      } else {
        queryBuilder.andWhere(`inwardRegister.${key} = :${paramKey}`, {
          [paramKey]: value,
        });
      }
    }
  });
  // ✅ Pagination
  queryBuilder.skip((page - 1) * limit).take(limit);

  const [data, total] = await queryBuilder.getManyAndCount();

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

      // Save Inward Product line
      // const inwardProduct = this.inwardProductRepository.create({
      //   count,
      //   size,
      //   variety,
      //   origin,
      //   quantity,
      //   unitPrice,
      //   netWeight,
      //   grossWeight,
      //   amount,
      //   product: variant.productTemplate,
      //   variant,
      //   inwardRegister: savedInward,
      // });

      // await queryRunner.manager.save(inwardProduct);
  // // Step 3: Save inward product line item
  // const inwardProduct = this.inwardProductRepository.create({
  //   ...rest,
  //   count,
  //   size,
  //   variety,
  //   origin,
  //   quantity,
  //   unitPrice,
  //   product: variant.productTemplate,
  //   variant,
  //   inwardRegister: savedInward1,
  // });
  // // Step 3: Save inward product line item
  // const inwardProduct = this.inwardProductRepository.create({
  //   ...rest,
  //   count,
  //   size,
  //   variety,
  //   origin,
  //   quantity,
  //   unitPrice,
  //   product: variant.productTemplate,
  //   variant,
  //   inwardRegister: savedInward1,
  // });

  // await queryRunner.manager.save(inwardProduct);

  async getInwardRegisters(queryOptions: PaginationOptions): Promise<any> {
    const queryBuilder = this.inwardRegisterRepo
      .createQueryBuilder('inwardRegister')
      .leftJoinAndSelect('inwardRegister.grnNo', 'grnNo')
      .leftJoinAndSelect('inwardRegister.companyName', 'companyName')
      .leftJoinAndSelect('inwardRegister.location', 'location')
      .leftJoinAndSelect(
        'inwardRegister.deliveryChallanNo',
        'deliveryChallanNo',
      )
      .leftJoinAndSelect('inwardRegister.selectedVendor', 'selectedVendor')
      .leftJoinAndSelect('inwardRegister.selectedFarmer', 'selectedFarmer')
      .leftJoinAndSelect('inwardRegister.inwardProducts', 'inwardProducts')
      .leftJoinAndSelect('inwardProducts.productName', 'productName')
      .leftJoinAndSelect('inwardProducts.uom', 'uom')
      .orderBy('inwardRegister.createdAt', 'DESC');

    // Apply pagination, search, filters, and sorting
    const result = await buildQuery(
      queryBuilder,
      queryOptions,
      'inwardRegister',
    );
    console.log(result);

    // Transform inward registers data to match the expected structure
    const transformedInwardRegisters = result.data.map((inwardRegister) => {
      const rawDate = inwardRegister.createdAt;
      const { createdDate, createdTime } = formatDateTime(rawDate);
      const selectedParty =
        inwardRegister.source === 'farmer' && inwardRegister.selectedFarmer
          ? inwardRegister.selectedFarmer.id
          : inwardRegister.source === 'vendor' && inwardRegister.selectedVendor
          ? inwardRegister.selectedVendor.id
          : null;
      return {
        id: inwardRegister.id,
        inwardType: inwardRegister.inwardType,
        companyName: inwardRegister.companyName?.name || null,
        location: inwardRegister.location ? inwardRegister.location.name : null,
        createdDate: createdDate,
        createdTime: createdTime,

        date: inwardRegister.date || null,
        batchNo: inwardRegister.batchNo,
        source: inwardRegister.source,
        purchasedBy: inwardRegister.purchasedBy,
        totalWeightInKg: inwardRegister.totalWeightInKg,
        purchasedQty: inwardRegister.purchasedQty,
        inwardQtyInKg: inwardRegister.inwardQtyInKg,
        inwardCost: inwardRegister.inwardCost,
        remarks: inwardRegister.remarks,
        inwardBy: inwardRegister.inwardBy,
        grnNo: inwardRegister.grnNo?.grnNo || null,
        deliveryChallanNo: inwardRegister.deliveryChallanNo?.challanNo || null,
        selectedParty: selectedParty,
        inwardProducts: inwardRegister.inwardProducts.map((product) => ({
          id: product?.id || null,
          productName: product?.productName?.id || null,
          variant: product?.variant?.variantName || null,
          grossWeight: product.grossWeight,
          netWeight: product.netWeight,
          uom: product.uom?.id || null,
          packingMaterialWeight: product.packingMaterialWeight,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          amount: product.amount,
        })),
      };
    });

    return {
      data: transformedInwardRegisters,
      meta: result.meta,
    };
  }

  async getInwardRegisterById(id: string): Promise<any> {
    console.log('in service', id);

    // Fetch the inward register with relations
    const inwardRegister = await this.inwardRegisterRepo.findOne({
      where: { id },
      relations: [
        'grnNo',
        'location',
        'companyName',
        'deliveryChallanNo',
        'selectedVendor',
        'selectedFarmer',
        'inwardProducts',
        'inwardBy',
        'purchasedBy',
        'inwardProducts.productName',
        'inwardProducts.uom',
      ],
    });

    if (!inwardRegister) {
      return null; // Handle null case appropriately
    }
    // Dynamically construct the selectedParty field
    // const selectedParty =
    //   inwardRegister.source === 'farmer' && inwardRegister.selectedFarmer
    //     ? inwardRegister.selectedFarmer.id
    //     : inwardRegister.source === 'vendor' && inwardRegister.selectedVendor
    //     ? inwardRegister.selectedVendor.id
    //     : null;
    const selectedParty =
      inwardRegister.source === 'farmer' && inwardRegister.selectedFarmer
        ? {
            id: inwardRegister.selectedFarmer.id,
            name:
              inwardRegister.selectedFarmer.farmerfName +
              ' ' +
              inwardRegister.selectedFarmer.farmermName +
              ' ' +
              inwardRegister.selectedFarmer.farmerlName,
          }
        : inwardRegister.source === 'vendor' && inwardRegister.selectedVendor
        ? {
            id: inwardRegister.selectedVendor.id,
            name: inwardRegister.selectedVendor.companyName,
          }
        : null;
    const rawDate = inwardRegister.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);
    const transformedInwardRegister = {
      id: inwardRegister.id,
      createdDate: createdDate,
      createdTime: createdTime,

      inwardType: inwardRegister.inwardType,
      companyName: inwardRegister.companyName
        ? inwardRegister.companyName?.id
        : null,
      location: inwardRegister.location ? inwardRegister.location?.id : null,
      date: inwardRegister.date || null,
      batchNo: inwardRegister.batchNo,
      source: inwardRegister.source,
      totalWeightInKg: inwardRegister.totalWeightInKg,
      purchasedBy: inwardRegister.purchasedBy
        ? {
            id: inwardRegister.purchasedBy.id,
            name:
              inwardRegister.purchasedBy?.firstName +
                ' ' +
                inwardRegister.purchasedBy?.middleName +
                ' ' +
                inwardRegister.purchasedBy?.lastName || null,
          }
        : null,
      purchasedQty: inwardRegister.purchasedQty,
      inwardQtyInKg: inwardRegister.inwardQtyInKg,
      inwardCost: inwardRegister.inwardCost,
      remarks: inwardRegister.remarks,
      inwardBy: inwardRegister.inwardBy
        ? {
            id: inwardRegister.inwardBy.id,
            name:
              inwardRegister.inwardBy?.firstName +
                ' ' +
                inwardRegister.inwardBy?.middleName +
                ' ' +
                inwardRegister.inwardBy?.lastName || null,
          }
        : null,
      grnNo: inwardRegister.grnNo
        ? {
            id: inwardRegister.grnNo.id,
            grnNo: inwardRegister.grnNo.grnNo,
          }
        : null,
      deliveryChallanNo: inwardRegister.deliveryChallanNo
        ? {
            id: inwardRegister.deliveryChallanNo.id,
            challanNo: inwardRegister.deliveryChallanNo.challanNo,
          }
        : null,

      selectedParty: selectedParty,
      inwardProducts: inwardRegister.inwardProducts.map((product) => ({
        id: product?.id || null,
        productName: product.productName
          ? {
              id: product.productName.id,
              name: product.productName.name,
            }
          : null,

       variant: product.variant
         ? {
             id: product.variant.id,
             name: product.variant.variantName,
           }
         : null,
        grossWeight: product.grossWeight,
        netWeight: product.netWeight,
        uom: product.uom
          ? {
              id: product.uom.id,
              unit: product.uom.unit,
            }
          : null,

        packingMaterialWeight: product.packingMaterialWeight,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        amount: product.amount,
      })),
    };

    return transformedInwardRegister;
  }
async getInwardidforupdate(id: string): Promise<any> {
    console.log('in service', id);

    // Fetch the inward register with relations
    const inwardRegister = await this.inwardRegisterRepo.findOne({
      where: { id },
      relations: [
        'grnNo',
        'location',
        'companyName',
        'deliveryChallanNo',
        'selectedVendor',
        'selectedFarmer',
        'inwardProducts',
        'inwardBy',
        'purchasedBy',
        'inwardProducts.productName',
        'inwardProducts.uom',
      ],
    });

    if (!inwardRegister) {
      return null; // Handle null case appropriately
    }
    // Dynamically construct the selectedParty field
    // const selectedParty =
    //   inwardRegister.source === 'farmer' && inwardRegister.selectedFarmer
    //     ? inwardRegister.selectedFarmer.id
    //     : inwardRegister.source === 'vendor' && inwardRegister.selectedVendor
    //     ? inwardRegister.selectedVendor.id
    //     : null;
    const selectedParty =
      inwardRegister.source === 'farmer' && inwardRegister.selectedFarmer
        ?  inwardRegister.selectedFarmer.id
           
        : inwardRegister.source === 'vendor' && inwardRegister.selectedVendor
        ? inwardRegister.selectedVendor.id
        : null;
    const rawDate = inwardRegister.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);
    const transformedInwardRegister = {
      id: inwardRegister.id,
      createdDate: createdDate,
      createdTime: createdTime,

      inwardType: inwardRegister.inwardType,
      companyName: inwardRegister.companyName?.id||null,
        
      location: inwardRegister.location ? inwardRegister.location?.id : null,
      date: inwardRegister.date || null,
      batchNo: inwardRegister.batchNo,
      source: inwardRegister.source,
      totalWeightInKg: inwardRegister.totalWeightInKg,
      purchasedBy: inwardRegister.purchasedBy
        ? 
            inwardRegister.purchasedBy.id
            
        : null,
      purchasedQty: inwardRegister.purchasedQty,
      inwardQtyInKg: inwardRegister.inwardQtyInKg,
      inwardCost: inwardRegister.inwardCost,
      remarks: inwardRegister.remarks,
      inwardBy: inwardRegister.inwardBy
        ?  inwardRegister.inwardBy.id
            
        : null,
      grnNo: inwardRegister.grnNo
        ?  inwardRegister.grnNo.id
           
        : null,
      deliveryChallanNo: inwardRegister.deliveryChallanNo
        ?  inwardRegister.deliveryChallanNo.id
            
        : null,

      selectedParty: selectedParty,
      inwardProducts: inwardRegister.inwardProducts.map((product) => ({
        id: product?.id || null,
        productName: product.productName
          ?  product.productName.id
             
          : null,

        variant: product.variant? product.variant.id:null,
        grossWeight: product.grossWeight,
        netWeight: product.netWeight,
        uom: product.uom
          ?  product.uom.id
             
          : null,

        packingMaterialWeight: product.packingMaterialWeight,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        amount: product.amount,
      })),
    };

    return transformedInwardRegister;
  }

  async getInwardidforget(id: string): Promise<any> {
    console.log('in service', id);

    // Fetch the inward register with relations
    const inwardRegister = await this.inwardRegisterRepo.findOne({
      where: { id },
      relations: [
        'grnNo',
        'location',
        'companyName',
        'deliveryChallanNo',
        'selectedVendor',
        'selectedVendor.officeAddress',
        'selectedVendor.category',
        'selectedVendor.subcategory',
        'selectedVendor.vendorSaleInfo',
        'selectedFarmer',
        'selectedFarmer.farmAddress',
        'selectedFarmer.residensialAddress',
        'inwardProducts',
        'inwardBy',
        'purchasedBy',
        'inwardProducts.productName',
        'inwardProducts.uom',
      ],
    });

    if (!inwardRegister) {
      return null; // Handle null case appropriately
    }
    // Dynamically construct the selectedParty field
    // const selectedParty =
    //   inwardRegister.source === 'farmer' && inwardRegister.selectedFarmer
    //     ? inwardRegister.selectedFarmer.id
    //     : inwardRegister.source === 'vendor' && inwardRegister.selectedVendor
    //     ? inwardRegister.selectedVendor.id
    //     : null;
    const selectedParty =
      inwardRegister.source === 'farmer' && inwardRegister.selectedFarmer
        ? { 
          fullname:inwardRegister.selectedFarmer.farmerfName+' '+inwardRegister.selectedFarmer.farmermName+' '+inwardRegister.selectedFarmer.farmerlName,
          primaryMobileNo:inwardRegister.selectedFarmer.primaryMobileNo,
          secondaryMobileNo:inwardRegister.selectedFarmer.secondaryMobileNo,
          farmerCode:inwardRegister.selectedFarmer.farmerCode,
          email:inwardRegister.selectedFarmer.email,

           farmAddress:inwardRegister.selectedFarmer.farmAddress ? {
            id:inwardRegister.selectedFarmer.farmAddress.id,
            address1:inwardRegister.selectedFarmer.farmAddress.address1,
            address2:inwardRegister.selectedFarmer.farmAddress.address2,
            location:inwardRegister.selectedFarmer.farmAddress.location,
            city:inwardRegister.selectedFarmer.farmAddress.city,
            state:inwardRegister.selectedFarmer.farmAddress.state,
            pincode:inwardRegister.selectedFarmer.farmAddress.pincode

          }:null,

           residensialAddress:inwardRegister.selectedFarmer.residensialAddress ? {
            id:inwardRegister.selectedFarmer.residensialAddress.id,
            address1:inwardRegister.selectedFarmer.residensialAddress.address1,
            address2:inwardRegister.selectedFarmer.residensialAddress.address2,
            location:inwardRegister.selectedFarmer.residensialAddress.location,
            city:inwardRegister.selectedFarmer.residensialAddress.city,
            state:inwardRegister.selectedFarmer.residensialAddress.state,
            pincode:inwardRegister.selectedFarmer.residensialAddress.pincode

          }:null
          

        }
           
        : inwardRegister.source === 'vendor' && inwardRegister.selectedVendor
        ? {
          companyName:inwardRegister.selectedVendor.companyName,
          category:inwardRegister.selectedVendor.category?.name,
          subcategory:inwardRegister.selectedVendor.subcategory?.name,
          vendorCode:inwardRegister.selectedVendor?.vendorCode,
          contactPersonName:inwardRegister.selectedVendor.vendorSaleInfo.contactFName+' '+inwardRegister.selectedVendor.vendorSaleInfo?.contactMName+' '+inwardRegister.selectedVendor.vendorSaleInfo?.contactLName,
          officeAddress:inwardRegister.selectedVendor.officeAddress ? {
            id:inwardRegister.selectedVendor.officeAddress.id,
            address1:inwardRegister.selectedVendor.officeAddress.address1,
            address2:inwardRegister.selectedVendor.officeAddress.address2,
            location:inwardRegister.selectedVendor.officeAddress.location,
            city:inwardRegister.selectedVendor.officeAddress.city,
            state:inwardRegister.selectedVendor.officeAddress.state,
            pincode:inwardRegister.selectedVendor.officeAddress.pincode

          }:null
        }
        : null;
    const rawDate = inwardRegister.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);
    const transformedInwardRegister = {
      id: inwardRegister.id,
      createdDate: createdDate,
      createdTime: createdTime,

      inwardType: inwardRegister.inwardType,
      companyName: inwardRegister.companyName?.name||null,
        
      location: inwardRegister.location ? inwardRegister.location?.name : null,
      date: inwardRegister.date || null,
      batchNo: inwardRegister.batchNo,
      source: inwardRegister.source,
      totalWeightInKg: inwardRegister.totalWeightInKg,
      purchasedBy: inwardRegister.purchasedBy
        ? 
            inwardRegister.purchasedBy?.firstName+' '+inwardRegister.purchasedBy?.middleName+' '+inwardRegister.purchasedBy?.lastName
            
        : null,
      purchasedQty: inwardRegister.purchasedQty,
      inwardQtyInKg: inwardRegister.inwardQtyInKg,
      inwardCost: inwardRegister.inwardCost,
      remarks: inwardRegister.remarks,
      inwardBy: inwardRegister.inwardBy
        ?  inwardRegister.inwardBy?.firstName+' '+inwardRegister.inwardBy?.middleName+' '+inwardRegister.inwardBy?.lastName
            
        : null,
      grnNo: inwardRegister.grnNo
        ?  inwardRegister.grnNo.grnNo
           
        : null,
      deliveryChallanNo: inwardRegister.deliveryChallanNo
        ?  inwardRegister.deliveryChallanNo.challanNo
            
        : null,

      selectedParty: selectedParty,
      inwardProducts: inwardRegister.inwardProducts.map((product) => ({
        id: product?.id || null,
        productName: product.productName
          ?  product.productName.name
             
          : null,

       variant:product.variant ? product.variant.variantName:null,
        grossWeight: product.grossWeight,
        netWeight: product.netWeight,
        uom: product.uom
          ?  product.uom.unit
             
          : null,

        packingMaterialWeight: product.packingMaterialWeight,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        amount: product.amount,
      })),
    };

    return transformedInwardRegister;
  }
  async updateInwardRegister(
    id: string,
    data: any,
    updatedBy: string,
  ): Promise<InwardRegister> {
    const inwardRegister = await this.inwardRegisterRepo.findOne({
      where: { id },
    });

    if (!inwardRegister) {
      throw new AppError(404, `InwardRegister with ID ${id} not found`);
    }

    const oldData = { ...inwardRegister };

    Object.assign(inwardRegister, data);

    const updatedInwardRegister = await this.inwardRegisterRepo.save(
      inwardRegister,
    );

    await this.auditLogService.logChange(
      'InwardRegister',
      id,
      oldData,
      updatedInwardRegister,
      updatedBy,
    );

    return updatedInwardRegister;
  }

//   async updateInwardRegister(id: string, data: any, updatedBy: string): Promise<InwardRegister> {
//   const queryRunner = this.dataSource.createQueryRunner();
//   await queryRunner.connect();
//   await queryRunner.startTransaction();

//   try {
//     const inwardRegister = await queryRunner.manager.findOne(InwardRegister, { where: { id }, relations: ['inwardProducts'] });

//     if (!inwardRegister) {
//       throw new AppError(404, `InwardRegister with ID ${id} not found`);
//     }

//     const oldInwardProducts = inwardRegister.inwardProducts;

//     // Step 1: Revert previous stock effects
//     for (const oldItem of oldInwardProducts) {
//       const existingStock = await this.inventoryStockRepository.findOne({ /* same logic */ });

//       if (existingStock) {
//         existingStock.onHandQty -= Number(oldItem.netWeight || 0);
//         existingStock.amount -= Number(oldItem.amount || 0);
//         await queryRunner.manager.save(existingStock);
//       }
//     }

//     // Step 2: Delete old inward products (if applicable)
//     //await queryRunner.manager.delete(InwardProduct, { inwardRegister: { id } });

//     // Step 3: Update inwardRegister
//     Object.assign(inwardRegister, data);
//     const updatedInwardRegister = await queryRunner.manager.save(inwardRegister);

//     // Step 4: Insert new inwardProducts and update stock
//     for (const item of data.inwardProducts) {
//       // Same logic as in `createInwardRegister` — variant fetch/create + stock update
//     }

//     // Step 5: Commit
//     await queryRunner.commitTransaction();

//     await this.auditLogService.logChange(
//       'InwardRegister',
//       id,
//       inwardRegister,
//       updatedInwardRegister,
//       updatedBy,
//     );

//     return updatedInwardRegister;
//   } catch (error) {
//     await queryRunner.rollbackTransaction();
//     throw error;
//   } finally {
//     await queryRunner.release();
//   }
// }


  public async deleteInwardRegister(id: string): Promise<void> {
    const inwardRegister = await this.inwardRegisterRepo.findOne({
      where: { id },
    });

    if (!inwardRegister) {
      throw new AppError(404, `InwardRegister with ID ${id} not found`);
    }

    const now = new Date();

    // Calculate the date 6 months ahead
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

    console.log(sixMonthsFromNow); // Log the calculated date

    inwardRegister.deletionScheduledAt = sixMonthsFromNow;
    console.log('in delete service', inwardRegister.deletionScheduledAt);
    // Save the record with the updated deletionScheduledAt field
    await this.inwardRegisterRepo.save(inwardRegister);
    console.log(`InwardRegister with ID ${id} marked for deletion.`);
  }

  public async getScheduledForDeletionRecords(): Promise<InwardRegister[]> {
    return this.inwardRegisterRepo.find({
      where: { deletionScheduledAt: LessThanOrEqual(new Date()) },
    });
  }




//Todo:Get All Inward Register..By Vaishali
//    public async getAllInwardRegisters(queryOptions: PaginationOptions, userId: string): Promise<any> {
//     const data = await this.docSingalApproverService.getAllSingleApprovalDocumentsByUserId(
//       userId,
//       DocumentTypeEnum.INWARD_REGISTER,
//     );
//     const { search } = queryOptions;
//   //  console.log('Fetched documents:', data);
  
//     const typedDocuments = data as DocumentWithRelatedData[];
  
//     // if (typedDocuments.length > 0) {
//     //   console.log("doc.relatedData", typedDocuments[0].relatedData);
//     // } else {
//     //   console.log("No documents found for user.");
//     // }
  
//     for (const doc of typedDocuments) {
//       console.log('doc_id', doc.document_type_id);
      
//       if (!doc.document_type_id) continue;
  
//       try {
//         console.log('---------------------');
        
//         doc.relatedData = await this.inwardRegisterRepo.findOne({
//           where: { id: doc.document_type_id },
//         //  relations: ['grnNo', 'deliveryChallanNo', 'companyName', 'location', 'selectedVendor', 'selectedFarmer', 'purchasedBy', 'inwardBy', 'inwardProducts', 'inwardProducts.productName', 'inwardProducts.uom'],
//         });
//         console.log('Related data fetched for document:', doc.id, doc.relatedData);
        
//       } catch (e) {
//         console.log("in catch block", e);
//         doc.relatedData = null;
//       }
//     }
//  // console.log('Related data fetched for documents:', typedDocuments);
  
//     let relatedDataOnly = typedDocuments.map((doc) => {
//       const rd = doc.relatedData || {};
//       return {
//         documentId: doc.id,
//         overAllStatus: doc.status,
//         createdBy: `${doc.lastActionBy.firstName || null}  ${doc.lastActionBy.lastName || null}`,
//         createdDate: formatDateTime(doc.createdAt).createdDate,
//         createdTime: formatDateTime(doc.createdAt).createdTime,
//         // From relatedData
//       id: rd.id || null,
//       batchNo: rd.batchNo || null,
//       inwardType: rd.inwardType || null,
//       remarks: rd.remarks || null,
//       purchasedQty: rd.purchasedQty || null,
//       inwardQtyInKg: rd.inwardQtyInKg || null,
//       inwardCost: rd.inwardCost || null,
//       totalWeightInKg: rd.totalWeightInKg || null,
//       source: rd.source || null,

//       grnNo: rd.grnNo?.grnNo || null,
//       deliveryChallanNo: rd.deliveryChallanNo?.id || null,
//       companyName: rd.companyName?.name || null,
//       location: rd.location?.name || null,
//       vendorName: rd.selectedVendor?.companyName || null,
//       farmerName: rd.selectedFarmer?.farmerfName || null,
//       purchasedBy: rd.purchasedBy?.name || null,
//       inwardBy: rd.inwardBy?.name || null,

//       // Products
//       inwardProducts: rd.inwardProducts ? rd.inwardProducts.map((p: any) => ({
//         productName: p.productName?.name || null,
//         grade: p.grade || null,
//         quantity: p.quantity || null,
//         uom: p.uom?.unit || null,
//         unitPrice: p.unitPrice || null,
//         amount: p.amount || null,
//         purchaseDate: p.purchaseDate || null,
//         expectedHarvestDate: p.expectedHarvestDate || null,
//         dispatchDate: p.dispatchDate || null,
//         deliveryDate: p.deliveryDate || null,
//         deliveryLocation: p.deliveryLocation || null,
//         count: p.count || null,
//         size: p.size || null,
//         origin: p.origin || null,
//         variety: p.variety || null,
//       })) : [],
//       };
//     });
//    // 🔍 Deep Search
//   const objectToString = (obj: any): string => {
//     if (obj == null) return '';
//     if (typeof obj === 'object') {
//       return Object.values(obj).map((v) => objectToString(v)).join(' ');
//     }
//     return String(obj);
//   };

//   if (search && search.trim()) {
//     const term = search.toLowerCase();
//     relatedDataOnly = relatedDataOnly.filter((item) =>
//       objectToString(item).toLowerCase().includes(term)
//     );
//   }
//    // 🔄 Sorting
//   if (queryOptions.sort) {
//     const [field, direction] = queryOptions.sort.split(':');
//     const sortOrder = direction?.toUpperCase() === 'DESC' ? -1 : 1;

//     const getNestedValue = (obj: any, path: string) =>
//       path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);

//     relatedDataOnly.sort((a, b) => {
//       const valA = getNestedValue(a, field);
//       const valB = getNestedValue(b, field);

//       if (valA == null && valB == null) return 0;
//       if (valA == null) return -1 * sortOrder;
//       if (valB == null) return 1 * sortOrder;

//       if (!isNaN(valA) && !isNaN(valB)) {
//         return (Number(valA) - Number(valB)) * sortOrder;
//       }
//       return String(valA).localeCompare(String(valB)) * sortOrder;
//     });
//   }

//     return {
//       data: relatedDataOnly,
//       meta: {
//         total: relatedDataOnly.length,
//         page: queryOptions.page || 1,
//         pages: Math.ceil(relatedDataOnly.length / (queryOptions.limit || 10)),
//       }
//     };
//   }
public async getAllInwardRegisters(queryOptions: PaginationOptions, userId: string): Promise<any> {
    const data = await this.docSingalApproverService.getAllSingleApprovalDocumentsByUserId(
      userId,
      DocumentTypeEnum.INWARD_REGISTER,
    );
    const { search } = queryOptions;
  //  console.log('Fetched documents:', data);
  
    const typedDocuments = data as DocumentWithRelatedData[];
    // Exclude soft-deleted documents
  const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === false);
  
    // if (typedDocuments.length > 0) {
    //   console.log("doc.relatedData", typedDocuments[0].relatedData);
    // } else {
    //   console.log("No documents found for user.");
    // }
  
    for (const doc of activeDocuments) {
      console.log('doc_id', doc.document_type_id);
      
      if (!doc.document_type_id) continue;
  
      try {
        console.log('---------------------');
        
        doc.relatedData = await this.inwardRegisterRepo.findOne({
          where: { id: doc.document_type_id ,isDeleted:false},
         relations: ['grnNo', 'deliveryChallanNo', 'companyName', 'location', 'selectedVendor', 'selectedFarmer', 'purchasedBy', 'inwardBy', 'inwardProducts', 'inwardProducts.productName', 'inwardProducts.uom'],
        });
        console.log('Related data fetched for document:', doc.id, doc.relatedData);
        
      } catch (e) {
        console.log("in catch block", e);
        doc.relatedData = null;
      }
    }
 // console.log('Related data fetched for documents:', typedDocuments);
  
    let relatedDataOnly = activeDocuments.map((doc) => {
      const rd = doc.relatedData || {};
      return {
        documentId: doc.id,
        overAllStatus: doc.status,
        createdBy: `${doc.lastActionBy.firstName || null}  ${doc.lastActionBy.lastName || null}`,
        createdDate: formatDateTime(doc.createdAt).createdDate,
        createdTime: formatDateTime(doc.createdAt).createdTime,
        // From relatedData
      id: rd.id || null,
      batchNo: rd.batchNo || null,
      inwardType: rd.inwardType || null,
      remarks: rd.remarks || null,
      purchasedQty: rd.purchasedQty || null,
      inwardQtyInKg: rd.inwardQtyInKg || null,
      inwardCost: rd.inwardCost || null,
      totalWeightInKg: rd.totalWeightInKg || null,
      source: rd.source || null,

      grnNo: rd.grnNo?.grnNo || null,
      deliveryChallanNo: rd.deliveryChallanNo?.id || null,
      companyName: rd.companyName?.name || null,
      location: rd.location?.name || null,
      vendorName: rd.selectedVendor?.companyName || null,
      farmerName: rd.selectedFarmer?.farmerfName || null,
      purchasedBy: rd.purchasedBy?.name || null,
      inwardBy: rd.inwardBy?.name || null,

      // Products
      inwardProducts: rd.inwardProducts ? rd.inwardProducts.map((p: any) => ({
        productName: p.productName?.name || null,
        grade: p.grade || null,
        quantity: p.quantity || null,
        uom: p.uom?.unit || null,
        unitPrice: p.unitPrice || null,
        amount: p.amount || null,
        purchaseDate: p.purchaseDate || null,
        expectedHarvestDate: p.expectedHarvestDate || null,
        dispatchDate: p.dispatchDate || null,
        deliveryDate: p.deliveryDate || null,
        deliveryLocation: p.deliveryLocation || null,
        count: p.count || null,
        size: p.size || null,
        origin: p.origin || null,
        variety: p.variety || null,
      })) : [],
      };
    });
   // 🔍 Deep Search
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj).map((v) => objectToString(v)).join(' ');
    }
    return String(obj);
  };

  if (search && search.trim()) {
    const term = search.toLowerCase();
    relatedDataOnly = relatedDataOnly.filter((item) =>
      objectToString(item).toLowerCase().includes(term)
    );
  }
   // 🔄 Sorting
  if (queryOptions.sort) {
    const [field, direction] = queryOptions.sort.split(':');
    const sortOrder = direction?.toUpperCase() === 'DESC' ? -1 : 1;

    const getNestedValue = (obj: any, path: string) =>
      path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);

    relatedDataOnly.sort((a, b) => {
      const valA = getNestedValue(a, field);
      const valB = getNestedValue(b, field);

      if (valA == null && valB == null) return 0;
      if (valA == null) return -1 * sortOrder;
      if (valB == null) return 1 * sortOrder;

      if (!isNaN(valA) && !isNaN(valB)) {
        return (Number(valA) - Number(valB)) * sortOrder;
      }
      return String(valA).localeCompare(String(valB)) * sortOrder;
    });
  }

    return {
      data: relatedDataOnly,
      meta: {
        total: relatedDataOnly.length,
        page: queryOptions.page || 1,
        pages: Math.ceil(relatedDataOnly.length / (queryOptions.limit || 10)),
      }
    };
  }


  //TODO:Get Inward Register By Id For View..By Vaishali
public async getInwardregisterByIdForView(docid: string, userId:string): Promise<any> {
    const document = await this.docSingalApproverService.getSingleApprovalDocumentById(docid,userId)
    if(!document)
    {
      return null;
    }
    const id = document.documentTypeId;
    console.log('id in getDealSlipByIdForView', id);
    
    if (id) {
      //console.log("Hiiiiiiiiiiiiiiiiiiiiiii");
      //console.log('Document type ID not found for document:', id);
      
      const inwardRegister = await this.inwardRegisterRepo.findOne({
        where: { id },
        relations: [
          'grnNo',
        'deliveryChallanNo',
        'companyName',
        'location',
        'selectedVendor',
        'selectedFarmer',
        'purchasedBy',
        'inwardBy',
        'inwardProducts',
        'inwardProducts.productName',
        'inwardProducts.uom',
        ],
      });

      console.log('inwardRegister in getInwardregisterByIdForView', inwardRegister);
      

      if (!inwardRegister) { 
        throw new Error('inwardRegister not found');
      }

      // let selectedPartyId: string | null = null;
      // if (grn.source === 'vendor' && grn.selectedVendor) {
      //   selectedPartyId = grn.selectedVendor.companyName;
      // } else if (grn.source === 'farmer' && grn.selectedFarmer) {
      //   selectedPartyId =
      //     grn.selectedFarmer.farmerfName +
      //     ' ' +
      //     grn.selectedFarmer.farmermName +
      //     ' ' +
      //     grn.selectedFarmer.farmerlName;
      // }
      const rawDate = inwardRegister.createdAt;
      const { createdDate, createdTime } = formatDateTime(rawDate);
      return {
    documentId: document.documentId,
    overAllStatus: document.status,
    createdBy: document.createdBy ,
    createdDate,
    createdTime,
    approvalSummary: document.approvalSummary,

    
      // from InwardRegister:
      id: inwardRegister.id,
      inwardType: inwardRegister.inwardType,
      lotNo: inwardRegister.batchNo,
      remarks: inwardRegister.remarks,
      source: inwardRegister.source,
      purchasedQty: inwardRegister.purchasedQty,
      inwardQtyInKg: inwardRegister.inwardQtyInKg,
      inwardCost: inwardRegister.inwardCost,
      totalWeightInKg: inwardRegister.totalWeightInKg,

      grnNo: inwardRegister.grnNo?.grnNo || null,
      deliveryChallanId: inwardRegister.deliveryChallanNo?.id || null,
      companyName: inwardRegister.companyName?.name || null,
      locationName: inwardRegister.location?.name || null,
      vendorName: inwardRegister.selectedVendor?.companyName || null,
      farmerName: inwardRegister.selectedFarmer
        ? `${inwardRegister.selectedFarmer.farmerfName} ${inwardRegister.selectedFarmer.farmermName || ''} ${inwardRegister.selectedFarmer.farmerlName}`
        : null,

      purchasedBy: `${inwardRegister.inwardBy?.firstName || null } ${inwardRegister.inwardBy?.lastName || null}`,
      inwardBy: `${inwardRegister.inwardBy?.firstName || null } ${inwardRegister.inwardBy?.lastName || null}`,

      inwardProducts: inwardRegister.inwardProducts?.map((prod) => ({
        id: prod.id,
        productName: prod.productName?.name || null,
        uom: prod.uom?.unit || null,
        variant: prod.variant?.variantName || null,
        packingMaterialWeight: prod.packingMaterialWeight,
        quantity: prod.quantity,
        unitPrice: prod.unitPrice,
        amount: prod.amount,
        netWeight: prod.netWeight,
        grossWeight: prod.grossWeight,
      })) || [],
  };
  }
}
public async deleteMultipleInwardRegister(ids: string[]): Promise<{ success: string[]; failed: { id: string; reason: string }[]; message: string }> {
  const success: string[] = [];
  const failed: { id: string; reason: string }[] = [];  
  for (const id of ids) {
      const inwardRegister = await this.inwardRegisterRepo.findOne({
        where: { id },
      });

      if (!inwardRegister) {
        failed.push({ id, reason: 'Inward Register not found' });
        continue;
      }

      const relatedDocument = await this.documentbRepository.findOne({
        where: { document_type_id: inwardRegister.id }
      });

      if (!relatedDocument) {
        throw new Error(`Something went wrong`);
      }

      const deleteDocument = await this.documentbRepository.delete(relatedDocument.id);
      if (!deleteDocument) {
        throw new Error(`Failed to delete related document with ID ${relatedDocument.id}`);
      }


      const deleteGrn = await this.inwardRegisterRepo.delete(inwardRegister.id);

      if (!deleteGrn) {
        throw new Error(`Failed to delete Inward Register with ID ${id}`);
      }

    }
    const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
    return { success, failed, message};

  }


}
