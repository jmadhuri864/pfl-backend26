import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { StatutoryDetailsCustRepository } from "../repositories/statutoryDetails.repository";
import { StatutoryDetails } from "../entities/statutoryCust.entity";
import AppError from "../utils/appError";


@injectable()
export class StatutoryDetailsCustService
 {
    constructor(
        @inject(TYPES.StatutoryDetailsCustRepository)
        private readonly statutoryDetailsRepository: StatutoryDetailsCustRepository
      ) {}
    
      async create(statDetailsData: Partial<StatutoryDetails>): Promise<StatutoryDetails> {
        try {
          const statDetails = this.statutoryDetailsRepository.create(statDetailsData);
          return this.statutoryDetailsRepository.save(statDetails);
        } catch (error) {
          throw new AppError(500, `Error creating statutory details`);
        }
      }
    
      async update(id: string, statDetailsData: Partial<StatutoryDetails>): Promise<StatutoryDetails | null> {
        try {
          const statDetails = await this.statutoryDetailsRepository.findOneBy({ id });
    
          if (statDetails) {
            this.statutoryDetailsRepository.merge(statDetails, statDetailsData);
            return this.statutoryDetailsRepository.save(statDetails);
          }
    
          return null;
        } catch (error) {
          throw new AppError(500, `Error updating statutory details`);
        }
      }
    
      async getAll(): Promise<StatutoryDetails[]> {
        try {
          return this.statutoryDetailsRepository.find({ relations: ['customer'] ,
            order: {
              createdAt: 'DESC', // Assuming createdAt is a timestamp field 
            },

          });
        } catch (error) {
          throw new AppError(500, `Error retrieving statutory details`);
        }
      }
    
      async getById(id: string): Promise<StatutoryDetails | null> {
        try {
          return this.statutoryDetailsRepository.findOne({
            where: { id },
            relations: ['customer']
          });
        } catch (error) {
          throw new AppError(500, `Error retrieving statutory details by ID`);
        }
      }
    
     
    }