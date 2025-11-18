import { z } from "zod";


export const AddressSchema = z.object({
    address1: z.string().min(1, "Address is required"),
    address2:z.string().optional(),
    location: z.string().min(1, "Location is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    pincode: z.string().min(4, "Pincode is required"),
  });