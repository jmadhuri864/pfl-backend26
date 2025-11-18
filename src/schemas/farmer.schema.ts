import { object, TypeOf, z } from "zod";
import { AddressSchema } from "./address.schema";
import { CropSchema } from "./crop.schema";


export const LandHoldingStatusEnum = z.enum(["Owned", "Leased", "Shared", "Encumbered"]);
export const LandStatusEnum = z.enum(["Cultivable", "Fallow", "Irrigated", "Non-Irrigated"]);

 

export const farmerSchema = object({
  body: object({
  farmerfName : z
    .string()
    .max(100, "Farmer name must be 100 characters or less")
    .nullable(),
    farmermName: z
    .string()
    .max(100, "Farmer name must be 100 characters or less")
    .nullable()
    .optional(),
    farmerlName: z
    .string()
    .max(100, "Farmer name must be 100 characters or less")
    .nullable(),
    primaryMobileNo: z
    .string()
    .max(15, "Mobile number must be 15 characters or less")
    .nullable()
    .optional(),
    secondaryMobileNo: z
    .string()
    .max(15, "Mobile number must be 15 characters or less")
    .nullable()
    .optional(),
    email: z.string({ required_error: "Email is required" }).email("Invalid email format").optional(),
    gender: z.string().max(100).optional(),
    residensialAddress:AddressSchema.optional(),
    dob:z.date().nullable().optional(),
    landHoldingStatus: LandHoldingStatusEnum.optional(),
    landStatus: LandStatusEnum.optional(),
    farmAddress:AddressSchema.optional(),
    totalLandArea: z.number().max(999.99).nullable().optional(),
    cultivationArea: z.number().max(999.99).nullable().optional(),
    farmerGrading: z.string().nullable().optional(),
    sevenTwelveCopy: z.string().nullable().optional(),
    sevenTwelveNo: z.string().nullable().optional(),
    idProofCopy: z.string().nullable().optional(),
    idProofNo: z.string().nullable().optional(),
    dateOfVisit: z.date().nullable().optional(),
    howDoYouSell: z.string().nullable().optional(),
   farmerPhoto: z.string().nullable().optional(),
    farmPhoto: z.string().nullable().optional(),
    crops:z.array(CropSchema).optional(),
  }),
});


export type CreateFarmerInput = TypeOf<typeof  farmerSchema>['body'];