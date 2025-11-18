import { inject, injectable } from "inversify";
import { AddressRepository } from "../repositories/address.repository";
import { TYPES } from "../types";
import { DataSource } from "typeorm";
import { Address } from "../entities/address.entity";
import { AuditLogService } from "./auditLog.service";
import AppError from "../utils/appError";
import axios from "axios";


@injectable()
export class AddressService {
  private addressRepository: AddressRepository;

  constructor(@inject(TYPES.DataSource) private dataSource: DataSource,
   )
  {
    this.addressRepository = this.dataSource.getRepository(Address);
  }

  // Create a new address
  public async create(addressData: Partial<Address>): Promise<Address> 
  {
    const address = this.addressRepository.create(addressData);
    
    return await this.addressRepository.save(address);
  }

  // // Update an existing address
  // public async update(id: string, addressData: Partial<Address>): Promise<Address | null> 
  // {
  //   console.log(" data address is ",addressData);
  //   const address = await this.addressRepository.findOneBy({ id });
  //   console.log(" address is ",address);
  //   if (!address)
  //   {
  //     throw new AppError(404, "Address not found");
  //   }

  //   // Merge the existing address with the new data
  //   Object.assign(address, addressData);

  //   return await this.addressRepository.save(address);
  // }
  public async update(id: string, addressData: Partial<Address>): Promise<Address> {
    console.log("Data address is:", addressData);

    // Try to find the existing address by ID
    let address = await this.addressRepository.findOneBy({ id });
    console.log("Address is:", address);

    if (address) {
        // If address found, merge the existing address with the new data
        Object.assign(address, addressData);
        // Save the updated address
        return await this.addressRepository.save(address);
    } else {
        // If address is not found, create a new address
        return await this.create(addressData);
    }
}

  

public async deleteAddress(id: string): Promise<boolean> {
  const address = await this.addressRepository.findOne({
    where: { id },
  });

  if (!address) {
    throw new AppError(404, `Address with ID ${id} not found`);
  }

  const now = new Date();
  
  // Calculate the date 6 months ahead
  const sixMonthsFromNow = new Date(now);
  sixMonthsFromNow.setMonth(now.getMonth() + 6); // Adds 6 months to the current date
  sixMonthsFromNow.setHours(0, 0, 0, 0); // Optionally, set the time to midnight (00:00:00)

  console.log(sixMonthsFromNow); // Log the calculated date

  // Set the deletionScheduledAt field
  address.deletionScheduledAt = sixMonthsFromNow;

  console.log("In delete service for address", address.deletionScheduledAt);

  // Save the updated address with the scheduled deletion date
  await this.addressRepository.save(address);

  console.log(`Address with ID ${id} marked for deletion in 6 months.`);
  return true
}


  // Retrieve an address by ID
  public async findById(id: string): Promise<Address | null> 
  {
    return await this.addressRepository.findOneBy({ id });
  }

   public async fetchAddressByPincode(pincode:string):Promise<any>
  {
      const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);
      const data:any = response.data;
      console.log("data",response.data);
      for(const a of data)
      {
        console.log("a",a)
      }
    if (data[0].Status === 'Success' && data[0].PostOffice?.length > 0) {
      const postOffice = data[0].PostOffice[0];

      return {
        pincode:pincode,
        district: postOffice.District,
        state: postOffice.State,
        country: postOffice.Country,
      };
    }
    throw new Error("Invalid pincode or no data found");
  
  }
  // public async fetchAddressByPincode(pincode: string): Promise<any> {
  //   try {
  //     const response = await axios.get(
  //       `https://pinlookup.in/api/pincode?pincode=${pincode}`
  //     );

  //     console.log("Full response:", response.data);

  //     const record = response.data?.data;

  //     if (!record) {
  //       throw new Error("Invalid pincode or no data found");
  //     }

  //     const result = {
  //       pincode: record.pincode,
  //       officeName: record.office_name,
  //       officeType: record.office_type,
  //       division: record.division_name,
  //       region: record.region_name,
  //       circle: record.circle_name,
  //       taluk: record.taluk,
  //       district: record.district_name,
  //       state: record.state_name,
  //       country: "India", // Pinlookup doesn’t return country, we set it
  //       // latitude: record.latitude,
  //       // longitude: record.longitude,
  //     };

  //     console.log("Parsed result:", result);
  //     return result;
  //   } catch (err) {
  //     console.error("Error fetching from pinlookup:", err);
  //     throw err;
  //   }
  // }

}
