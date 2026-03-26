import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { GrnRepository } from "../repositories/grn.repository";
import { ProductVarientRepository } from "../repositories/varients.repository";
import { DataSource, In } from "typeorm";
import { UserLogger } from "../utils/logger";
import { ReturnToVendorRepository } from "../repositories/returnToVendor.repository";
import { InventoryStockRepository } from "../repositories/inventoryStock.repository";
import { DocumentbService } from "./documentb.service";
import { DocumentStatus, DocumentTypeEnum } from "../entities/docuemnt.entity";
import { DocumentTypeEnum as DocDefEnum } from "../entities/documentdef.entity";

@injectable()
export class ReturnToVendorService {

    constructor(@inject(TYPES.GrnRepository) private grnRepository: GrnRepository,
               @inject(TYPES.ProductVarientRepository)
                       private productVarientsRepository: ProductVarientRepository,
                    @inject(TYPES.ReturnToVendorRepository) private postReturnToVendorRepository: ReturnToVendorRepository,
                    @inject(TYPES.InventoryStockRepository) private inventoryStockRepository: InventoryStockRepository,
                    @inject(TYPES.DocumentbService) private documentbService: DocumentbService,
                    @inject(TYPES.DataSource) private dataSource: DataSource,
        ) {}   

    public async createReturn(returnData: any, requestedBy: any, clientIp?: string): Promise<any>{
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
          // 1️⃣ Validate required input
          if (!returnData.grnNo) {
            throw new Error('GRN number is required');
          }
          returnData.isChanged = true;

          // 2️⃣ Fetch GRN
          const grn = await queryRunner.manager.findOne(this.grnRepository.target, {
            where: { id: returnData.grnNo },
            relations: ['selectedVendor', 'grnProducts', 'grnProducts.productName', 'grnProducts.variant'],
          });

          if (!grn) {
            throw new Error('GRN not found');
          }

          // 3️⃣ Normalize variants input
          let variantIds: string[] = [];
          if (Array.isArray(returnData.variants)) {
            variantIds = returnData.variants;
          } else if (returnData.variants) {
            variantIds = [returnData.variants];
          }

          // 4️⃣ Fetch variant entities
          const variants = await this.productVarientsRepository.find({
            where: { id: In(variantIds) },
            relations: ['product'],
          });

          // 5️⃣ Extract product IDs
          const productIds = variants.map((v: any) => v.product?.id).filter(Boolean);

          // 6️⃣ Create and save return entity
          const newReturn = queryRunner.manager.create(this.postReturnToVendorRepository.target, {
            ...returnData,
            createdBy: requestedBy,
            variants: variants.map((v: any) => ({ id: v.id })),
            products: productIds.map((id: any) => ({ id })),
          });

          const savedNewReturn = await queryRunner.manager.save(newReturn);
          const savedreturn = Array.isArray(savedNewReturn) ? savedNewReturn[0] : savedNewReturn;

          // 7️⃣ Commit transaction before starting approval flow
          await queryRunner.commitTransaction();

          // 8️⃣ Create document and start approval flow (outside transaction)
          const document = await this.documentbService.createDocument({
            type: DocumentTypeEnum.RETURN_TO_VENDOR,
            docDef: DocDefEnum.PROCUREMENT,
            status: DocumentStatus.HOLD,
            remarks: 'Document auto-created with Return To Vendor',
            lastActionBy: { id: requestedBy },
            document_type_id: savedreturn.id,
          });

          await this.documentbService.startApprovalFlow(document.id);

          // 9️⃣ Process inventory (outside transaction, non-critical)
          if (Array.isArray(savedreturn.rtvProducts)) {
            await this.processInventoryForReturn(savedreturn);
          }

          // 🔟 Log creation
          UserLogger.logRfpaCreated(savedreturn.id, requestedBy, clientIp);

          return savedreturn;

      } catch (error: any) {
          await queryRunner.rollbackTransaction();
          throw error;
      } finally {
          await queryRunner.release();
      }
    }

    private async processInventoryForReturn(returnRecord: any): Promise<void> {
        try {
            const companyId = returnRecord?.companyName?.id ?? returnRecord?.companyName;
            const locationId = returnRecord?.location?.id ?? returnRecord?.location;

            if (!Array.isArray(returnRecord.rtvProducts) || returnRecord.rtvProducts.length === 0) {
                console.log('📦 No products to process for inventory');
                return;
            }

            // Group products by productId to identify products with multiple variants
            const productGroups = new Map<string, any[]>();
            for (const item of returnRecord.rtvProducts) {
                const productId = item?.productName?.id ?? item?.productName;
                if (productId) {
                    if (!productGroups.has(productId)) {
                        productGroups.set(productId, []);
                    }
                    productGroups.get(productId)?.push(item);
                }
            }

            console.log(`\n📦 Processing ${returnRecord.rtvProducts.length} items from ${productGroups.size} unique product(s)`);

            // Process each item
            for (const item of returnRecord.rtvProducts) {
                const itemVariantId = item?.variant?.id ?? item?.variant;
                const itemProductId = item?.productName?.id ?? item?.productName;
                
                // Check if this product has multiple variants
                const variantCount = productGroups.get(itemProductId)?.length || 1;
                const isMultiVariant = variantCount > 1;

                if (!itemProductId || !itemVariantId || !companyId || !locationId) {
                    console.warn(`❌ Skipping item due to missing relation ids:`, {
                        product: itemProductId,
                        variant: itemVariantId,
                        company: companyId,
                        location: locationId,
                    });
                    continue;
                }

                const itemNetWeight = Number(item.netWeight) || 0;
                const itemQuantity = Number(item.quantity) || 0;
                const itemUnitPrice = Number(item.unitPrice) || 0;
                const amount = +(itemUnitPrice * itemQuantity).toFixed(2);

                const variantLabel = isMultiVariant ? `[Variant ${variantCount}/${productGroups.get(itemProductId)?.length}]` : '';
                console.log(`\n📤 Processing RTV item: productId=${itemProductId} ${variantLabel}`);
                console.log(`   ├─ variantId=${itemVariantId}`);
                console.log(`   ├─ quantity=${itemQuantity}, unitPrice=${itemUnitPrice}, netWeight=${itemNetWeight}`);
                console.log(`   └─ amount=${amount}`);

                // Find existing stock by relation ids
                const existingStock = await this.inventoryStockRepository.findOne({
                    where: {
                        company: { id: companyId },
                        product: { id: itemProductId },
                        variant: { id: itemVariantId },
                        location: { id: locationId },
                    },
                });

                if (existingStock) {
                    const currentInwardQty = Number(existingStock.inwardQty) || 0;
                    const currentInwardAmt = Number(existingStock.inwardAmt) || 0;

                    existingStock.inwardQty = +(currentInwardQty - itemNetWeight).toFixed(2);
                    existingStock.inwardAmt = +(currentInwardAmt - amount).toFixed(2);

                    console.log(`   ✅ Updated existing stock`);
                    console.log(`      └─ InwardQty: ${currentInwardQty} → ${existingStock.inwardQty}`);
                    console.log(`      └─ InwardAmt: ${currentInwardAmt} → ${existingStock.inwardAmt}`);

                    await this.inventoryStockRepository.save(existingStock);
                } else {
                    // Create a new stock record representing the negative movement (returned to vendor)
                    const newStock = this.inventoryStockRepository.create({
                        company: { id: companyId },
                        location: { id: locationId },
                        product: { id: itemProductId },
                        variant: { id: itemVariantId },
                        inwardQty: +(0 - itemNetWeight).toFixed(2),
                        inwardAmt: +(0 - amount).toFixed(2),
                        dumpQty: 0,
                        dumpAmt: 0,
                    });

                    console.log(`   ✅ Created new stock entry (first return for this variant)`);
                    console.log(`      └─ InwardQty: ${newStock.inwardQty}`);
                    console.log(`      └─ InwardAmt: ${newStock.inwardAmt}`);

                    await this.inventoryStockRepository.save(newStock);
                }
            }

            console.log(`\n✅ Inventory processing completed for return: ${returnRecord.id}\n`);
        } catch (error) {
            console.error('❌ Error processing inventory for return:', error);
            throw error;
        }
    }

    public async getAll(page: number = 1, limit: number = 10): Promise<{ data: any[], total: number, page: number, limit: number }> {
        try {
            const skip = (page - 1) * limit;

            const [data, total] = await this.postReturnToVendorRepository.findAndCount({
                relations: ['companyName', 'location', 'selectedVendor', 'createdBy', 'rtvProducts', 'rtvProducts.productName', 'rtvProducts.variant', 'rtvProducts.uom'],
                select:{'companyName': { id: true, name: true }, 'location': { id: true, name: true }, 'selectedVendor': { id: true, companyName: true }, 'createdBy': { id: true, firstName: true,lastName: true }, 'rtvProducts': { id: true, quantity: true, unitPrice: true, netWeight: true, grossWeight: true, productName: { id: true, name: true }, variant: { id: true, variantName: true,variantCode: true }, uom:{id:true,unit:true} } },
                order: { createdAt: 'DESC' },
                take: limit,
                skip: skip,
            });

            return { data, total, page, limit };
        } catch (error) {
            console.error('Error fetching all return to vendor records:', error);
            throw error;
        }
    }

    public async getById(id: string): Promise<any> {


        try {
            if (!id) {
                throw new Error('Return to vendor ID is required');
            }

            const returnRecord = await this.postReturnToVendorRepository.findOne({
                where: { id },
                relations: ['companyName', 'location', 'selectedVendor', 'createdBy', 'rtvProducts', 'rtvProducts.productName', 'rtvProducts.variant', 'rtvProducts.uom'],
                select:{'companyName': { id: true, name: true }, 'location': { id: true, name: true }, 'selectedVendor': { id: true, companyName: true }, 'createdBy': { id: true, firstName: true,lastName: true }, 'rtvProducts': { id: true, quantity: true, unitPrice: true, netWeight: true, grossWeight: true, productName: { id: true, name: true }, variant: { id: true, variantName: true,variantCode: true }, uom:{id:true,unit:true} } },

            });

            if (!returnRecord) {
                throw new Error(`Return to vendor record with ID ${id} not found`);
            }

            return returnRecord;
        } catch (error) {
            console.error('Error fetching return to vendor by ID:', error);
            throw error;
        }
    }



     public async getByIdForUpdate(id: string): Promise<any> {
        try {
            if (!id) {
                throw new Error('Return to vendor ID is required');
            }

            const returnRecord = await this.postReturnToVendorRepository.findOne({
                where: { id },
                relations: ['grnNo','companyName', 'location', 'selectedVendor', 'createdBy', 'rtvProducts', 'rtvProducts.productName', 'rtvProducts.variant', 'rtvProducts.uom'],
                

            });

            if (!returnRecord) {
                throw new Error(`Return to vendor record with ID ${id} not found`);
            }
 // Map to return only specific fields
            return {
                id: returnRecord.id,
                grnNo:returnRecord.grnNo?.id||null,
                companyName: returnRecord.companyName.id || null,
                location: returnRecord.location.id || null ,
                selectedVendor: returnRecord.selectedVendor.id || null,
                createdBy: returnRecord.createdBy?.id||null,
                returnedGrossWeight:returnRecord.returnedGrossWeight,
                totalAmt:returnRecord.totalAmt,
                returnedNetWeight: returnRecord.returnedNetWeight,
                returnDate:returnRecord.returnDate||null,
                amtWords:returnRecord.amtWords || null,
                remark:returnRecord.remark || null,

                rtvProducts: returnRecord.rtvProducts?.map(product => ({
                    id: product.id,
                    quantity: product.quantity,
                    unitPrice: product.unitPrice,
                    netWeight: product.netWeight,
                    grossWeight: product.grossWeight,
                    productName: product.productName.id|| null,
                    variant: product.variant.id || null,
                    uom: product.uom.id || null
                })) || []
            };
            
        } catch (error) {
            console.error('Error fetching return to vendor by ID:', error);
            throw error;
        }
    }

     public async getByIdForView(id: string): Promise<any> {
        try {
            if (!id) {
                throw new Error('Return to vendor ID is required');
            }

            const returnRecord = await this.postReturnToVendorRepository.findOne({
                where: { id },
                relations: ['companyName', 'location', 'selectedVendor', 'createdBy', 'rtvProducts', 'rtvProducts.productName', 'rtvProducts.variant', 'rtvProducts.uom'],
            });

            if (!returnRecord) {
                throw new Error(`Return to vendor record with ID ${id} not found`);
            }

            // Map to return only specific fields
            return {
                id: returnRecord.id,
                companyName: returnRecord.companyName.name || null,
                location: returnRecord.location.name || null ,
                selectedVendor: returnRecord.selectedVendor.companyName || null,
                createdBy: returnRecord.createdBy?.firstName|| null+' '+returnRecord.createdBy?.lastName||null,
                 returnedGrossWeight:returnRecord.returnedGrossWeight,
                totalAmt:returnRecord.totalAmt,
                returnedNetWeight: returnRecord.returnedNetWeight,
                returnDate:returnRecord.returnDate||null,
                amtWords:returnRecord.amtWords || null,
                remark:returnRecord.remark || null,
                rtvProducts: returnRecord.rtvProducts?.map(product => ({
                    id: product.id,
                    quantity: product.quantity,
                    unitPrice: product.unitPrice,
                    netWeight: product.netWeight,
                    grossWeight: product.grossWeight,
                    productName: product.productName.name|| null,
                    variant: product.variant.variantName || null,
                    uom: product.uom.unit || null
                })) || []
            };
        } catch (error) {
            console.error('Error fetching return to vendor by ID:', error);
            throw error;
        }
    }

    public async updateReturn(id: string, updateData: any): Promise<any> {
        try {
            if (!id) {
                throw new Error('Return to vendor ID is required');
            }

            // Fetch existing record
            const existingRecord = await this.postReturnToVendorRepository.findOne({
                where: { id },
                relations: ['rtvProducts', 'rtvProducts.productName', 'rtvProducts.variant', 'companyName', 'location'],
            });

            if (!existingRecord) {
                throw new Error(`Return to vendor record with ID ${id} not found`);
            }

            const original = { ...existingRecord };

            // Capture old rtvProducts BEFORE Object.assign mutates existingRecord
            //const oldRtvProducts = existingRecord.rtvProducts ? [...existingRecord.rtvProducts] : [];

            const oldRtvProducts = existingRecord.rtvProducts.map(p => ({
    productName: p.productName?.id ?? p.productName,
    variant: p.variant?.id ?? p.variant,
    netWeight: Number(p.netWeight),
    quantity: Number(p.quantity),
    unitPrice: Number(p.unitPrice)
}));

            if(updateData.id) delete updateData.id;

            // Re-process inventory FIRST with correct old/new separation
            if (updateData.rtvProducts && Array.isArray(updateData.rtvProducts)) {
                console.log('🔄 Re-processing inventory stock for updated return...');
                await this.reprocessInventoryForUpdate(existingRecord, oldRtvProducts, updateData.rtvProducts);
            }

            Object.assign(existingRecord, updateData);

            const updatedRecord = await this.postReturnToVendorRepository.save(existingRecord);

            console.log('Return to vendor updated successfully:', {
                id: updatedRecord.id,
                original: original,
                updated: updatedRecord
            });
            return updatedRecord;
        } catch (error) {
            console.error('Error updating return to vendor:', error);
            throw error;
        }
    }

    private async reprocessInventoryForUpdate(existingRecord: any, oldProducts: any[], newProducts: any[]): Promise<void> {
        try {
            const companyId = existingRecord?.companyName?.id ?? existingRecord?.companyName;
            const locationId = existingRecord?.location?.id ?? existingRecord?.location;

            if (!companyId || !locationId) {
                console.warn('Cannot re-process inventory: missing company or location');
                return;
            }

            // Build per-variant aggregates for old and new lists so we can compute a single delta
            const makeKey = (p: any, v: any) => `${p}::${v}`;

            const oldMap = new Map<string, { productId: string, variantId: string, weight: number, amount: number, count: number }>();
            const newMap = new Map<string, { productId: string, variantId: string, weight: number, amount: number, count: number }>();

            const accumulate = (map: Map<string, any>, item: any) => {
                // const productId = item?.productName?.id ?? item?.productName;
                // const variantId = item?.variant?.id ?? item?.variant;

                    const productId =
                    item?.productName?.id ??
                    item?.productName ??
                    item?.productId;

                    const variantId =
                    item?.variant?.id ??
                    item?.variant ??
                    item?.variantId;
                if (!productId || !variantId) return;
                const key = makeKey(productId, variantId);
                const netWeight = Number(item.netWeight) || 0;
                const quantity = Number(item.quantity) || 0;
                const unitPrice = Number(item.unitPrice) || 0;
                const amt = +(unitPrice * quantity).toFixed(2);
                if (!map.has(key)) {
                    map.set(key, { productId, variantId, weight: 0, amount: 0, count: 0 });
                }
                const entry = map.get(key)!;
                entry.weight = +(entry.weight + netWeight).toFixed(2);
                entry.amount = +(entry.amount + amt).toFixed(2);
                entry.count = entry.count + 1;
            };

            for (const it of oldProducts) accumulate(oldMap, it);
            for (const it of newProducts) accumulate(newMap, it);

            console.log(`\n🔄 Re-processing inventory stock for updated return...`);
            console.log(`📊 Old: ${oldProducts.length} items from ${oldMap.size} variant-keys`);
            console.log(`📊 New: ${newProducts.length} items from ${newMap.size} variant-keys\n`);

            // For each variant key present in either map compute delta = new - old, then apply that delta
            const allKeys = new Set<string>([...oldMap.keys(), ...newMap.keys()]);
            for (const key of allKeys) {
                const oldEntry = oldMap.get(key) || { productId: null, variantId: null, weight: 0, amount: 0, count: 0 };
                const newEntry = newMap.get(key) || { productId: null, variantId: null, weight: 0, amount: 0, count: 0 };

                const productId = newEntry.productId ?? oldEntry.productId;
                const variantId = newEntry.variantId ?? oldEntry.variantId;

                if (!productId || !variantId) {
                    console.warn('Skipping key with missing ids', { key, oldEntry, newEntry });
                    continue;
                }

                const deltaWeight = +(newEntry.weight - oldEntry.weight).toFixed(2); // positive => more returned now
                const deltaAmount = +(newEntry.amount - oldEntry.amount).toFixed(2);

                const variantLabel = (oldEntry.count + newEntry.count) > 1 ? `[Aggregated ${oldEntry.count + newEntry.count}]` : '';
                console.log(`\n🔁 Variant: productId=${productId} variantId=${variantId} ${variantLabel}`);
                console.log(`   ├─ OldWeight=${oldEntry.weight}, OldAmt=${oldEntry.amount}`);
                console.log(`   ├─ NewWeight=${newEntry.weight}, NewAmt=${newEntry.amount}`);
                console.log(`   └─ DeltaWeight=${deltaWeight}, DeltaAmt=${deltaAmount}`);

                const stock = await this.inventoryStockRepository.findOne({
                    where: {
                        company: { id: companyId },
                        product: { id: productId },
                        variant: { id: variantId },
                        location: { id: locationId },
                    },
                });

                if (stock) {
                    const currentInwardQty = Number(stock.inwardQty) || 0;
                    const currentInwardAmt = Number(stock.inwardAmt) || 0;

                    // When deltaWeight > 0 => more returned now -> decrease inwardQty by delta (more negative)
                    // When deltaWeight < 0 => less returned now -> increase inwardQty by |delta|
                    stock.inwardQty = +(currentInwardQty - deltaWeight).toFixed(2);
                    stock.inwardAmt = +(currentInwardAmt - deltaAmount).toFixed(2);

                    console.log(`   ✅ Updated stock`);
                    console.log(`      └─ InwardQty: ${currentInwardQty} → ${stock.inwardQty}`);
                    console.log(`      └─ InwardAmt: ${currentInwardAmt} → ${stock.inwardAmt}`);

                    await this.inventoryStockRepository.save(stock);
                } else {
                    // No existing stock: create only if net delta causes a non-zero movement
                    if (deltaWeight === 0 && deltaAmount === 0) {
                        console.log('   ℹ️ No change and no stock exists — skipping creation');
                        continue;
                    }

                    const createQty = +(0 - deltaWeight).toFixed(2);
                    const createAmt = +(0 - deltaAmount).toFixed(2);

                    const newStock = this.inventoryStockRepository.create({
                        company: { id: companyId },
                        location: { id: locationId },
                        product: { id: productId },
                        variant: { id: variantId },
                        inwardQty: createQty,
                        inwardAmt: createAmt,
                        dumpQty: 0,
                        dumpAmt: 0,
                    });

                    console.log(`   ✅ Created new stock entry`);
                    console.log(`      └─ InwardQty: ${newStock.inwardQty}`);
                    console.log(`      └─ InwardAmt: ${newStock.inwardAmt}`);

                    await this.inventoryStockRepository.save(newStock);
                }
            }

            console.log(`\n✅ Inventory re-processing completed successfully\n`);
        } catch (error) {
            console.error('❌ Error re-processing inventory:', error);
            throw error;
        }
    }

    public async softDeleteReturn(id: string): Promise<any> {
    try {
        if (!id) {
            throw new Error("Return to vendor ID is required");
        }

        const record = await this.postReturnToVendorRepository.findOne({
            where: { id },
            relations: ["rtvProducts"],
            withDeleted: true, // important
        });

        if (!record) {
            throw new Error("RTV record not found");
        }

        if (record.isDeleted) {
            throw new Error("RTV already deleted");
        }

        await this.postReturnToVendorRepository.softDelete(id);
        record.isDeleted = true; // mark as deleted for inventory processing
        record.deletedAtNew = new Date(); // set deletion timestamp
        await this.postReturnToVendorRepository.save(record); // persist the isDeleted flag

        console.log("RTV soft deleted:", id);

        return {
            message: "Return to vendor soft deleted successfully",
            id,
        };
    } catch (error) {
        console.error("Error soft deleting RTV:", error);
        throw error;
    }
}
}