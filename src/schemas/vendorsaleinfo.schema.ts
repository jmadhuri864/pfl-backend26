import { TypeOf, z } from "zod";

export const createVendorSaleInfoSchema = z.object({
    contactFName:z.string(),
    contactMName:z.string(),
    contactLName: z.string(),
    directContactNumber: z.string(),
    mobileNumber: z.string(),
    email: z.string()


})




export type CreateVendorSaleInfoSchema = z.infer<typeof createVendorSaleInfoSchema>;