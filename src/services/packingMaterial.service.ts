import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { PackingMaterialRepository } from '../repositories/packingMaterial.repository';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import AppError from '../utils/appError';
import { AuditLogService } from './auditLog.service';

@injectable()
export class PackingMaterialService {
  constructor(
    @inject(TYPES.PackingMaterialRepository)
    private readonly packingMaterialRepository: PackingMaterialRepository,
    @inject(TYPES.AuditLogService)
        private readonly auditLogService: AuditLogService,
  ) {}
  async findAllPackingMaterial(): Promise<{ id: string; name: string }[]> {
    const materials = await this.packingMaterialRepository.find();

    return materials.map((mat) => ({
      id: mat.id,
      name: mat.packagingMaterialName,
    }));
  }

  async createPackingMaterial(data: any): Promise<any> {
    const material = await this.packingMaterialRepository.create(data);
    return await this.packingMaterialRepository.save(material);
  }
  async getMaterialById(id: string): Promise<any> {
    const material = await this.packingMaterialRepository.findOne({
      where: { id: id },
      relations:['uom']
    });
    if (!material) {
      throw new Error('Material not found');
    }

    const formatResponse = {
      id: material.id,
      packagingMaterialName: material.packagingMaterialName,
      packagingMaterialWeight: material.packagingMaterialWeight,
      packagingMaterialDescription: material.packagingMaterialDescription,
      useFor: material.useFor,
      uom: material.uom.id,
       
      containsQuantity: material.containsQuantity,
    };
    return formatResponse;
  }

  async getAll(queryOptions:PaginationOptions): Promise<any> {
    
  let queryBuilder=this.packingMaterialRepository
  .createQueryBuilder('post_packaging_material')
  .leftJoinAndSelect('post_packaging_material.uom','uom')

   const data= await buildQuery(queryBuilder, queryOptions, "post_packaging_material");
    const formatResponse = data.data.map((material) => ({
      id: material.id,
      packagingMaterialName: material.packagingMaterialName,
      packagingMaterialWeight: material.packagingMaterialWeight,
      packagingMaterialDescription: material.packagingMaterialDescription,
      useFor: material.useFor,
      uom: material.uom?.unit||null ,
      containsQuantity: material.containsQuantity,
    }));
  const data1=data.meta;
    return {formatResponse,data1}
    };


    async updatePackingMaterial(
        id: string,
        data: any,
        updatedBy: string,
      ): Promise<any> {
        const material = await this.packingMaterialRepository.findOne({
          where: { id },
        });
    
        if (!material ) {
          throw new AppError(404, `packing material with ID ${id} not found`);
        }
    
        const oldData = { ...material  };
    
        Object.assign(material , data);
    
        const updatedInwardRegister = await this.packingMaterialRepository.save(
          material,
        );
    
        await this.auditLogService.logChange(
          'post_packaging_material',
          id,
          oldData,
          updatedInwardRegister,
          updatedBy,
        );
    
        return updatedInwardRegister;
      }

      async getAllPartial(): Promise<any[]> {
        const data = await this.packingMaterialRepository
          .createQueryBuilder('post_packaging_material')
          .leftJoinAndSelect('post_packaging_material.uom', 'uom')
          .getMany();
      
        const formatResponse = data.map((material) => ({
          id: material.id,
          packagingMaterialName: material.packagingMaterialName,
          packagingMaterialWeight: material.packagingMaterialWeight,
         
        }));
      
        return formatResponse;
      }
      
      
  }
  

 

