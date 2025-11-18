import { injectable, inject } from 'inversify';
import { AddressService } from './address.service';
import { DeliveryDetailsCustRepository } from '../repositories/deliveryDetailsCust.repository';
import { DeliveryDetails } from '../entities/deliveryDetailsCust.entity';
import { TYPES } from '../types';
import AppError from '../utils/appError';
import { DocumentbRepository } from '../repositories/documentb.repository';

@injectable()
export class DeliveryDetailsCustService {
  constructor(
    @inject(TYPES.DeliveryDetailsCustRepository)
    private readonly deliveryDetailsRepository: DeliveryDetailsCustRepository,
    @inject(TYPES.AddressService)
    private readonly addressService: AddressService,
    @inject(TYPES.DocumentbRepository)
    private readonly documentbRepository: DocumentbRepository,
  ){}
  async create(deliveryDetailsData: Partial<any>): Promise<DeliveryDetails> {
    try {
      const { deliveryAddress, ...data } = deliveryDetailsData;

      if (deliveryAddress) {
        // Ensure that the address exists or create it
        const address = await this.addressService.create(deliveryAddress);
        data.deliveryAddress = address;
      }

      const deliveryDetails = this.deliveryDetailsRepository.create(data);
      return this.deliveryDetailsRepository.save(deliveryDetails);
    } catch (error) {
      // Handle or log the error as appropriate
      throw new AppError(500, `Error creating delivery details`);
    }
  }

  async update(id: string, deliveryDetailsData: Partial<DeliveryDetails>): Promise<DeliveryDetails | null> {
    try {
      const deliveryDetails = await this.deliveryDetailsRepository.findOne({
        where: { id },
        relations: ['deliveryAddress']
      });

      if (deliveryDetails) {
        const { deliveryAddress, ...data } = deliveryDetailsData;
        
        if (deliveryAddress) {
          // Ensure that the address exists or create it
          const address = await this.addressService.update(deliveryDetails.deliveryAddress.id,deliveryAddress);
          deliveryDetails.deliveryAddress = address;
        }

        this.deliveryDetailsRepository.merge(deliveryDetails, data);
        return this.deliveryDetailsRepository.save(deliveryDetails);
      }

      return null;
    } catch (error) {
      // Handle or log the error as appropriate
      throw new AppError(500, `Error updating delivery details`);
    }
  }

  // async delete(id: string): Promise<boolean> {
  //   try {
  //     const result = await this.deliveryDetailsRepository.delete(id);
  //     return result
  //   } catch (error) {
  //     // Handle or log the error as appropriate
  //     throw new AppError(500, `Error deleting delivery details`);
  //   }
  // }

  async getAll(): Promise<DeliveryDetails[]> {
    try {
      return this.deliveryDetailsRepository.find({ relations: ['deliveryAddress', 'customer'] 
        ,
        order: {
          createdAt: 'DESC', // Assuming createdAt is a timestamp field 
        },
      });
    } catch (error) {
      // Handle or log the error as appropriate
      throw new AppError(500, `Error retrieving delivery details`);
    }
  }

  async getById(id: string): Promise<DeliveryDetails | null> {
    try {
      return this.deliveryDetailsRepository.findOne({
        where: { id },
        relations: ['deliveryAddress', 'customer']
      });
    } catch (error) {
      // Handle or log the error as appropriate
      throw new AppError(500, `Error retrieving delivery details by ID`);
    }
  }
  public async deleteMultipleDCForCustomer(ids: string[]): Promise<{ success: string[]; failed: { id: string; reason: string }[]; message: string }> {
  const success: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  for (const id of ids) {
    try {
      const dcForCustomer = await this.deliveryDetailsRepository.findOne({
        where: { id },
      });
      if (!dcForCustomer) {
        failed.push({ id, reason: 'Delivery Challan For Customer not found' });
        continue;
      }
      const relatedDocument = await this.documentbRepository.findOne({
        where: { document_type_id: dcForCustomer.id }
      });

      if (!relatedDocument) {
        throw new Error(`Something went wrong`);
      }

      const deleteDocument = await this.documentbRepository.delete(relatedDocument.id);
      if (!deleteDocument) {
        throw new Error(`Failed to delete related document with ID ${relatedDocument.id}`);
      }

      const deleteDCForCustomer = await this.deliveryDetailsRepository.delete(dcForCustomer.id);
      if (!deleteDCForCustomer) {
        throw new Error(`Failed to delete Delivery Challan For Customer with ID ${id}`);
      }
      success.push(id);
    } catch (error: any) {
      failed.push({ id, reason: error.message || 'Unknown error' });
    }
  }
  const message = `Deletion completed. Success: ${success.length}, Failed: ${failed.length}`;
  return { success, failed, message };
}

}
