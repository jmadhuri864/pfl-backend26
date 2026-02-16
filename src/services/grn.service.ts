import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { GrnRepository } from '../repositories/grn.repository';
import { GRN, GrnType, PurchaseType } from '../entities/grn.entity';
import { GrnProductRepository } from '../repositories/grnProduct.repository';
import {
  Between,
  ILike,
  In,
  IsNull,
  LessThan,
  Like,
  MoreThanOrEqual,
} from 'typeorm';
import { ProductRepository } from '../repositories/product.repository';
import { UOMRepository } from '../repositories/uom.repository';
import { VendorService } from './vendor.service';
import { FarmerService } from './farmer.service';
import { ApprovalStatus, CompanyName } from '../utils/status.enum';
import { UserService } from './user.service';
import { AuditLogService } from './auditLog.service';
import { Levels } from '../entities/levels.entity';
import { UserRepository } from '../repositories/user.repository';
import { LevelsRepository } from '../repositories/levels.repository';
import { RequestsRepository } from '../repositories/requests.repository';
import { NotificationService } from './notification.service';
import AppError from '../utils/appError';
import { BranchessRepository } from '../repositories/branches.repository';
import { buildQuery, buildQueryFromArray, PaginationOptions } from '../utils/pagination';

import { formatDateTime } from '../utils/dateUtils';

import { User } from '../entities/user.entity';

import { ReportingManagersRepository } from '../repositories/reportingmanager.repository';
import { DocumentbService, DocumentWithRelatedData } from './documentb.service';
import { Documentb, DocumentStatus, DocumentTypeEnum } from '../entities/docuemnt.entity';
import { log } from 'node:console';
import { DocumentTypeEnum as DocDefEnum } from '../entities/documentdef.entity';
import { ApprovalFlowService } from './approvalFlow.service';
import { DocumentbRepository } from '../repositories/documentb.repository';
import { ProductVarientRepository } from '../repositories/varients.repository';


interface SourceMetrics {
  totalPurchases: number;
  totalAmount: number;
  averageAmount: number;
  productBreakdown: any[];
  seasonalTrends: any[];
  qualityMetrics: any;
  paymentAnalysis: any;
}

// interface DocumentWithRelatedData extends Documentb {
//   relatedData?: any;
// }

@injectable()
export class GrnService {
  constructor(
    @inject(TYPES.GrnRepository) private readonly grnRepository: GrnRepository,
    @inject(TYPES.GrnProductRepository)
    private readonly grnProductRepository: GrnProductRepository,
     @inject(TYPES.ProductVarientRepository)
            private productVarientsRepository: ProductVarientRepository,
    @inject(TYPES.BranchessRepository)
    private readonly branchesRepository: BranchessRepository,
    @inject(TYPES.ProductRepository)
    private readonly productRepository: ProductRepository,
    @inject(TYPES.UOMRepository)
    private readonly uomRepository: UOMRepository,
    @inject(TYPES.VendorService)
    private readonly vendorService: VendorService,
    @inject(TYPES.DocumentbRepository)
    private readonly documentbRepository: DocumentbRepository,

    @inject(TYPES.NotificationService)
    private readonly notificationService: NotificationService,

    @inject(TYPES.FarmerService)
    private readonly farmerService: FarmerService,
    @inject(TYPES.UserService)
    private readonly userService: UserService,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService,
    @inject(TYPES.UserRepository)
    private readonly userRepository: UserRepository,
    // @inject(TYPES.ReportingManagersRepository)
    // private readonly reportingManagerRepository: ReportingManagersRepository,
    @inject(TYPES.LevelsRepository)
    private readonly levelsRepository: LevelsRepository,
    @inject(TYPES.RequestsRepository)
    private readonly requestsRepository: RequestsRepository,

    @inject(TYPES.DocumentbService)
    private readonly documentbService: DocumentbService,
    @inject(TYPES.ApprovalFlowService)
    private approvalFlowService: ApprovalFlowService
  ) // @inject(TYPES.DocumentApproveRepository)
  // private readonly docApproveRepo: DocumentApproveRepository,

  { }

  // public async createGrn(grnData: any): Promise<any> {
  //   grnData.createdAt = new Date();
  //   console.log('UTC Time:', grnData.createdAt);

  //   console.log('in grn create service', grnData.purchaseLocation);
  //   const branch = await this.branchesRepository.findOne({
  //     where: { id: grnData.purchaseLocation },
  //   });

  //   console.log(branch);
  //   if (!branch) {
  //     throw new Error(`Branch not found for id: ${grnData.purchaseForWhich}`);
  //   }

  //   const serialNo = await this.generateSerialNo(branch.prefix);
  //   console.log(serialNo);
  //   grnData.grnNo = serialNo;

  //   console.log('in service grn data', grnData);

  //   const grn = this.grnRepository.create(grnData);

  //   return this.grnRepository.save(grn);
  // }

  // public async createGrn(grnData: any): Promise<any> {
  // grnData.createdAt = new Date();
  // console.log('UTC Time:', grnData.createdAt);

  // const branch = await this.branchesRepository.findOne({
  //   where: { id: grnData.purchaseLocation },
  // });

  // if (!branch) {
  //   throw new Error(`Branch not found for id: ${grnData.purchaseForWhich}`);
  // }

  // const serialNo = await this.generateSerialNo(branch.prefix);
  // grnData.grnNo = serialNo;

  // const grn = this.grnRepository.create(grnData);
  // const savedGrn = await this.grnRepository.save(grn);

  // const documentApproval = this.documentApprovalRepository.create({
  //       documentRefId: Array.isArray(savedGrn) ? (savedGrn[0] as GRN)?.id : (savedGrn as GRN).id,
  //       requestedBy: { id: grnData.requestedBy },
  //       documentdef: { id: '1227d43e-fff7-452c-84cb-700ab03e5c16' },
  //     });

  //     const savedApproval = await this.documentApprovalRepository.save(documentApproval);

  //     if (Array.isArray(savedGrn)) {
  //       savedGrn.forEach((grn) => {
  //         grn.documentApproval = savedApproval;
  //       });
  //     } else {
  //       savedGrn = savedApproval;
  //     }
  //     if (Array.isArray(savedGrn)) {
  //       await Promise.all(savedGrn.map((grn) => this.grnRepository.save(grn)));
  //     } else {
  //       await this.grnRepository.save(savedGrn);
  //     }

  //     return savedGrn;
  //     } catch (error:any) {
  //       console.error('Error creating RFPA:', error);
  //       throw new Error('Failed to create RFPA');
  //     }
public async getAllRecycleBinGrns(queryOptions: PaginationOptions, userId: string): Promise<{
    data: any[];
    meta: { total: number; page: number; pages: number };
  }> {
    const { search } = queryOptions;
    const {data,meta}= await this.documentbService.getAllDocumentByUserId(
      userId,
      DocumentTypeEnum.GRN,
      queryOptions
    );
const paginatedData = await buildQueryFromArray(data,queryOptions)
  //   console.log('data in grn service', data);
//const data = paginatedResult.data


    const typedDocuments = paginatedData.data as DocumentWithRelatedData[];
    for (const doc of typedDocuments) {
      if (!doc.document_type_id) continue;
      try {
        doc.relatedData = await this.grnRepository.findOne({
          where: { id: doc.document_type_id , isDeleted: true },
          relations: ['companyName', 'grnProducts', 'grnProducts.productName', 'grnProducts.uom', 'selectedFarmer', 'selectedVendor', 'dealSlipId', 'purchaseForSalesLocation', 'purchaseLocation', 'paymentInfo'],
        });

      } catch {
        doc.relatedData = null;
      }
    }

    // let relatedDataOnly = typedDocuments
    //   .filter((d) => d)
    //   .map((doc) => ({
    //     documentId: doc.id,
    //     overAllStatus: doc.status,
    //     createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
    //     createdDate: formatDateTime(doc.createdAt).createdDate,
    //     createdTime: formatDateTime(doc.createdAt).createdTime,
    //     ...doc.relatedData,
    //     id: doc.relatedData.id,
    //     companyName: doc.relatedData.companyName?.name || null,
    //     // grnNo: doc.relatedData.grnNo,
    //     // requestingDepartment: doc.relatedData.requestingDepartment,
    //     purchaseLocation: doc.relatedData.purchaseLocation?.name || null,
    //     purchaseForSalesLocation: doc.relatedData.purchaseForSalesLocation?.name || null,
    //     otherPurchaseForSalesLoc: doc.relatedData.otherPurchaseForSalesLoc || null,
    //     otherPurchaseLoc: doc.relatedData.otherPurchaseLoc || null,
    //     purchaseInstructionsBy: doc.relatedData.purchaseInstructionsBy,
    //     grnProducts: doc.relatedData.grnProducts.map((product: any) => ({
    //       id: product.id,
          
    //       quantity: product.quantity,
    //       unitPrice: product.unitPrice,
    //       productName: product.productName?.id,
    //       variant: product.variant?.id || null,
    //       uom: product.uom?.id,
         
    //       amount: product.amount,
    //       rtv: product.rtv,
    //       purchaseDate: product.purchaseDate,
    //       dispatchDate: product.dispatchDate,
    //       deliveryDate: product.deliveryDate,
    //       deliveryLocation: product.deliveryLocation,
    //       expectedHarvestDate: product.expectedHarvestDate,
    //     })),

    //   }))

     //TODO:New code

    let relatedDataOnly = typedDocuments
  .filter((doc) => doc.relatedData) // ✅ filter out null GRNs
  .map((doc) => {
    const related = doc.relatedData;

    return {
      documentId: doc.id,
      overAllStatus: doc.status,
      createdBy: doc.lastActionBy
        ? `${doc.lastActionBy.firstName || ''} ${doc.lastActionBy.lastName || ''}`.trim()
        : null,
      createdDate: formatDateTime(doc.createdAt).createdDate,
      createdTime: formatDateTime(doc.createdAt).createdTime,

      id: related?.id || null,
      companyName: related?.companyName?.name || null,
      purchaseLocation: related?.purchaseLocation?.name || null,
      purchaseForSalesLocation: related?.purchaseForSalesLocation?.name || null,
      otherPurchaseForSalesLoc: related?.otherPurchaseForSalesLoc || null,
      otherPurchaseLoc: related?.otherPurchaseLoc || null,
      purchaseInstructionsBy: related?.purchaseInstructionsBy || null,

      grnProducts:
        related?.grnProducts?.map((product: any) => ({
          id: product.id,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          productName: product.productName?.id,
          variant: product.variant?.id || null,
          uom: product.uom?.id,
          amount: product.amount,
          rtv: product.rtv,
          purchaseDate: product.purchaseDate,
          dispatchDate: product.dispatchDate,
          deliveryDate: product.deliveryDate,
          deliveryLocation: product.deliveryLocation,
          expectedHarvestDate: product.expectedHarvestDate,
        })) || [],
    };
  });
// ✅ Generic Deep Search Helper
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj).map((v) => objectToString(v)).join(' ');
    }
    return String(obj);
  };

  // ✅ Apply deep search on all fields (including nested)
  if (search && search.trim()) {
    const term = search.toLowerCase();
    relatedDataOnly = relatedDataOnly.filter((item) =>
      objectToString(item).toLowerCase().includes(term)
    );
  }
  // 🔄 Sorting with nested field support
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
    total: paginatedData.meta.total,
    page:paginatedData.meta.page,
    pages: paginatedData.meta.pages
  }
};
  }
  public async createGrn(grnData: any): Promise<any> {
    try {

      //TODO: Check approval flow is exit or not for logged user

    //  const approvalFlowExit = this.approvalFlowService.findApprovalFlowForLoggedUser(grnData.requestedBy, 'grn')

    // if (!approvalFlowExit) {
    //   throw new Error('Approval flow not found');
    // }


      grnData.createdAt = new Date();
      console.log('UTC Time:', grnData.createdAt);

      const branch = await this.branchesRepository.findOne({
        where: { id: grnData.purchaseLocation },
      });

      if (!branch) {
        throw new Error(`Branch not found for id: ${grnData.purchaseForWhich}`);
      }

      const serialNo = await this.generateSerialNo(branch.prefix);
      grnData.grnNo = serialNo;

 // 3. Normalize variants input
    let variantIds: string[] = [];
    if (Array.isArray(grnData.variants)) {
      variantIds = grnData.variants;
    } else if (grnData.variants) {
      variantIds = [grnData.variants];
    }
    
    // 4. Fetch variants
    const variants = await this.productVarientsRepository.find({
      where: { id: In(variantIds) },
      relations: ['product'],
    });
// 5. Extract product IDs
    const productIds = variants.map(v => v.product?.id).filter(Boolean);

      const grn = this.grnRepository.create({...grnData,
         variants: variants.map(v => ({ id: v.id })),
      products: productIds.map(id => ({ id })),
    });
      const savedGrn = await this.grnRepository.save(grn) as GRN | GRN[];
      console.log('totalAmt ', grnData.requestedBy);

      const document = await this.documentbService.createDocument({
        type: DocumentTypeEnum.GRN,
        docDef: DocDefEnum.PROCUREMENT,
        totalAmt: grnData.totalAmt,
        status: DocumentStatus.HOLD,
        remarks: 'Document auto-created with GRN',
        lastActionBy: { id: grnData.requestedBy },
        document_type_id: Array.isArray(savedGrn) ? (savedGrn[0] as GRN)?.id : (savedGrn as GRN).id
      }, );
      //console.log('Document created:', docuemnt);
      //const saved = await this.grnRepository.save(savedGrn);

      await this.documentbService.startApprovalFlow(document.id);

      return savedGrn;
    } catch (error: any) {
      console.error('Error creating GRN:', error);
      throw new Error('Failed to create GRN');
    }
  }
public async getAllGrns(queryOptions: PaginationOptions, userId: string): Promise<{
    data: any[];
    meta: { total: number; page: number; pages: number };
  }> {
        const { search } = queryOptions;
    // Get ALL documents without pagination first
    const {data: allDocuments}= await this.documentbService.getAllDocumentByUserId(
      userId,
      DocumentTypeEnum.GRN,
      queryOptions,
      true // skipPagination = true
    );

    const typedDocuments = allDocuments as DocumentWithRelatedData[];



    
    for (const doc of typedDocuments) {
      if (!doc.document_type_id) continue;
      try {
        doc.relatedData = await this.grnRepository.findOne({
          where: { id: doc.document_type_id, isDeleted: false },
          relations: ['companyName', 'grnProducts', 'grnProducts.productName', 'grnProducts.uom', 'selectedFarmer', 'selectedVendor', 'dealSlipId', 'purchaseForSalesLocation', 'purchaseLocation', 'paymentInfo'],
        });

      } catch {
        doc.relatedData = null;
      }
    }

    console.log('typedDocuments', typedDocuments);

  

    

    let relatedDataOnly = typedDocuments
  .filter((doc) => doc.relatedData) // ✅ filter out null GRNs
  .map((doc) => {
    const related = doc.relatedData;

    return {
      documentId: doc.id,
      overAllStatus: doc.status,
      createdBy: doc.lastActionBy
        ? `${doc.lastActionBy.firstName || ''} ${doc.lastActionBy.lastName || ''}`.trim()
        : null,
      createdDate: formatDateTime(doc.createdAt).createdDate,
      createdTime: formatDateTime(doc.createdAt).createdTime,

      id: related?.id || null,
      companyName: related?.companyName?.name || null,
      grnType: related?.grnType || null,
      purchaseType:related?.purchaseType || null,
      locationType: related?.locationType || null,
      source:related?.source || null,
      billNo:related?.billNo || null,
      freight:related?.freight || null,
      subTotalAmt:related?.subTotalAmt || null,
     otherCharges: related?.otherCharges||null,
     totalAmt:related?.totalAmt || null,
     amtWords:related?.amtWords || null,
     cratesIn:related?.cratesIn || null,
     purchasedBy:related?.purchasedBy || null,
     receivedThrough:related?.receivedThrough || null,
     vehicleNo:related?.vehicleNo || null,
     timeIn:related?.timeIn || null,
     remark:related?.remark || null,
     securityPerson:related?.securityPerson|| null,
     deliveryReceivingPerson:related?.deliveryReceivingPerson || null,
     rmn:related?.rmn || null,
   
      purchaseLocation: related?.purchaseLocation?.name || null,
      purchaseForSalesLocation: related?.purchaseForSalesLocation?.name || null,
      otherPurchaseForSalesLoc: related?.otherPurchaseForSalesLoc || null,
      otherPurchaseLoc: related?.otherPurchaseLoc || null,
      purchaseInstructionsBy: related?.purchaseInstructionsBy || null,
      grnNo: related?.grnNo || null,
paymentInfo: {
  id: related?.paymentInfo?.id || null,
    paymentTerms:related?.paymentInfo?.paymentTerms || null,
    paymentDate:related?.paymentInfo?.paymentDate || null,
    paymentMode:related?.paymentInfo?.paymentMode || null,
    creditPeriod:related?.paymentInfo?.creditPeriod || null,
    dueDate:related?.paymentInfo?.dueDate || null,
    advancePaidAmt:related?.paymentInfo?.advancePaidAmt || null,
    remainingAmt:related?.paymentInfo?.remainingAmt || null,
},
      grnProducts:
        related?.grnProducts?.map((product: any) => ({
          id: product.id,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          productName: product.productName?.id,
          variant: product.variant?.id || null,
          uom: product.uom?.id,
          amount: product.amount,
          rtv: product.rtv,
          purchaseDate: product.purchaseDate,
          dispatchDate: product.dispatchDate,
          deliveryDate: product.deliveryDate,
          deliveryLocation: product.deliveryLocation,
          expectedHarvestDate: product.expectedHarvestDate,
        })) || [],
    };
  });

// ✅ Generic Deep Search Helper
  const objectToString = (obj: any): string => {
    if (obj == null) return '';
    if (typeof obj === 'object') {
      return Object.values(obj).map((v) => objectToString(v)).join(' ');
    }
    return String(obj);
  };

  // ✅ Apply deep search on all fields (including nested)
  if (search && search.trim()) {
    const term = search.toLowerCase();
    relatedDataOnly = relatedDataOnly.filter((item) =>
      objectToString(item).toLowerCase().includes(term)
    );
  }
  // 🔄 Sorting with nested field support
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

        // Apply pagination
  const total = relatedDataOnly.length;
  const page = queryOptions.page || 1;
  const limit = queryOptions.limit || 10;
  const pages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;
  const paginatedResult = relatedDataOnly.slice(skip, skip + limit);

  return {
    data: paginatedResult,
    meta: {
      total,
      page,
      pages
    }
  };


  }
//   public async getAllGrns(queryOptions: PaginationOptions, userId: string): Promise<{
//     data: any[];
//     meta: { total: number; page: number; pages: number };
//   }> {
//     const { search } = queryOptions;
//     const {data,meta}= await this.documentbService.getAllDocumentByUserId(
//       userId,
//       DocumentTypeEnum.GRN,
//       queryOptions
//     );
// const paginatedData = await buildQueryFromArray(data,queryOptions)
//   //   console.log('data in grn service', data);
// //const data = paginatedResult.data


//     const typedDocuments = paginatedData.data as DocumentWithRelatedData[];
//     for (const doc of typedDocuments) {
//       if (!doc.document_type_id) continue;
//       try {
//         doc.relatedData = await this.grnRepository.findOne({
//           where: { id: doc.document_type_id },
//           relations: ['companyName', 'grnProducts', 'grnProducts.productName', 'grnProducts.uom', 'selectedFarmer', 'selectedVendor', 'dealSlipId', 'purchaseForSalesLocation', 'purchaseLocation', 'paymentInfo'],
//         });

//       } catch {
//         doc.relatedData = null;
//       }
//     }

//     let relatedDataOnly = typedDocuments
//       .filter((d) => d)
//       .map((doc) => ({
//         documentId: doc.id,
//         overAllStatus: doc.status,
//         createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
//         createdDate: formatDateTime(doc.createdAt).createdDate,
//         createdTime: formatDateTime(doc.createdAt).createdTime,
//         ...doc.relatedData,
//         id: doc.relatedData.id,
//         companyName: doc.relatedData.companyName?.name || null,
//         // grnNo: doc.relatedData.grnNo,
//         // requestingDepartment: doc.relatedData.requestingDepartment,
//         purchaseLocation: doc.relatedData.purchaseLocation?.name || null,
//         purchaseForSalesLocation: doc.relatedData.purchaseForSalesLocation?.name || null,
//         otherPurchaseForSalesLoc: doc.relatedData.otherPurchaseForSalesLoc || null,
//         otherPurchaseLoc: doc.relatedData.otherPurchaseLoc || null,
//         purchaseInstructionsBy: doc.relatedData.purchaseInstructionsBy,
//         grnProducts: doc.relatedData.grnProducts.map((product: any) => ({
//           id: product.id,
          
//           quantity: product.quantity,
//           unitPrice: product.unitPrice,
//           productName: product.productName?.id,
//           variant: product.variant?.id || null,
//           uom: product.uom?.id,
         
//           amount: product.amount,
//           rtv: product.rtv,
//           purchaseDate: product.purchaseDate,
//           dispatchDate: product.dispatchDate,
//           deliveryDate: product.deliveryDate,
//           deliveryLocation: product.deliveryLocation,
//           expectedHarvestDate: product.expectedHarvestDate,
//         })),

//       }))
// // ✅ Generic Deep Search Helper
//   const objectToString = (obj: any): string => {
//     if (obj == null) return '';
//     if (typeof obj === 'object') {
//       return Object.values(obj).map((v) => objectToString(v)).join(' ');
//     }
//     return String(obj);
//   };

//   // ✅ Apply deep search on all fields (including nested)
//   if (search && search.trim()) {
//     const term = search.toLowerCase();
//     relatedDataOnly = relatedDataOnly.filter((item) =>
//       objectToString(item).toLowerCase().includes(term)
//     );
//   }
//   // 🔄 Sorting with nested field support
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
//   data: relatedDataOnly,
//   meta: {
//     total: paginatedData.meta.total,
//     page:paginatedData.meta.page,
//     pages: paginatedData.meta.pages
//   }
// };
//   }
    // const queryBuilder = this.grnRepository
    //   .createQueryBuilder('grn')
    //   .leftJoinAndSelect('grn.companyName', 'companyName')
    //   .leftJoinAndSelect('grn.selectedFarmer', 'selectedFarmer')
    //   .leftJoinAndSelect('grn.selectedVendor', 'selectedVendor')
    //   //.leftJoinAndSelect("grn.requestedBy", "requestedBy")
    //   .leftJoinAndSelect('grn.dealSlipId', 'dealSlipId')
    //   .leftJoinAndSelect('grn.grnProducts', 'grnProducts')
    //   .leftJoinAndSelect('grnProducts.productName', 'productName')
    //   .leftJoinAndSelect('grnProducts.uom', 'uom')
    //   .leftJoinAndSelect(
    //     'grn.purchaseForSalesLocation',
    //     'purchaseForSalesLocation',
    //   )
    //   .leftJoinAndSelect('grn.purchaseLocation', 'purchaseLocation')
    //   .leftJoinAndSelect('grn.purchaseBy', 'purchaseBy')
    //   // .leftJoinAndSelect('grn.documentApproval', 'documentApproval')
    //   .orderBy('grn.createdAt', 'DESC');

    // // Use buildQuery for pagination and filtering
    // const { data, meta } = await buildQuery(queryBuilder, queryOptions, 'grn');

    // const formattedGrns = data.map((grn) => {
    //   const rawDate = grn.createdAt;
    //   const { createdDate, createdTime } = formatDateTime(rawDate);
    //   const selectedParty =
    //     grn.source === 'vendor'
    //       ? grn.selectedVendor
    //       : grn.source === 'farmer'
    //         ? grn.selectedFarmer
    //         : null;

    //   return {
    //     id: grn.id,
    //     companyName: grn.companyName?.name || null,
    //     grnNo: grn.grnNo,
    //     requestingDepartment: grn.requestingDepartment,
    //     purchaseLocation: grn.purchaseLocation?.name || null,
    //     purchaseForSalesLocation: grn.purchaseForSalesLocation?.name || null,
    //     otherPurchaseForSalesLoc: grn.otherPurchaseForSalesLoc || null,
    //     otherPurchaseLoc: grn.otherPurchaseLoc || null,
    //     purchaseInstructionsBy: grn.purchaseInstructionsBy,
    //     source: grn.source,
    //     billNo: grn.billNo,
    //     grnType: grn.grnType,
    //     locationType: grn.locationType,
    //     purchaseType: grn.purchaseType,
    //     subTotalAmt: grn.subTotalAmt,
    //     freight: grn.freight,
    //     otherCharges: grn.otherCharges,
    //     totalAmt: grn.totalAmt,
    //     amtWords: grn.amtWords,
    //     purchasedBy: grn.purchasedBy,
    //     receivedThrough: grn.receivedThrough,
    //     vehicleNo: grn.vehicleNo,
    //     timeIn: grn.timeIn,
    //     cratesIn: grn.cratesIn,
    //     deliveryReceivingPerson: grn.deliveryReceivingPerson,
    //     // approvalStatus: grn.approvalStatus,
    //     approvalNote: grn.approvalNote,
    //     specialReq: grn.specialReq,
    //     securityPerson: grn.securityPerson,
    //     remark: grn.remark,
    //     createdAt: grn.createdAt,
    //     createdDate: createdDate,
    //     createdTime: createdTime,
    //     // requestedBy: {
    //     //     firstName: grn.requestedBy?.firstName || "",
    //     //     lastName: grn.requestedBy?.lastName || "",
    //     // },

    //     purchaseBy: {
    //       firstName: grn.purchaseBy?.firstName || '',
    //       lastName: grn.purchaseBy?.lastName || '',
    //     },
    //     selectedParty: selectedParty ? selectedParty.id : null,
    //     grnProducts: grn.grnProducts.map((product) => ({
    //       id: product.id,
    //       quantity: product.quantity,
    //       unitPrice: product.unitPrice,
    //       productName: product.productName?.id,
    //       uom: product.uom?.id,
    //       count: product.count,
    //       variety: product.variety,
    //       size: product.size,
    //       origin: product.origin,
    //       amount: product.amount,
    //       rtv: product.rtv,
    //       purchaseDate: product.purchaseDate,
    //       dispatchDate: product.dispatchDate,
    //       deliveryDate: product.deliveryDate,
    //       deliveryLocation: product.deliveryLocation,
    //       expectedHarvestDate: product.expectedHarvestDate,
    //     })),
    //   };
    // });

    // return {
    //   data: formattedGrns,
    //   meta,
    // };



  //   return data;
  // }

  // ...existing code...
// public async getAllGrns(queryOptions: PaginationOptions, userId: string): Promise<{
//   data: any[];
//   meta: { total: number; page: number; pages: number };
// }> {
//   const { data, meta } = await this.documentbService.getAllDocumentByUserId(
//     userId,
//     DocumentTypeEnum.GRN,
//     queryOptions
//   );

//   const typedDocuments = data as DocumentWithRelatedData[];

//   // Fetch related GRN data
//   for (const doc of typedDocuments) {
//     if (!doc.document_type_id) continue;
//     try {
//       doc.relatedData = await this.grnRepository.findOne({
//         where: { id: doc.document_type_id },
//         relations: [
//           'companyName', 'grnProducts', 'grnProducts.productName', 'grnProducts.uom',
//           'selectedFarmer', 'selectedVendor', 'dealSlipId', 'purchaseForSalesLocation',
//           'purchaseLocation', 'paymentInfo'
//         ],
//       });
//     } catch {
//       doc.relatedData = null;
//     }
//   }

//   // Apply GRN field filters here
//   let filteredDocuments = typedDocuments;
//   if (queryOptions.filters) {
//     filteredDocuments = filteredDocuments.filter(doc => {
//       if (!doc.relatedData) return false;
//       // Check each GRN filter
//       for (const [key, value] of Object.entries(queryOptions.filters ?? {})) {
//         // Only filter on GRN fields
//         if (
//           ['companyName', 'source', 'grnType', 'locationType', /* add more GRN fields here */].includes(key)
//         ) {
//           // Handle nested fields if needed
//           if (key === 'companyName' && doc.relatedData.companyName?.id !== value && doc.relatedData.companyName?.name !== value) {
//             return false;
//           }
//           if (key === 'source' && doc.relatedData.source !== value) {
//             return false;
//           }
//           if (key === 'grnType' && doc.relatedData.grnType !== value) {
//             return false;
//           }
//           if (key === 'locationType' && doc.relatedData.locationType !== value) {
//             return false;
//           }
//           // Add more GRN field checks as needed
//         }
//       }
//       return true;
//     });
//   }

//   const relatedDataOnly = filteredDocuments
//     .filter((d) => d)
//     .map((doc) => ({
//       documentId: doc.id,
//       overAllStatus: doc.status,
//       createdBy: doc.lastActionBy.firstName + ' ' + doc.lastActionBy.lastName,
//       createdDate: formatDateTime(doc.createdAt).createdDate,
//       createdTime: formatDateTime(doc.createdAt).createdTime,
//       ...doc.relatedData,
//       id: doc.relatedData.id,
//       companyName: doc.relatedData.companyName?.name || null,
//       purchaseLocation: doc.relatedData.purchaseLocation?.name || null,
//       purchaseForSalesLocation: doc.relatedData.purchaseForSalesLocation?.name || null,
//       otherPurchaseForSalesLoc: doc.relatedData.otherPurchaseForSalesLoc || null,
//       otherPurchaseLoc: doc.relatedData.otherPurchaseLoc || null,
//       purchaseInstructionsBy: doc.relatedData.purchaseInstructionsBy,
//       grnProducts: doc.relatedData.grnProducts.map((product: any) => ({
//         id: product.id,
//         quantity: product.quantity,
//         unitPrice: product.unitPrice,
//         productName: product.productName?.id,
//         uom: product.uom?.id,
//         count: product.count,
//         variety: product.variety,
//         size: product.size,
//         origin: product.origin,
//         amount: product.amount,
//         rtv: product.rtv,
//         purchaseDate: product.purchaseDate,
//         dispatchDate: product.dispatchDate,
//         deliveryDate: product.deliveryDate,
//         deliveryLocation: product.deliveryLocation,
//         expectedHarvestDate: product.expectedHarvestDate,
//       })),
//     }));

//   return {
//     data: relatedDataOnly,
//     meta: {
//       total: meta.total,
//       page: meta.page,
//       pages: meta.pages,
//     },
//   };
// }

  public async getGrnById(id: string): Promise<any> {
    const grn = await this.grnRepository.findOne({
      where: { id },
      relations: [
        'companyName',
        'grnProducts',
        'grnProducts.productName',
        'grnProducts.uom',
        'selectedFarmer',
        'selectedVendor',
        //'documentApproval',
        //"requestedBy",
        'paymentInfo',
        'dealSlipId',
        'purchaseForSalesLocation',
        'purchaseLocation',
        'purchaseBy',
      ],
    });

    if (!grn) {
      throw new Error('GRN not found');
    }

    let selectedPartyId: string | null = null;
    if (grn.source === 'vendor' && grn.selectedVendor) {
      selectedPartyId = grn.selectedVendor.id;
    } else if (grn.source === 'farmer' && grn.selectedFarmer) {
      selectedPartyId = grn.selectedFarmer.id;
    }
    const rawDate = grn.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);
    console.log(grn.timeIn);
    return {
      id: grn.id,
      companyName: grn.companyName?.id ?? null,
      purchaseInstructionsBy: grn.purchaseInstructionsBy,
      //serialNo: grn.serialNo,
      dealSlipId: {
        id: grn.dealSlipId?.id || null,
        dealSlipNo: grn.dealSlipId?.dealSlipNo || null,
      },
      purchaseType: grn.purchaseType,
      otherPurchaseForSalesLoc: grn.otherPurchaseForSalesLoc || null,
      otherPurchaseLoc: grn.otherPurchaseLoc || null,
      grnNo: grn.grnNo,
      locationType: grn.locationType,
      grnType: grn.grnType,
      rmn: grn.rmn,
      createdDate: createdDate,
      createdTime: createdTime,
      requestingDepartment: grn.requestingDepartment,
      purchaseLocation: grn.purchaseLocation?.id ?? null,
      purchaseForSalesLocation: grn.purchaseForSalesLocation?.id ?? null,
      selectedParty: selectedPartyId,
      source: grn.source,
      billNo: grn.billNo,
      billImage: grn.billImage,
      subTotalAmt: grn.subTotalAmt,
      freight: grn.freight,
      otherCharges: grn.otherCharges,
      totalAmt: grn.totalAmt,
      amtWords: grn.amtWords,
      purchasedBy: grn.purchasedBy,
      receivedThrough: grn.receivedThrough,
      vehicleNo: grn.vehicleNo,
      timeIn: grn.timeIn,
      cratesIn: grn.cratesIn,
      deliveryReceivingPerson: grn.deliveryReceivingPerson,
      baseLocation: grn.baseLocation,
      specialReq: grn.specialReq,
      securityPerson: grn.securityPerson,
      //approvalStatus: grn.approvalStatus,
      approvalNote: grn.approvalNote,
      remark: grn.remark,

      // requestedBy: {
      //   firstName: grn.requestedBy?.firstName || "",
      //   lastName: grn.requestedBy?.lastName || "",
      // },

      purchaseBy: {
        firstName: grn.purchaseBy?.firstName || '',
        lastName: grn.purchaseBy?.lastName || '',
      },

      paymentInfo: grn.paymentInfo
        ? {
          id: grn.paymentInfo.id,
          paymentMode: grn.paymentInfo.paymentMode,
          paymentDate: grn.paymentInfo.paymentDate,
          advancePaidAmt: grn.paymentInfo.advancePaidAmt,
          remainingAmt: grn.paymentInfo.remainingAmt,
          paymentTerms: grn.paymentInfo.paymentTerms,
          dueDate: grn.paymentInfo.dueDate,
          creditPeriod: grn.paymentInfo.creditPeriod,
        }
        : null,
      grnProducts: grn.grnProducts.map((product) => ({
        id: product.id,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        productName: product.productName?.id ?? null,
        uom: product.uom?.id ?? null,
        variant: product.variant?.id || null,
        amount: product.amount,
        rtv: product.rtv,
        netWeight: product.netWeight,
        grossWeight: product.grossWeight,
        packingMaterialWeight: product.packingMaterialWeight,
        revisedRate: product.revisedRate,
        revisedQuantity: product.revisedQuantity,
        purchaseDate: product.purchaseDate,
        dispatchDate: product.dispatchDate,
        deliveryDate: product.deliveryDate,
        deliveryLocation: product.deliveryLocation,
        expectedHarvestDate: product.expectedHarvestDate,
      })),
    };
  }

  public async getGrnByIdForView(docid: string): Promise<any> {
    const document = await this.documentbService.getDocumentById(docid)
    const id = document.documentTypeId;
    console.log('id in getGrnByIdForView', id);

    if (id) {
      console.log("Hiiiiiiiiiiiiiiiiiiiiiii");
      console.log('Document type ID not found for document:', id);

      const grn = await this.grnRepository.findOne({
        where: { id },
        relations: [
          'companyName',
          'grnProducts',
          'grnProducts.productName',
          'grnProducts.uom',
          'grnProducts.variant',
          'selectedFarmer',
          'selectedVendor',
          'purchaseInstructionsBy',
          //'documentApproval',
          //"requestedBy",
          // "documentApproval",
          // "documentApproval.documentdef",
          // "documentApproval.requestedBy",
          // "documentApproval.verifiedBy",
          // "documentApproval.authorisedBy",
          'paymentInfo',
          'dealSlipId',
          'purchaseForSalesLocation',
          'purchaseLocation',
          'createdBy',
          'purchaseBy',
        ],
      });

      console.log('grn in getGrnByIdForView', grn);


      if (!grn) {
        throw new Error('GRN not found');
      }

      let selectedPartyId: string | null = null;
      if (grn.source === 'vendor' && grn.selectedVendor) {
        selectedPartyId = grn.selectedVendor.companyName;
      } else if (grn.source === 'farmer' && grn.selectedFarmer) {
        selectedPartyId =
          grn.selectedFarmer.farmerfName +
          ' ' +
          grn.selectedFarmer.farmermName +
          ' ' +
          grn.selectedFarmer.farmerlName;
      }
      const rawDate = grn.createdAt;
      const { createdDate, createdTime } = formatDateTime(rawDate);
      console.log(grn.timeIn);
      return {
        id: grn.id,
        companyName: grn.companyName?.name ?? null,
        purchaseInstructionsBy: grn.purchaseInstructionsBy?.firstName || null + ' ' + grn.purchaseInstructionsBy?.lastName || null,
        //serialNo: grn.serialNo,
        dealSlipId: grn.dealSlipId?.dealSlipNo || null,

        purchaseType: grn.purchaseType,
        otherPurchaseForSalesLoc: grn.otherPurchaseForSalesLoc || null,
        otherPurchaseLoc: grn.otherPurchaseLoc || null,
        grnNo: grn.grnNo,
        locationType: grn.locationType,
        grnType: grn.grnType,
        rmn: grn.rmn,
        createdDate: createdDate,
        createdTime: createdTime,
        requestingDepartment: grn.requestingDepartment,
        //purchaseInstructionsBy:grn.purchaseInstructionsBy.name,
        purchaseLocation: grn.purchaseLocation?.name ?? null,
        purchaseForSalesLocation: grn.purchaseForSalesLocation?.name ?? null,
        selectedParty: selectedPartyId,
        source: grn.source,
        billNo: grn.billNo,
        billImage: grn.billImage,
        subTotalAmt: grn.subTotalAmt,
        freight: grn.freight,
        otherCharges: grn.otherCharges,
        totalAmt: grn.totalAmt,
        amtWords: grn.amtWords,
        purchasedBy: grn.purchasedBy,
        receivedThrough: grn.receivedThrough,
        vehicleNo: grn.vehicleNo,
        timeIn: grn.timeIn,
        cratesIn: grn.cratesIn,
        deliveryReceivingPerson: grn.deliveryReceivingPerson,
        baseLocation: grn.baseLocation,
        specialReq: grn.specialReq,
        securityPerson: grn.securityPerson,
        //approvalStatus: grn.approvalStatus,
        approvalNote: grn.approvalNote,
        remark: grn.remark,

        // requestedBy: {
        //   firstName: grn.requestedBy?.firstName || "",
        //   lastName: grn.requestedBy?.lastName || "",
        // },

        // purchaseBy: {
        //   firstName: grn.purchaseBy?.firstName || '',
        //   lastName: grn.purchaseBy?.lastName || '',
        // },
        purchaseBy: grn.purchaseBy
          ? `${grn.purchaseBy.firstName} ${grn.purchaseBy.lastName}`
          : null,

        paymentInfo: grn.paymentInfo
          ? {
            id: grn.paymentInfo.id,
            paymentMode: grn.paymentInfo.paymentMode,
            paymentDate: grn.paymentInfo.paymentDate,
            advancePaidAmt: grn.paymentInfo.advancePaidAmt,
            remainingAmt: grn.paymentInfo.remainingAmt,
            paymentTerms: grn.paymentInfo.paymentTerms,
            dueDate: grn.paymentInfo.dueDate,
            creditPeriod: grn.paymentInfo.creditPeriod,
          }
          : null,
        grnProducts: grn.grnProducts.map((product) => ({
          id: product.id,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          productName: product.productName?.name ?? null,
          variant: product.variant?.variantName || null,
          uom: product.uom?.unit ?? null,
         
          amount: product.amount,
          rtv: product.rtv,
          netWeight: product.netWeight,
          grossWeight: product.grossWeight,
          packingMaterialWeight: product.packingMaterialWeight,
          revisedRate: product.revisedRate,
          revisedQuantity: product.revisedQuantity,
          purchaseDate: product.purchaseDate,
          dispatchDate: product.dispatchDate,
          deliveryDate: product.deliveryDate,
          deliveryLocation: product.deliveryLocation,
          expectedHarvestDate: product.expectedHarvestDate,
        })),
        overAllStatus: document.overAllStatus,
        createdBy: document.createdBy,
        approvalSummary: document.approvalSummary,
        documentId: document.id,
      };
    }
  }


  public async getGrnByIdForupdate(id: string): Promise<any> {
       const document = await this.documentbService.getDocumentById(id)
    const id1 = document.documentTypeId;
    console.log('id in getGrnByIdForView', id1);

    const grn = await this.grnRepository.findOne({
      where: { id: id1 },
      relations: [
        'companyName',
        'grnProducts',
        'grnProducts.productName',
        'grnProducts.uom',
        'grnProducts.variant',
        'selectedFarmer',
        'selectedVendor',
       'purchaseInstructionsBy',
       // 'documentApproval',
        //"requestedBy",
        // "documentApproval",

        // "documentApproval.requestedBy",
        // "documentApproval.verifiedBy",
        // "documentApproval.authorisedBy",
        'paymentInfo',
        'dealSlipId',
        'purchaseForSalesLocation',
        'purchaseLocation',
        'createdBy',
        'purchaseBy',
      ],
    });

    if (!grn) {
      throw new Error('GRN not found');
    }

    let selectedPartyId: string | null = null;
    if (grn.source === 'vendor' && grn.selectedVendor) {
      selectedPartyId = grn.selectedVendor.id;
    } else if (grn.source === 'farmer' && grn.selectedFarmer) {
      selectedPartyId = grn.selectedFarmer.id;
    }
    const rawDate = grn.createdAt;
    const { createdDate, createdTime } = formatDateTime(rawDate);
    console.log(grn.timeIn);
    return {
      id: grn.id,
      companyName: grn.companyName?.id ?? null,
      purchaseInstructionsBy: grn.purchaseInstructionsBy?.id || null,
      //serialNo: grn.serialNo,
      dealSlipId: grn.dealSlipId?.id || null,

      purchaseType: grn.purchaseType,
      otherPurchaseForSalesLoc: grn.otherPurchaseForSalesLoc || null,
      otherPurchaseLoc: grn.otherPurchaseLoc || null,
      grnNo: grn.grnNo,
      locationType: grn.locationType,
      grnType: grn.grnType,
      rmn: grn.rmn,
      createdDate: createdDate,
      createdTime: createdTime,
      requestingDepartment: grn.requestingDepartment,
      purchaseLocation: grn.purchaseLocation?.id ?? null,
      purchaseForSalesLocation: grn.purchaseForSalesLocation?.id ?? null,
      selectedParty: selectedPartyId,
      source: grn.source,
      billNo: grn.billNo,
      billImage: grn.billImage,
      subTotalAmt: grn.subTotalAmt,
      freight: grn.freight,
      otherCharges: grn.otherCharges,
      totalAmt: grn.totalAmt,
      amtWords: grn.amtWords,
      purchasedBy: grn.purchasedBy,
      receivedThrough: grn.receivedThrough,
      vehicleNo: grn.vehicleNo,
      timeIn: grn.timeIn,
      cratesIn: grn.cratesIn,
      deliveryReceivingPerson: grn.deliveryReceivingPerson,
      baseLocation: grn.baseLocation,
      specialReq: grn.specialReq,
      securityPerson: grn.securityPerson,
      //approvalStatus: grn.approvalStatus,
      approvalNote: grn.approvalNote,
      remark: grn.remark,

      // requestedBy: {
      //   firstName: grn.requestedBy?.firstName || "",
      //   lastName: grn.requestedBy?.lastName || "",
      // },

      // purchaseBy: {
      //   firstName: grn.purchaseBy?.firstName || '',
      //   lastName: grn.purchaseBy?.lastName || '',
      // },
      purchaseBy: grn.purchaseBy?.id || null,

      paymentInfo: grn.paymentInfo
        ? {
          id: grn.paymentInfo.id,
          paymentMode: grn.paymentInfo.paymentMode,
          paymentDate: grn.paymentInfo.paymentDate,
          advancePaidAmt: grn.paymentInfo.advancePaidAmt,
          remainingAmt: grn.paymentInfo.remainingAmt,
          paymentTerms: grn.paymentInfo.paymentTerms,
          dueDate: grn.paymentInfo.dueDate,
          creditPeriod: grn.paymentInfo.creditPeriod,
        }
        : null,
      grnProducts: grn.grnProducts.map((product) => ({
        id: product.id,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        productName: product.productName?.id ?? null,
        variant: product.variant?.id || null,
        uom: product.uom?.id ?? null,
       
        amount: product.amount,
        rtv: product.rtv,
        netWeight: product.netWeight,
        grossWeight: product.grossWeight,
        packingMaterialWeight: product.packingMaterialWeight,
        revisedRate: product.revisedRate,
        revisedQuantity: product.revisedQuantity,
        purchaseDate: product.purchaseDate,
        dispatchDate: product.dispatchDate,
        deliveryDate: product.deliveryDate,
        deliveryLocation: product.deliveryLocation,
        expectedHarvestDate: product.expectedHarvestDate,
      })),
    };
  }

  // Update a GRN
  public async updateGrn(
  id: string,
  grnData: any,
  updatedBy: string,
): Promise<any> {
  const grn = await this.grnRepository.findOne({ where: { id } });
  console.log("Fetched GRN:", grn);
  
  if (!grn) return null;

  const originalGrn = { ...grn };

  
  // ✅ Never allow ID overwrite
  if ('id' in grnData) delete grnData.id;


  // ✅ Merge scalar fields only
  Object.assign(grn, grnData);

  console.log("Saving updated GRN:", grn);

  // ✅ Now save safely (won’t create new)
  const updatedGrn = await this.grnRepository.save(grn);

  // ✅ Audit log
  await this.auditLogService.logChange(
    'GRN',
    grn.id,
    originalGrn,
    grnData,
    updatedBy,
  );

  return updatedGrn;
}

  // Delete a GRN with scheduled deletion (6 months)
  public async deleteGrn(id: string): Promise<boolean> {
    const grn = await this.grnRepository.findOne({ where: { id } });

    if (!grn) {
      throw new AppError(404, `GRN with ID ${id} not found`);
    }

    // Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

    // Log the scheduled deletion
    console.log(
      `GRN with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`,
    );

    // Set the deletionScheduledAt field for the GRN
    grn.deletionScheduledAt = sixMonthsFromNow;

    // Save the updated GRN with the scheduled deletion date
    await this.grnRepository.save(grn);

    console.log(`GRN with ID ${id} marked for deletion in 6 months.`);
    return true;
  }
  // async getReportingChain(employee: User): Promise<Set<string>> {
  //   const chain = new Set<string>();

  //   const collectManagers = async (emp: User) => {
  //     if (emp.reportingManagers && emp.reportingManagers.length > 0) {
  //       for (const manager of emp.reportingManagers) {
  //         if (!chain.has(manager.id)) {
  //           chain.add(manager.id);
  //           const managerWithReports = await this.userRepository.findOne({
  //             where: { id: manager.id },
  //             relations: ['reportingManagers'],
  //           });
  //           if (managerWithReports) {
  //             await collectManagers(managerWithReports);
  //           }
  //         }
  //       }
  //     }
  //   };

  //   await collectManagers(employee);
  //   return chain;
  // }

  // //TODO: Get pending grn
  // public async getPendingGrns(employeeId: string): Promise<any> {
  //   const pendingGrns = await this.grnRepository
  //     .createQueryBuilder('grn')
  //     .leftJoinAndSelect('grn.documentApproval', 'documentApproval')
  //     .leftJoinAndSelect('documentApproval.requestedBy', 'requestedBy')
  //     .leftJoinAndSelect('grn.selectedVendor', 'selectedVendor')
  //     .leftJoinAndSelect('grn.selectedFarmer', 'selectedFarmer')
  //     .leftJoinAndSelect('grn.currentLevel', 'currentLevel')
  //     .leftJoinAndSelect('grn.createdBy', 'createdBy')
  //     .orderBy('grn.createdAt', 'DESC')
  //     .getMany();
  // console.log(pendingGrns.length)
  //   const currentUser = await this.userRepository.findOne({
  //     where: { id: employeeId },
  //     relations: ['reportingManagers', 'reportingManagers.reportingTo'],
  //   });
  // //console.log();
  //   if (!currentUser) {
  //     throw new Error('Current user not found');
  //   }
  //   const filteredGrns = [];

  //   for (const grn of pendingGrns) {
  //     const requestedBy = grn.documentApproval?.requestedBy;
  //     console.log(requestedBy?.id);
  //     const currentLevel = grn.currentLevel;
  //     const createdBy = grn.createdBy;

  //     //if (!requestedBy || !createdBy) continue;

  //     const isRequester = requestedBy?.id === employeeId;
  //     const isReportingManager = requestedBy?.reportingManagers?.some(
  //       (manager) => manager.id === employeeId
  //     );
  //     const isCurrentLevelApprover = currentLevel?.id === employeeId;

  //     // Get reporting chain of createdBy
  //     const reportingChain = await this.getReportingChain(requestedBy);
  //     const isInCreatorChain = reportingChain.has(employeeId);
  // console.log(reportingChain)
  // console.log({
  //   isRequester,
  //   isReportingManager,
  //   isCurrentLevelApprover,
  //   isInCreatorChain,
  // });
  // console.log(grn?.grnNo);
  //     if (
  //       isRequester ||
  //       isReportingManager ||
  //       isCurrentLevelApprover ||
  //       isInCreatorChain
  //     ) {
  //       filteredGrns.push(grn);
  //     }
  //   }

  //   return filteredGrns.map((grn) => {
  //     const rawDate = grn.createdAt;
  //     const { createdDate, createdTime } = formatDateTime(rawDate);
  //     return {
  //       id: grn.id,
  //       grnNo: grn.grnNo,
  //       companyName: grn.companyName?.name || null,
  //       purchaseLocation: grn.purchaseLocation?.name || null,
  //       purchaseForSalesLocation: grn.purchaseForSalesLocation?.name || null,
  //       source: grn.source,
  //       billNo: grn.billNo,
  //       subTotalAmt: grn.subTotalAmt,
  //       freight: grn.freight,
  //       otherCharges: grn.otherCharges,
  //       totalAmt: grn.totalAmt,
  //       amtWords: grn.amtWords,
  //       purchasedBy: grn.purchasedBy,
  //       timeIn: grn.timeIn,
  //       deliveryReceivingPerson: grn.deliveryReceivingPerson,
  //       approvalStatus: grn.documentApproval?.approvalStatus || null,
  //       approvalNote: grn.approvalNote,
  //       createdAt: grn.createdAt,
  //       createdDate,
  //       createdTime,
  //     };
  //   });
  // }

  public async getGrnDetails(grnId: string): Promise<GRN | null> {
    return this.grnRepository
      .createQueryBuilder('grn')
      .leftJoinAndSelect('grn.selectedVendor', 'selectedVendor') // Ensure this is correct
      .leftJoinAndSelect('grn.grnProducts', 'grnProducts')
      .leftJoinAndSelect('grn.purchaseForWhich', 'purchaseForWhich')
      .leftJoinAndSelect('grn.purchaseLocation', 'purchaseLocation')
      .where('grn.id = :grnId', { grnId })
      .getOne();
  }

  // public async approveGrn(
  //   grnId: string,
  //   userId: string,
  //   data: { approvalStatus: string; approvalNote?: string }
  // ) {

  //   const grn = await this.grnRepository.findOne({
  //     where: { id: grnId },
  //   });

  //   if (!grn) {
  //     throw new Error("Grn not found");
  //   }

  //   console.log(data.approvalStatus);

  //   // Validate the incoming status change from the frontend
  //   if (
  //     data.approvalStatus !== ApprovalStatus.APPROVED &&
  //     data.approvalStatus !== ApprovalStatus.REJECTED
  //   ) {
  //     throw new Error(
  //       "Invalid approval status. It must be either APPROVED or REJECTED."
  //     );
  //   }

  //   // Update the Deal Slip status and note
  //   grn.approvalStatus = data.approvalStatus; // Use the status from the frontend
  //   grn.approvalNote = data.approvalNote || ""; // Use the note from the frontend, if provided
  //   // grn.grnApprovedAt = new Date(); // Set approval timestamp

  //   // Save the updated Deal Slip
  //   await this.grnRepository.save(grn);

  //   // Fetch the user details of the logged-in user
  //   const user = await this.userService.findUserById(userId);

  //   if (!user) {
  //     throw new Error("User not found");
  //   }

  //   // Prepare the response with user details
  //   const response = {
  //     message: `Deal Slip status updated to ${data.approvalStatus}`,
  //     approvalStatus: grn.approvalStatus,
  //     approvalNote: grn.approvalNote,
  //     user: {
  //       name: `${user.firstName} ${user.lastName}`,
  //       //designation: user.role?.name,
  //       department: user.selectDepartment,
  //     },
  //   };

  //   return response;
  // }

  // async requestApproval(
  //   grnId: string,
  //   requestedById: string,
  // ): Promise<DocumentApprove> {
  //   const grn = await this.grnRepository.findOne({
  //     where: { id: grnId },
  //     relations: ['documentApproval'],
  //   });
  //   if (!grn) throw new Error('GRN not found');

  //   const requestedBy = await this.userRepository.findOneBy({
  //     id: requestedById,
  //   });
  //   if (!requestedBy) throw new Error('Requested user not found');

  //   const firstApprover = await this.documentApproveService.findNextApprover(
  //     requestedById,
  //     null,
  //   );
  //   if (!firstApprover) throw new Error('No first-level approver found');

  //   const docDef = await this.docDefRepo.findOneBy({ uniqueKey: 'grn' });
  //   if (!docDef) throw new Error('Document Definition for GRN not found');

  //   const approval = this.documentApprovalRepository.create({
  //     approvalStatus: DocumentApprovalStatus.PENDING,
  //     currentStage: ApprovalStage.FIRST_LEVEL,
  //     documentRefId: grn.id,
  //     requestedBy,
  //     documentdef: docDef,
  //   });

  //   const savedApproval = await this.documentApprovalRepository.save(approval);
  //   grn.documentApproval = savedApproval;
  //   await this.grnRepository.save(grn);

  //   await this.notificationService.createNoti(
  //     `A new '${docDef.uniqueKey}' document '${savedApproval.documentRefId}' requires your approval.`,
  //     firstApprover.id,
  //   );

  //   await this.notificationService.createNoti(
  //     `The approval process for your '${docDef.uniqueKey}' document '${savedApproval.documentRefId}' has started. The first approver is ${firstApprover.firstName}.`,
  //     requestedBy.id,
  //   );

  //   return savedApproval;
  // }
  async generateGRNNo(): Promise<string> {
    const today = new Date();
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, ''); // Generate date part in YYYYMMDD format

    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      0,
      0,
      0,
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
      0,
      0,
      0,
    );

    // Find the last GRN created today
    const lastGRN = await this.grnRepository.findOne({
      where: [
        { createdAt: MoreThanOrEqual(startOfDay) },
        { createdAt: LessThan(endOfDay) },
      ],
      order: { createdAt: 'DESC' }, // Order by creation time, descending
    });

    // Extract the sequence number from the last GRN created today
    const sequenceNumber = lastGRN ? parseInt(lastGRN.grnNo.slice(-4)) + 1 : 1;

    // Return the new grnNo with the date part and sequence number
    return `${datePart}${sequenceNumber.toString().padStart(4, '0')}`;
  }
  // Get all GRNs with only id and grnNo
  public async getAllGrnNumbers(): Promise<{ id: string; grnNo: string }[]> {
    const grns = await this.grnRepository.find({
      select: ['id', 'grnNo'], // Select only the id and grnNo fields
      order: {
        createdAt: 'DESC', // Optionally order by creation date
      },
    });

    return grns.map((grn) => ({
      id: grn.id,
      grnNo: grn.grnNo,
    }));
  }
  // async escalateToNextLevel(
  //   grn: GRN,
  //   currentLevel: Levels
  // ): Promise<Levels | null> {
  //   const nextLevel = await this.levelsRepository.findOne({
  //     where: {
  //       hierarchy: currentLevel.hierarchy + 1, // Find the next level based on hierarchy
  //       department: currentLevel.department,
  //     },
  //   });

  //   if (!nextLevel) {
  //     console.log("No further levels to escalate.");
  //     return null; // No next level
  //   }

  //   const nextManager = await this.userRepository.findOne({
  //     where: {
  //       level: nextLevel,
  //     },
  //   });

  //   if (!nextManager) {
  //     console.log(`No manager found at level ${nextLevel.hierarchy}`);
  //     return nextLevel; // Escalate without manager notification
  //   }

  //   const request = this.requestsRepository.create({
  //     submitter: grn.requestedBy,
  //     approver: nextManager,
  //     level: nextLevel,
  //     status: ApprovalStatus.PENDING,
  //   });

  //   await this.requestsRepository.save(request);

  //   // Send notification to the next approver
  //   const message = `New GRN ${grn.grnNo} requires your approval.`;
  //   await this.notificationService.createNoti(message, nextManager.id);

  //   return nextLevel;
  // }
  // async processApproval(
  //   grnId: string,
  //   approverId: string,
  //   approvalStatus: ApprovalStatus,
  //   rejectionReason?: string
  // ): Promise<void> {
  //   const grn = await this.grnRepository.findOne({
  //     where: { id: grnId },
  //     relations: ["currentLevel"],
  //   });

  //   if (!grn) throw new Error("GRN not found.");

  //   const currentLevel = grn.currentLevel;

  //   if (approvalStatus === ApprovalStatus.REJECTED) {
  //     // Update GRN and notify submitter
  //     grn.approvalStatus = ApprovalStatus.REJECTED;
  //     await this.grnRepository.save(grn);

  //     const submitter = await this.userRepository.findOne({
  //       where: { id: grn.requestedBy.id },
  //     });
  //     if (submitter) {
  //       const message = `Your GRN ${grn.grnNo} was rejected. Reason: ${
  //         rejectionReason || "No reason provided."
  //       }`;
  //       await this.notificationService.createNoti(message, submitter.id);
  //     }
  //     return;
  //   }

  //   // If approved, escalate to the next level
  //   const nextLevel = await this.escalateToNextLevel(grn, currentLevel);
  //   if (!nextLevel) {
  //     // If no next level, mark GRN as approved
  //     grn.approvalStatus = ApprovalStatus.APPROVED;
  //     await this.grnRepository.save(grn);

  //     const message = `Your GRN ${grn.grnNo} has been fully approved.`;
  //     const submitter = await this.userRepository.findOne({
  //       where: { id: grn.requestedBy.id },
  //     });
  //     if (submitter) {
  //       await this.notificationService.createNoti(message, submitter.id);
  //     }
  //   } else {
  //     grn.currentLevel = nextLevel;
  //     await this.grnRepository.save(grn);
  //   }
  // }

  private async generateSerialNo(prefix: string): Promise<string> {
    // Get the count of existing GRNs for the branch (or use another unique mechanism)
    const count = await this.grnRepository.count({
      where: { grnNo: ILike(`${prefix}%`) },
    });
    console.log(count);
    // Generate the serial number in the format "PREFIX-001"
    const serialNo = `${prefix}-${(count + 1).toString().padStart(5, '0')}`;
    return serialNo;
  }

  // //TODO: Get all pending approval
  // async getAllPendingApprovals(){
  //   try {
  //     const result = await
  //   } catch (error) {

  //   }
  // }


  public async deleteMultipleGrns(ids: string[]) {
    for (const id of ids) {
      const grn = await this.grnRepository.findOne({
        where: { id },
      });

      if (!grn) {
        throw new Error(`GRN with ID ${id} not found`);
      }

      const relatedDocument = await this.documentbRepository.findOne({
        where: { document_type_id: grn.id }
      });

      if (!relatedDocument) {
        throw new Error(`Something went wrong`);
      }

      const deleteDocument = await this.documentbRepository.delete(relatedDocument.id);
      if (!deleteDocument) {
        throw new Error(`Failed to delete related document with ID ${relatedDocument.id}`);
      }


      const deleteGrn = await this.grnRepository.delete(grn.id);

      if (!deleteGrn) {
        throw new Error(`Failed to delete GRN with ID ${id}`);
      }

    }

    return { message: 'GRN records marked for deletion successfully' };


  }

}
