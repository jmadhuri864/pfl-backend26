import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { BillingDetailsCustRepository } from "../repositories/billingDetailsCust.repository";
import { BillingDetailsCust } from "../entities/billingdetailsCust.entity";
import AppError from "../utils/appError";
import { AddressService } from "./address.service";

@injectable()
export class BillingDetailsCustService {


    constructor(
        @inject(TYPES.BillingDetailsCustRepository)
        private readonly billingDetailsCustRepository: BillingDetailsCustRepository,
       @inject(TYPES.AddressService) private readonly addressService:AddressService,
      ) {}


    // Get all billing details
  async getAll() {
    return this.billingDetailsCustRepository.find({ relations: ['billingAddress', 'customer'] ,

      order: {
        createdAt: 'DESC', // Assuming createdAt is a timestamp field 
      },
    });
  }

  // Get billing details by ID
  async getById(id: string) {
    const billingDetails = await this.billingDetailsCustRepository.findOne({ where: { id }, relations: ['billingAddress', 'customer'] });
    if (!billingDetails) {
      throw new AppError(404, 'Billing details not found');
    }
    return billingDetails;
  }

  // Create new billing details
  async create(billingDetailsData: Partial<BillingDetailsCust>) {
    const{billingAddress,...data}=billingDetailsData;
    let address;
    if(billingAddress)
    {
    address=await this.addressService.create(billingAddress)
    //billingAddressId = address.id;
    }

    const billingDetails = this.billingDetailsCustRepository.create({
      ...data,
      billingAddress: address, // Use ID for relationship
    });
    return this.billingDetailsCustRepository.save(billingDetails);
  }

  // Update billing details
  async update(id: string, billingDetailsData: Partial<BillingDetailsCust>) {
    const billingDetails = await this.getById(id);
    Object.assign(billingDetails, billingDetailsData);
    return this.billingDetailsCustRepository.save(billingDetails);
  }

  // Delete billing details
  async delete(id: string) {
    const billingDetails = await this.getById(id);
    await this.billingDetailsCustRepository.remove(billingDetails);
  }
}