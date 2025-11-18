import { inject, injectable } from 'inversify';

import { TYPES } from '../types';
import { BankDetailsCustRepository } from '../repositories/bank-detailsCust.repository';
import { BankDetailsCust } from '../entities/bankDetailsCust.entity';



@injectable()
export class BankDetailsCustService {
  // private bankDetailsCustRepository: BankDetailsCustRepository;
  // constructor(@inject(TYPES.DataSource) private dataSource: DataSource) 
  // {
  //   this.bankDetailsCustRepository = this.dataSource.getRepository(BankDetailsCust);
  // }

  constructor(
    @inject(TYPES.BankDetailsCustRepository)
    private readonly bankDetailsCustRepository: BankDetailsCustRepository,
  ) {}


  // async create(bankDetails: BankDetailsCust): Promise<BankDetailsCust> {
  //   return this.bankDetailsCustRepository.save(bankDetails);
    
  // }

    // Create and save the bank details instance
    async createBankDetails(bankDetailData: BankDetailsCust): Promise<BankDetailsCust> {
      const bankDetails = this.bankDetailsCustRepository.create(bankDetailData);
      return await this.bankDetailsCustRepository.save(bankDetails);
    }

  

  async findAll(): Promise<BankDetailsCust[]> {
    
    return this.bankDetailsCustRepository.find({  order: {
      createdAt: 'DESC', // Assuming createdAt is a timestamp field 
    },});
  }

  async findById(id: string): Promise<BankDetailsCust | null> {
    return this.bankDetailsCustRepository.findOneBy({id});
  }

  async update(id: string, bankDetails: BankDetailsCust): Promise<BankDetailsCust | null> {
    const existingBankDetails = await this.bankDetailsCustRepository.findOneBy({id});
    if (!existingBankDetails) return null;
    
    Object.assign(existingBankDetails, bankDetails);
    return this.bankDetailsCustRepository.save(existingBankDetails);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.bankDetailsCustRepository.delete(id);
    return result.affected !== 0;
  }
}
