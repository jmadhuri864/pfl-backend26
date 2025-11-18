import { object, z } from "zod";
import { addressSchema } from "./user.schema";
import { BranchType } from "../entities/branches.entity";

// // Define a Zod schema for the route parameters
// export const CreateBranchParamsSchema = z.object({
//   branchType: z.nativeEnum(BranchType), // Ensures branchType is one of the defined enum values
// });
const params = {
  params: object({
    branchType: z.nativeEnum(BranchType),
  }),
};
export const CreateBranchBodySchema  = z.object({

    name: z.string().min(1, "Branch name is required"),
    address: addressSchema, // Nested AddressSchema
    contactNumber: z.string().optional(),
    cFirstName:z.string(),
    cMiddleName:z.string().optional(),
    cLastName:z.string(),
    notes: z.string().optional(),
    totalCapacity: z.number().min(1, "Total capacity must be a positive number").optional(),
    currentCapacity: z.number().min(0, "Current capacity cannot be negative").optional(),
    balanceCapacity: z.number().min(0, "Balance capacity cannot be negative").optional(),
    type: z.nativeEnum(BranchType).optional(),
    
  });
  
  
export const UpdateBranchBodySchema = object({
  name: z.string().min(1, "Branch name is required").optional(),
  address: addressSchema.optional(), // Nested AddressSchema
  contactNumber: z.string().optional(),
  cFirstName:z.string().optional(),
    cMiddleName:z.string().optional(),
    cLastName:z.string().optional(),
  notes: z.string().optional(),
  totalCapacity: z.number().min(1, "Total capacity must be a positive number").optional(),
  currentCapacity: z.number().min(0, "Current capacity cannot be negative").optional(),
  balanceCapacity: z.number().min(0, "Balance capacity cannot be negative").optional(),
  type: z.nativeEnum(BranchType).optional(), // Ensure branchType is valid if provided
});
  export type BranchSchema = z.infer<typeof CreateBranchBodySchema >;
  //export type CreateBranchParams = z.infer<typeof CreateBranchParamsSchema>;