import { inject, injectable } from 'inversify';
import * as XLSX from 'xlsx';
import { Farmer } from '../entities/farmer.entity';
import { FarmerRepository } from '../repositories/farmer.repository';
import { TYPES } from '../types';

import { Crop } from '../entities/crop.entity';
import fs from 'fs';
import csv from 'csv-parser';
import { CropRepository } from '../repositories/crop.repository';

import { Address } from '../entities/address.entity';
import { AuditLogService } from './auditLog.service';
import AppError from '../utils/appError';
import { applyNumericFilter, buildQuery, PaginationOptions } from '../utils/pagination';
import { AddressRepository } from '../repositories/address.repository';
import { AppDataSource } from '../utils/data-source';
import { parseExcelDate } from '../utils/excelParser';
import { UserRepository } from '../repositories/user.repository';
import { Role } from '../entities/user.entity';
import { Status } from '../utils/status.enum';
import { formatDateTime } from '../utils/dateUtils';

@injectable()
export class FarmerService {
  constructor(
    @inject(TYPES.FarmerRepository)
    private readonly farmerRepository: FarmerRepository,
    @inject(TYPES.AddressRepository)
    private readonly addressRepository: AddressRepository,
    @inject(TYPES.CropRepository)
    private readonly cropRepository: CropRepository,
    @inject(TYPES.UserRepository)
    private userRepository: UserRepository,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService,
  ) {}

  // public async getAllFarmers(queryOptions: PaginationOptions): Promise<any> {
  //   const queryBuilder = this.farmerRepository.createQueryBuilder('farmer')
  //     .leftJoinAndSelect('farmer.crops', 'crops')
  //     .leftJoinAndSelect('farmer.residensialAddress', 'residensialAddress')
  //     .leftJoinAndSelect('farmer.farmAddress', 'farmAddress')
  //      // Default sorting by createdAt

  //   // Return paginated results using the paginateQuery utility
  //   return await paginateQuery(queryBuilder, queryOptions);
  // }

  //   async getAllFarmers(options: PaginationOptions) {
  //     // Removed invalid paginate method call
  //     const queryBuilder = this.farmerRepository.createQueryBuilder('farmer')
  //       .leftJoinAndSelect('farmer.crops', 'crops')
  //       .leftJoinAndSelect('farmer.residensialAddress', 'residensialAddress')
  //       .leftJoinAndSelect('farmer.farmAddress', 'farmAddress')
  //       .paginate()
  // // Applying pagination, filtering, and sorting
  // return await paginateQuery(queryBuilder, options);
  //     // return await paginate(queryBuilder, options);
  //   }

  async getAllFarmers(options: PaginationOptions): Promise<any> {
  const queryBuilder = this.farmerRepository
    .createQueryBuilder('farmer')
    .leftJoinAndSelect('farmer.createdBy', 'createdBy') // ✅ include this
    .leftJoinAndSelect('farmer.crops', 'crops')
    .leftJoinAndSelect('crops.crop', 'crop')
    .leftJoinAndSelect('farmer.residensialAddress', 'residensialAddress')
    .leftJoinAndSelect('farmer.farmAddress', 'farmAddress')
    .orderBy('farmer.createdAt', 'DESC');

  const farmers = await buildQuery(queryBuilder, options, 'farmer');

  // ✅ Define helper function to format date & time
  // function formatDateTime(dateString?: string) {
  //   if (!dateString) return { createdDate: null, createdTime: null };

  //   const date = new Date(dateString);
  //   const day = String(date.getDate()).padStart(2, '0');
  //   const month = String(date.getMonth() + 1).padStart(2, '0');
  //   const year = date.getFullYear();

  //   const hours = date.getHours();
  //   const minutes = String(date.getMinutes()).padStart(2, '0');
  //   const ampm = hours >= 12 ? 'PM' : 'AM';
  //   const hour12 = hours % 12 || 12;
  //   const formattedTime = `${String(hour12).padStart(2, '0')}:${minutes} ${ampm}`;
  //   const formattedDate = `${day}-${month}-${year}`;

  //   return { createdDate: formattedDate, createdTime: formattedTime };
  // }

  // ✅ Format each farmer
  const formattedData = farmers.data.map((farmer: any) => {
    const { createdDate, createdTime } = formatDateTime(farmer.createdAt);

    return {
      ...farmer,
      createdBy: farmer.createdBy
        ? `${farmer.createdBy.firstName} ${farmer.createdBy.lastName}`
        : null,
      createdDate,
      createdTime,
      //createdAt: createdDate && createdTime ? `${createdDate} ${createdTime}` : null,
    };
  });

  // ✅ Return final structured response
  return {
    ...farmers,
    data: formattedData,
  };
}


  public async getAllFarmerCodes(): Promise<string[]> {
    const farmers = await this.farmerRepository.find({
      select: ['farmerCode'], 
      order: {
        createdAt: 'DESC', 
      },
    });

    
    return farmers.map((farmer) => farmer.farmerCode);
  }
 public async getFarmersWithFilters(queryOptions: PaginationOptions) {
    const queryBuilder = this.farmerRepository
      .createQueryBuilder('farmer')
      .leftJoinAndSelect('farmer.residensialAddress', 'residensialAddress')
      .leftJoinAndSelect('farmer.farmAddress', 'farmAddress')
      .leftJoinAndSelect('farmer.crops', 'crops')
      .orderBy('farmer.createdAt', 'DESC');

       const { filters = {} } = queryOptions;

  
  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue;

    if (['totalLandArea', 'cultivationArea'].includes(key)) continue;

   
    if (key.includes('.')) {
      const [alias, column] = key.split('.');

      if (alias === 'farmAddress' || alias === 'residensialAddress') {
       
        if (column === 'pincode') {
          queryBuilder.andWhere(`"${alias}"."${column}" = :${alias}_${column}`, { [`${alias}_${column}`]: value });
        } else {
         
          queryBuilder.andWhere(`LOWER("${alias}"."${column}") LIKE LOWER(:${alias}_${column})`, { [`${alias}_${column}`]: `%${value}%` });
        }
      }


      if (alias === 'crops' && column === 'crop') {
        queryBuilder.andWhere(qb => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from('crop', 'c')
            .where('"c"."farmerId" = "farmer"."id"')
            .andWhere('LOWER(c.crop) = LOWER(:crop)')
            .getQuery();
          return `EXISTS ${subQuery}`;
        }, { crop: value });
      }
    } else {
      
      queryBuilder.andWhere(`farmer.${key} = :${key}`, { [key]: value });
    }
  }

    const {
      status,
      landStatus,
      landHoldingStatus,
      totalLandArea,
      cultivationArea,

    } = queryOptions.filters || {};

    

   
    if (status) queryBuilder.andWhere('farmer.status = :status', { status });
    if (landStatus) queryBuilder.andWhere('farmer.landStatus = :landStatus', { landStatus });
    if (landHoldingStatus) queryBuilder.andWhere('farmer.landHoldingStatus = :landHoldingStatus', { landHoldingStatus });

   
    applyNumericFilter(queryBuilder, 'farmer', 'totalLandArea', totalLandArea);
    applyNumericFilter(queryBuilder, 'farmer', 'cultivationArea', cultivationArea);

    const [sql, params] = queryBuilder.getQueryAndParameters();
    console.log('SQL:', sql);
    console.log('Params:', params);

   
    const { data, meta } = await buildQuery(queryBuilder, queryOptions, 'farmer');

   
    const formattedData = data.map((farmer) => ({
      id: farmer.id,
      fullName: [farmer.farmerfName, farmer.farmermName, farmer.farmerlName]
        .filter(Boolean)
        .join(' '),
      primaryMobileNo: farmer.primaryMobileNo,
      secondaryMobileNo: farmer.secondaryMobileNo,
      status: farmer.status,
      email: farmer.email,
      farmerCode: farmer.farmerCode,
      totalLandArea: farmer.totalLandArea,
      cultivationArea: farmer.cultivationArea,
      landHoldingStatus: farmer.landHoldingStatus,
      landStatus: farmer.landStatus,
      residensialAddress: farmer.residensialAddress || null,
      farmAddress: farmer.farmAddress || null,
      crops: farmer.crops || [],
    }));

    return {
      data: formattedData,
      total: meta.total,
      currentPage: meta.page,
      totalPages: meta.pages,
    };}
  public async getAllFarmer(
    queryOptions: PaginationOptions,
  ): Promise<{ data1: any[]; meta: any }> {
    const queryBuilder = this.farmerRepository
      .createQueryBuilder('farmer')
      .leftJoinAndSelect('farmer.residensialAddress', 'residensialAddress')
      .leftJoinAndSelect('farmer.farmAddress', 'farmAddress')
      .orderBy('farmer.createdAt', 'DESC');

    const { data, meta } = await buildQuery(
      queryBuilder,
      queryOptions,
      'farmer',
    );

    const data1 = data.map((farmer) => ({
      id: farmer.id,
      fullName: [farmer.farmerfName, farmer.farmermName, farmer.farmerlName]
        .filter(Boolean)
        .join(' '),
      primaryMobileNo: farmer.primaryMobileNo,
      secondaryMobileNo: farmer.secondaryMobileNo,
      status: farmer.status,
      email: farmer.email,
      farmerCode: farmer.farmerCode,
      residensialAddress: farmer.residensialAddress
        ? {
            id: farmer.residensialAddress.id,
            address1: farmer.residensialAddress.address1,
            address2: farmer.residensialAddress.address2,
            location: farmer.residensialAddress.location,
            city: farmer.residensialAddress.city,
            state: farmer.residensialAddress.state,
            pincode: farmer.residensialAddress.pincode,
          }
        : null,
      farmAddress: farmer.farmAddress
        ? {
            id: farmer.farmAddress.id,
            address1: farmer.farmAddress.address1,
            address2: farmer.farmAddress.address2,
            location: farmer.farmAddress.location,
            city: farmer.farmAddress.city,
            state: farmer.farmAddress.state,
            pincode: farmer.farmAddress.pincode,
          }
        : null,
    }));

    return { data1, meta };
  }

  public async getPartialFarmersById(id: string): Promise<any> {
    const farmer = await this.farmerRepository
      .createQueryBuilder('farmer')
      .leftJoinAndSelect('farmer.residensialAddress', 'residensialAddress')
      .leftJoinAndSelect('farmer.farmAddress', 'farmAddress')
      .select([
        'farmer.id',
        'farmer.primaryMobileNo',
        'farmer.secondaryMobileNo',
        'farmer.email',
        'farmer.farmerCode',
        'residensialAddress.id',
        'residensialAddress.address1',
        'residensialAddress.address2',
        'residensialAddress.location',
        'residensialAddress.city',
        'residensialAddress.state',
        'residensialAddress.pincode',
        'farmAddress.id',
        'farmAddress.address1',
        'farmAddress.address2',
        'farmAddress.location',
        'farmAddress.city',
        'farmAddress.state',
        'farmAddress.pincode',
      ])
      .addSelect(
        `
        TRIM(CONCAT(
          COALESCE(farmer.farmerfName, ''), ' ',
          COALESCE(farmer.farmermName, ''), ' ',
          COALESCE(farmer.farmerlName, '')
        ))`,
        'fullName',
      )
      .where('farmer.id = :id', { id })
      .getRawOne();

    if (!farmer) return null;

    return {
      id: farmer.farmer_id,
      fullName: farmer.fullName,
      primaryMobileNo: farmer.farmer_primaryMobileNo,
      secondaryMobileNo: farmer.farmer_secondaryMobileNo,
      email: farmer.farmer_email,
      farmerCode: farmer.farmer_farmerCode,
      residensialAddress: farmer.residensialAddress_id
        ? {
            id: farmer.residensialAddress_id,
            address1: farmer.residensialAddress_address1,
            address2: farmer.residensialAddress_address2,
            location: farmer.residensialAddress_location,
            city: farmer.residensialAddress_city,
            state: farmer.residensialAddress_state,
            pincode: farmer.residensialAddress_pincode,
          }
        : null,
      farmAddress: farmer.farmAddress_id
        ? {
            id: farmer.farmAddress_id,
            address1: farmer.farmAddress_address1,
            address2: farmer.farmAddress_address2,
            location: farmer.farmAddress_location,
            city: farmer.farmAddress_city,
            state: farmer.farmAddress_state,
            pincode: farmer.farmAddress_pincode,
          }
        : null,
    };
  }

    public async getfarmerbyidforview(id: string): Promise<any> {
      console.log('inservice',id)
    const farmer = await this.farmerRepository
      .createQueryBuilder('farmer')
      .leftJoinAndSelect('farmer.residensialAddress', 'residensialAddress')
      .leftJoinAndSelect('farmer.farmAddress', 'farmAddress')
      .leftJoinAndSelect('farmer.crops', 'crops')
      .leftJoinAndSelect('crops.crop', 'crop')
      .where('farmer.id = :id', { id })
      .getOne();

    if (!farmer) return null;

    return {
      id: farmer.id,
      farmerfName:farmer.farmerfName ||  null,
      farmermName:farmer.farmermName || null ,
      farmerlName:farmer.farmerlName || null,
      gender:farmer.gender,
      dob: farmer.dob,
    idProofNo: farmer.idProofNo,
    idProofCopy: farmer.idProofCopy,
    howDoYouSell: farmer.howDoYouSell,
    landHoldingStatus: farmer.landHoldingStatus,
    landStatus: farmer.landStatus,
    totalLandArea: farmer.totalLandArea,
    cultivationArea: farmer.cultivationArea,
    sevenTwelveNo: farmer.sevenTwelveNo,
    sevenTwelveCopy: farmer.sevenTwelveCopy,

      //fullName: farmer.farmerfName + ' ' + farmer.farmermName + ' ' + farmer.farmerlName,
      primaryMobileNo: farmer.primaryMobileNo,
      secondaryMobileNo: farmer.secondaryMobileNo,
      email: farmer.email,
      farmerCode: farmer.farmerCode,
      residensialAddress: farmer.residensialAddress.id
        ? {
            id: farmer.residensialAddress.id,
            address1: farmer.residensialAddress.address1,
            address2: farmer.residensialAddress.address2,
            location: farmer.residensialAddress.location,
            city: farmer.residensialAddress.city,
            state: farmer.residensialAddress.state,
            pincode: farmer.residensialAddress.pincode,
          }
        : null,
      farmAddress: farmer.farmAddress.id
        ? {
            id: farmer.farmAddress.id,
            address1: farmer.farmAddress.address1,
            address2: farmer.farmAddress.address2,
            location: farmer.farmAddress.location,
            city: farmer.farmAddress.city,
            state: farmer.farmAddress.state,
            pincode: farmer.farmAddress.pincode,
          }
        : null,
    

    crops: farmer.crops?.map((crop: Crop) => ({
      id: crop.id,
      crop: crop.crop?.name || null,
      variety: crop.variety,
      noOfPlants: crop.noOfPlants,
      pruningDate: crop.pruningDate,
      expectedHarvestDate: crop.expectedHarvestDate,
      expectedQuantityInTonnes: crop.expectedQuantityInTonnes,

    })),
    };
  }

  public async getfarmerbyidforupdate(id: string): Promise<any> {
      console.log('inservice',id)
    const farmer = await this.farmerRepository
      .createQueryBuilder('farmer')
      .leftJoinAndSelect('farmer.residensialAddress', 'residensialAddress')
      .leftJoinAndSelect('farmer.farmAddress', 'farmAddress')
      .leftJoinAndSelect('farmer.crops', 'crops')
      .leftJoinAndSelect('crops.crop', 'crop')
      .where('farmer.id = :id', { id })
      .getOne();

    if (!farmer) return null;

    return {
      id: farmer.id,
      farmerfName:farmer.farmerfName ||  null,
      farmermName:farmer.farmermName || null ,
      farmerlName:farmer.farmerlName || null,
      gender:farmer.gender,
      dob: farmer.dob, 
    idProofNo: farmer.idProofNo,
    idProofCopy: farmer.idProofCopy,
    howDoYouSell: farmer.howDoYouSell,
    landHoldingStatus: farmer.landHoldingStatus,
    landStatus: farmer.landStatus,
    totalLandArea: farmer.totalLandArea,
    cultivationArea: farmer.cultivationArea,
    sevenTwelveNo: farmer.sevenTwelveNo,
    sevenTwelveCopy: farmer.sevenTwelveCopy,
      //fullName: farmer.farmerfName + ' ' + farmer.farmermName + ' ' + farmer.farmerlName,
      primaryMobileNo: farmer.primaryMobileNo,
      secondaryMobileNo: farmer.secondaryMobileNo,
      email: farmer.email,
      farmerCode: farmer.farmerCode,
      residensialAddress: farmer.residensialAddress.id
        ? {
            id: farmer.residensialAddress.id,
            address1: farmer.residensialAddress.address1,
            address2: farmer.residensialAddress.address2,
            location: farmer.residensialAddress.location,
            city: farmer.residensialAddress.city,
            state: farmer.residensialAddress.state,
            pincode: farmer.residensialAddress.pincode,
          }
        : null,
      farmAddress: farmer.farmAddress.id
        ? {
            id: farmer.farmAddress.id,
            address1: farmer.farmAddress.address1,
            address2: farmer.farmAddress.address2,
            location: farmer.farmAddress.location,
            city: farmer.farmAddress.city,
            state: farmer.farmAddress.state,
            pincode: farmer.farmAddress.pincode,
          }
        : null,
    

    crops: farmer.crops?.map((crop: Crop) => ({
      id: crop.id,
      crop: crop.crop?.id || null,
      variety: crop.variety,
      noOfPlants: crop.noOfPlants,
      pruningDate: crop.pruningDate,
      expectedHarvestDate: crop.expectedHarvestDate,
      expectedQuantityInTonnes: crop.expectedQuantityInTonnes,

    })),
    };
  }

  public async getAllFarmerWithFilter(filter: string): Promise<any[]> {
    const query = this.farmerRepository
      .createQueryBuilder('farmer')
      .leftJoin('farmer.residensialAddress', 'residensialAddress')
      .leftJoin('farmer.farmAddress', 'farmAddress')
      .select([
        'farmer.id',
        'farmer.primaryMobileNo',
        'farmer.secondaryMobileNo',
        'farmer.email',
        'farmer.farmerCode',
        'residensialAddress.id',
        'residensialAddress.address1',
        'residensialAddress.address2',
        'residensialAddress.location',
        'residensialAddress.city',
        'residensialAddress.state',
        'residensialAddress.pincode',
        'farmAddress.id',
        'farmAddress.address1',
        'farmAddress.address2',
        'farmAddress.location',
        'farmAddress.city',
        'farmAddress.state',
        'farmAddress.pincode',
      ])
      .addSelect(
        `TRIM(CONCAT(
          COALESCE(farmer.farmerfName, ''), ' ',
          COALESCE(farmer.farmermName, ''), ' ',
          COALESCE(farmer.farmerlName, '')
        ))`,
        'fullName',
      )
      .orderBy('farmer.createdAt', 'DESC');

    // Apply filtering only if 'filter' is provided
    if (filter) {
      query.where(
        `TRIM(CONCAT(
          COALESCE(farmer.farmerfName, ''), ' ',
          COALESCE(farmer.farmermName, ''), ' ',
          COALESCE(farmer.farmerlName, '')
        )) ILIKE :filter`,
        { filter: `%${filter}%` },
      );
    }

    const farmers = await query.getRawMany();

    return farmers.map((farmer) => ({
      id: farmer.farmer_id,
      fullName: farmer.fullName,
      primaryMobileNo: farmer.farmer_primaryMobileNo,
      secondaryMobileNo: farmer.farmer_secondaryMobileNo,
      email: farmer.farmer_email,
      farmerCode: farmer.farmer_farmerCode,
      residensialAddress: farmer.residensialAddress_id
        ? {
            id: farmer.residensialAddress_id,
            address1: farmer.residensialAddress_address1,
            address2: farmer.residensialAddress_address2,
            location: farmer.residensialAddress_location,
            city: farmer.residensialAddress_city,
            state: farmer.residensialAddress_state,
            pincode: farmer.residensialAddress_pincode,
          }
        : null, // Return null if residential address is missing
      farmAddress: farmer.farmAddress_id
        ? {
            id: farmer.farmAddress_id,
            address1: farmer.farmAddress_address1,
            address2: farmer.farmAddress_address2,
            location: farmer.farmAddress_location,
            city: farmer.farmAddress_city,
            state: farmer.farmAddress_state,
            pincode: farmer.farmAddress_pincode,
          }
        : null, // Return null if farm address is missing
    }));
  }
  async approveFarmer(farmerId: string, approverId: string,status:Status) {
    console.log('Approver ID:', approverId);
    const approver = await this.userRepository.findOne({
      where: { id: approverId },
     
    });
    if (!approver) throw new Error('Approver not found');

    if (!approver.roles || !approver.roles.includes('admin' as Role)) {
      throw new Error('Only admin can approve farmers');
    }

    const farmer = await this.farmerRepository.findOne({
      where: { id: farmerId },
    });
    if (!farmer) throw new Error('farmer not found');

    farmer.status = status;
    return await this.farmerRepository.save(farmer);
  }
  async getFarmerById(id: string): Promise<Farmer | null> {
    return this.farmerRepository.findOne({
      where: { id },
      relations: ['crops', 'residensialAddress', 'farmAddress','crops.crop'], // Corrected to use an array
    });
  }
  async getFarmerByIdForUpdate(id: string) {
    const farmer = await this.farmerRepository.findOne({
      where: { id },
      relations: ['residensialAddress', 'farmAddress', 'crops'],
    });

    if (!farmer) {
      throw new Error('Farmer not found');
    }

    return {
      id: farmer.id,
      farmerfName: farmer.farmerfName,
      farmerlName: farmer.farmerlName,
      primaryMobileNo: farmer.primaryMobileNo,
      dob: farmer.dob,
      residensialAddress: farmer.residensialAddress?.id || null,
      farmAddress: farmer.farmAddress?.id || null,
      crop: farmer.crops,
    };
  }

  public async createFarmer(farmerData: any): Promise<any> {
    const user = await this.userRepository.findOneBy({
      id: farmerData.createdBy,
    });
    console.log("in user service",user);
    if (user?.roles && user.roles.includes('admin' as Role)) {
      farmerData.status = 'approved';
    }
    console.log('in create farmer');
    let sequenceNumber = await this.farmerRepository.count(); // Get initial count once
    farmerData.farmerCode = `FARM${new Date().getFullYear()}${String(
      ++sequenceNumber,
    ).padStart(4, '0')}`;
    const farmer = this.farmerRepository.create(farmerData);
    console.log('it will create farmer');
    return this.farmerRepository.save(farmer);
  }

  // public async updateFarmer(
  //   farmerId: string,
  //   updateData: any
  // ): Promise<Farmer | null> {
  //   const farmer = await this.farmerRepository.findOne({
  //     where: { id: farmerId },
  //     relations: ["crops"],
  //   });
  //   if (!farmer) {
  //     return null;
  //   }

  //   const { crops: updatedCrops, ...outerFields } = updateData;
  //   Object.assign(farmer, outerFields);

  //   if (updatedCrops) {
  //     updatedCrops.forEach((updatedCrop: any) => {
  //       const existingCrop = farmer.crops.find(
  //         (crop) => crop.id === updatedCrop.id
  //       );
  //       if (existingCrop) {
  //         for (const key in updatedCrop) {
  //           if (updatedCrop.hasOwnProperty(key)) {
  //             (existingCrop as any)[key] = updatedCrop[key];
  //           }
  //         }
  //       }
  //     });
  //   }

  //   await this.farmerRepository.save(farmer);
  //   return farmer;
  // }
  // public async updateFarmer(
  //   farmerId: string,
  //   updateData: any,
  //   updatedBy: string,
  // ): Promise<Farmer | null> {
  //   // Step 1: Fetch the existing Farmer with relations to "crops"
  //   const farmer = await this.farmerRepository.findOne({
  //     where: { id: farmerId },
  //     relations: ['crops'],
  //   });

  //   if (!farmer) {
  //     return null; // If Farmer doesn't exist, return null
  //   }

  //   // Step 2: Prepare the data for audit logging (before update)
  //   const { crops: updatedCrops, ...outerFields } = updateData;
  //   const previousFarmerData = { ...farmer };

  //   // Log changes for the Farmer fields (excluding crops)
  //   await this.auditLogService.logChange(
  //     'Farmer',
  //     farmerId,
  //     previousFarmerData,
  //     { ...outerFields },
  //     updatedBy,
  //   );

  //   Object.assign(farmer, outerFields);

  //   if (updatedCrops) {

  //     updatedCrops.forEach((updatedCrop: Partial<Crop>) => {
  //       const existingCrop = farmer.crops.find(
  //         (crop) => crop.id === updatedCrop.id,
  //       );
  //       if (existingCrop) {

  //         this.auditLogService.logChange(
  //           'Crop',
  //           updatedCrop.id!,
  //           existingCrop,
  //           updatedCrop,
  //           updatedBy,
  //         );

  //         for (const key in updatedCrop) {
  //           if (Object.prototype.hasOwnProperty.call(updatedCrop, key)) {
  //             (existingCrop as any)[key] = updatedCrop[key as keyof Crop]!;
  //           }
  //         }
  //       }
  //     });
  //   }

  //   // Step 5: Save the updated Farmer (and related crops)
  //   await this.farmerRepository.save(farmer);

  //   return farmer; // Return the updated Farmer entity
  // }

  //   public async updateFarmer(
  //   farmerId: string,
  //   updateData: any,
  //   updatedBy: string
  // ): Promise<Farmer | null> {
  //   const farmer = await this.farmerRepository.findOne({
  //     where: { id: farmerId },
  //     relations: ["crops"],
  //   });

  //   if (!farmer) return null;

  //   const { crops: updatedCrops, ...outerFields } = updateData;

  //   // Audit farmer outer fields
  //   await this.auditLogService.logChange(
  //     "Farmer",
  //     farmerId,
  //     { ...farmer },
  //     { ...outerFields },
  //     updatedBy
  //   );

  //   // Update outer fields
  //   Object.assign(farmer, outerFields);

  //   if (updatedCrops) {
  //     const updatedCropIds = updatedCrops.filter((c: { id: any }) => c.id).map((c: { id: any }) => c.id);

  //     // Keep only crops that still exist in request (others will be deleted by orphanedRowAction)
  //     farmer.crops = farmer.crops.filter(c => updatedCropIds.includes(c.id));

  //     for (const updatedCrop of updatedCrops) {
  //       if (updatedCrop.id) {
  //         // Update existing crop
  //         const existingCrop = farmer.crops.find(c => c.id === updatedCrop.id);
  //         if (existingCrop) {
  //           await this.auditLogService.logChange(
  //             "Crop",
  //             updatedCrop.id,
  //             existingCrop,
  //             updatedCrop,
  //             updatedBy
  //           );
  //           Object.assign(existingCrop, updatedCrop);
  //         }
  //       } else {
  //         // Add new crop
  //         const newCrop = this.cropRepository.create(updatedCrop);
  //         if (Array.isArray(newCrop)) {
  //           farmer.crops.push(...newCrop);
  //         } else {
  //           farmer.crops.push(newCrop);
  //         }
  //       }
  //     }
  //   }

  //   await this.farmerRepository.save(farmer);
  //   return farmer;
  // }

  public async updateFarmer(
    farmerId: string,
    updateData: any,
    updatedBy: string,
    requestedBy: string | { id?: string }
  ): Promise<Farmer | null> {


    const farmer = await this.farmerRepository.findOne({
      where: { id: farmerId },
      relations: ['crops'],
    });

    if (!farmer) return null;

    const { crops: updatedCrops, ...outerFields } = updateData;
 console.log('Approver ID:', updatedBy);
 
  const requesterId =
    typeof requestedBy === 'object' && requestedBy !== null && 'id' in requestedBy && requestedBy.id
      ? requestedBy.id
      : (requestedBy as string);

  if (!requesterId) {
    throw new Error('Requester id not provided');
  }

  // ✅ Find the requester user
  const requester = await this.userRepository.findOne({
    where: { id: requesterId },
  });

  if (!requester) throw new Error('Requester not found');

  // ✅ Check if user has admin role
  if (Array.isArray(requester.roles) && requester.roles.includes('admin' as Role)) {
    console.log('✅ Requester is Admin — setting farmer status to "approved"');
    farmer.status =Status.APPROVED;
  } else {
    console.log('Requester is not Admin — keeping existing status');
  }
    // Audit farmer outer fields
    await this.auditLogService.logChange(
      'Farmer',
      farmerId,
      { ...farmer },
      { ...outerFields },
      updatedBy,
    );

    // Update outer fields
    Object.assign(farmer, outerFields);

    if (updatedCrops) {
      const updatedCropIds = updatedCrops
        .filter((c: { id: any }) => c.id)
        .map((c: { id: any }) => c.id);

      // Keep only crops that still exist in request (others will be deleted by orphanedRowAction)
      farmer.crops = farmer.crops.filter((c) => updatedCropIds.includes(c.id));

      for (const updatedCrop of updatedCrops) {
        if (updatedCrop.id) {
          // Update existing crop
          const existingCrop = farmer.crops.find(
            (c) => c.id === updatedCrop.id,
          );
          if (existingCrop) {
            await this.auditLogService.logChange(
              'Crop',
              updatedCrop.id,
              existingCrop,
              updatedCrop,
              updatedBy,
            );
            Object.assign(existingCrop, updatedCrop);
          }
        } else {
          // Add new crop
          const newCrop = this.cropRepository.create(updatedCrop);
          if (Array.isArray(newCrop)) {
            farmer.crops.push(...newCrop);
          } else {
            farmer.crops.push(newCrop);
          }
        }
      }
    }

    await this.farmerRepository.save(farmer);
    return farmer;
  }
  // Delete a farmer with scheduled deletion (6 months)
  async deleteFarmer(id: string): Promise<boolean> {
    // Find the farmer by ID
    const farmer = await this.farmerRepository.findOne({
      where: { id },
      relations: ['crops'], // Include related crops to handle deletion if necessary
    });

    if (!farmer) {
      throw new AppError(404, `Farmer with ID ${id} not found`);
    }

    // Calculate the date 6 months ahead
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

    // Log the scheduled deletion
    console.log(
      `Farmer with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`,
    );

    // Set the deletionScheduledAt field for the farmer
    farmer.deletionScheduledAt = sixMonthsFromNow;

    // Optionally, handle related crops and mark them for deletion in 6 months as well
    if (farmer.crops && farmer.crops.length > 0) {
      for (const crop of farmer.crops) {
        crop.deletionScheduledAt = sixMonthsFromNow;
        await this.farmerRepository.manager.save(crop);
      }
    }

    // Save the updated farmer with the scheduled deletion date
    await this.farmerRepository.save(farmer);

    console.log(`Farmer with ID ${id} marked for deletion in 6 months.`);
    return true;
  }
  async createFarmerwithExcel(farmerData: any): Promise<any> {
    console.log('in create farmer');
    const workbook = XLSX.readFile(farmerData);
    const sheetNames = workbook.SheetNames;
    console.log('Sheet names found:', sheetNames);

    const farmerRepository = AppDataSource.getRepository(Farmer);

    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      console.log('Processing sheet:', sheetName);

      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
      });

      if (jsonData.length < 2) {
        console.warn('Sheet does not have enough rows:', sheetName);
        continue;
      }

      const headers: string[] = (jsonData[0] as any[]).map((h: any) =>
        h ? String(h).trim() : `UNKNOWN`,
      );
      console.log('Headers found:', headers);

      const dataRows = jsonData.slice(1); // Skip header row

      for (const rowUntyped of dataRows) {
        if (!Array.isArray(rowUntyped) || rowUntyped.length === 0) continue;

        const rowData: Record<string, any> = {};
        headers.forEach((header, index) => {
          rowData[header] = rowUntyped[index];
        });

        console.log('Mapped Row:', rowData);

        if (!rowData['First Name'] || !rowData['Primary Mobile No']) {
          console.warn('Skipping incomplete row:', rowData);
          continue;
        }

        let sequenceNumber = await farmerRepository.count();
        const farmerCode = `FARM${new Date().getFullYear()}${String(
          ++sequenceNumber,
        ).padStart(4, '0')}`;

        const farmer = new Farmer();
        farmer.farmerfName = rowData['First Name'];
        farmer.farmermName = rowData['Middl Name'] || rowData['MiddleName']; // support both spellings
        farmer.farmerlName = rowData['Last Name'];
        farmer.primaryMobileNo = rowData['Primary Mobile No'];
        farmer.secondaryMobileNo = rowData['Secondary Mobile No'];
        farmer.email = rowData['Email'];
        farmer.gender = rowData['Gender'];

        // ---- Fix for DOB ----
        console.log('Raw DOB value:', rowData['Date Of Birth']);

        if (rowData['Date Of Birth']) {
          const dob = parseExcelDate(rowData['Date Of Birth']);
          farmer.dob = dob || null;
        }

        farmer.landHoldingStatus = rowData['Land Holding'];
        farmer.landStatus = rowData['Land Status'];
        farmer.totalLandArea = rowData['Total Land Area'];
        farmer.cultivationArea = rowData['Cultivation Area'];
        farmer.farmerCode = farmerCode;
        farmer.farmerGrading = rowData['Farmer Grading'];
        farmer.sevenTwelveCopy = rowData['Seven Twelve Copy'];
        farmer.sevenTwelveNo = rowData['Seven Twelve No'];
        farmer.idProofCopy = rowData['Id Proof Copy'];
        farmer.idProofNo = rowData['Id Proof  No'];

        if (rowData['Date Of Visit']) {
          farmer.dateOfVisit = new Date(rowData['Date Of Visit']);
        }

        farmer.howDoYouSell = rowData['How Do You Sell'];
        // farmer.registerBy = rowData['Register By'];

        // if (rowData['Register Date']) {
        //   const regDate = parseExcelDate(rowData['Register Date']);
        //   farmer.registerDate = regDate || null;
        // }

        farmer.farmerPhoto = rowData['Farmer Photo'];
        farmer.farmPhoto = rowData['Farm Photo'];

        // Residential Address
        const resAddress = new Address();
        resAddress.address1 = rowData['Residensial Address1'];
        resAddress.address2 = rowData['Residensial Address2'];
        resAddress.location = rowData['Residensial Location'];
        resAddress.city = rowData['Residensial City'];
        resAddress.state = rowData['Residensial State'];
        resAddress.pincode = rowData['Residensial Pincode'];
        farmer.residensialAddress = resAddress;

        // Farm Address
        const farmAddress = new Address();
        farmAddress.address1 = rowData['Farm Address1'];
        farmAddress.address2 = rowData['Farm Address2'];
        farmAddress.location = rowData['Farm Location'];
        farmAddress.city = rowData['Farm City'];
        farmAddress.state = rowData['Farm State'];
        farmAddress.pincode = rowData['Farm Pincode'];
        farmer.farmAddress = farmAddress;

        // ---- Crops ----
        farmer.crops = [];
        let i = 1;
        while (rowData[`Crop${i}.Crop`]) {
          const crop = new Crop();
          crop.crop = rowData[`Crop${i}.Crop`];
          crop.variety = rowData[`Crop${i}.Variety`];
          crop.noOfPlants = rowData[`Crop${i}.No_Of_Plants`];

          if (rowData[`Crop${i}.Pruning_Date`]) {
            const pruningDate = parseExcelDate(
              rowData[`Crop${i}.Pruning_Date`],
            );
            crop.pruningDate = pruningDate || null;
          }
          if (rowData[`Crop${i}.Expected_Harvest_Date`]) {
            const expectedHarvestDate = parseExcelDate(
              rowData[`Crop${i}.Expected_Harvest_Date`],
            );
            crop.expectedHarvestDate = expectedHarvestDate || null;
          }

          crop.expectedQuantityInTonnes =
            rowData[`Crop${i}.ExpectedQuantityInTonnes`];

          farmer.crops.push(crop);
          i++;
        }

        console.log('Saving farmer:', farmer.farmerfName);
        const result = await farmerRepository.save(farmer);
        console.log('Saved farmer with ID:', result.id);
      }
    }
  }

  async getFarmerDetails(farmerId: string): Promise<Farmer | null> {
    const farmer = await this.farmerRepository
      .createQueryBuilder('farmer')
      .leftJoinAndSelect('farmer.residensialAddress', 'residensialAddress')
      .leftJoinAndSelect('farmer.farmAddress', 'farmAddress')
      .select([
        'farmer.id',
        'farmer.farmerCode',
        'farmer.farmerfName',
        'farmer.farmerlName',
        'farmer.farmermName',
        'farmer.primaryMobileNo',
        'farmer.email',
        'residensialAddress', // You can specify specific fields from the address if needed
        'farmAddress', // Same for farmAddress
      ])
      .where('farmer.id = :farmerId', { farmerId })
      .getOne();

    return farmer;
  }
  async processCsv(filePath: string): Promise<void> {
    const farmers: Farmer[] = [];
    let sequenceNumber = await this.farmerRepository.count(); // Get current count

    const splitFullName = (
      fullName: string,
    ): { firstName: string; middleName: string; lastName: string } => {
      if (!fullName) return { firstName: '', middleName: '', lastName: '' };
      const parts = fullName.trim().split(' ');
      return {
        firstName: parts[0] || '',
        middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
        lastName: parts.length > 1 ? parts[parts.length - 1] : '',
      };
    };

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', async (row) => {
          try {
            console.log('CSV Row:', row); // Debugging: Print row data

            const farmer = new Farmer();
            const { firstName, middleName, lastName } = splitFullName(
              row.fullName || '',
            );
            farmer.farmerfName = firstName;
            farmer.farmermName = middleName;
            farmer.farmerlName = lastName;
            farmer.primaryMobileNo = row.primaryMobileNo;

            // Creating farm address
            const farmAddress = new Address();
            farmAddress.address1 = row['farmAddress_address1'];
            farmAddress.location = row['farmAddress_location'];
            farmAddress.city = row['farmAddress_city'];
            farmAddress.state = row['farmAddress_state'];
            farmAddress.pincode = row['farmAddress_pincode'];

            farmer.farmAddress = farmAddress;
            farmer.totalLandArea = parseFloat(row.totalLandArea) || 0;

            // Processing crops
            farmer.crops = [];
            let i = 0;
            while (row[`crops[${i}].crop`]) {
              const crop = new Crop();
              crop.crop = row[`crops[${i}].crop`];
              farmer.crops.push(crop);
              i++;
            }

            // Generating Farmer Code
            farmer.farmerCode = `FARM${new Date().getFullYear()}${String(
              ++sequenceNumber,
            ).padStart(4, '0')}`;
            farmers.push(farmer);
          } catch (err) {
            console.error('Error processing row:', err);
          }
        })
        .on('end', async () => {
          try {
            if (farmers.length === 0) {
              console.log('No farmers found in CSV.');
              resolve();
              return;
            }

            console.log('Saving Farmers:', farmers.length);

            // Using transaction for efficient inserts
            await AppDataSource.transaction(
              async (transactionalEntityManager) => {
                for (const farmer of farmers) {
                  farmer.farmAddress = await transactionalEntityManager.save(
                    Address,
                    farmer.farmAddress,
                  );
                }
                await transactionalEntityManager.save(Farmer, farmers);
              },
            );

            console.log('Farmers saved successfully.');
            resolve();
          } catch (error) {
            console.error('Error saving farmers:', error);
            reject(error);
          }
        })
        .on('error', (error) => {
          console.error('CSV Parsing Error:', error);
          reject(error);
        });
    });

    // Cleanup uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting file:', err);
    });
  }
}
