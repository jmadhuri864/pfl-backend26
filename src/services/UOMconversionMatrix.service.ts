import { inject, injectable } from "inversify";
import { UOMConversionMatrixRepository } from "../repositories/uomMatrix.repository";
import { TYPES } from "../types";
import { DataSource, In } from "typeorm";
import { AuditLogService } from "./auditLog.service";
import { UOMConversionMatrix } from "../entities/uom_matrix.entity";
import { buildQuery, PaginationOptions } from "../utils/pagination";

@injectable()
export class UOMConversionMatrixService {
  private uomConversionMatrixRepository: UOMConversionMatrixRepository;

  constructor(
    @inject(TYPES.DataSource) private dataSource: DataSource,
    @inject(TYPES.AuditLogService) private readonly auditLogService: AuditLogService
  ) {
    this.uomConversionMatrixRepository = this.dataSource.getRepository(
      UOMConversionMatrix
    ) as UOMConversionMatrixRepository;
  }

  public async getAll(queryOptions:PaginationOptions): Promise<any> {
   let queryBuilder = await  this.uomConversionMatrixRepository.createQueryBuilder('uomConversionMatrix')
    .leftJoinAndSelect('uomConversionMatrix.fromUOM', 'fromUOM')
    .leftJoinAndSelect('uomConversionMatrix.toUOM', 'toUOM')
    .orderBy('uomConversionMatrix.createdAt', 'DESC');
  const result = await buildQuery(queryBuilder, queryOptions, 'uomConversionMatrix');

  return{
    data:result.data.map((uom)=>{
      return{
        id:uom.id,
        conversionFactor:uom.conversionFactor,
        fromUOM:uom.fromUOM ?
        {
          id:uom?.fromUOM.id,
          unit:uom?.fromUOM.unit
        }:null,
        toUOM:uom.toUOM
        ?
        {
          id:uom?.toUOM.id,
          unit:uom?.toUOM.unit
        }:null
      }
    }),
    meta:result.meta
  }

 // return result ;
  }

  public async getById(id: string): Promise<UOMConversionMatrix | null> {
    return this.uomConversionMatrixRepository.findOne({
      where: { id },
      relations: ["fromUOM", "toUOM"],
    });
  }
  public async getByIdForUpdate(id: string): Promise<any> {
    return await  this.uomConversionMatrixRepository.createQueryBuilder('uomConversionMatrix')
    .leftJoinAndSelect('uomConversionMatrix.fromUOM', 'fromUOM')
    .leftJoinAndSelect('uomConversionMatrix.toUOM', 'toUOM')
    .select(
      ["uomConversionMatrix",
        "fromUOM.id",
        "toUOM.id",
      ]
    )
  }

  

  public async create(
    conversionData: Partial<UOMConversionMatrix>
  ): Promise<UOMConversionMatrix> {
    const conversion =
      this.uomConversionMatrixRepository.create(conversionData);
    return this.uomConversionMatrixRepository.save(conversion);
  }

  public async update(
    id: string,
    conversionData: Partial<UOMConversionMatrix>,
    updatedBy: string
  ): Promise<UOMConversionMatrix | null> {
   
    const existingConversionMatrix = await this.uomConversionMatrixRepository.findOne({
        where: { id }
    });

    if (!existingConversionMatrix) {
        throw new Error("UOM Conversion Matrix not found");
    }

   
    Object.assign(existingConversionMatrix, conversionData);

   
    const updatedConversionMatrix = await this.uomConversionMatrixRepository.save(existingConversionMatrix);

   
    await this.auditLogService.logChange(
        'UOMConversionMatrix',         
        id,                            
        existingConversionMatrix,      
        updatedConversionMatrix,       
        updatedBy                      
    );

  
    return updatedConversionMatrix;
  }
  public async delete(id: string): Promise<boolean> {
   
    const uomConversionMatrix = await this.uomConversionMatrixRepository.findOne({
        where: { id },
    });

   
    if (!uomConversionMatrix) {
        return false;
    }

    
    const now = new Date();
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); 
    sixMonthsFromNow.setHours(0, 0, 0, 0); 

   
    console.log(`UOM Conversion Matrix with ID ${id} marked for deletion in 6 months at ${sixMonthsFromNow}`);

   
    uomConversionMatrix.deletionScheduledAt = sixMonthsFromNow;

    
    await this.uomConversionMatrixRepository.save(uomConversionMatrix);

 
    console.log(`UOM Conversion Matrix with ID ${id} marked for deletion in 6 months.`);
    return true;
}
async softDeleteConversion(userIds: string[]) {

  const result = await this.uomConversionMatrixRepository.softDelete({
    id: In(userIds)
  });

  return result;
}

}
