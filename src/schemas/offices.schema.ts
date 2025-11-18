import { z } from "zod";
import { OFFICE_TYPE } from "../entities/offices.entity";
import { addressSchema, updateaddressSchema } from "./user.schema";

export const CreateOfficeBodySchema = z.object({
  name: z.string().min(1, "Office name is required").optional(),
  address: addressSchema.optional(),
  contactNumber: z.string().optional(),
  cFirstName:z.string().optional(),
    cMiddleName:z.string().optional(),
    cLastName:z.string().optional(),
  notes: z.string().optional(),
  officeEmail: z.string().email("Invalid email address").optional(),
  type: z.nativeEnum(OFFICE_TYPE).optional(),
});

export const UpdateOfficeBodySchema = z.object({
  name: z.string().optional(),
  address: updateaddressSchema.optional(),
  contactNumber: z.string().optional(),
  cFirstName:z.string().optional(),
    cMiddleName:z.string().optional(),
    cLastName:z.string().optional(),
  notes: z.string().optional(),
  officeEmail: z.string().email("Invalid email address").optional(),
  type: z.nativeEnum(OFFICE_TYPE).optional(),
});
