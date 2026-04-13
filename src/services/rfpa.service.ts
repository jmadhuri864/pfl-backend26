import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { RfpaRepository } from '../repositories/rfpa.repository';
import { RFPA } from '../entities/rfpa.entity';
import { RFPAProduct } from '../entities/rfpaProduct.entity';
import { Product } from '../entities/product.entity';
import { ProductVarient } from '../entities/productVarient.entity';
import { UOM } from '../entities/uom.entity';
import { Company } from '../entities/company.entity';
import { Branches } from '../entities/branches.entity';
import { Vendor } from '../entities/vendor.entity';
import { Farmer } from '../entities/farmer.entity';
import { PaymentInfoForRFPA } from '../entities/rfpaPayementInfo.entity';
import { DeepPartial, ILike, In, LessThan, MoreThanOrEqual, SelectQueryBuilder, DataSource } from 'typeorm';
import { UOMRepository } from '../repositories/uom.repository';
import { ProductRepository } from '../repositories/product.repository';
import { VendorService } from './vendor.service';
import { FarmerService } from './farmer.service';
import { Status } from '../utils/status.enum';
import { UserService } from './user.service';
import { NotificationRepository } from '../repositories/notification.repository';

import { NotificationService } from './notification.service';
import { next } from 'inversify-express-utils';
import AppError from '../utils/appError';
import { sendEmail } from '../utils/sendEmail';
import { AuditLogService } from './auditLog.service';
import { format } from 'date-fns';
import { buildQueryFromArray, PaginationOptions } from '../utils/pagination';
import { formatDateTime } from '../utils/dateUtils';
import { createHash } from 'crypto';
import { Documentb,/* DocumentStatus, DocumentTypeEnum */} from '../entities/docuemnt.entity';
import { DocumentbService, DocumentWithRelatedData,/* DocumentWithRelatedData*/ } from './documentb.service';
import { DocumentTypeEnum } from '../entities/docuemnt.entity';
import { DocumentStatus } from '../entities/docuemnt.entity';
import { DocumentTypeEnum as DocDefEnum } from '../entities/documentdef.entity';
import { DocSingalApproverService } from './DocSingalApproverService.service';
import { ApprovalFlowService } from './approvalFlow.service';
import { DocumentbRepository } from '../repositories/documentb.repository';
import { ProductVarientRepository } from '../repositories/varients.repository';
import { RfpaPaymentInfoRepository } from '../repositories/rfpaPaymentInfo.repository';
import { ApprovalFlowRepository } from '../repositories/approvalFlow.repository';
import { CacheService } from './cache.service';

export interface RFPAWithRelatedData extends RFPA {
  relatedData?: any;
}

// Converts DD-MM-YYYY to YYYY-MM-DD; returns null/undefined as-is
function normalizeDateFormat(date: string | null | undefined): string | null | undefined {
  if (!date) return date;
  const ddmmyyyy = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = date.match(ddmmyyyy);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return date;
}


@injectable()
export class RfpaService {
  constructor(
    @inject(TYPES.DataSource)
    private readonly dataSource: DataSource,
    @inject(TYPES.RfpaRepository)
    private readonly rfpaRepository: RfpaRepository,
    @inject(TYPES.ProductRepository)
    private readonly productRepository: ProductRepository,
    @inject(TYPES.UOMRepository)
    private readonly uomRepository: UOMRepository,
    @inject(TYPES.VendorService)
    private readonly vendorService: VendorService,
    @inject(TYPES.FarmerService)
    private readonly farmerService: FarmerService,
    @inject(TYPES.UserService)
    private readonly userService: UserService,
    @inject(TYPES.NotificationService)
    private readonly notificationService: NotificationService,

     @inject(TYPES.ProductVarientRepository)
        private productVarientsRepository: ProductVarientRepository,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService,
    @inject(TYPES.DocumentbService)
    //Todo:By Vaishali
    private readonly documentbService: DocumentbService, // Replace with actual type if available
    @inject(TYPES.DocSingalApproverService)
     private readonly docSingalApproverService: DocSingalApproverService,
     @inject(TYPES.ApprovalFlowService)
    private approvalFlowService: ApprovalFlowService,
    @inject(TYPES.DocumentbRepository)
    private documentbRepository: DocumentbRepository,
    @inject(TYPES.RfpaPaymentInfoRepository)
    private rfpaPaymentInfoRepository:RfpaPaymentInfoRepository,
    @inject(TYPES.ApprovalFlowRepository)
    private approvalFlowRepository:ApprovalFlowRepository,
    @inject(TYPES.CacheService)
    private readonly cacheService: CacheService,
  ) {}

  private readonly CACHE_PREFIX = 'rfpa';
  private readonly CACHE_TTL = 180;

  private async invalidateCache(id?: string): Promise<void> {
    const tasks: Promise<any>[] = [
      this.cacheService.invalidatePattern(`${this.CACHE_PREFIX}:list:*`),
      this.cacheService.invalidatePattern(`${this.CACHE_PREFIX}:recycle:*`),
      this.cacheService.invalidatePattern(`${this.CACHE_PREFIX}:all:*`),
      this.cacheService.invalidatePattern(`${this.CACHE_PREFIX}:rfpanumbers:*`),
    ];
    if (id) {
      tasks.push(
        this.cacheService.del(`${this.CACHE_PREFIX}:id:${id}`),
        this.cacheService.del(`${this.CACHE_PREFIX}:update:${id}`),
        this.cacheService.del(`${this.CACHE_PREFIX}:view:${id}`),
      );
    }
    await Promise.all(tasks);
  }

  // async findAllRfpas(): Promise<any[]> {
  //   const rfpas = await this.rfpaRepository.find({
  //     relations: [
  //       'requestedBy',
  //       'selectedVendor',
  //       'selectedFarmer',
  //       'rfpaProducts',
  //       'rfpaProducts.product',
  //       'rfpaProducts.uom',
  //       'paymentInfo',
  //       'purchaseForWhich',
  //       'purchaseLocation'
  //     ],

  //     order: {
  //       createdAt: 'DESC', // Assuming createdAt is a timestamp field
  //     },
  //   });

  //   // Format the response for each RFPA
  //   const formattedResponses = await Promise.all(
  //     rfpas.map(async (rfpa) => {
  //       const getSelectedParty = (rfpa: RFPA) => {
  //         return rfpa.source === 'vendor'
  //           ? rfpa.selectedVendor?.id
  //           : rfpa.source === 'farmer'
  //           ? rfpa.selectedFarmer?.id
  //           : null;
  //       };

  //       return {
  //         id: rfpa.id,
  //         companyName:rfpa.companyName,
  //         rfpaId: rfpa.rfpaId ,

  //         requestingDepartment: rfpa.requestingDepartment,
  //         baseLocation: rfpa.baseLocation,
  //         purchaseLocation: rfpa.purchaseLocation.name||null,
  //         purchaseForWhich: rfpa.purchaseForWhich.name||null,
  //         approvalStatus: rfpa.approvalStatus,
  //         deliveryReceivingPerson: rfpa.deliveryReceivingPerson,

  //         packingInstruction: rfpa.packingInstruction,
  //         specialRequest: rfpa.specialRequest,
  //         source: rfpa.source,
  //         requestedBy: {
  //           firstName: rfpa.requestedBy?.firstName || "",
  //   lastName: rfpa.requestedBy?.lastName || "",
  //         },
  //         selectedParty: getSelectedParty(rfpa),
  //         paymentInfo: rfpa.paymentInfo
  //         ? {
  //             id: rfpa.paymentInfo.id,
  //             paymentMode: rfpa.paymentInfo.paymentMode,
  //             paymentDate: rfpa.paymentInfo.paymentDate,
  //             advancePaidAmount: rfpa.paymentInfo.advancePaidAmt,
  //             paymentTerms: rfpa.paymentInfo.paymentTerms,
  //           }
  //         : null,

  //         rfpaProducts: await Promise.all(
  //           rfpa.rfpaProducts.map(async (product) => {
  //             const productEntity = await this.productRepository.findOne({ where: { id: product.product.id } });
  //             const uomEntity = await this.uomRepository.findOne({ where: { id: product.uom.id } });

  //             return {
  //               id: product.id,
  //               grade: product.grade,
  //               description:product.description,
  //               quantity: product.quantity,
  //               unitPrice: product.unitPrice,
  //               product: productEntity?.id || null,
  //               uom: uomEntity?.id|| null,
  //               totalVal: product.totalVal,
  //               purchaseDate: product.purchaseDate,
  //               dispatchDate: product.dispatchDate,
  //               deliveryDate: product.deliveryDate,
  //               deliveryLocation: product.deliveryLocation,
  //               expectedHarvestDate: product.expectedHarvestDate,
  //             };
  //           })
  //         ),
  //       };
  //     })
  //   );

  //   return formattedResponses;
  // }



  async createRfpa(rfpaData: any): Promise<any> {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Generate RFPA ID
    const rfpaId = await this.generateRFPAId();

    

    // Helper function to extract ID from object or return the value directly
    const extractId = (value: any) => {
      if (!value) return null;
      if (typeof value === 'string') return value;
      if (typeof value === 'object' && value.id) return value.id;
      return null;
    };

    // Determine if selectedParty is vendor or farmer based on source
    const selectedVendorId = rfpaData.source === 'vendor' ? extractId(rfpaData.selectedParty || rfpaData.selectedVendor) : null;
    const selectedFarmerId = rfpaData.source === 'farmer' ? extractId(rfpaData.selectedParty || rfpaData.selectedFarmer) : null;

    const rfpaPaymentInfo = queryRunner.manager.create(this.rfpaPaymentInfoRepository.target, {
      paymentMode: rfpaData.paymentInfo.paymentMode,
      creditPeriod: rfpaData.paymentInfo.creditPeriod,
      paymentDate: rfpaData.paymentInfo.paymentDate,
      paymentTerms: rfpaData.paymentInfo.paymentTerms,
      dueDate: rfpaData.paymentInfo.dueDate,
      advancePaidAmt: rfpaData.paymentInfo.advancePaidAmt,
      validityOfQuote: rfpaData.paymentInfo.validityOfQuote
    })

    const saveRfpaPaymentInfo = await queryRunner.manager.save(rfpaPaymentInfo);
    console.log("RFPA Data...........", saveRfpaPaymentInfo);
    
    // Create RFPA entity with plain ID values (TypeORM will handle the relationships)
    const rfpaEntity = queryRunner.manager.create(this.rfpaRepository.target, {
      rfpaId,
      requestingDepartment: rfpaData.requestingDepartment,
      companyName: extractId(rfpaData.companyName),
      purchaseLocation: extractId(rfpaData.purchaseLocation),
      purchaseForSalesLocation: extractId(rfpaData.purchaseForSalesLocation),
      otherPurchaseLoc: rfpaData.otherPurchaseLoc,
      otherPurchaseForSalesLoc: rfpaData.otherPurchaseForSalesLoc,
      deliveryReceivingPerson: rfpaData.deliveryReceivingPerson,
      packingInstruction: rfpaData.packingInstruction,
      selectedVendor: selectedVendorId,
      selectedFarmer: selectedFarmerId,
      specialReq: rfpaData.specialReq,
      source: rfpaData.source,
      paymentInfo: saveRfpaPaymentInfo.id,
      remark: rfpaData.remark,
    } as any) as unknown as RFPA;

    // Create RFPA products if provided
    if (rfpaData.rfpaProducts && Array.isArray(rfpaData.rfpaProducts)) {
      rfpaEntity.rfpaProducts = rfpaData.rfpaProducts.map((product: any) => {
        const rfpaProduct = new RFPAProduct();
        rfpaProduct.productName = extractId(product.productName) as any;
        rfpaProduct.variant = extractId(product.variant) as any;
        rfpaProduct.grade = product.grade;
        rfpaProduct.quantity = product.quantity;
        rfpaProduct.uom = extractId(product.uom) as any;
        rfpaProduct.unitPrice = product.unitPrice;
        rfpaProduct.count = product.count;
        rfpaProduct.size = product.size;
        rfpaProduct.origin = product.origin;
        rfpaProduct.variety = product.variety;
        rfpaProduct.amount = product.amount;
        rfpaProduct.purchaseDate = product.purchaseDate;
        rfpaProduct.expectedHarvestDate = product.expectedHarvestDate;
        rfpaProduct.dispatchDate = product.dispatchDate;
        rfpaProduct.deliveryDate = product.deliveryDate;
        rfpaProduct.deliveryLocation = product.deliveryLocation;
        return rfpaProduct;
      });
    }

    // Save RFPA with products in one transaction (cascade will save products automatically)
    const savedRfpaResult = await queryRunner.manager.save(rfpaEntity);
    
    // Handle both single entity and array return types
    const savedRfpa = Array.isArray(savedRfpaResult) ? savedRfpaResult[0] : savedRfpaResult;
console.log(rfpaData.createdBy)
    // Create document & start approval flow
    const document = await this.documentbService.createDocument({
      type: DocumentTypeEnum.RFPA,
      docDef: DocDefEnum.PROCUREMENT,
      status: DocumentStatus.HOLD,
      remarks: 'Document auto-created with RFPA',
      lastActionBy: { id: rfpaData.createdBy } as any,
      document_type_id: savedRfpa.id,
    });

    // Commit transaction - all operations succeeded
    await queryRunner.commitTransaction();

    // Start approval flow after commit so RFPA is visible to other DB connections
    await this.documentbService.startApprovalFlow(document.id);

    await this.invalidateCache();
    return savedRfpa;
  } catch (error: any) {
    // Rollback transaction - undo all changes
    await queryRunner.rollbackTransaction();
    console.error('Error creating RFPA:', error);
    throw error;
  } finally {
    // Release query runner
    await queryRunner.release();
  }
}

  async findAllRfpas(
    queryOptions: PaginationOptions,
  ): Promise<{ data: any[]; meta: any }> {
    const hash = createHash('md5').update(JSON.stringify(queryOptions)).digest('hex');
    const cacheKey = `${this.CACHE_PREFIX}:all:${hash}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const page = queryOptions.page ?? 1;
    const limit = queryOptions.limit ?? 10;

    const skip = (page - 1) * limit;

    // Fetch RFPA records with pagination
    const [rfpas, total] = await this.rfpaRepository.findAndCount({
      relations: [
        'companyName',
        //'requestedBy',
        'selectedVendor',
        'selectedFarmer',
        'rfpaProducts',
        'rfpaProducts.productName',
        'rfpaProducts.uom',
        'paymentInfo',
        'purchaseForSalesLocation',
        'purchaseLocation',
      ],
      where: { isDeleted: false },
      order: {
        createdAt: 'DESC',
      },
      skip,
      take: limit,
    });

    const formattedResponses = rfpas.map((rfpa) => {
      const rawDate = rfpa.createdAt;
      const { createdDate, createdTime } = formatDateTime(rawDate);
      const getSelectedParty = (rfpa: RFPA) => {
        return rfpa.source === 'vendor'
          ? rfpa.selectedVendor?.id || null
          : rfpa.source === 'farmer'
          ? rfpa.selectedFarmer?.id || null
          : null;
      };

      return {
        id: rfpa.id,
        companyName: rfpa.companyName?.name || null,
        rfpaId: rfpa.rfpaId,
        createdTime,
        createdDate,

        // createdTime: rfpa.createdTime,
        requestingDepartment: rfpa.requestingDepartment,
        purchaseLocation: rfpa.purchaseLocation?.name || null,
        purchaseForSalesLocation: rfpa.purchaseForSalesLocation?.name || null,
        // approvalStatus: rfpa.approvalStatus,
        deliveryReceivingPerson: rfpa.deliveryReceivingPerson,
        packingInstruction: rfpa.packingInstruction,
       specialReq: rfpa.specialReq,
        source: rfpa.source,
        // requestedBy: rfpa.requestedBy
        //   ? {
        //       firstName: rfpa.requestedBy.firstName || "",
        //       lastName: rfpa.requestedBy.lastName || "",
        //     }
        //   : { firstName: "", lastName: "" },
        selectedParty: getSelectedParty(rfpa),
        paymentInfo: rfpa.paymentInfo
          ? {
              id: rfpa.paymentInfo.id,
              paymentMode: rfpa.paymentInfo.paymentMode,
              paymentDate: rfpa.paymentInfo.paymentDate,
              advancePaidAmount: rfpa.paymentInfo.advancePaidAmt,
              paymentTerms: rfpa.paymentInfo.paymentTerms,
              validityOfQuote: rfpa.paymentInfo.validityOfQuote,
              creditPeriod: rfpa.paymentInfo.creditPeriod,
              dueDate: rfpa.paymentInfo.dueDate,
            }
          : null,
        rfpaProducts: rfpa.rfpaProducts
          ? rfpa.rfpaProducts.map((product) => ({
              id: product.id,
              grade: product.grade,
              //description: product.description,
              quantity: product.quantity,
              unitPrice: product.unitPrice,
              productName: product.productName?.name || null,
              uom: product.uom?.unit || null,
              amount: product.amount,
              purchaseDate: product.purchaseDate,
              dispatchDate: product.dispatchDate,
              deliveryDate: product.deliveryDate,
              deliveryLocation: product.deliveryLocation,
              expectedHarvestDate: product.expectedHarvestDate,
            }))
          : [],
      };
    });

    const result = {
      data: formattedResponses,
      meta: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    };
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  async getRFQById(id: string) {
    const cacheKey = `${this.CACHE_PREFIX}:id:${id}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const rfpa = await this.rfpaRepository.findOne({
      where: { id },
      relations: [
        'companyName',
        'selectedVendor',
        'selectedFarmer',
        'rfpaProducts',
        'rfpaProducts.productName',
        'rfpaProducts.uom',
        'paymentInfo',
        'purchaseForSalesLocation',
        'purchaseLocation',
      ],
    });

    if (!rfpa) throw new Error(`RFQ with ID ${id} not found`);

    const selectedParty =
      rfpa.source === 'vendor' && rfpa.selectedVendor
        ? rfpa.selectedVendor.id
        : rfpa.source === 'farmer' && rfpa.selectedFarmer
        ? rfpa.selectedFarmer.id
        : null;
    const rawDate = rfpa.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);

    const result = {
      rfpaId: rfpa.rfpaId,
      companyName: rfpa.companyName
        ? { id: rfpa.companyName.id, companyName: rfpa.companyName.name }
        : null,
      createdDate,
      createdTime,
      requestingDepartment: rfpa.requestingDepartment,
      purchaseLocation: rfpa.purchaseLocation?.id || null,
      purchaseForSalesLocation: rfpa.purchaseForSalesLocation?.id || null,
      otherPurchaseForSalesLoc: rfpa.otherPurchaseForSalesLoc,
      otherPurchaseLoc: rfpa.otherPurchaseLoc,
      deliveryReceivingPerson: rfpa.deliveryReceivingPerson,
      remark: rfpa.remark,
      packingInstruction: rfpa.packingInstruction,
      specialReq: rfpa.specialReq,
      source: rfpa.source,
      selectedParty,
      paymentInfo: rfpa.paymentInfo
        ? {
            paymentMode: rfpa.paymentInfo.paymentMode,
            paymentDate: rfpa.paymentInfo.paymentDate,
            advancePaidAmt: rfpa.paymentInfo.advancePaidAmt,
            paymentTerms: rfpa.paymentInfo.paymentTerms,
            validityOfQuote: rfpa.paymentInfo.validityOfQuote,
            creditPeriod: rfpa.paymentInfo.creditPeriod,
            dueDate: rfpa.paymentInfo.dueDate,
          }
        : null,
      rfpaProducts: rfpa.rfpaProducts.map((product) => ({
        grade: product.grade,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        productName: product.productName
          ? { id: product.productName.id, name: product.productName.name }
          : null,
        uom: product.uom
          ? { id: product.uom.id, unit: product.uom.unit }
          : null,
        amount: product.amount,
        purchaseDate: product.purchaseDate,
        dispatchDate: product.dispatchDate,
        deliveryDate: product.deliveryDate,
        deliveryLocation: product.deliveryLocation,
        expectedHarvestDate: product.expectedHarvestDate,
      })),
    };
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }
async getRFQByIdForUpdate(id: string) {
    const cacheKey = `${this.CACHE_PREFIX}:update:${id}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const rfpa = await this.rfpaRepository.findOne({
      where: { id },
      relations: [
        'companyName',
        'selectedVendor',
        'selectedFarmer',
        'rfpaProducts',
        'rfpaProducts.variant',
        'rfpaProducts.productName',
        'rfpaProducts.uom',
        'paymentInfo',
        'purchaseForSalesLocation',
        'purchaseLocation',
      ],
    });

    if (!rfpa) throw new Error(`RFQ with ID ${id} not found`);

    const selectedParty =
      rfpa.source === 'vendor' && rfpa.selectedVendor
        ? rfpa.selectedVendor.id
        : rfpa.source === 'farmer' && rfpa.selectedFarmer
        ? rfpa.selectedFarmer.id
        : null;
    const rawDate = rfpa.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);

    const result = {
      rfpaId: rfpa.rfpaId,
      companyName: rfpa.companyName?.id,
      createdDate,
      createdTime,
      requestingDepartment: rfpa.requestingDepartment,
      purchaseLocation: rfpa.purchaseLocation?.id || null,
      purchaseForSalesLocation: rfpa.purchaseForSalesLocation?.id || null,
      otherPurchaseForSalesLoc: rfpa.otherPurchaseForSalesLoc,
      otherPurchaseLoc: rfpa.otherPurchaseLoc,
      deliveryReceivingPerson: rfpa.deliveryReceivingPerson,
      remark: rfpa.remark,
      packingInstruction: rfpa.packingInstruction,
      specialReq: rfpa.specialReq,
      source: rfpa.source,
      selectedParty,
      paymentInfo: rfpa.paymentInfo
        ? {
            paymentMode: rfpa.paymentInfo.paymentMode,
            paymentDate: rfpa.paymentInfo.paymentDate,
            advancePaidAmt: rfpa.paymentInfo.advancePaidAmt,
            paymentTerms: rfpa.paymentInfo.paymentTerms,
            validityOfQuote: rfpa.paymentInfo.validityOfQuote,
            creditPeriod: rfpa.paymentInfo.creditPeriod,
            dueDate: rfpa.paymentInfo.dueDate,
          }
        : null,
      rfpaProducts: rfpa.rfpaProducts.map((product) => ({
        grade: product.grade,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        productName: product.productName?.id || null,
        variant: product.variant?.id || null,
        uom: product.uom?.id || null,
        amount: product.amount,
        purchaseDate: product.purchaseDate,
        dispatchDate: product.dispatchDate,
        deliveryDate: product.deliveryDate,
        deliveryLocation: product.deliveryLocation,
        expectedHarvestDate: product.expectedHarvestDate,
      })),
    };
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }
  async getRFQByIdByView(id: string) {
    const cacheKey = `${this.CACHE_PREFIX}:view:${id}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const rfpa = await this.rfpaRepository.findOne({
      where: { id },
      relations: [
        'companyName',
        'selectedVendor',
        'selectedFarmer',
        'rfpaProducts',
        'rfpaProducts.variant',
        'rfpaProducts.productName',
        'rfpaProducts.uom',
        'paymentInfo',
        'purchaseForSalesLocation',
        'purchaseLocation',
      ],
    });

    if (!rfpa) throw new Error(`RFQ with ID ${id} not found`);

    const selectedParty =
      rfpa.source === 'vendor' && rfpa.selectedVendor
        ? {
            id: rfpa.selectedVendor.id,
            vendorCode: rfpa.selectedVendor.vendorCode,
            companyName: rfpa.selectedVendor.companyName,
          }
        : rfpa.source === 'farmer' && rfpa.selectedFarmer
        ? {
            id: rfpa.selectedFarmer.id,
            farmerCode: rfpa.selectedFarmer.farmerCode,
            name: rfpa.selectedFarmer.farmerfName + ' ' + rfpa.selectedFarmer.farmerlName,
          }
        : null;

    const rawDate = rfpa.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);

    const result = {
      rfpa: rfpa.rfpaId,
      companyName: rfpa.companyName.name,
      createdDate,
      createdTime,
      requestingDepartment: rfpa.requestingDepartment,
      purchaseLocation: rfpa.purchaseLocation?.name || null,
      purchaseForSalesLocation: rfpa.purchaseForSalesLocation?.name || null,
      otherPurchaseForSalesLoc: rfpa.otherPurchaseForSalesLoc,
      otherPurchaseLoc: rfpa.otherPurchaseLoc,
      deliveryReceivingPerson: rfpa.deliveryReceivingPerson || null,
      remark: rfpa.remark || null,
      packingInstruction: rfpa.packingInstruction || null,
      specialReq: rfpa.specialReq,
      source: rfpa.source,
      selectedParty,
      paymentInfo: rfpa.paymentInfo
        ? {
            paymentMode: rfpa.paymentInfo.paymentMode,
            paymentDate: rfpa.paymentInfo.paymentDate,
            advancePaidAmt: rfpa.paymentInfo.advancePaidAmt,
            paymentTerms: rfpa.paymentInfo.paymentTerms,
            validityOfQuote: rfpa.paymentInfo.validityOfQuote,
            creditPeriod: rfpa.paymentInfo.creditPeriod,
            dueDate: rfpa.paymentInfo.dueDate,
          }
        : null,
      rfpaProducts: rfpa.rfpaProducts.map((product) => ({
        grade: product.grade,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        productName: product.productName?.name || null,
        variant: product.variant?.variantName || null,
        uom: product.uom?.unit || null,
        amount: product.amount,
        purchaseDate: product.purchaseDate,
        dispatchDate: product.dispatchDate,
        deliveryDate: product.deliveryDate,
        deliveryLocation: product.deliveryLocation,
        expectedHarvestDate: product.expectedHarvestDate,
      })),
    };
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  async generateRFPAId(): Promise<string> {
    const now = new Date();
    const yyyy = now.getFullYear().toString();
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const datePrefix = `RFPA${yyyy}${mm}${dd}`;

    const count = await this.rfpaRepository.count({
      where: { rfpaId: ILike(`${datePrefix}%`) },
    });

    return `${datePrefix}${(count + 1).toString().padStart(5, '0')}`;
  }

  
//   async createRfpa(rfpaData: any): Promise<any> {
//     try {

//       //TODO: Check approval flow is exit or not for logged user

//      const approvalFlowExit = await this.approvalFlowService.findApprovalFlowForLoggedUser(rfpaData.requestedBy, 'rfpa')
// console.log(approvalFlowExit)
//     if (!approvalFlowExit) {
//       throw new Error('Approval flow not found');
//     }


//       const rfpaId = await this.generateRFPAId();

// let variantIds: string[] = [];
//    if (Array.isArray(rfpaData.variants)) {
//   variantIds = rfpaData.variants;
// } else if (rfpaData.variants) {
//   // handle case where only single variant id is sent
//   variantIds = [rfpaData.variants];
// }

// if (!variantIds.length) {
//   throw new Error("No variant IDs provided");
// }

// const variants = await this.productVarientsRepository.find({
//   where: { id: In(variantIds) },
//   relations: ['product'],
// });
    
//     const productIds = variants.map(v => v.product?.id).filter(Boolean);

    
//     const rfpaEntity = this.rfpaRepository.create({
//       ...rfpaData,
//       rfpaId,
//       createdAt: new Date(),
//       variants: variants.map(v => ({ id: v.id })),  
//       products: productIds.map(id => ({ id })),     
//     });
      

//        const savedRfpa = await this.rfpaRepository.save(rfpaEntity);
//       console.log("saved rfpa", savedRfpa);
    


//      console.log("requestBY",rfpaData.requestedBy);

//       //Todo:By Vaishali
//        const document = await this.documentbService.createDocument({
//               type: DocumentTypeEnum.RFPA,
//               docDef: DocDefEnum.PROCUREMENT,
//              // totalAmt: rfpaData.totalAmt,
//               status: DocumentStatus.HOLD,
//               remarks: 'Document auto-created with RFPA',
//               lastActionBy: { id: rfpaData.requestedBy },
//               document_type_id: Array.isArray(savedRfpa) ? (savedRfpa[0] as RFPA)?.id : (savedRfpa as RFPA).id
//             },/* approvalFlowExit*/);
      
//             await this.documentbService.startApprovalFlow(document.id);
//       return savedRfpa;
//     } catch (error) {
//       console.log(error);
//       console.error('Error creating RFPA:', error);
//       throw new Error('Failed to create RFPA');
//     }
//   }





  async updateRfpa(id: string, rfpaData: any, updatedBy: string): Promise<any> {
    return await this.dataSource.transaction(async (manager) => {
      // Find existing RFPA with all relations
      const existingRfpa = await manager.findOne(RFPA, {
        where: { id },
        relations: [
          'companyName',
          'purchaseLocation',
          'purchaseForSalesLocation',
          'selectedVendor',
          'selectedFarmer',
          'paymentInfo',
          'rfpaProducts',
        ],
      });

      if (!existingRfpa) {
        throw new AppError(404, 'RFPA not found');
      }

      const originalRfpa = { ...existingRfpa };

      // Update basic RFPA fields
      if (rfpaData.rfpaId !== undefined) existingRfpa.rfpaId = rfpaData.rfpaId;
      if (rfpaData.requestingDepartment !== undefined) existingRfpa.requestingDepartment = rfpaData.requestingDepartment;
      if (rfpaData.otherPurchaseLoc !== undefined) existingRfpa.otherPurchaseLoc = rfpaData.otherPurchaseLoc;
      if (rfpaData.otherPurchaseForSalesLoc !== undefined) existingRfpa.otherPurchaseForSalesLoc = rfpaData.otherPurchaseForSalesLoc;
      if (rfpaData.deliveryReceivingPerson !== undefined) existingRfpa.deliveryReceivingPerson = rfpaData.deliveryReceivingPerson;
      if (rfpaData.packingInstruction !== undefined) existingRfpa.packingInstruction = rfpaData.packingInstruction;
      if (rfpaData.specialReq !== undefined) existingRfpa.specialReq = rfpaData.specialReq;
      if (rfpaData.source !== undefined) existingRfpa.source = rfpaData.source;
      if (rfpaData.remark !== undefined) existingRfpa.remark = rfpaData.remark;

      // Helper: extract id from either a plain string UUID or an object with .id
      const extractId = (value: any): string | null => {
        if (!value) return null;
        if (typeof value === 'string') return value;
        if (typeof value === 'object' && value.id) return value.id;
        return null;
      };

      // Handle company relation
      const companyId = extractId(rfpaData.companyName);
      if (companyId) {
        const company = await manager.findOne(Company, { where: { id: companyId } });
        if (company) existingRfpa.companyName = company;
      } else if (rfpaData.companyName === null) {
        existingRfpa.companyName = null as any;
      }

      // Handle purchase location relation
      const purchaseLocationId = extractId(rfpaData.purchaseLocation);
      if (purchaseLocationId) {
        const branch = await manager.findOne(Branches, { where: { id: purchaseLocationId } });
        if (branch) existingRfpa.purchaseLocation = branch;
      } else if (rfpaData.purchaseLocation === null) {
        existingRfpa.purchaseLocation = null as any;
      }

      // Handle purchase for sales location relation
      const purchaseForSalesLocationId = extractId(rfpaData.purchaseForSalesLocation);
      if (purchaseForSalesLocationId) {
        const branch = await manager.findOne(Branches, { where: { id: purchaseForSalesLocationId } });
        if (branch) existingRfpa.purchaseForSalesLocation = branch;
      } else if (rfpaData.purchaseForSalesLocation === null) {
        existingRfpa.purchaseForSalesLocation = null as any;
      }

      // Handle vendor/farmer via selectedParty or explicit fields
      const selectedPartyId = extractId(rfpaData.selectedParty);
      const selectedVendorId = extractId(rfpaData.selectedVendor) || (rfpaData.source === 'vendor' ? selectedPartyId : null);
      const selectedFarmerId = extractId(rfpaData.selectedFarmer) || (rfpaData.source === 'farmer' ? selectedPartyId : null);

      if (selectedVendorId) {
        const vendor = await manager.findOne(Vendor, { where: { id: selectedVendorId } });
        if (vendor) {
          existingRfpa.selectedVendor = vendor;
          existingRfpa.selectedFarmer = null as any;
        }
      } else if (rfpaData.selectedVendor === null && !selectedPartyId) {
        existingRfpa.selectedVendor = null as any;
      }

      if (selectedFarmerId) {
        const farmer = await manager.findOne(Farmer, { where: { id: selectedFarmerId } });
        if (farmer) {
          existingRfpa.selectedFarmer = farmer;
          existingRfpa.selectedVendor = null as any;
        }
      } else if (rfpaData.selectedFarmer === null && !selectedPartyId) {
        existingRfpa.selectedFarmer = null as any;
      }

      // Handle payment info
      if (rfpaData.paymentInfo) {
        const normalizedPaymentInfo = {
          ...rfpaData.paymentInfo,
          paymentDate: normalizeDateFormat(rfpaData.paymentInfo.paymentDate),
          dueDate: normalizeDateFormat(rfpaData.paymentInfo.dueDate),
          validityOfQuote: normalizeDateFormat(rfpaData.paymentInfo.validityOfQuote),
        };
        if (existingRfpa.paymentInfo) {
          Object.assign(existingRfpa.paymentInfo, normalizedPaymentInfo);
          await manager.save(PaymentInfoForRFPA, existingRfpa.paymentInfo);
        } else {
          const paymentInfo = manager.create(PaymentInfoForRFPA, normalizedPaymentInfo);
          const savedPaymentInfo = await manager.save(PaymentInfoForRFPA, paymentInfo);
          existingRfpa.paymentInfo = savedPaymentInfo;
        }
      } else if (rfpaData.paymentInfo === null && existingRfpa.paymentInfo) {
        await manager.remove(PaymentInfoForRFPA, existingRfpa.paymentInfo);
        existingRfpa.paymentInfo = null as any;
      }

      // Handle RFPA products
      if (rfpaData.rfpaProducts && Array.isArray(rfpaData.rfpaProducts)) {
        // Remove existing products
        if (existingRfpa.rfpaProducts && existingRfpa.rfpaProducts.length > 0) {
          await manager.remove(RFPAProduct, existingRfpa.rfpaProducts);
        }

        // Create new products
        const newProducts = [];
        for (const productData of rfpaData.rfpaProducts) {
          const product = manager.create(RFPAProduct, {
            ...productData,
            purchaseDate: normalizeDateFormat(productData.purchaseDate),
            expectedHarvestDate: normalizeDateFormat(productData.expectedHarvestDate),
            dispatchDate: normalizeDateFormat(productData.dispatchDate),
            deliveryDate: normalizeDateFormat(productData.deliveryDate),
            rfpa: existingRfpa,
          });
          
          // Handle product relations — support both plain UUID strings and objects with .id
          const productNameId = extractId(productData.productName);
          if (productNameId) {
            const productEntity = await manager.findOne(Product, { where: { id: productNameId } });
            if (productEntity) product.productName = productEntity;
          }

          const variantId = extractId(productData.variant);
          if (variantId) {
            const variantEntity = await manager.findOne(ProductVarient, { where: { id: variantId } });
            if (variantEntity) product.variant = variantEntity;
          }

          const uomId = extractId(productData.uom);
          if (uomId) {
            const uomEntity = await manager.findOne(UOM, { where: { id: uomId } });
            if (uomEntity) product.uom = uomEntity;
          }

          const savedProduct = await manager.save(RFPAProduct, product);
          newProducts.push(savedProduct);
        }
        existingRfpa.rfpaProducts = newProducts;
      }

      // Save the updated RFPA
      const updatedRfpa = await manager.save(RFPA, existingRfpa);

      // Log changes
      await this.auditLogService.logChange(
        'RFPA',
        updatedRfpa.id,
        originalRfpa,
        updatedRfpa,
        updatedBy,
      );

      await this.invalidateCache(id);

      // Return the updated entity with relations
      return await manager.findOne(RFPA, {
        where: { id: updatedRfpa.id },
        relations: [
          'companyName',
          'purchaseLocation',
          'purchaseForSalesLocation',
          'selectedVendor',
          'selectedFarmer',
          'paymentInfo',
          'rfpaProducts',
          'rfpaProducts.productName',
          'rfpaProducts.variant',
          'rfpaProducts.uom',
        ],
      });
    });
  }

  

  // // Approve RFPA and return the result
  // public async approveRFPA(rfpaId: string, userId: string, data: any) {
  //   // Find the RFPA record by ID
  //   const id =rfpaId;
  //   console.log(rfpaId)
  //   console.log("id is ",id)
  //   const rfpa = await this.rfpaRepository.findOne({
  //     where: { id },
  //     relations: [
  //       //'requestedBy',
  //       'selectedVendor',
  //       'selectedFarmer',
  //       'rfpaProducts',
  //       'rfpaProducts.productName',
  //       'rfpaProducts.uom',
  //       'paymentInfo',
  //     ],
  //   });
  //   //console.log(rfpa)
  //   if (!rfpa) {
  //     throw new Error('RFPA not found');
  //   }
  //    // Ensure only valid status changes are allowed
  //    if (data.approvalStatus !== 'approved' && data.approvalStatus !== 'rejected') {
  //     throw new Error('status plz check');
  // }

  //   // Update the status to approved
  //   //rfpa.approvalStatus = Status.APPROVED;
  //   rfpa.approvalNote=data.approvalNote || '';
  //   rfpa.rfpaApprovedAt= new Date()
  //   // Save the updated RFPA
  //   await this.rfpaRepository.save(rfpa);

  //   // Fetch the user details of the logged-in user
  //   const user = await this.userService.findUserById(userId);

  //   if (!user) {
  //     throw new Error('User not found');
  //   }

  //   // Prepare the response with user details
  //   const response = {
  //     message: 'RFPA status updated to Approved',
  //     user: {
  //       name: `${user.firstName} ${user.lastName}`,

  //       // department: user.selectDepartment,
  //     }
  //   };

  //   return response;
  // }

  // async findAllApprovedRfpas(): Promise<any[]> { // Replace Rfpa with your actual RFPA type/interface
  //   const rfpas = await this.rfpaRepository.find({
  //     where: {
  //       approvalStatus: DocumentApprovalStatus.APPROVED
  //     },

  //     order: {
  //       createdAt: 'DESC', // Assuming createdAt is a timestamp field
  //     },
  //   });

  //   return rfpas; // Return the result
  // }
//service

//TODO:Get Recycle Bin RFPA..By Vaishali
   public async getRecycleBinRfpa(queryOptions: PaginationOptions, userId: string): Promise<{
    data: any[];
    meta: { total: number; page: number; pages: number };
  }> {
    const cacheKey = `${this.CACHE_PREFIX}:recycle:${userId}:${JSON.stringify(queryOptions)}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const queryBuilder = await this.docSingalApproverService.getAllSingleApprovalDocumentsByUserId(
      userId,
      DocumentTypeEnum.RFPA,
      true, // includeDeleted for recycle bin
    );
    const { search } = queryOptions;
    const paginatedResult = await buildQueryFromArray(queryBuilder, queryOptions);

    const typedDocuments = paginatedResult.data as DocumentWithRelatedData[];
    const activeDocuments = typedDocuments;

    // ---- Batch fetch instead of N+1 ----
    const rfpaIds = activeDocuments
      .map(doc => doc.document_type_id)
      .filter(Boolean) as string[];

    const rfpas = rfpaIds.length
      ? await this.rfpaRepository
          .createQueryBuilder('rfpa')
          .leftJoinAndSelect('rfpa.selectedVendor', 'selectedVendor')
          .leftJoinAndSelect('selectedVendor.officeAddress', 'officeAddress')
          .leftJoinAndSelect('rfpa.selectedFarmer', 'selectedFarmer')
          .leftJoinAndSelect('selectedFarmer.residensialAddress', 'residensialAddress')
          .leftJoinAndSelect('selectedFarmer.farmAddress', 'farmAddress')
          .leftJoinAndSelect('rfpa.paymentInfo', 'paymentInfo')
          .leftJoinAndSelect('rfpa.rfpaProducts', 'rfpaProducts')
          .leftJoinAndSelect('rfpaProducts.productName', 'productName')
          .leftJoinAndSelect('rfpaProducts.uom', 'uom')
          .leftJoinAndSelect('rfpa.companyName', 'companyName')
          .leftJoinAndSelect('rfpa.purchaseLocation', 'purchaseLocation')
          .leftJoinAndSelect('rfpa.purchaseForSalesLocation', 'purchaseForSalesLocation')
          .where('rfpa.id IN (:...ids)', { ids: rfpaIds })
          .andWhere('rfpa.isDeleted = true')
          .getMany()
      : [];

    const rfpaMap = new Map(rfpas.map(r => [r.id, r]));

    let relatedDataOnly = activeDocuments
      .filter(doc => doc.document_type_id && rfpaMap.has(doc.document_type_id))
      .map((doc) => {
        const rd: any = rfpaMap.get(doc.document_type_id!)!;
        return {
          id: rd.id,
          documentId: doc.id,
          overAllStatus: doc.status,
          createdBy: doc.lastActionBy?.firstName || null,
          createdDate: formatDateTime(doc.createdAt).createdDate,
          createdTime: formatDateTime(doc.createdAt).createdTime,
          rfpaId: rd.rfpaId || null,
          remark: rd.remark || null,
          source: rd.source || null,
          specialRequest: rd.specialRequest || null,
          requestingDepartment: rd.requestingDepartment || null,
          otherPurchaseLoc: rd.otherPurchaseLoc || null,
          otherPurchaseForSalesLoc: rd.otherPurchaseForSalesLoc || null,
          deliveryReceivingPerson: rd.deliveryReceivingPerson,
          packingInstruction: rd.packingInstruction,
          vendor: rd.selectedVendor ? {
            selectedParty: rd.selectedParty || null,
            companyName: rd.selectedVendor.companyName || null,
            gstn: rd.selectedVendor.gstn || null,
            panNo: rd.selectedVendor.panNo || null,
            officeAddress: rd.selectedVendor.officeAddress || null,
          } : null,
          farmer: rd.selectedFarmer ? {
            selectedParty: rd.selectedParty || null,
            fullName: `${rd.selectedFarmer.farmerfName ?? ''} ${rd.selectedFarmer.farmermName ?? ''} ${rd.selectedFarmer.farmerlName ?? ''}`.trim(),
            primaryMobileNo: rd.selectedFarmer.primaryMobileNo || null,
            landStatus: rd.selectedFarmer.landStatus || null,
            totalLandArea: rd.selectedFarmer.totalLandArea || null,
            residensialAddress: rd.selectedFarmer.residensialAddress || null,
            farmAddress: rd.selectedFarmer.farmAddress || null,
          } : null,
          paymentInfo: rd.paymentInfo ? {
            paymentMode: rd.paymentInfo.paymentMode || null,
            paymentDate: rd.paymentInfo.paymentDate || null,
            advancePaidAmt: rd.paymentInfo.advancePaidAmt || null,
            paymentTerms: rd.paymentInfo.paymentTerms || null,
            dueDate: rd.paymentInfo.dueDate || null,
            creditPeriod: rd.paymentInfo.creditPeriod || null,
            validityOfQuote: rd.paymentInfo.validityOfQuote || null,
          } : null,
          rfpaProducts: rd.rfpaProducts ? rd.rfpaProducts.map((p: any) => ({
            productName: p.productName?.name || null,
            variant: p.variant?.variantName || null,
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
          })) : [],
          companyName: rd.companyName?.name || null,
          purchaseLocation: rd.purchaseLocation?.name || null,
          purchaseForSalesLocation: rd.purchaseForSalesLocation?.name || null,
        };
      });

    const objectToString = (obj: any): string => {
      if (obj == null) return '';
      if (typeof obj === 'object') return Object.values(obj).map((v) => objectToString(v)).join(' ');
      return String(obj);
    };

    if (search && search.trim()) {
      const term = search.toLowerCase();
      relatedDataOnly = relatedDataOnly.filter((item) =>
        objectToString(item).toLowerCase().includes(term)
      );
    }

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
        if (!isNaN(valA) && !isNaN(valB)) return (Number(valA) - Number(valB)) * sortOrder;
        return String(valA).localeCompare(String(valB)) * sortOrder;
      });
    }

    const result = {
      data: relatedDataOnly,
      meta: {
        total: paginatedResult.meta.total,
        page: paginatedResult.meta.page,
        pages: paginatedResult.meta.pages,
      },
    };
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }
// public async getAllRFPANumbers(
//   filter: {
//     overAllStatus?: string;
//     isDealSlipCreated?: boolean;
//     employeeBaseHirechey?: boolean;
//     page?: number;
//     limit?: number;
//     search?: string;
//   },
//   loginUserId: string
// ): Promise<{
//   data: {
//     id: string;
//     rfpaId: string;
//     documentId: string | null;
//   }[];
//   total: number;
//   page: number;
//   limit: number;
//   totalPages: number;
// }> {

//   const rfpaWhere: any = {};

//   if (typeof filter?.isDealSlipCreated === "boolean") {
//     rfpaWhere.isDealSlipCreated = filter.isDealSlipCreated;
//   }

//   // Fetch RFPA
//   const rfpas = await this.rfpaRepository.find({
//     select: ["id", "rfpaId", "isDealSlipCreated"],
//     where: rfpaWhere,
//     relations: ["createdBy"],
//     order: { createdAt: "DESC" }
//   });

//   const filteredResults: {
//     id: string;
//     rfpaId: string;
//     documentId: string | null;
//   }[] = [];

//   for (const rfpa of rfpas) {

//     if (!rfpa.id || !rfpa.rfpaId) {
//       continue;
//     }

//     // =============================
//     // Fetch Document
//     // =============================

//     const document = await this.documentbRepository.findOne({
//       where: { document_type_id: rfpa.id },
//       select: ["id", "status"]
//     });

//     const documentId = document?.id || null;
//     const documentStatus = document?.status;

//     // =============================
//     // Employee Hierarchy Logic
//     // =============================

//     if (filter?.employeeBaseHirechey) {

//       const approvalFlow = await this.approvalFlowRepository
//         .createQueryBuilder("approvalflows")

//         .leftJoinAndSelect("approvalflows.creator", "creator")
//         .leftJoinAndSelect("approvalflows.verifiers", "verifiers")

//         .leftJoinAndSelect("approvalflows.approvers", "approvers")

//         .leftJoinAndSelect("approvers.firstApprover", "firstApprover")
//         .leftJoinAndSelect("firstApprover.users", "firstApproverUsers")

//         .leftJoinAndSelect("approvers.secondApprover", "secondApprover")
//         .leftJoinAndSelect("secondApprover.users", "secondApproverUsers")

//         .leftJoinAndSelect("approvers.thirdApprover", "thirdApprover")
//         .leftJoinAndSelect("thirdApprover.users", "thirdApproverUsers")

//         .leftJoinAndSelect("approvalflows.finalizers", "finalizers")
//         .leftJoinAndSelect("finalizers.firstFinalizers", "firstFinalizers")
//         .leftJoinAndSelect("finalizers.secondFinalizers", "secondFinalizers")

//         .where("creator.id = :creatorId", { creatorId: rfpa.createdBy?.id })
//         .andWhere("approvalflows.type = :documentType", { documentType: "Procurement" })

//         .getOne();

//       if (!approvalFlow) {
//         continue;
//       }

//       let hierarchy = 0;

//       if (approvalFlow.creator?.id === loginUserId) {
//         hierarchy = 1;
//       }
//       else if (approvalFlow.verifiers?.some(v => v.id === loginUserId)) {
//         hierarchy = 2;
//       }
//       else if (approvalFlow.approvers?.firstApprover?.users?.some(u => u.id === loginUserId)) {
//         hierarchy = 3;
//       }
//       else if (approvalFlow.approvers?.secondApprover?.users?.some(u => u.id === loginUserId)) {
//         hierarchy = 4;
//       }
//       else if (approvalFlow.approvers?.thirdApprover?.users?.some(u => u.id === loginUserId)) {
//         hierarchy = 5;
//       }
//       else if (approvalFlow.finalizers?.firstFinalizers?.some(u => u.id === loginUserId)) {
//         hierarchy = 6;
//       }
//       else if (approvalFlow.finalizers?.secondFinalizers?.some(u => u.id === loginUserId)) {
//         hierarchy = 7;
//       }

//       if (hierarchy === 0) {
//         continue;
//       }

//       if (hierarchy === 1 && rfpa.createdBy?.id !== loginUserId) {
//         continue;
//       }
//     }

//     // =============================
//     // Status / DealSlip Filtering
//     // =============================

//     if (
//       filter?.overAllStatus &&
//       typeof filter?.isDealSlipCreated === "boolean"
//     ) {

//       if (
//         documentStatus === filter.overAllStatus &&
//         rfpa.isDealSlipCreated === filter.isDealSlipCreated
//       ) {
//         filteredResults.push({ id: rfpa.id, rfpaId: rfpa.rfpaId, documentId });
//       }

//     }

//     else if (filter?.overAllStatus) {

//       if (documentStatus === filter.overAllStatus) {
//         filteredResults.push({ id: rfpa.id, rfpaId: rfpa.rfpaId, documentId });
//       }

//     }

//     else if (typeof filter?.isDealSlipCreated === "boolean") {

//       if (rfpa.isDealSlipCreated === filter.isDealSlipCreated) {
//         filteredResults.push({ id: rfpa.id, rfpaId: rfpa.rfpaId, documentId });
//       }

//     }

//     else {
//       filteredResults.push({ id: rfpa.id, rfpaId: rfpa.rfpaId, documentId });
//     }

//   }

//   // =============================
//   // Search After Filtering
//   // =============================

//   let searchedResults = filteredResults;

//   if (filter?.search) {
//     const search = filter.search.toLowerCase();

//     searchedResults = filteredResults.filter(item =>
//       item.rfpaId.toLowerCase().includes(search)
//     );
//   }

//   // =============================
//   // Pagination
//   // =============================

//   const page = filter.page || 1;
//   const limit = filter.limit || 10;

//   const startIndex = (page - 1) * limit;
//   const endIndex = startIndex + limit;

//   const paginatedResults = searchedResults.slice(startIndex, endIndex);

//   return {
//     data: paginatedResults,
//     total: searchedResults.length,
//     page,
//     limit,
//     totalPages: Math.ceil(searchedResults.length / limit)
//   };
// }
public async getAllRFPANumbers(
  filter: {
    overAllStatus?: string;
    isDealSlipCreated?: boolean;
    employeeBaseHirechey?: boolean;
    page?: number;
    limit?: number;
    search?: string;
  },
  loginUserId: string
): Promise<any> {
  const hash = createHash('md5').update(JSON.stringify({ filter, loginUserId })).digest('hex');
  const cacheKey = `${this.CACHE_PREFIX}:rfpanumbers:${hash}`;
  const cached = await this.cacheService.get<any>(cacheKey);
  if (cached) return cached;

  const rfpaWhere: any = {};

  if (typeof filter?.isDealSlipCreated === "boolean") {
    console.log("--------------");
    
    rfpaWhere.isDealSlipCreated = filter.isDealSlipCreated;
  }

  // Fetch RFPA
  const rfpas = await this.rfpaRepository.find({
    select: ["id", "rfpaId", "isDealSlipCreated"],
    where: { ...rfpaWhere, isDeleted: false },
    relations: ["createdBy"],
    order: { createdAt: "DESC" }
  });

  const filteredResults: {
    id: string;
    rfpaId: string;
    documentId: string | null;
  }[] = [];

  for (const rfpa of rfpas) {

    if (!rfpa.id || !rfpa.rfpaId) {
      continue;
    }

    // =============================
    // Fetch Document
    // =============================

    const document = await this.documentbRepository.findOne({
      where: { document_type_id: rfpa.id },
      select: ["id", "status"]
    });

    const documentId = document?.id || null;
    const documentStatus = document?.status;

    // =============================
    // Employee Hierarchy Logic
    // =============================

    if (filter?.employeeBaseHirechey) {

      const approvalFlow = await this.approvalFlowRepository
        .createQueryBuilder("approvalflows")

        .leftJoinAndSelect("approvalflows.creator", "creator")
        .leftJoinAndSelect("approvalflows.verifiers", "verifiers")

        .leftJoinAndSelect("approvalflows.approvers", "approvers")

        .leftJoinAndSelect("approvers.firstApprover", "firstApprover")
        .leftJoinAndSelect("firstApprover.users", "firstApproverUsers")

        .leftJoinAndSelect("approvers.secondApprover", "secondApprover")
        .leftJoinAndSelect("secondApprover.users", "secondApproverUsers")

        .leftJoinAndSelect("approvers.thirdApprover", "thirdApprover")
        .leftJoinAndSelect("thirdApprover.users", "thirdApproverUsers")

        .leftJoinAndSelect("approvalflows.finalizers", "finalizers")
        .leftJoinAndSelect("finalizers.firstFinalizers", "firstFinalizers")
        .leftJoinAndSelect("finalizers.secondFinalizers", "secondFinalizers")

        .where("creator.id = :creatorId", { creatorId: rfpa.createdBy?.id })
        .andWhere("approvalflows.type = :documentType", { documentType: "Procurement" })

        .getOne();

      if (!approvalFlow) {
        continue;
      }

      let hierarchy = 0;

      if (approvalFlow.creator?.id === loginUserId) {
        hierarchy = 1;
      }
      else if (approvalFlow.verifiers?.some(v => v.id === loginUserId)) {
        hierarchy = 2;
      }
      else if (approvalFlow.approvers?.firstApprover?.users?.some(u => u.id === loginUserId)) {
        hierarchy = 3;
      }
      else if (approvalFlow.approvers?.secondApprover?.users?.some(u => u.id === loginUserId)) {
        hierarchy = 4;
      }
      else if (approvalFlow.approvers?.thirdApprover?.users?.some(u => u.id === loginUserId)) {
        hierarchy = 5;
      }
      else if (approvalFlow.finalizers?.firstFinalizers?.some(u => u.id === loginUserId)) {
        hierarchy = 6;
      }
      else if (approvalFlow.finalizers?.secondFinalizers?.some(u => u.id === loginUserId)) {
        hierarchy = 7;
      }

      if (hierarchy === 0) {
        continue;
      }

      if (hierarchy === 1 && rfpa.createdBy?.id !== loginUserId) {
        continue;
      }
    }

    // =============================
    // Status / DealSlip Filtering
    // =============================

    if (
      filter?.overAllStatus &&
      typeof filter?.isDealSlipCreated === "boolean"
    ) {

      if (
        documentStatus === filter.overAllStatus &&
        rfpa.isDealSlipCreated === filter.isDealSlipCreated
      ) {
        filteredResults.push({
           id: rfpa.id, 
           rfpaId: rfpa.rfpaId, 
           documentId });
      }

    }

    else if (filter?.overAllStatus) {

      if (documentStatus === filter.overAllStatus) {
        filteredResults.push({ 
          id: rfpa.id, 
          rfpaId: rfpa.rfpaId, 
          documentId });
      }

    }

    else if (typeof filter?.isDealSlipCreated === "boolean") {

      if (rfpa.isDealSlipCreated === filter.isDealSlipCreated) {
        filteredResults.push({ 
          id: rfpa.id, 
          rfpaId: rfpa.rfpaId, 
          documentId });
      }

    }

    else {
      filteredResults.push({ 
        id: rfpa.id, 
        rfpaId: rfpa.rfpaId, 
        documentId });
    }

  }

  // =============================
  // Search After Filtering
  // =============================

  let searchedResults = filteredResults;

  if (filter?.search) {
    const search = filter.search.toLowerCase();

    searchedResults = filteredResults.filter(item =>
      item.rfpaId.toLowerCase().includes(search)
    );
  }

  // =============================
  // Pagination
  // =============================

  const page = filter.page || 1;
  const limit = filter.limit || 10;

  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  const paginatedResults = searchedResults.slice(startIndex, endIndex);

  const result = {
    data: paginatedResults,
    total: searchedResults.length,
    page,
    limit,
    totalPages: Math.ceil(searchedResults.length / limit),
  };
  await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
  return result;
}

  

  async deleteRfpa(id: string): Promise<boolean> {
    
    const rfpa = await this.rfpaRepository.findOne({
      where: { id },
    });

  
    if (!rfpa) {
      throw new Error(`RFPA with ID ${id} not found`);
      return false;
    }

    
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); 
    sixMonthsFromNow.setHours(0, 0, 0, 0); 

    
    console.log(
      `RFPA with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`,
    );

    
    rfpa.deletionScheduledAt = sixMonthsFromNow;
    await this.rfpaRepository.save(rfpa);
    await this.invalidateCache(id);
    return true;
  }


  // //Todo:Get All RFPA..By Vaishali
  //  public async getAllRfpa(queryOptions: PaginationOptions, userId: string): Promise<{
  //   data: any[];
  //   meta: { total: number; page: number; pages: number };
  // }> {
  //   const data = await this.docSingalApproverService.getAllSingleApprovalDocumentsByUserId(
  //     userId,
  //     DocumentTypeEnum.RFPA,
  //   );
  // const { search } = queryOptions;
  //   console.log('Fetched documents:', data);
  
  //   const typedDocuments = data as DocumentWithRelatedData[];
  
  //   if (typedDocuments.length > 0) {
  //     console.log(typedDocuments.length)
  //     console.log("doc.relatedData", typedDocuments[0].relatedData);
  //   } else {
  //     console.log("No documents found for user.");
  //   }
  
  //   for (const doc of typedDocuments) {
  //     if (!doc.document_type_id) continue;
  
  //     try {
  //       doc.relatedData = await this.rfpaRepository.findOne({
  //         where: { id: doc.document_type_id },
  //       relations: [ 'selectedVendor',
  //         'selectedVendor.officeAddress',
  //         'selectedFarmer',
  //         'selectedFarmer.residensialAddress',
  //         'selectedFarmer.farmAddress',
  //         'paymentInfo',
  //         'rfpaProducts',
  //         'rfpaProducts.productName',
  //         'rfpaProducts.uom',
  //         'companyName',
  //         'purchaseLocation',
  //         'purchaseForSalesLocation',]
      
  
          
  //       });
  //     } catch (e) {
  //       console.log("in catch block", e);
  //       doc.relatedData = null;
  //     }
  //   }
  
  //   let relatedDataOnly = typedDocuments.map((doc) => {
  //     const rd = doc.relatedData || {};
  //     return {
        
  //     id:doc.relatedData?.id||null,
  //     documentId: doc?.id||null,
  //     overAllStatus: doc?.status,
  //     createdBy: doc.lastActionBy?.firstName || null,
  //     createdDate: formatDateTime(doc.createdAt).createdDate,
  //     createdTime: formatDateTime(doc.createdAt).createdTime,

  //     // RFPA core fields
  //     rfpaId: rd.rfpaId || null,
  //     remark: rd.remark || null,
  //     source:rd.source || null,
  //     specialReq: rd.specialReq || null,
  //     requestingDepartment: rd.requestingDepartment || null,
  //     otherPurchaseLoc: rd.otherPurchaseLoc || null,
  //     otherPurchaseForSalesLoc: rd.otherPurchaseForSalesLoc || null,

  //     // Vendor details
  //     vendor: rd.selectedVendor ? {
  //       selectedParty:rd.selectedParty || null,
  //       companyName: rd.selectedVendor.companyName || null,
  //       gstn: rd.selectedVendor.gstn || null,
  //       panNo: rd.selectedVendor.panNo || null,
  //       officeAddress: rd.selectedVendor.officeAddress || null,
  //     } : null,

  //     // Farmer details
  //     farmer: rd.selectedFarmer ? {
  //       selectedParty:rd.selectedParty || null,
  //       fullName: `${rd.selectedFarmer.farmerfName ?? ''} ${rd.selectedFarmer.farmermName ?? ''} ${rd.selectedFarmer.farmerlName ?? ''}`.trim(),
  //       primaryMobileNo: rd.selectedFarmer.primaryMobileNo || null,
  //       landStatus: rd.selectedFarmer.landStatus || null,
  //       totalLandArea: rd.selectedFarmer.totalLandArea || null,
  //       residensialAddress: rd.selectedFarmer.residensialAddress || null,
  //       farmAddress: rd.selectedFarmer.farmAddress || null,
  //     } : null,

  //     // Payment info
  //     paymentInfo: rd.paymentInfo ? {
  //       paymentMode: rd.paymentInfo.paymentMode || null,
  //       paymentDate: rd.paymentInfo.paymentDate || null,
  //       advancePaidAmt: rd.paymentInfo.advancePaidAmt || null,
  //       paymentTerms: rd.paymentInfo.paymentTerms || null,
  //       dueDate: rd.paymentInfo.dueDate || null,
  //       creditPeriod: rd.paymentInfo.creditPeriod || null,
  //       validityOfQuote: rd.paymentInfo.validityOfQuote || null,
  //     } : null,

  //     // Products
  //     rfpaProducts: rd.rfpaProducts ? rd.rfpaProducts.map((p: any) => ({
  //       productName: p.productName?.name || null,
  //       grade: p.grade || null,
  //       quantity: p.quantity || null,
  //       uom: p.uom?.unit || null,
  //       unitPrice: p.unitPrice || null,
  //       amount: p.amount || null,
  //       purchaseDate: p.purchaseDate || null,
  //       expectedHarvestDate: p.expectedHarvestDate || null,
  //       dispatchDate: p.dispatchDate || null,
  //       deliveryDate: p.deliveryDate || null,
  //       deliveryLocation: p.deliveryLocation || null,
  //       count: p.count || null,
  //       size: p.size || null,
  //       origin: p.origin || null,
  //       variety: p.variety || null,
  //     })) : [],

  //     // Company & branches
  //     companyName: rd.companyName?.name || null,
  //     purchaseLocation: rd.purchaseLocation?.name || null,
  //     purchaseForSalesLocation: rd.purchaseForSalesLocation?.name || null,
  //     };
  //   });
  //  // 🔍 Deep Search Logic
  // const objectToString = (obj: any): string => {
  //   if (obj == null) return '';
  //   if (typeof obj === 'object') {
  //     return Object.values(obj).map((v) => objectToString(v)).join(' ');
  //   }
  //   return String(obj);
  // };

  // if (search && search.trim()) {
  //   const term = search.toLowerCase();
  //   relatedDataOnly = relatedDataOnly.filter((item) =>
  //     objectToString(item).toLowerCase().includes(term)
  //   );
  // }
  //   return {
  //     data: relatedDataOnly,
  //     meta: {
  //       total: relatedDataOnly.length,
  //       page: queryOptions.page || 1,
  //       pages: Math.ceil(relatedDataOnly.length / (queryOptions.limit || 10)),
  //     }
  //   };
  // }

  //Todo:Get All RFPA..By Vaishali
   //Todo:Get All RFPA..By Vaishali
  public async getAllRfpa(queryOptions: PaginationOptions, userId: string): Promise<{
    data: any[];
    meta: { total: number; page: number; pages: number };
  }> {
    const cacheKey = `${this.CACHE_PREFIX}:list:${userId}:${JSON.stringify(queryOptions)}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const queryBuilder = await this.docSingalApproverService.getAllSingleApprovalDocumentsByUserId(
      userId,
      DocumentTypeEnum.RFPA,
    );
    const { search } = queryOptions;
    const paginatedResult = await buildQueryFromArray(queryBuilder, queryOptions);

    const typedDocuments = paginatedResult.data as DocumentWithRelatedData[];
    const activeDocuments = typedDocuments;

    // ---- Batch fetch: one query instead of N+1 ----
    const rfpaIds = activeDocuments
      .map(doc => doc.document_type_id)
      .filter(Boolean) as string[];

    const rfpas = rfpaIds.length
      ? await this.rfpaRepository
          .createQueryBuilder('rfpa')
          .leftJoinAndSelect('rfpa.companyName', 'companyName')
          .leftJoinAndSelect('rfpa.purchaseLocation', 'purchaseLocation')
          .leftJoinAndSelect('rfpa.purchaseForSalesLocation', 'purchaseForSalesLocation')
          .leftJoinAndSelect('rfpa.paymentInfo', 'paymentInfo')
          .where('rfpa.id IN (:...ids)', { ids: rfpaIds })
          .andWhere('rfpa.isDeleted = false')
          .andWhere('rfpa.deletedAt IS NULL')
          .getMany()
      : [];

    const rfpaMap = new Map(rfpas.map(r => [r.id, r]));

    let relatedDataOnly = activeDocuments
      .filter(doc => doc.document_type_id && rfpaMap.has(doc.document_type_id))
      .map((doc) => {
        const rd: any = rfpaMap.get(doc.document_type_id!)!;
        return {
          id: rd.id,
          documentId: doc.id,
          overAllStatus: doc.status,
          createdBy: doc.lastActionBy?.firstName || null,
          createdDate: formatDateTime(doc.createdAt).createdDate,
          createdTime: formatDateTime(doc.createdAt).createdTime,
          rfpaId: rd.rfpaId || null,
          remark: rd.remark || null,
          source: rd.source || null,
          deliveryReceivingPerson: rd.deliveryReceivingPerson,
          packingInstruction: rd.packingInstruction,
          paymentInfo: rd.paymentInfo ? {
            paymentMode: rd.paymentInfo.paymentMode || null,
            paymentDate: rd.paymentInfo.paymentDate || null,
            advancePaidAmt: rd.paymentInfo.advancePaidAmt || null,
            paymentTerms: rd.paymentInfo.paymentTerms || null,
            dueDate: rd.paymentInfo.dueDate || null,
            creditPeriod: rd.paymentInfo.creditPeriod || null,
            validityOfQuote: rd.paymentInfo.validityOfQuote || null,
          } : null,
          companyName: rd.companyName?.name || null,
          purchaseLocation: rd.purchaseLocation?.name || null,
          purchaseForSalesLocation: rd.purchaseForSalesLocation?.name || null,
        };
      });

    // 🔍 Deep search
    const objectToString = (obj: any): string => {
      if (obj == null) return '';
      if (typeof obj === 'object') return Object.values(obj).map((v) => objectToString(v)).join(' ');
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
        if (!isNaN(valA) && !isNaN(valB)) return (Number(valA) - Number(valB)) * sortOrder;
        return String(valA).localeCompare(String(valB)) * sortOrder;
      });
    }

    const result = {
      data: relatedDataOnly,
      meta: {
        total: paginatedResult.meta.total,
        page: paginatedResult.meta.page,
        pages: paginatedResult.meta.pages,
      },
    };

    await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }



  //TODO:Get RFPA By Id For View.. BY Vaishali
// public async getRfpaByIdForView(docid: string, userId:string): Promise<any> {
//     const document = await this.docSingalApproverService.getSingleApprovalDocumentById(docid,userId)
//     if(!document)
//     {
//       return null;
//     }
//     const id = document.documentTypeId;
//     console.log('id in getRfpaByIdForView', id);
    
    
//   if (!id) {
//     throw new Error('Document type ID not found.');
//   }

//   // fetch RFPA entity with relations
//   const rfpa = await this.rfpaRepository.findOne({
//     where: { id },
//     relations: [
//       'selectedVendor',
//       'selectedVendor.officeAddress',
//       'selectedFarmer',
//       'selectedFarmer.residensialAddress',
//       'selectedFarmer.farmAddress',
//       'paymentInfo',
//       'rfpaProducts',
//       'rfpaProducts.productName',
//       'rfpaProducts.uom',
//       'companyName',
//       'purchaseLocation',
//       'purchaseForSalesLocation',
//     ],
//   });

//   if (!rfpa) {
//     throw new Error('RFPA not found');
//   }

//   const rawDate = document.createdAt;
//   const { createdDate, createdTime } = formatDateTime(rawDate);

//   return {
//     documentId: document.documentId,
//     overAllStatus: document.status,
//     createdBy: document.createdBy,
//      createdDate: formatDateTime(document.createdAt).createdDate,
//       createdTime: formatDateTime(document.createdAt).createdTime,
//     approvalSummary: document.approvalSummary,

//     // RFPA core fields
//     rfpaId: rfpa.rfpaId || null,
//     remark: rfpa.remark || null,
//     source:rfpa.source || null,
//     specialRequest: rfpa.specialRequest || null,
//     requestingDepartment: rfpa.requestingDepartment || null,
//     otherPurchaseLoc: rfpa.otherPurchaseLoc || null,
//     otherPurchaseForSalesLoc: rfpa.otherPurchaseForSalesLoc || null,

//     // Vendor details
//     vendor: rfpa.selectedVendor ? {
//       companyName: rfpa.selectedVendor.companyName || null,
//       gstn: rfpa.selectedVendor.gstn || null,
//       panNo: rfpa.selectedVendor.panNo || null,
//       officeAddress: rfpa.selectedVendor.officeAddress || null,
//     } : null,

//     // Farmer details
//     farmer: rfpa.selectedFarmer ? {
//       fullName: `${rfpa.selectedFarmer.farmerfName ?? ''} ${rfpa.selectedFarmer.farmermName ?? ''} ${rfpa.selectedFarmer.farmerlName ?? ''}`.trim(),
//       primaryMobileNo: rfpa.selectedFarmer.primaryMobileNo || null,
//       landStatus: rfpa.selectedFarmer.landStatus || null,
//       totalLandArea: rfpa.selectedFarmer.totalLandArea || null,
//       residensialAddress: rfpa.selectedFarmer.residensialAddress || null,
//       farmAddress: rfpa.selectedFarmer.farmAddress || null,
//     } : null,

//     // Payment info
//     paymentInfo: rfpa.paymentInfo ? {
//       paymentMode: rfpa.paymentInfo.paymentMode || null,
//       paymentDate: rfpa.paymentInfo.paymentDate || null,
//       advancePaidAmt: rfpa.paymentInfo.advancePaidAmt || null,
//       paymentTerms: rfpa.paymentInfo.paymentTerms || null,
//       dueDate: rfpa.paymentInfo.dueDate || null,
//       creditPeriod: rfpa.paymentInfo.creditPeriod || null,
//       validityOfQuote: rfpa.paymentInfo.validityOfQuote || null,
//     } : null,

//     // Products
//     rfpaProducts: rfpa.rfpaProducts ? rfpa.rfpaProducts.map((p: any) => ({
//       productName: p.productName?.name || null,
//       grade: p.grade || null,
//       quantity: p.quantity || null,
//       uom: p.uom?.unit || null,
//       unitPrice: p.unitPrice || null,
//       amount: p.amount || null,
//       purchaseDate: p.purchaseDate || null,
//       expectedHarvestDate: p.expectedHarvestDate || null,
//       dispatchDate: p.dispatchDate || null,
//       deliveryDate: p.deliveryDate || null,
//       deliveryLocation: p.deliveryLocation || null,
//       count: p.count || null,
//       size: p.size || null,
//       origin: p.origin || null,
//       variety: p.variety || null,
//     })) : [],

//     // Company & branches
//     companyName: rfpa.companyName?.name || null,
//     purchaseLocation: rfpa.purchaseLocation?.name || null,
//     purchaseForSalesLocation: rfpa.purchaseForSalesLocation?.name || null,
//   };

// }


public async getRfpaByIdForView(docid: string, userId:string): Promise<any> {
    const document = await this.docSingalApproverService.getSingleApprovalDocumentById(docid,userId)
    if(!document)
    {
      return null;
    }
    const id = document.documentTypeId;
    console.log('id in getRfpaByIdForView', id);
    
    
  if (!id) {
    throw new Error('Document type ID not found.');
  }

  // fetch RFPA entity with relations
  const rfpaEntity = await this.rfpaRepository.findOne({
    where: { id },
    relations: [
      'selectedVendor',
      'selectedVendor.officeAddress',
      'selectedVendor.vendorSaleInfo',
      'selectedFarmer',
      'selectedFarmer.residensialAddress',
      'selectedFarmer.farmAddress',
      'paymentInfo',
      'rfpaProducts',
      'rfpaProducts.productName',
      'rfpaProducts.uom',
      'rfpaProducts.variant',
      'companyName',
      'purchaseLocation',
      'purchaseForSalesLocation',
    ],
  });

  if (!rfpaEntity) {
    throw new Error('RFPA not found');
  }

  const rawDate = document.createdAt;
  const { createdDate, createdTime } = formatDateTime(rawDate);

const selectedVendorInRFPA = rfpaEntity.selectedVendor ? {
      companyName: rfpaEntity.selectedVendor.companyName || null,
      vendorCode: rfpaEntity.selectedVendor.vendorCode || null,
      contactPersonName: `${rfpaEntity.selectedVendor?.vendorSaleInfo?.contactFName ?? ''} ${rfpaEntity.selectedVendor?.vendorSaleInfo?.contactLName ?? ''}`.trim() || null,
      officeContactNo: rfpaEntity.selectedVendor.officeContactNo || null,
      officeEmail: rfpaEntity.selectedVendor.officeEmail || null,
      officeAddress: rfpaEntity.selectedVendor.officeAddress || null,
    } : null;

const selectedFarmerInRFPA = rfpaEntity.selectedFarmer ? {
      fullName: `${rfpaEntity.selectedFarmer.farmerfName ?? ''} ${rfpaEntity.selectedFarmer.farmermName ?? ''} ${rfpaEntity.selectedFarmer.farmerlName ?? ''}`.trim(),
      primaryMobileNo: rfpaEntity.selectedFarmer.primaryMobileNo || null,
      email: rfpaEntity.selectedFarmer.email || null,
      farmerCode: rfpaEntity.selectedFarmer.farmerCode || null,
      residensialAddress: rfpaEntity.selectedFarmer.residensialAddress || null,
      farmAddress: rfpaEntity.selectedFarmer.farmAddress || null
    } : null;

const selectedPartyData = rfpaEntity.source === 'vendor' ? selectedVendorInRFPA : selectedFarmerInRFPA;



  return {
    documentId: document.documentId,
    overAllStatus: document.status,
    createdBy: document.createdBy,
    createdDate: formatDateTime(document.createdAt).createdDate,
    createdTime: formatDateTime(document.createdAt).createdTime,
    approvalSummary: document.approvalSummary,

    // RFPA core fields
    rfpaId: rfpaEntity.rfpaId || null,
    remark: rfpaEntity.remark || null,
    specialReq: rfpaEntity.specialReq || null,
    requestingDepartment: rfpaEntity.requestingDepartment || null,
    otherPurchaseLoc: rfpaEntity.otherPurchaseLoc || null,
    otherPurchaseForSalesLoc: rfpaEntity.otherPurchaseForSalesLoc || null,
    source: rfpaEntity.source || null,
    deliveryReceivingPerson: rfpaEntity.deliveryReceivingPerson || null,
    packingInstruction: rfpaEntity.packingInstruction || null,

    // Vendor / Farmer Data
    selectedParty: selectedPartyData,

    // Payment info
    paymentInfo: rfpaEntity.paymentInfo ? {
      paymentMode: rfpaEntity.paymentInfo.paymentMode || null,
      paymentDate: rfpaEntity.paymentInfo.paymentDate || null,
      advancePaidAmt: rfpaEntity.paymentInfo.advancePaidAmt || null,
      paymentTerms: rfpaEntity.paymentInfo.paymentTerms || null,
      dueDate: rfpaEntity.paymentInfo.dueDate || null,
      creditPeriod: rfpaEntity.paymentInfo.creditPeriod || null,
      validityOfQuote: rfpaEntity.paymentInfo.validityOfQuote || null,
    } : null,

    // Products
    rfpaProducts: rfpaEntity.rfpaProducts ? rfpaEntity.rfpaProducts.map((p: any) => ({
      productName: p.productName?.name || null,
      variant: p.variant?.variantName || null,
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
    })) : [],

    // Company & branches
    companyName: rfpaEntity.companyName?.name || null,
    purchaseLocation: rfpaEntity.purchaseLocation?.name || null,
    purchaseForSalesLocation: rfpaEntity.purchaseForSalesLocation?.name || null,
  }

}

//TODO:Filterd RFPA By Vaishali...20/08/2025
   async filterRfpas(
    page: number,
    limit: number,
    filters: Record<string, any>
  ) {
    const queryBuilder: SelectQueryBuilder<RFPA> =
      this.rfpaRepository.createQueryBuilder("rfpa");
  
    // ✅ Select all fields from Rfpa
    queryBuilder.select("rfpa");

    // ✅ Exclude soft-deleted records
    queryBuilder
      .where("rfpa.isDeleted = false")
      .andWhere("rfpa.deletedAt IS NULL");
  
    // ✅ Join relations but select only specific fields
    queryBuilder
      .leftJoin("rfpa.companyName", "companyName")
      .addSelect("companyName.name")
      .leftJoin("rfpa.purchaseLocation", "purchaseLocation")
      .addSelect("purchaseLocation.name")
      .leftJoin("rfpa.purchaseForSalesLocation", "purchaseForSalesLocation")
      .addSelect("purchaseForSalesLocation.name")
      .leftJoin("rfpa.selectedVendor", "selectedVendor")
    .addSelect(["selectedVendor.companyName"])
    .leftJoin("rfpa.selectedFarmer", "selectedFarmer")
    .addSelect([
      "selectedFarmer.farmerlName",
      "selectedFarmer.farmermName",
      "selectedFarmer.farmerfName",
    ])
    .leftJoin("rfpa.paymentInfo","paymentInfo")
    .addSelect("paymentInfo.paymentMode")
    .leftJoinAndSelect("rfpa.rfpaProducts", "rfpaProducts")
    .leftJoinAndSelect("rfpaProducts.productName", "product")
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
        queryBuilder.andWhere(`rfpa.${key} ILIKE :${paramKey}`, {
          [paramKey]: `%${value}%`,
        });
      } else {
        queryBuilder.andWhere(`rfpa.${key} = :${paramKey}`, {
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

  async deleteMultipleRFPA(ids: string[]) {

    for (const id of ids) {
      const rfpa = await this.rfpaRepository.findOne({ where: { id } });
      if (!rfpa) throw new Error(`RFPA with ID ${id} not found`);

      // Soft delete related document
      const relatedDocument = await this.documentbRepository.findOne({
        where: { document_type_id: rfpa.id },
      });
      if (relatedDocument) {
        await this.documentbRepository.softDelete(relatedDocument.id);
        await this.documentbRepository.update(relatedDocument.id, { isDeleted: true } as any);
      }

      // Soft delete RFPA
      await this.rfpaRepository.softDelete(rfpa.id);
      await this.rfpaRepository.update(rfpa.id, { isDeleted: true } as any);

      // Bust per-id caches
      await Promise.all([
        this.cacheService.del(`${this.CACHE_PREFIX}:id:${id}`),
        this.cacheService.del(`${this.CACHE_PREFIX}:update:${id}`),
        this.cacheService.del(`${this.CACHE_PREFIX}:view:${id}`),
      ]);
    }

    // Bust list/all caches once after all deletes
    await Promise.all([
      this.cacheService.invalidatePattern(`${this.CACHE_PREFIX}:list:*`),
      this.cacheService.invalidatePattern(`${this.CACHE_PREFIX}:recycle:*`),
      this.cacheService.invalidatePattern(`${this.CACHE_PREFIX}:all:*`),
      this.cacheService.invalidatePattern(`${this.CACHE_PREFIX}:rfpanumbers:*`),
    ]);

    return { message: 'RFPA records marked for deletion successfully' };

  }

}
