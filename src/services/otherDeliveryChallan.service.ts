import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { OtherDeliveryChallanRepository } from '../repositories/otherDeliveryChallan.repository';
import logger from '../utils/logger';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import { formatDateTime } from '../utils/dateUtils';
import { DataSource } from 'typeorm';
import { DocumentWithRelatedData, DocumentbService } from './documentb.service';
import { DocDoubleApproverService } from './docDoubleApprover.service';
import { DeliveryChallanService } from './deliveryChallan.service';
import { CustomerDeliveryChallanService } from './customerDeliveryChallan.service';
import { DocumentStatus, DocumentTypeEnum } from '../entities/docuemnt.entity';
import { DocumentTypeEnum as DocDefEnum } from '../entities/documentdef.entity';
import { CacheService } from './cache.service';
import { createHash } from 'crypto';
import { DocumentbRepository } from '../repositories/documentb.repository';


@injectable()
export class OtherDeliveryChallanService {
  constructor(
    @inject(TYPES.OtherDeliveryChallanRepository)
    private readonly challanRepository: OtherDeliveryChallanRepository,
    @inject(TYPES.DataSource)
    private readonly dataSource: DataSource,
        @inject(TYPES.DocumentbService)
            private readonly documentbService: DocumentbService,
            @inject(TYPES.DocDoubleApproverService)
                private readonly docDoubleApproverService: DocDoubleApproverService,
                @inject(TYPES.DeliveryChallanService)
                private readonly deliveryChallanService: DeliveryChallanService,
                     @inject(TYPES.CustomerDeliveryChallanService)
    private readonly customerDeliveryChallanService:CustomerDeliveryChallanService,
    @inject(TYPES.CacheService)
    private readonly cacheService: CacheService,
    @inject(TYPES.DocumentbRepository)
    private readonly documentbRepository: DocumentbRepository,
  ) {}

  private readonly CACHE_PREFIX = 'odc';
  private readonly CACHE_TTL = 180;

  private async invalidateCache(id?: string): Promise<void> {
    const tasks: Promise<any>[] = [
      this.cacheService.invalidatePattern(`${this.CACHE_PREFIX}:list:*`),
    ];
    if (id) {
      tasks.push(
        this.cacheService.del(`${this.CACHE_PREFIX}:id:${id}`),
        this.cacheService.del(`${this.CACHE_PREFIX}:view:${id}`),
        this.cacheService.del(`${this.CACHE_PREFIX}:update:${id}`),
      );
    }
    await Promise.all(tasks);
  }

  async create(data: any): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      data.challanNo = await this.customerDeliveryChallanService.generateVoucherNo(data.type || 'O');

      const challanData: any = {
        challanNo: data.challanNo,
        type: 'other-delivery-challan',
        companyName: data.companyName ? { id: data.companyName } : undefined,
        offices: data.offices ? { id: data.offices } : undefined,
        grnNo: data.grnNo ? { id: data.grnNo } : undefined,
        fromLocation: data.fromLocation ? { id: data.fromLocation } : undefined,
        driverName: data.driverName,
        contactNo: data.contactNo,
        altContactNo: data.altContactNo,
        vehicleNo: data.vehicleNo,
        licenseNo: data.licenseNo,
        rmn: data.rmn,
        receiverName: data.receiverName,
        transitInsuranceNo: data.transitInsuranceNo || null,
        totalProductAmount: data.totalProductAmount,
        netProductWeight: data.netProductWeight,
        netPackagingMaterialWeight: data.netPackagingMaterialWeight,
        totalPackagingMaterialAmount: data.totalPackagingMaterialAmount,
        totalAmtInWords: data.totalAmtInWords,
        requestingDepartment: data.requestingDepartment,
        remark: data.remark,
        anyAttachment: data.anyAttachment,
        createdBy: data.createdBy ? { id: data.createdBy } : undefined,
        // OtherDeliveryChallan specific fields (varchar columns)
        customer: data.customerName || data.customer || null,
        customerContactNo: data.customerContactNo || null,
        customerEmail: data.customerEmail || null,
        deliveryChallanProducts: data.deliveryChallanProducts,
      };

      // Handle customerAddress — create new if object, link if UUID string
      if (data.customerAddress && typeof data.customerAddress === 'object') {
        const newAddress = queryRunner.manager.create('Address', {
          address1: data.customerAddress.address1,
          address2: data.customerAddress.address2,
          location: data.customerAddress.location,
          city: data.customerAddress.city,
          state: data.customerAddress.state,
          pincode: data.customerAddress.pincode,
        });
        const savedAddress = await queryRunner.manager.save(newAddress) as any;
        challanData.customerAddress = { id: savedAddress.id };
      } else if (data.customerAddress && typeof data.customerAddress === 'string') {
        challanData.customerAddress = { id: data.customerAddress };
      }

      const challan = queryRunner.manager.create(this.challanRepository.target, challanData);
      const savedChallanArr = await queryRunner.manager.save(challan);
      const savedChallan = Array.isArray(savedChallanArr) ? savedChallanArr[0] : savedChallanArr;

      const document = await this.documentbService.createDocument({
        type: DocumentTypeEnum.DC_TYPE_OTHER,
        docDef: DocDefEnum.OPERATION,
        status: DocumentStatus.HOLD,
        remarks: 'Document auto-created with Other Delivery Challan',
        lastActionBy: { id: data.createdBy },
        document_type_id: savedChallan.id,
      });

      // Commit transaction - all operations succeeded
      await queryRunner.commitTransaction();

      // Start approval flow after commit so challan is visible to other DB connections
      await this.documentbService.startApprovalFlow(document.id);
      await this.invalidateCache();

      return savedChallan;
    } catch (error: any) {
      // Rollback transaction - undo all changes
      await queryRunner.rollbackTransaction();
      console.error('Error creating GRN:', error);
      throw new Error('Failed to create GRN');
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }
  catch(err: any) {
    logger.error('Error creating other delivery challan', { error: err });
    return null;
  }

  async getById(id: string): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}:id:${id}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.challanRepository.findOne({
        where: { id },
        relations: [
          'deliveryChallanProducts',
          'deliveryChallanProducts.productName',
          'deliveryChallanProducts.packagingMaterial',
          'deliveryChallanProducts.packagingMaterialUoM',
          'deliveryChallanProducts.saleUoM',
          'companyName',
          'offices',
          'grnNo',
          'fromLocation',
        ],
      });
      if (result) await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (err) {
      logger.error(`Error fetching other delivery challan by ID: ${id}`, {
        error: err,
      });
      return null;
    }
  }

  async getByIdChallanforView(docId: string): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}:view:${docId}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const document = await this.docDoubleApproverService.getDocumentById(docId);
    const id = document.documentTypeId;

    if (!id) return null;

    const challan = await this.challanRepository
      .createQueryBuilder('challan')
      .leftJoinAndSelect('challan.deliveryChallanProducts', 'products')
      .leftJoinAndSelect('products.productName', 'productName')
      .leftJoinAndSelect('products.variant', 'variant')
      .leftJoinAndSelect('products.packagingMaterial', 'packagingMaterial')
      .leftJoinAndSelect('products.packagingMaterialUoM', 'packagingMaterialUoM')
      .leftJoinAndSelect('products.saleUoM', 'saleUoM')
      .leftJoinAndSelect('challan.companyName', 'company')
      .leftJoinAndSelect('challan.customerAddress', 'customerAddress')
      .leftJoinAndSelect('challan.offices', 'office')
      .leftJoinAndSelect('challan.grnNo', 'grn')
      .leftJoinAndSelect('challan.fromLocation', 'fromLocation')
      .where('challan.id = :id', { id })
      .getOne();

    if (!challan) {
      return null;
    }

    const { createdDate, createdTime } = formatDateTime(challan.createdAt);

    const formattedChallan = {
      id: challan.id,
      challanNo: challan.challanNo,

      companyName: challan.companyName?.name || null,
      office: challan.offices?.name || null,
      grnNo: challan.grnNo?.grnNo || null,
      fromLocation: challan.fromLocation?.name||null,
       
      driverName: challan.driverName,
      contactNo: challan.contactNo,
      altContactNo: challan.altContactNo,
      vehicleNo: challan.vehicleNo,
      licenseNo: challan.licenseNo,
      receiverName: challan.receiverName,
      rmn: challan.rmn,
      transitInsuranceNo: challan.transitInsuranceNo || null,
      totalProductAmount: challan.totalProductAmount,
      netProductWeight: challan.netProductWeight,
      netPackagingMaterialWeight: challan.netPackagingMaterialWeight,
      totalPackagingMaterialAmount: challan.totalPackagingMaterialAmount,
    
      totalAmtInWords: challan.totalAmtInWords,
      createdDate,
      createdTime,
      //requestingDepartment: challan.requestingDepartment,
      // approvalStatus: challan.approvalStatus,
      customer: (challan as any).customer || null,
      customerContactNo: (challan as any).customerContactNo || null,
      customerEmail: (challan as any).customerEmail || null,
      //customerAddress:challan.customerAddress.address1||" "+ challan.customerAddress.address2||" "+challan.customerAddress.location||""+challan.customerAddress.city||""+challan.customerAddress.state||""+challan.customerAddress.pincode,
      customerAddress: (challan as any).customerAddress
  ? [
      (challan as any).customerAddress.address1,
      (challan as any).customerAddress.address2,
      (challan as any).customerAddress.location,
      (challan as any).customerAddress.city,
      (challan as any).customerAddress.state,
      (challan as any).customerAddress.pincode
    ]
      .filter(Boolean)
      .join(' ')   // space instead of comma
  : null,
      remark: challan.remark,
      anyAttachment: challan.anyAttachment,
      deliveryChallanProducts: challan.deliveryChallanProducts.map(
        (product) => ({
          id: product.id,
          productName: product.productName?.name,
          variant:product.variant?.variantName,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          amount: product.amount,
          saleUoM: product.saleUoM?.unit || null,
          packagingMaterial:
            product.packagingMaterial?.packagingMaterialName || null,
             netWeight:product.netWeight,
             grossWeight:product.grossWeight,
          packagingMaterialUoM: product.packagingMaterialUoM?.unit || null,
          packagingMaterialAmount: product.packagingMaterialAmount,
          packagingMaterialUnitPrice: product.packagingMaterialUnitPrice,
          packagingMaterialQuantity: product.packagingMaterialQuantity,
          packingMaterialWeight:product.packingMaterialWeight,
          packagingMaterialTotalWeight: product.packagingMaterialTotalWeight,
        }),
      ),
      overAllStatus: document.overAllStatus,
      createdBy: document.createdBy,
      approvalSummary: document.approvalSummary,
      documentId: document.documentId,
    };

    await this.cacheService.set(cacheKey, formattedChallan, this.CACHE_TTL);
    return formattedChallan;
  }
  async getByIdChallanforUpdate(id: string): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}:update:${id}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const challan = await this.challanRepository
      .createQueryBuilder('challan')
      .leftJoinAndSelect('challan.deliveryChallanProducts', 'products')
      .leftJoinAndSelect('products.productName', 'productName')
      .leftJoinAndSelect('products.variant', 'variant')
      .leftJoinAndSelect('products.packagingMaterial', 'packagingMaterial')
      .leftJoinAndSelect(
        'products.packagingMaterialUoM',
        'packagingMaterialUoM',
      )
      .leftJoinAndSelect('products.saleUoM', 'saleUoM')
      .leftJoinAndSelect('challan.companyName', 'company')
      .leftJoinAndSelect('challan.customerAddress', 'customerAddress')
      .leftJoinAndSelect('challan.offices', 'office')
      .leftJoinAndSelect('challan.grnNo', 'grn')
      .leftJoinAndSelect('challan.fromLocation', 'fromLocation')
      .where('challan.id = :id', { id })
      .getOne();

    if (!challan) {
      return null;
    }

    const { createdDate, createdTime } = formatDateTime(challan.createdAt);

    const formattedChallan = {
      id: challan.id,
      challanNo: challan.challanNo,

      companyName: challan.companyName?.id || null,
      office: challan.offices?.id || null,
      grnNo: challan.grnNo?.id || null,
      fromLocation: challan.fromLocation?.id || null,
      rmn: challan.rmn,
      driverName: challan.driverName,
      contactNo: challan.contactNo,
      altContactNo: challan.altContactNo,
      vehicleNo: challan.vehicleNo,
      licenseNo: challan.licenseNo,
      receiverName: challan.receiverName,
      transitInsuranceNo: challan.transitInsuranceNo || null,
      totalProductAmount: challan.totalProductAmount,
      netProductWeight: challan.netProductWeight,
      netPackagingMaterialWeight: challan.netPackagingMaterialWeight,
      totalPackagingMaterialAmount: challan.totalPackagingMaterialAmount,
      totalAmtInWords: challan.totalAmtInWords,
      createdDate,
      createdTime,
      requestingDepartment: challan.requestingDepartment,
      approvalStatus: challan.approvalStatus,
      customer: (challan as any).customer || null,
      customerContactNo: (challan as any).customerContactNo || null,
      customerEmail: (challan as any).customerEmail || null,
      customerAddress: (challan as any).customerAddress
        ? {
            id: (challan as any).customerAddress.id,
            address1: (challan as any).customerAddress.address1,
            address2: (challan as any).customerAddress.address2,
            location: (challan as any).customerAddress.location,
            city: (challan as any).customerAddress.city,
            state: (challan as any).customerAddress.state,
            pincode: (challan as any).customerAddress.pincode,
          }
        : null,
      remark: challan.remark,
      anyAttachment: challan.anyAttachment,
      deliveryChallanProducts: challan.deliveryChallanProducts.map(
        (product) => ({
          id: product.id,
          productName: product.productName?.id,
           variant: product.variant?.id || null,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          amount: product.amount,
          saleUoM: product.saleUoM?.id || null,
          netWeight:product.netWeight,
             grossWeight:product.grossWeight,
          packagingMaterial: product.packagingMaterial?.id || null,
          packagingMaterialUoM: product.packagingMaterialUoM?.id || null,
          packagingMaterialAmount: product.packagingMaterialAmount,
          packagingMaterialUnitPrice: product.packagingMaterialUnitPrice,
          packagingMaterialQuantity: product.packagingMaterialQuantity,
           packingMaterialWeight:product.packingMaterialWeight,
          packagingMaterialTotalWeight: product.packagingMaterialTotalWeight,
        }),
      ),
    };

    await this.cacheService.set(cacheKey, formattedChallan, this.CACHE_TTL);
    return formattedChallan;
  }
  async getAll(queryOptions: PaginationOptions, userId: string): Promise<any> {
    const hash = createHash('md5').update(`${userId}:${JSON.stringify(queryOptions)}`).digest('hex');
    const cacheKey = `${this.CACHE_PREFIX}:list:${hash}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const { data, meta } = await this.docDoubleApproverService.getAllDocumentByUserIdForDoubleApprover(
      userId,
      DocumentTypeEnum.DC_TYPE_OTHER,
      queryOptions,
    );

    const typedDocuments = data as DocumentWithRelatedData[];
    const activeDocuments = typedDocuments
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    for (const doc of activeDocuments) {
      if (!doc.document_type_id) continue;
      try {
        doc.relatedData = await this.challanRepository.findOne({
          where: { id: doc.document_type_id, isDeleted: false, deletedAt: null as any },
          relations: ['companyName', 'offices', 'grnNo', 'fromLocation', "customerAddress"],
        });
      } catch {
        doc.relatedData = null;
      }
    }

    const relatedDataOnly = activeDocuments
      .filter((doc) => doc.relatedData)
      .map((doc) => ({
        documentId: doc.id,
        overAllStatus: doc.status,
        createdBy: doc.lastActionBy?.firstName + ' ' + doc.lastActionBy?.lastName,
        createdDate: formatDateTime(doc.createdAt).createdDate,
        createdTime: formatDateTime(doc.createdAt).createdTime,
        id: doc.relatedData.id,
        challanNo: doc.relatedData.challanNo,
        companyName: doc.relatedData.companyName?.name || null,
        office: doc.relatedData.offices?.name || null,
        grnNo: doc.relatedData.grnNo?.grnNo || null,
        fromLocation: doc.relatedData.fromLocation?.name||null,
          
        customer: (doc.relatedData as any).customer || null,
        customerContactNo: (doc.relatedData as any).customerContactNo || null,
        customerEmail: (doc.relatedData as any).customerEmail || null,
        rmn: doc.relatedData.rmn,
        customerAddress: (doc.relatedData as any).customerAddress
  ? [
      (doc.relatedData as any).customerAddress.address1,
      (doc.relatedData as any).customerAddress.address2,
      (doc.relatedData as any).customerAddress.location,
      (doc.relatedData as any).customerAddress.city,
      (doc.relatedData as any).customerAddress.state,
      (doc.relatedData as any).customerAddress.pincode
    ]
      .filter(Boolean)
      .join(' ')   // space instead of comma
  : null,
        driverName: doc.relatedData.driverName,
        contactNo: doc.relatedData.contactNo,
        altContactNo: doc.relatedData.altContactNo,
        vehicleNo: doc.relatedData.vehicleNo,
        licenseNo: doc.relatedData.licenseNo,
        receiverName: doc.relatedData.receiverName,
        transitInsuranceNo: doc.relatedData.transitInsuranceNo || null,
        totalProductAmount: doc.relatedData.totalProductAmount,
        netProductWeight: doc.relatedData.netProductWeight,
        netPackagingMaterialWeight: doc.relatedData.netPackagingMaterialWeight,
        totalPackagingMaterialAmount: doc.relatedData.totalPackagingMaterialAmount,
        totalAmtInWords: doc.relatedData.totalAmtInWords,
        requestingDepartment: doc.relatedData.requestingDepartment,
        approvalStatus: doc.relatedData.approvalStatus,
        remark: doc.relatedData.remark,
        anyAttachment: doc.relatedData.anyAttachment,
      }));

    const result = {
      data: relatedDataOnly,
      meta: {
        total: meta.total,
        page: meta.page,
        pages: meta.pages,
      },
    };
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  async update(id: string, data: any): Promise<any> {
    try {
      const challan = await this.challanRepository.findOne({ where: { id } });
      if (!challan) return null;

      Object.assign(challan, data);
      const saved = await this.challanRepository.save(challan);
      await this.invalidateCache(id);
      return saved;
    } catch (err) {
      logger.error(`Error updating other delivery challan with ID: ${id}`, {
        error: err,
      });
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.challanRepository.softDelete(id);
      await this.challanRepository.update(id, { isDeleted: true } as any);
      if (result.affected !== 0) await this.invalidateCache(id);
      return result.affected !== 0;
    } catch (err) {
      logger.error(`Error deleting other delivery challan with ID: ${id}`, {
        error: err,
      });
      return false;
    }
  }

  public async deleteMultipleOtherDeliveryChallans(ids: string[]): Promise<{ success: string[]; failed: { id: string; reason: string }[]; message: string }> {
    const success: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    for (const id of ids) {
      try {
        const challan = await this.challanRepository.findOne({ where: { id } });
        if (!challan) {
          failed.push({ id, reason: 'Other Delivery Challan not found' });
          continue;
        }

        // Soft delete related document
        const relatedDocument = await this.documentbRepository.findOne({
          where: { document_type_id: challan.id },
        });
        if (relatedDocument) {
          await this.documentbRepository.softDelete(relatedDocument.id);
          await this.documentbRepository.update(relatedDocument.id, { isDeleted: true } as any);
        }

        // Soft delete challan
        await this.challanRepository.softDelete(challan.id);
        await this.challanRepository.update(challan.id, { isDeleted: true } as any);

        await this.invalidateCache(id);
        success.push(id);
      } catch (error: any) {
        failed.push({ id, reason: error.message || 'Unknown error' });
      }
    }

    const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
    return { success, failed, message };
  }
}
