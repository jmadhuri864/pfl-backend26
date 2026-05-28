import { inject, injectable } from 'inversify';
import * as XLSX from 'xlsx';
import { Farmer } from '../entities/farmer.entity';
import { FarmerRepository } from '../repositories/farmer.repository';
import { TYPES } from '../types';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from '../middleware/spaces.config';

import { Crop } from '../entities/crop.entity';
import { Product } from '../entities/product.entity';
import fs from 'fs';
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
import { User } from '../entities/user.entity';
import { Status } from '../utils/status.enum';
import { formatDateTime } from '../utils/dateUtils';
import { CreateBranchBodySchema } from '../schemas/branch.schema';
import { In } from 'typeorm';
import { CacheService } from './cache.service';

const CACHE_PREFIX = 'farmer';
const CACHE_TTL = 180;
const CACHE_TTL_DETAIL = 300;

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
    @inject(TYPES.CacheService)
    private readonly cacheService: CacheService,
  ) {}

  // ─── Cache Helpers ────────────────────────────────────────────────────────

  private async invalidateFarmerCache(id?: string): Promise<void> {
    const tasks: Promise<any>[] = [
      this.cacheService.invalidatePattern(`${CACHE_PREFIX}:list:*`),
    ];
    if (id) {
      tasks.push(
        this.cacheService.del(`${CACHE_PREFIX}:id:${id}`),
        this.cacheService.del(`${CACHE_PREFIX}:view:${id}`),
        this.cacheService.del(`${CACHE_PREFIX}:update:${id}`),
      );
    }
    await Promise.all(tasks);
  }

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
  const key = `${CACHE_PREFIX}:list:${JSON.stringify(options)}`;
  const cached = await this.cacheService.get<any>(key);
  if (cached) return cached;

  const queryBuilder = this.farmerRepository
    .createQueryBuilder('farmer')
    .leftJoin('farmer.createdBy', 'createdBy')
    .leftJoin('farmer.residensialAddress', 'residensialAddress')
    .leftJoin('farmer.farmAddress', 'farmAddress')
    .select([
      'farmer.id', 'farmer.status', 'farmer.farmerCode',
      'farmer.farmerfName', 'farmer.farmermName', 'farmer.farmerlName',
      'farmer.primaryMobileNo', 'farmer.secondaryMobileNo', 'farmer.email',
      'farmer.gender', 'farmer.dob', 'farmer.totalLandArea', 'farmer.cultivationArea',
      'farmer.landHoldingStatus', 'farmer.landStatus', 'farmer.idProofNo', 'farmer.createdAt',
      'createdBy.firstName', 'createdBy.lastName',
      'residensialAddress.address1', 'residensialAddress.address2', 'residensialAddress.location',
      'residensialAddress.city', 'residensialAddress.state', 'residensialAddress.pincode',
      'farmAddress.address1', 'farmAddress.address2', 'farmAddress.location',
      'farmAddress.city', 'farmAddress.state', 'farmAddress.pincode',
    ])
    .orderBy('farmer.createdAt', 'DESC');

  const farmers = await buildQuery(queryBuilder, options, 'farmer');

  const formatAddr = (addr: any) => addr
    ? [addr.address1, addr.address2, addr.location, addr.city, addr.state, addr.pincode]
        .filter(Boolean).join(' ')
    : '';

  const response = {
    data: farmers.data.map((farmer: any) => {
      const { createdDate, createdTime } = formatDateTime(farmer.createdAt);
      return {
        id: farmer.id,
        status: farmer.status,
        farmerCode: farmer.farmerCode?.toUpperCase() ?? '',
        farmerfName: farmer.farmerfName,
        farmermName: farmer.farmermName,
        farmerlName: farmer.farmerlName,
        primaryMobileNo: farmer.primaryMobileNo,
        secondaryMobileNo: farmer.secondaryMobileNo,
        email: farmer.email,
        gender: farmer.gender,
        dob: farmer.dob,
        totalLandArea: farmer.totalLandArea,
        cultivationArea: farmer.cultivationArea,
        landHoldingStatus: farmer.landHoldingStatus,
        landStatus: farmer.landStatus,
        idProofNo: farmer.idProofNo,
        residensialAddress: formatAddr(farmer.residensialAddress),
        farmAddress: formatAddr(farmer.farmAddress),
        createdBy: farmer.createdBy
          ? `${farmer.createdBy.firstName} ${farmer.createdBy.lastName}`
          : null,
        createdDate,
        createdTime,
      };
    }),
    meta: farmers.meta,
  };

  await this.cacheService.set(key, response, CACHE_TTL);
  return response;
}



  public async getAllFarmerCodes(): Promise<string[]> {
    const key = `${CACHE_PREFIX}:codes:all`;
    const cached = await this.cacheService.get<string[]>(key);
    if (cached) return cached;

    const farmers = await this.farmerRepository.find({
      select: ['farmerCode'], 
      order: {
        createdAt: 'DESC', 
      },
    });

    const result = farmers.map((farmer) => farmer.farmerCode);
    await this.cacheService.set(key, result, CACHE_TTL);
    return result;
  }
 public async getFarmersWithFilters(queryOptions: PaginationOptions) {
    const key = `${CACHE_PREFIX}:filtered:${JSON.stringify(queryOptions)}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

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

    const response = {
      data: formattedData,
      total: meta.total,
      currentPage: meta.page,
      totalPages: meta.pages,
    };
    await this.cacheService.set(key, response, CACHE_TTL);
    return response;
  }

  public async getAllFarmer(
    queryOptions: PaginationOptions,
  ): Promise<{ data1: any[]; meta: any }> {
    const key = `${CACHE_PREFIX}:all:${JSON.stringify(queryOptions)}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const queryBuilder = this.farmerRepository
      .createQueryBuilder('farmer')
      .leftJoinAndSelect('farmer.residensialAddress', 'residensialAddress')
      .leftJoinAndSelect('farmer.farmAddress', 'farmAddress')
      .leftJoin('farmer.createdBy', 'createdBy')
      .addSelect(['createdBy.firstName', 'createdBy.lastName'])
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
      createdBy: farmer.createdBy
        ? `${farmer.createdBy.firstName || ''} ${farmer.createdBy.lastName || ''}`.trim() || null
        : null,
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

    const result = { data1, meta };
    await this.cacheService.set(key, result, CACHE_TTL);
    return result;
  }

  public async getPartialFarmersById(id: string): Promise<any> {
    const key = `${CACHE_PREFIX}:partial:${id}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

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

    const result = {
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
    await this.cacheService.set(key, result, CACHE_TTL_DETAIL);
    return result;
  }

  public async getfarmerbyidforview(id: string): Promise<any> {
    const key = `${CACHE_PREFIX}:view:${id}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const farmer = await this.farmerRepository
      .createQueryBuilder('farmer')
      .leftJoin('farmer.residensialAddress', 'residensialAddress')
      .leftJoin('farmer.farmAddress', 'farmAddress')
      .leftJoin('farmer.createdBy', 'createdBy')
      .leftJoin('farmer.crops', 'crops')
      .leftJoin('crops.crop', 'crop')
      .select([
        'farmer.id', 'farmer.farmerfName', 'farmer.farmermName', 'farmer.farmerlName',
        'farmer.gender', 'farmer.dob', 'farmer.idProofNo', 'farmer.idProofCopy',
        'farmer.howDoYouSell', 'farmer.landHoldingStatus', 'farmer.landStatus',
        'farmer.totalLandArea', 'farmer.cultivationArea', 'farmer.sevenTwelveNo',
        'farmer.sevenTwelveCopy', 'farmer.primaryMobileNo', 'farmer.secondaryMobileNo',
        'farmer.email', 'farmer.farmerCode', 'farmer.createdAt',
        'createdBy.firstName', 'createdBy.lastName',
        'residensialAddress.id', 'residensialAddress.address1', 'residensialAddress.address2',
        'residensialAddress.location', 'residensialAddress.city', 'residensialAddress.state', 'residensialAddress.pincode',
        'farmAddress.id', 'farmAddress.address1', 'farmAddress.address2',
        'farmAddress.location', 'farmAddress.city', 'farmAddress.state', 'farmAddress.pincode',
        'crops.id', 'crops.variety', 'crops.noOfPlants', 'crops.pruningDate',
        'crops.expectedHarvestDate', 'crops.expectedQuantityInTonnes',
        'crop.name',
      ])
      .where('farmer.id = :id', { id })
      .getOne();

    if (!farmer) return null;

    const { createdDate, createdTime } = formatDateTime(farmer.createdAt);
    const mapAddress = (addr: any) => addr?.id ? {
      id: addr.id, address1: addr.address1, address2: addr.address2,
      location: addr.location, city: addr.city, state: addr.state, pincode: addr.pincode,
    } : null;

    const result = {
      id: farmer.id,
      farmerfName: farmer.farmerfName ?? null,
      farmermName: farmer.farmermName ?? null,
      farmerlName: farmer.farmerlName ?? null,
      gender: farmer.gender,
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
      primaryMobileNo: farmer.primaryMobileNo,
      secondaryMobileNo: farmer.secondaryMobileNo,
      email: farmer.email,
      farmerCode: farmer.farmerCode,
      createdBy: farmer.createdBy
        ? `${farmer.createdBy.firstName} ${farmer.createdBy.lastName}`
        : null,
      createdDate,
      createdTime,
      residensialAddress: mapAddress(farmer.residensialAddress),
      farmAddress: mapAddress(farmer.farmAddress),
      crops: farmer.crops?.map((crop: Crop) => ({
        id: crop.id,
        crop: crop.crop?.name ?? null,
        variety: crop.variety,
        noOfPlants: crop.noOfPlants,
        pruningDate: crop.pruningDate,
        expectedHarvestDate: crop.expectedHarvestDate,
        expectedQuantityInTonnes: crop.expectedQuantityInTonnes,
      })) ?? [],
    };

    await this.cacheService.set(key, result, CACHE_TTL_DETAIL);
    return result;
  }

  public async getfarmerbyidforupdate(id: string): Promise<any> {
    const key = `${CACHE_PREFIX}:update:${id}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const farmer = await this.farmerRepository
      .createQueryBuilder('farmer')
      .leftJoin('farmer.residensialAddress', 'residensialAddress')
      .leftJoin('farmer.farmAddress', 'farmAddress')
      .leftJoin('farmer.crops', 'crops')
      .leftJoin('farmer.createdBy', 'createdBy')
      .leftJoin('crops.crop', 'crop')
      .select([
        'farmer.id', 'farmer.farmerfName', 'farmer.farmermName', 'farmer.farmerlName',
        'farmer.gender', 'farmer.dob', 'farmer.idProofNo', 'farmer.idProofCopy',
        'farmer.howDoYouSell', 'farmer.landHoldingStatus', 'farmer.landStatus',
        'farmer.totalLandArea', 'farmer.cultivationArea', 'farmer.sevenTwelveNo',
        'farmer.sevenTwelveCopy', 'farmer.primaryMobileNo', 'farmer.secondaryMobileNo',
        'farmer.email', 'farmer.farmerCode', 'farmer.farmerPhoto', 'farmer.farmPhoto',
        'farmer.status',
        'farmer.createdAt',
        'createdBy.id',
        'residensialAddress.id', 'residensialAddress.address1', 'residensialAddress.address2',
        'residensialAddress.location', 'residensialAddress.city', 'residensialAddress.state', 'residensialAddress.pincode',
        'farmAddress.id', 'farmAddress.address1', 'farmAddress.address2',
        'farmAddress.location', 'farmAddress.city', 'farmAddress.state', 'farmAddress.pincode',
        'crops.id', 'crops.variety', 'crops.noOfPlants', 'crops.pruningDate',
        'crops.expectedHarvestDate', 'crops.expectedQuantityInTonnes',
        'crop.id',
      ])
      .where('farmer.id = :id', { id })
      .getOne();

    if (!farmer) return null;

    const { createdDate, createdTime } = formatDateTime(farmer.createdAt);
    const mapAddress = (addr: any) => addr?.id ? {
      id: addr.id, address1: addr.address1, address2: addr.address2,
      location: addr.location, city: addr.city, state: addr.state, pincode: addr.pincode,
    } : null;

    const updateResult = {
      id: farmer.id,
      farmerfName: farmer.farmerfName ?? null,
      farmermName: farmer.farmermName ?? null,
      farmerlName: farmer.farmerlName ?? null,
      gender: farmer.gender,
      status:farmer.status,
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
      primaryMobileNo: farmer.primaryMobileNo,
      secondaryMobileNo: farmer.secondaryMobileNo,
      email: farmer.email,
      farmerCode: farmer.farmerCode,
      farmerPhoto: farmer.farmerPhoto,
      farmPhoto: farmer.farmPhoto,
      createdBy: farmer.createdBy?.id ?? null,
      createdDate,
      createdTime,
      residensialAddress: mapAddress(farmer.residensialAddress),
      farmAddress: mapAddress(farmer.farmAddress),
      crops: farmer.crops?.map((crop: Crop) => ({
        id: crop.id,
        crop: crop.crop?.id ?? null,
        variety: crop.variety,
        noOfPlants: crop.noOfPlants,
        pruningDate: crop.pruningDate,
        expectedHarvestDate: crop.expectedHarvestDate,
        expectedQuantityInTonnes: crop.expectedQuantityInTonnes,
      })) ?? [],
    };

    await this.cacheService.set(key, updateResult, CACHE_TTL_DETAIL);
    return updateResult;
  }

 public async getAllFarmerWithFilter(filter: string): Promise<any[]> {
    const key = `${CACHE_PREFIX}:withFilter:${filter}`;
    const cached = await this.cacheService.get<any[]>(key);
    if (cached) return cached;

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

    const result = farmers.map((farmer) => ({
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
    await this.cacheService.set(key, result, CACHE_TTL);
    return result;
  }
  async submitFarmer(farmerId: string, fileUpdates: Record<string, string | null> = {}): Promise<Farmer> {
    const farmer = await this.farmerRepository.findOne({ where: { id: farmerId } });
    if (!farmer) throw new AppError(404, 'Farmer not found');
    farmer.status = Status.PENDING;
    // Apply file updates only if provided
    if (fileUpdates.farmPhoto !== undefined)       farmer.farmPhoto       = fileUpdates.farmPhoto       ?? farmer.farmPhoto;
    if (fileUpdates.farmerPhoto !== undefined)     farmer.farmerPhoto     = fileUpdates.farmerPhoto     ?? farmer.farmerPhoto;
    if (fileUpdates.idProofCopy !== undefined)     farmer.idProofCopy     = fileUpdates.idProofCopy     ?? farmer.idProofCopy;
    if (fileUpdates.sevenTwelveCopy !== undefined) farmer.sevenTwelveCopy = fileUpdates.sevenTwelveCopy ?? farmer.sevenTwelveCopy;
    const saved = await this.farmerRepository.save(farmer);
    await this.invalidateFarmerCache(farmerId);
    return saved;
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
    const saved = await this.farmerRepository.save(farmer);
    await this.invalidateFarmerCache(farmerId);
    return saved;
  }
  async getFarmerById(id: string): Promise<Farmer | null> {
    const key = `${CACHE_PREFIX}:id:${id}`;
    const cached = await this.cacheService.get<Farmer>(key);
    if (cached) return cached;

    const farmer = await this.farmerRepository
      .createQueryBuilder('farmer')
      .leftJoinAndSelect('farmer.crops', 'crops')
      .leftJoinAndSelect('crops.crop', 'crop')
      .leftJoinAndSelect('farmer.residensialAddress', 'residensialAddress')
      .leftJoinAndSelect('farmer.farmAddress', 'farmAddress')
      .where('farmer.id = :id', { id })
      .getOne();

    if (farmer) await this.cacheService.set(key, farmer, CACHE_TTL_DETAIL);
    return farmer;
  }
  async getFarmerByIdForUpdate(id: string) {
    const key = `${CACHE_PREFIX}:idForUpdate:${id}`;
    const cached = await this.cacheService.get<any>(key);
    if (cached) return cached;

    const farmer = await this.farmerRepository
      .createQueryBuilder("farmer")
      .leftJoinAndSelect("farmer.residensialAddress", "residensialAddress")
      .leftJoinAndSelect("farmer.farmAddress", "farmAddress")
      .leftJoinAndSelect("farmer.crops", "crops")
      .where("farmer.id = :id", { id })
      .getOne();

    if (!farmer) throw new Error("Farmer not found");

    const result = {
      id: farmer.id,
      farmerfName: farmer.farmerfName,
      farmerlName: farmer.farmerlName,
      primaryMobileNo: farmer.primaryMobileNo,
      dob: farmer.dob,
      residensialAddress: farmer.residensialAddress?.id || null,
      farmAddress: farmer.farmAddress?.id || null,
      crop: farmer.crops,
    };
    await this.cacheService.set(key, result, CACHE_TTL_DETAIL);
    return result;
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
    const saved = await this.farmerRepository.save(farmer);
    await this.invalidateFarmerCache();
    return saved;
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
    await this.invalidateFarmerCache(farmerId);
    return farmer;
  }
  // Delete a farmer with scheduled deletion (6 months)
  async deleteFarmer(id: string): Promise<boolean> {
    const farmer = await this.farmerRepository.findOne({ where: { id } });

    if (!farmer) {
      throw new AppError(404, `Farmer with ID ${id} not found`);
    }

    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6);
    sixMonthsFromNow.setHours(0, 0, 0, 0);

    // Bulk update all crops for this farmer in one query instead of N individual saves
    await this.cropRepository
      .createQueryBuilder()
      .update()
      .set({ deletionScheduledAt: sixMonthsFromNow })
      .where('"farmerId" = :id', { id })
      .execute();

    farmer.deletionScheduledAt = sixMonthsFromNow;
    await this.farmerRepository.save(farmer);
    await this.invalidateFarmerCache(id);

    console.log(`Farmer with ID ${id} marked for deletion in 6 months.`);
    return true;
  }
 
async createFarmerwithExcel(fileUrl: string): Promise<any> {
  try {
    console.log('📂 File URL:', fileUrl);

    if (!fileUrl) {
      throw new Error('No file URL or path provided');
    }

    let fileBuffer: Buffer;

    // 📥 Get file
    if (fileUrl.startsWith('https://')) {
      const urlObj = new URL(fileUrl);
      const key = urlObj.pathname.replace(/^\//, '');
      fileBuffer = await this.getExcelFromSpaces(key);
    } else {
      const fs = await import('fs');
      fileBuffer = fs.readFileSync(fileUrl);
    }

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;

    const farmerRepository = AppDataSource.getRepository(Farmer);
    const productRepository = AppDataSource.getRepository(Product);
    const userRepository = AppDataSource.getRepository(User);

    for (const sheetName of sheetNames) {
      console.log('📄 Sheet:', sheetName);

      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
      });

      if (jsonData.length < 2) continue;

      const headers: string[] = (jsonData[0] as any[]).map((h: any) =>
        h ? String(h).trim() : '',
      );

      console.log('🧾 Headers:', headers);

      const rows = jsonData.slice(1);

      for (const rowUntyped of rows) {
        if (!Array.isArray(rowUntyped)) continue;

        const rowData: Record<string, any> = {};
        headers.forEach((header, index) => {
          rowData[header] = rowUntyped[index];
        });

        console.log('➡️ Row:', rowData);

        // ✅ Required check
        if (!rowData['First Name'] || !rowData['Primary Mobile No']) {
          console.warn('⛔ Skipping row (missing data)');
          continue;
        }

        // ✅ Generate code
        const count = await farmerRepository.count();
        const farmerCode = `FARM${new Date().getFullYear()}${String(
          count + 1,
        ).padStart(4, '0')}`;

        const farmer = new Farmer();

        farmer.farmerfName = rowData['First Name'];
        farmer.farmermName =
          rowData['Middle Name'] || rowData['Middl Name'];
        farmer.farmerlName = rowData['Last Name'];
        farmer.primaryMobileNo = rowData['Primary Mobile No'];
        farmer.secondaryMobileNo = rowData['Secondary Mobile No'];
        farmer.email = rowData['Email'];
        farmer.gender = rowData['Gender'];

        // 📅 DOB
        if (rowData['Date Of Birth']) {
          const dob = parseExcelDate(rowData['Date Of Birth']);
          if (dob) farmer.dob = new Date(dob);
        }

        farmer.landHoldingStatus = rowData['Land Holding'];
        farmer.landStatus = rowData['Land Status'];
        farmer.totalLandArea = rowData['Total Land Area'];
        farmer.cultivationArea = rowData['Cultivation Area'];
        farmer.farmerCode = farmerCode;

        // 👤 createdBy
        if (rowData['Created By']) {
          const name = rowData['Created By'].trim();

          const user = await userRepository
            .createQueryBuilder('user')
            .where(
              "LOWER(CONCAT(user.firstName,' ',user.lastName)) = LOWER(:name)",
              { name },
            )
            .getOne();

          if (user) {
            farmer.createdBy = user;
          } else {
            console.warn('⚠️ User not found:', name);
          }
        }

        // 🏠 Residential Address
        const res = new Address();
        res.address1 = rowData['Residential Address1'];
        res.address2 = rowData['Residential Address2'];
        res.city = rowData['Residential City'];
        res.state = rowData['Residential State'];
        res.pincode = rowData['Residential Pincode'];
        farmer.residensialAddress = res;

        // 🚜 Farm Address
        const farm = new Address();
        farm.address1 = rowData['Farm Address1'];
        farm.address2 = rowData['Farm Address2'];
        farm.city = rowData['Farm City'];
        farm.state = rowData['Farm State'];
        farm.pincode = rowData['Farm Pincode'];
        farmer.farmAddress = farm;

        // 🌱 CROPS (FIXED LOOP)
        farmer.crops = [];

        let i = 1;

        while (rowData[`Crop${i}.Crop`]) {
          const cropName = rowData[`Crop${i}.Crop`];

          if (!cropName) {
            i++; // ✅ FIX
            continue;
          }

          console.log('🌾 Crop:', cropName);

          const product = await productRepository
            .createQueryBuilder('product')
            .where('LOWER(product.name)=LOWER(:name)', {
              name: cropName.trim(),
            })
            .getOne();

          if (!product) {
            console.warn('⚠️ Product not found:', cropName);
            i++; // ✅ FIX
            continue;
          }

          const crop = new Crop();
          crop.crop = product;
          crop.variety = rowData[`Crop${i}.Variety`];
          crop.noOfPlants = rowData[`Crop${i}.No_Of_Plants`];

          farmer.crops.push(crop);

          i++; // ✅ MUST
        }

        // 💾 SAVE
        try {
          console.log('💾 Saving farmer:', farmer.farmerfName);
          const saved = await farmerRepository.save(farmer);
          console.log('✅ Saved ID:', saved.id);
        } catch (err) {
          console.error('❌ SAVE ERROR:', err);
        }
      }
    }

    await this.deleteFileFromSpaces(fileUrl);
    await this.invalidateFarmerCache();

    console.log('🎉 Upload completed');
  } catch (error) {
    console.error('🔥 ERROR:', error);

    try {
      await this.deleteFileFromSpaces(fileUrl);
    } catch {}

    throw error;
  }
}
  /**
   * Get Excel file from DigitalOcean Spaces
   * @param key - Spaces key/path to the Excel file
   * @returns Buffer containing the file data
   */
  private async getExcelFromSpaces(key: string): Promise<Buffer> {
    try {
      console.log('📂 Reading Excel file from Spaces:', key);

      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const command = new GetObjectCommand({
        Bucket: process.env.DO_SPACES_BUCKET!,
        Key: key,
      });

      const response = await s3.send(command);

      if (!response.Body) {
        throw new Error('No file content found in Spaces response');
      }

      const bytes = await response.Body.transformToByteArray();
      const fileBuffer = Buffer.from(bytes);

      console.log('✅ Excel file read successfully, size:', fileBuffer.length, 'bytes');
      return fileBuffer;
    } catch (error) {
      console.error('❌ Error reading Excel file from Spaces:', error);
      throw new Error(`Failed to read Excel file from Spaces (key: ${key}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete file from DigitalOcean Spaces
   * @param fileUrl - The full URL or key of the file to delete
   */
  private async deleteFileFromSpaces(fileUrl: string): Promise<void> {
    try {
      // Extract the key from the full URL
      // URL format: https://bucket-name.sgp1.digitaloceanspaces.com/documents/filename
      const urlParts = fileUrl.split('/');
      const key = urlParts.slice(-2).join('/'); // Gets "documents/filename"
      
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.DO_SPACES_BUCKET!,
        Key: key,
      });

      await s3.send(deleteCommand);
      console.log(`Successfully deleted file: ${key}`);
    } catch (error) {
      console.error(`Failed to delete file from spaces: ${fileUrl}`, error);
      // Don't throw error here to avoid breaking the main flow
    }
  }

  async getFarmerDetails(farmerId: string): Promise<Farmer | null> {
    const key = `${CACHE_PREFIX}:details:${farmerId}`;
    const cached = await this.cacheService.get<Farmer>(key);
    if (cached) return cached;

    const farmer = await this.farmerRepository
      .createQueryBuilder("farmer")
      .leftJoinAndSelect("farmer.residensialAddress", "residensialAddress")
      .leftJoinAndSelect("farmer.farmAddress", "farmAddress")
      .select([
        "farmer.id",
        "farmer.farmerCode",
        "farmer.farmerfName",
        "farmer.farmerlName",
        "farmer.farmermName",
        "farmer.primaryMobileNo",
        "farmer.email",
        "residensialAddress",
        "farmAddress",
      ])
      .where("farmer.id = :farmerId", { farmerId })
      .getOne();

    if (farmer) await this.cacheService.set(key, farmer, CACHE_TTL_DETAIL);
    return farmer;
  }
  async softDeleteFarmers(farmerIds: string[]) {
    const result = await this.farmerRepository.softDelete({
      id: In(farmerIds)
    });
    await this.invalidateFarmerCache();
    return result;
  }
    
  }

