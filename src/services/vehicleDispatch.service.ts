import { id, inject, injectable } from 'inversify';
import { VehicleDispatchRepository } from '../repositories/vehicleDispatch.repository';
import { VehicleDispatch } from '../entities/vehicleDispatch.entity';
import { TYPES } from '../types';
import { AuditLogService } from './auditLog.service';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import { DocSingalApproverService } from './DocSingalApproverService.service';
import { DocumentStatus, DocumentTypeEnum } from '../entities/docuemnt.entity';
import { DocumentbService, DocumentWithRelatedData } from './documentb.service';
import { formatDateTime } from '../utils/dateUtils';
import { DocumentTypeEnum as DocDefEnum } from '../entities/documentdef.entity';
import { ApprovalFlowService } from './approvalFlow.service';
import { ILike, SelectQueryBuilder } from 'typeorm';
import { DocumentbRepository } from '../repositories/documentb.repository';

@injectable()
export class VehicleDispatchService {
  constructor(
    @inject(TYPES.VehicleDispatchRepository)
    private readonly vehicleDispatchRepository: VehicleDispatchRepository,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService,
    @inject(TYPES.DocSingalApproverService)
    private readonly docSingalApproverService: DocSingalApproverService,
    @inject(TYPES.DocumentbService)
    private readonly documentbService: DocumentbService,
    @inject(TYPES.DocumentbRepository)
    private readonly documentbRepository: DocumentbRepository,
    @inject(TYPES.ApprovalFlowService)
    private approvalFlowService: ApprovalFlowService
  ) {}
private async generateSerialNo(prefix: string): Promise<string> {
    // Get the count of existing GRNs for the branch (or use another unique mechanism)
    const count = await this.vehicleDispatchRepository.count({
      where: { vehicleDispatchNo: ILike(`${prefix}%`) },
    });
    console.log(count);
    // Generate the serial number in the format "PREFIX-001"
    const serialNo = `${prefix}-${(count + 1).toString().padStart(5, '0')}`;
    return serialNo;
  }




  async create(data: any): Promise<any> {

    //TODO: Check approval flow is exit or not for logged user

     const approvalFlowExit = this.approvalFlowService.findApprovalFlowForLoggedUser(data.requestedBy, 'vehicle-dispatch-register')

    if (!approvalFlowExit) {
      throw new Error('Approval flow not found');
    }

const serialNo = await this.generateSerialNo("VEHD");
      data.vehicleDispatchNo = serialNo;
    const vehicleDispatch = this.vehicleDispatchRepository.create(data);
    console.log(vehicleDispatch);
    const savedVehicalDispatch=await this.vehicleDispatchRepository.save(vehicleDispatch);

    //Todo:By Vaishali
           const document = await this.documentbService.createDocument({
                  type: DocumentTypeEnum.VEHICLE_DISPATCH_REGISTER,
                  docDef: DocDefEnum.OPERATION,
                 // totalAmt: rfpaData.totalAmt,
                  status: DocumentStatus.HOLD,
                  remarks: 'Document auto-created with Vehical_Dispatch',
                  lastActionBy: { id: data.requestedBy },
                  document_type_id: Array.isArray(savedVehicalDispatch) ? (savedVehicalDispatch[0] as VehicleDispatch)?.id : (savedVehicalDispatch as VehicleDispatch).id
                }, );
          
                await this.documentbService.startApprovalFlow(document.id);
    
    return savedVehicalDispatch;
  }
//TODO:Get All Recycle Bin Vehical Dispatch..By Vaishali
    public async getAllRecycleBinVehicalDispatch(queryOptions: PaginationOptions, userId: string): Promise<
     any
    > {
      const data = await this.docSingalApproverService.getAllSingleApprovalDocumentsByUserId(
        userId,
        DocumentTypeEnum.VEHICLE_DISPATCH_REGISTER,
      );
    const { search } = queryOptions;
      console.log('Fetched documents:', data);
    
      const typedDocuments = data as DocumentWithRelatedData[];
      const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === true);
    
      if (typedDocuments.length > 0) {
        console.log("doc.relatedData", typedDocuments[0].relatedData);
      } else {
        console.log("No documents found for user.");
      }
    
      for (const doc of activeDocuments) {
        if (!doc.document_type_id) {
          console.log('Missing document_type_id for doc', doc.id);
          continue;
        }
    
        try {
          doc.relatedData = await this.vehicleDispatchRepository.findOne({
            where: { id: doc.document_type_id, isDeleted: true },
            relations: [
          'companyName',
          'clientAddress',
          'dcNo',
          ]
          });
        } catch (e) {
          console.log("in catch block", e);
          doc.relatedData = null;
        }
      }
    
      let relatedDataOnly = activeDocuments.map((doc) => {
        const rd = doc.relatedData || {};
        return {
          documentId: doc.id,
          overAllStatus: doc.status,
          createdBy: `${doc.lastActionBy.firstName || null}  ${doc.lastActionBy.lastName || null}`,
          createdDate: formatDateTime(doc.createdAt).createdDate,
          createdTime: formatDateTime(doc.createdAt).createdTime,
  
          // From VehicleDispatch entity
      id: rd.id || null,
      date: rd.date || null,
      vehicleType: rd.vehicleType || null,
      vehicleNo: rd.vehicleNo || null,
      driverName: rd.driverName || null,
      driverMobNo: rd.driverMobNo || null,
      paymentDiscussed: rd.paymentDiscussed || null,
      outTime: rd.outTime || null,
      reachingTime: rd.reachingTime || null,
      clientName: rd.clientName || null,
      receivingPerson: rd.receivingPerson || null,
      supervisorName: rd.supervisorName || null,
      accDeptVerification: rd.accDeptVerification || null,
      transportationBillAmt: rd.transportationBillAmt || null,
      advancePaid: rd.advancePaid || null,
      remarksPFL: rd.remarksPFL || null,
      feedbackbyTransporterOwner: rd.feedbackbyTransporterOwner || null,
      netInwardQty: rd.netInwardQty || null,
      clientGRNNo: rd.clientGRNNo || null,
      paymentTerms: rd.paymentTerms || null,
      rejection: rd.rejection || null,
      shrinkageDump: rd.shrinkageDump || null,

      // Related entity fields
      companyName: rd.companyName?.name || null,
      clientAddress: rd.clientAddress || null,
      deliveryChallanNo: rd.dcNo?.challanNo || null,

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
  async findAll(queryOptions: PaginationOptions): Promise<any> {
  let query = this.vehicleDispatchRepository
    .createQueryBuilder('dispatch')
    .leftJoinAndSelect('dispatch.clientAddress', 'clientAddress')
    .leftJoinAndSelect('dispatch.dcNo', 'dcNo')
    .leftJoinAndSelect('dispatch.companyName', 'companyName')
    .orderBy('dispatch.createdAt', 'DESC');

  console.log(query.getQueryAndParameters()); // Debug SQL Query

  const result = await buildQuery(query, queryOptions, 'dispatch');
console.log(result); // Debug result
  const formattedResult = result.data.map((item) => {
    return {
      id: item.id,
      companyName: item.companyName?.name || null,
      date: item.date,
      vehicleType: item.vehicleType,
      vehicleNo: item.vehicleNo,
      driverName: item.driverName,
      driverMobNo: item.driverMobNo,
      paymentDiscussed: item.paymentDiscussed,
      outTime: item.outTime,
      reachingTime: item.reachingTime,
      clientName: item.clientName,
      clientAddress: item.clientAddress ? {
        address1: item.clientAddress.address1,
        address2: item.clientAddress.address2,
        location: item.clientAddress.location,
        city: item.clientAddress.city,
        state: item.clientAddress.state,
        pincode: item.clientAddress.pincode,
      }:null,
      receivingPerson: item.receivingPerson,
      supervisorName: item.supervisorName,
      accDeptVerification: item.accDeptVerification,
      transportationBillAmt: item.transportationBillAmt,
      advancePaid: item.advancePaid,
      remarksPFL: item.remarksPFL,
      feedbackbyTransporterOwner: item.feedbackbyTransporterOwner,
      netInwardQty: item.netInwardQty,
      clientGRNNo: item.clientGRNNo,
      paymentTerms: item.paymentTerms,
      dcNo: item.dcNo?.challanNo,
      rejection: item.rejection,
      shrinkageDump: item.shrinkageDump,
    };
  });

  return{ data:formattedResult,
    meta:result.meta
  }
}

  

  async findById(id: string): Promise<any> {
    return await this.vehicleDispatchRepository
    .createQueryBuilder('dispatch')
    .leftJoinAndSelect('dispatch.clientAddress', 'clientAddress')
    .leftJoinAndSelect('dispatch.dcNo', 'dcNo')
    .leftJoinAndSelect('dispatch.companyName', 'companyName')
      .select(['dispatch', 'clientAddress', 'dcNo.id','companyName.id'])
      .where('dispatch.id = :id', { id })
      .getOne();
  }

  async update(
    id: string,
    data: Partial<VehicleDispatch>,
    updatedBy: string,
  ): Promise<VehicleDispatch | null> {
    const dispatch = await this.findById(id);
    if (!dispatch) {
      return null;
    }

    const originalDispatch = { ...dispatch };

    Object.assign(dispatch, data);

    const updatedDispatch = await this.vehicleDispatchRepository.save(dispatch);

    // Step 4: Log the changes using the audit log service
    await this.auditLogService.logChange(
      'VehicleDispatch', // Entity name
      id, // Entity ID
      originalDispatch, // Original data (before the update)
      updatedDispatch, // Updated data (after the update)
      updatedBy, // User who made the update
    );

    // Return the updated vehicle dispatch
    return updatedDispatch;
  }

  async delete(id: string): Promise<boolean> {
    // Step 1: Find the vehicle dispatch by ID
    const dispatch = await this.vehicleDispatchRepository.findOne({
      where: { id },
    });

    // Step 2: If the vehicle dispatch doesn't exist, return false
    if (!dispatch) {
      return false;
    }

    // Step 3: Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

    // Log the scheduled deletion
    console.log(
      `Vehicle Dispatch with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`,
    );

    // Step 4: Set the deletionScheduledAt field for the vehicle dispatch
    dispatch.deletionScheduledAt = sixMonthsFromNow;

    // Step 5: Save the updated vehicle dispatch with the scheduled deletion date
    await this.vehicleDispatchRepository.save(dispatch);

    // Step 6: Return true to indicate the deletion was scheduled
    console.log(
      `Vehicle Dispatch with ID ${id} marked for deletion in 6 months.`,
    );
    return true;
  }
//Todo:Get All Vehical Dispatch..By Vaishali
     public async getAllvehicalDispatch(queryOptions: PaginationOptions, userId: string): Promise<
     any
    > {
      const data = await this.docSingalApproverService.getAllSingleApprovalDocumentsByUserId(
        userId,
        DocumentTypeEnum.VEHICLE_DISPATCH_REGISTER,
      );
    const { search } = queryOptions;
      console.log('Fetched documents:', data);
    
      const typedDocuments = data as DocumentWithRelatedData[];
      const activeDocuments = typedDocuments.filter(doc => doc.isDeleted === false);
    
      if (typedDocuments.length > 0) {
        console.log("doc.relatedData", typedDocuments[0].relatedData);
      } else {
        console.log("No documents found for user.");
      }
    
      for (const doc of activeDocuments) {
        if (!doc.document_type_id) {
          console.log('Missing document_type_id for doc', doc.id);
          continue;
        }
    
        try {
          doc.relatedData = await this.vehicleDispatchRepository.findOne({
            where: { id: doc.document_type_id, isDeleted: false },
            relations: [
          'companyName',
          'clientAddress',
          'dcNo',
          ]
          });
        } catch (e) {
          console.log("in catch block", e);
          doc.relatedData = null;
        }
      }
    
      let relatedDataOnly = activeDocuments.map((doc) => {
        const rd = doc.relatedData || {};
        return {
          documentId: doc.id,
          overAllStatus: doc.status,
          createdBy: `${doc.lastActionBy.firstName || null}  ${doc.lastActionBy.lastName || null}`,
          createdDate: formatDateTime(doc.createdAt).createdDate,
          createdTime: formatDateTime(doc.createdAt).createdTime,
  
          // From VehicleDispatch entity
      id: rd.id || null,
      date: rd.date || null,
      vehicleType: rd.vehicleType || null,
      vehicleNo: rd.vehicleNo || null,
      driverName: rd.driverName || null,
      driverMobNo: rd.driverMobNo || null,
      paymentDiscussed: rd.paymentDiscussed || null,
      outTime: rd.outTime || null,
      reachingTime: rd.reachingTime || null,
      clientName: rd.clientName || null,
      receivingPerson: rd.receivingPerson || null,
      supervisorName: rd.supervisorName || null,
      accDeptVerification: rd.accDeptVerification || null,
      transportationBillAmt: rd.transportationBillAmt || null,
      advancePaid: rd.advancePaid || null,
      remarksPFL: rd.remarksPFL || null,
      feedbackbyTransporterOwner: rd.feedbackbyTransporterOwner || null,
      netInwardQty: rd.netInwardQty || null,
      clientGRNNo: rd.clientGRNNo || null,
      paymentTerms: rd.paymentTerms || null,
      rejection: rd.rejection || null,
      shrinkageDump: rd.shrinkageDump || null,

      // Related entity fields
      companyName: rd.companyName?.name || null,
      clientAddress: rd.clientAddress || null,
      deliveryChallanNo: rd.dcNo?.challanNo || null,

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


  
  //Todo:Get All Vehical Dispatch..By Vaishali
  //    public async getAllvehicalDispatch(queryOptions: PaginationOptions, userId: string): Promise<
  //    any
  //   > {
  //     const data = await this.docSingalApproverService.getAllSingleApprovalDocumentsByUserId(
  //       userId,
  //       DocumentTypeEnum.VEHICLE_DISPATCH_REGISTER,
  //     );
  //   const { search } = queryOptions;
  //     console.log('Fetched documents:', data);
    
  //     const typedDocuments = data as DocumentWithRelatedData[];
    
  //     if (typedDocuments.length > 0) {
  //       console.log("doc.relatedData", typedDocuments[0].relatedData);
  //     } else {
  //       console.log("No documents found for user.");
  //     }
    
  //     for (const doc of typedDocuments) {
  //       if (!doc.document_type_id) {
  //         console.log('Missing document_type_id for doc', doc.id);
  //         continue;
  //       }
    
  //       try {
  //         doc.relatedData = await this.vehicleDispatchRepository.findOne({
  //           where: { id: doc.document_type_id },
  //           relations: [
  //         'companyName',
  //         'clientAddress',
  //         'dcNo',
  //         ]
  //         });
  //       } catch (e) {
  //         console.log("in catch block", e);
  //         doc.relatedData = null;
  //       }
  //     }
    
  //     let relatedDataOnly = typedDocuments.map((doc) => {
  //       const rd = doc.relatedData || {};
  //       return {
  //         documentId: doc.id,
  //         overAllStatus: doc.status,
  //         createdBy: `${doc.lastActionBy.firstName || null}  ${doc.lastActionBy.lastName || null}`,
  //         createdDate: formatDateTime(doc.createdAt).createdDate,
  //         createdTime: formatDateTime(doc.createdAt).createdTime,
  
  //         // From VehicleDispatch entity
  //     id: rd.id || null,
  //     date: rd.date || null,
  //     vehicleType: rd.vehicleType || null,
  //     vehicleNo: rd.vehicleNo || null,
  //     driverName: rd.driverName || null,
  //     driverMobNo: rd.driverMobNo || null,
  //     paymentDiscussed: rd.paymentDiscussed || null,
  //     outTime: rd.outTime || null,
  //     reachingTime: rd.reachingTime || null,
  //     clientName: rd.clientName || null,
  //     receivingPerson: rd.receivingPerson || null,
  //     supervisorName: rd.supervisorName || null,
  //     accDeptVerification: rd.accDeptVerification || null,
  //     transportationBillAmt: rd.transportationBillAmt || null,
  //     advancePaid: rd.advancePaid || null,
  //     remarksPFL: rd.remarksPFL || null,
  //     feedbackbyTransporterOwner: rd.feedbackbyTransporterOwner || null,
  //     netInwardQty: rd.netInwardQty || null,
  //     clientGRNNo: rd.clientGRNNo || null,
  //     paymentTerms: rd.paymentTerms || null,
  //     rejection: rd.rejection || null,
  //     shrinkageDump: rd.shrinkageDump || null,

  //     // Related entity fields
  //     companyName: rd.companyName?.name || null,
  //     clientAddress: rd.clientAddress || null,
  //     deliveryChallanNo: rd.dcNo?.challanNo || null,

  //       };
  //     });
  //    // 🔍 Deep Search
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

  //  // 🔄 Sorting
  // if (queryOptions.sort) {
  //   const [field, direction] = queryOptions.sort.split(':');
  //   const sortOrder = direction?.toUpperCase() === 'DESC' ? -1 : 1;

  //   const getNestedValue = (obj: any, path: string) =>
  //     path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);

  //   relatedDataOnly.sort((a, b) => {
  //     const valA = getNestedValue(a, field);
  //     const valB = getNestedValue(b, field);

  //     if (valA == null && valB == null) return 0;
  //     if (valA == null) return -1 * sortOrder;
  //     if (valB == null) return 1 * sortOrder;

  //     if (!isNaN(valA) && !isNaN(valB)) {
  //       return (Number(valA) - Number(valB)) * sortOrder;
  //     }
  //     return String(valA).localeCompare(String(valB)) * sortOrder;
  //   });
  // }
  //     return {
  //       data: relatedDataOnly,
  //       meta: {
  //         total: relatedDataOnly.length,
  //         page: queryOptions.page || 1,
  //         pages: Math.ceil(relatedDataOnly.length / (queryOptions.limit || 10)),
  //       }
  //     };
  //   }

    //TODO:Get Vehical Dispatch By Id For View..By Vaishali
public async getVehicalDispatchByIdForView(docid: string, userId:string): Promise<any> {
    const document = await this.docSingalApproverService.getSingleApprovalDocumentById(docid,userId)
    if(!document)
    {
      return null;
    }
    const id = document.documentTypeId;
    console.log('id in getVehicalDispatchByIdForView', id);
    
    if (id) {
      //console.log("Hiiiiiiiiiiiiiiiiiiiiiii");
      //console.log('Document type ID not found for document:', id);
      
      const vehicalDispatch = await this.vehicleDispatchRepository.findOne({
        where: { id },
        relations: [
         'companyName',
        'clientAddress',
        'dcNo',
        ],
      });

      console.log('Vehical Dispatch in getVehicalDispatchByIdForView', vehicalDispatch);
      

      if (!vehicalDispatch) { 
        throw new Error('AQR not found');
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
      const rawDate = vehicalDispatch.createdAt;
      const { createdDate, createdTime } = formatDateTime(rawDate);
      return {
    documentId: document.documentId,
    overAllStatus: document.status,
    createdBy: document.createdBy?.firstName + ' ' + document.createdBy?.lastName || null,
    createdDate,
    createdTime,
    approvalSummary: document.approvalSummary,
// VehicleDispatch fields
      id: vehicalDispatch.id,
      date: vehicalDispatch.date || null,
      vehicleType: vehicalDispatch.vehicleType || null,
      vehicleNo: vehicalDispatch.vehicleNo || null,
      driverName: vehicalDispatch.driverName || null,
      driverMobNo: vehicalDispatch.driverMobNo || null,
      paymentDiscussed: vehicalDispatch.paymentDiscussed || null,
      outTime: vehicalDispatch.outTime || null,
      reachingTime: vehicalDispatch.reachingTime || null,
      clientName: vehicalDispatch.clientName || null,
      receivingPerson: vehicalDispatch.receivingPerson || null,
      supervisorName: vehicalDispatch.supervisorName || null,
      accDeptVerification: vehicalDispatch.accDeptVerification || null,
      transportationBillAmt: vehicalDispatch.transportationBillAmt || null,
      advancePaid: vehicalDispatch.advancePaid || null,
      remarksPFL: vehicalDispatch.remarksPFL || null,
      feedbackbyTransporterOwner: vehicalDispatch.feedbackbyTransporterOwner || null,
      netInwardQty: vehicalDispatch.netInwardQty || null,
      clientGRNNo: vehicalDispatch.clientGRNNo || null,
      paymentTerms: vehicalDispatch.paymentTerms || null,
      rejection: vehicalDispatch.rejection || null,
      shrinkageDump: vehicalDispatch.shrinkageDump || null,

      // Related entity fields
      companyName: vehicalDispatch.companyName?.name || null,
      clientAddress: vehicalDispatch.clientAddress?.address1 || null,
      deliveryChallanNo: vehicalDispatch.dcNo?.challanNo || null,
  };
  }
}
//TODO:Filterd VehicalDispatch By Vaishali...20/08/2025
       async filterVehicalDispatch(
        page: number,
        limit: number,
        filters: Record<string, any>
      ) {
        const queryBuilder: SelectQueryBuilder<VehicleDispatch> =
          this.vehicleDispatchRepository.createQueryBuilder("vehicalDispatch");
      
        // ✅ Select all fields from Aqr
        queryBuilder.select("vehicalDispatch");
      
        // ✅ Join relations but select only specific fields
        queryBuilder
          .leftJoin("vehicalDispatch.companyName", "companyName")
          .addSelect("companyName.name")
          .leftJoin("vehicalDispatch.dcNo", "dcNo")
          .addSelect("dcNo.vehicleNo")
          
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
            queryBuilder.andWhere(`vehicalDispatch.${key} ILIKE :${paramKey}`, {
              [paramKey]: `%${value}%`,
            });
          } else {
            queryBuilder.andWhere(`vehicalDispatch.${key} = :${paramKey}`, {
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
public async deleteMultipleVehicleDispatch(ids: string[]): Promise<{ success: string[]; failed: { id: string; reason: string }[]; message: string }> {
  const success: string[] = [];
  const failed: { id: string; reason: string }[] = [];  
  for (const id of ids) {
      const vehicalDispatch = await this.vehicleDispatchRepository.findOne({
        where: { id },
      });

      if (!vehicalDispatch) {
        failed.push({ id, reason: 'Vehicle Dispatch not found' });
        continue;
      }

      const relatedDocument = await this.documentbRepository.findOne({
        where: { document_type_id: vehicalDispatch.id }
      });

      if (!relatedDocument) {
        throw new Error(`Something went wrong`);
      }

      const deleteDocument = await this.documentbRepository.delete(relatedDocument.id);
      if (!deleteDocument) {
        throw new Error(`Failed to delete related document with ID ${relatedDocument.id}`);
      }


      const deleteGrn = await this.vehicleDispatchRepository.delete(vehicalDispatch.id);

      if (!deleteGrn) {
        throw new Error(`Failed to delete Vehicle Dispatch with ID ${id}`);
      }

    }
    const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
    return { success, failed, message};

  }
}
