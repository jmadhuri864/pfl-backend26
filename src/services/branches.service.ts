import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { BranchessRepository } from "../repositories/branches.repository";
import { Branches, BranchType } from "../entities/branches.entity";
import { AddressRepository } from "../repositories/address.repository";
import { Address } from "../entities/address.entity";
import { AddressService } from "./address.service";
import { AuditLogService } from "./auditLog.service";
import AppError from "../utils/appError";
import { format } from "date-fns";
import { classToPlain } from "class-transformer";
import { buildQuery,  PaginationOptions } from "../utils/pagination";
import { In } from "typeorm";

@injectable()
export class BranchessService {
  constructor(
    @inject(TYPES.BranchessRepository)
    private readonly branchesRepository: BranchessRepository,
    @inject(TYPES.AddressService)
    private readonly addressService: AddressService,
    @inject(TYPES.AuditLogService)
    private readonly auditLogService: AuditLogService
  ) {}

  async createBranch(branchData: any): Promise<any> {
    const { address, totalCapacity, ...data } = branchData;
console.log(branchData)
    // Create the address
    const newAddress =  await this.addressService.create(address);
    console.log(newAddress);

     // Assuming new branch starts with 0 current capacity
    //const balanceCapacity = totalCapacity - data.currentCapacity;

    // Create the branch with calculated capacities
    const branch = this.branchesRepository.create({
        ...data,
        address: newAddress,
        totalCapacity,
       
        //balanceCapacity,
    });

    return this.branchesRepository.save(branch);
}
async updateBranch(id: string, branchData: any,updatedBy:string): Promise<Branches | null> {
  // Find the branch including its address
  console.log(branchData);
  const branch = await this.branchesRepository.findOne({
    where: { id },
    relations: ['address'],
  });

  if (!branch) return null;
// Store the original state of the branch for audit logging
const originalBranch = { ...branch };
  // Update the capacities based on the equation
  if (branchData.currentCapacity !== undefined || branchData.totalCapacity !== undefined) {
    // Calculate balanceCapacity if currentCapacity or totalCapacity is provided
    const currentCapacity = branchData.currentCapacity !== undefined ? branchData.currentCapacity : branch.currentCapacity;
    const totalCapacity = branchData.totalCapacity !== undefined ? branchData.totalCapacity : branch.totalCapacity;

    // Update balanceCapacity based on the equation
    branchData.balanceCapacity = totalCapacity - currentCapacity;
  }

  // Update the address if provided
  if (branchData.address) {
    const originalAddress = { ...branch.address }; 
    const updatedAddress = await this.addressService.update(branch.address.id, branchData.address);
    console.log(updatedAddress);
    if (!updatedAddress) {
      throw new Error("Failed to update address");
    }
    // Log changes to the address
    await this.auditLogService.logChange(
      'Address',
      branch.address.id,
      originalAddress,
      updatedAddress,
      updatedBy
    );

    branch.address = updatedAddress;
  }

  // Update the branch fields
  Object.assign(branch, branchData);

   // Save the updated branch
   const updatedBranch = await this.branchesRepository.save(branch);

   // Log changes to the branch
   await this.auditLogService.logChange(
     'Branches',
     id,
     originalBranch,
     updatedBranch,
     updatedBy
   );
 
   return updatedBranch;
}

async softDeleteBranches(userIds: string[],branchType:BranchType) {

  const result = await this.branchesRepository.softDelete({
     id: In(userIds),
    type: branchType,
    
  });

  return result;
}
  

  async getBranchByIdAndType(id: string): Promise<any> {
    console.log("in service branch")
    const result = await this.branchesRepository.findOne({
      where: {
        id,
       
      },
      relations:['address']
    });

    //return classToPlain(result);
    return result;
    
  }

async getAllByBranchType(branchType: BranchType, queryOptions: PaginationOptions): Promise<any> {
    console.log(`Fetching branches with type: ${branchType}`);

    let queryBuilder = this.branchesRepository.createQueryBuilder('branch')
        .leftJoinAndSelect('branch.address', 'address')
        .where('branch.type = :branchType', { branchType })
        .orderBy('branch.createdAt', 'DESC'); // Sorting by createdAt

   
    const result = await buildQuery(queryBuilder, queryOptions, "branch");
    //const result = await buildQuery1(queryBuilder, queryOptions, "branch", Branches);
  //   const objectToString = (obj: any): string => {
  //   if (obj == null) return '';
  //   if (typeof obj === 'object') {
  //     return Object.values(obj).map((v) => objectToString(v)).join(' ');
  //   }
  //   return String(obj);
  // };

  // if ( queryOptions.search&&  queryOptions.search.trim()) {
  //   const term =  queryOptions.search.toLowerCase();
  //   result.data = result.data.filter((item) =>
  //     objectToString(item).toLowerCase().includes(term)
  //   );
  // }

  return{
    data:result.data.map((branch)=>{
      return{
        id:branch.id,
        address:{
          id:branch.address.id,
          address1:branch.address.address1,
          address2:branch.address.address2,
          city:branch.address.city,
          location:branch.address.location,
          pincode:branch.address.pincode,
          state:branch.address.state
        },
        contactPerson: [
        branch.cFirstName || '',
        branch.cMiddleName || '',
        branch.cLastName || ''
      ].filter(Boolean).join(' '),
        //contactPerson:`${branch.cFirstName} ${branch.cMiddleName} ${branch.cLastName}`,
        contact:branch.contactNumber?branch.contactNumber:'',
        name:branch.name,
       totalCapacity:branch.totalCapacity,
       currentCapacity:branch.currentCapacity,
       balanceCapacity:branch.balanceCapacity
      }
    }),
    meta:result.meta
  }
   // return result;
}



  async deleteBranch(id: string, branchType: BranchType): Promise<boolean> {
    const branch = await this.branchesRepository.findOne({
      where: { id, type: branchType },
    });
  
    if (!branch) {
      throw new AppError(404, `Branch with ID ${id} not found`);
    }
  
    const now = new Date();
    
    // Calculate the date 6 months ahead
    const sixMonthsFromNow = new Date(now);
    sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
    sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)
  
    console.log(sixMonthsFromNow); // Log the calculated date
  
    // Set the deletionScheduledAt field for the branch
    branch.deletionScheduledAt = sixMonthsFromNow;
  
    console.log("In delete service for Branch", branch.deletionScheduledAt);
  
    // Save the updated branch with the scheduled deletion date
    await this.branchesRepository.save(branch);
  
    console.log(`Branch with ID ${id} marked for deletion in 6 months.`);
  
    return true;
  }
  
  
 
  // async getAllByFilterDataBranchType(): Promise<Pick<Branches, 'id' | 'name' | 'type'>[]> {
  //   return this.branchesRepository.find({
  //     // where: {
  //     //   type: branchType, // Matches the property name in the entity
  //     // },
  //     select: ['id', 'name', 'type'], // 'type' is the actual column name, not 'branchType'
  //   });
  // }
  async getAllByFilterDataBranchType(): Promise<Pick<Branches, 'id' | 'name' | 'type'>[]> {
    
    return this.branchesRepository.find({
      select: ['id', 'name', 'type'],  
    });
  }
  
  
  
  
}
