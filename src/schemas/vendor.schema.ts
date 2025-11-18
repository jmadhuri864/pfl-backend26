import { array, date, object, string, TypeOf } from "zod";
import { addressSchema, updateaddressSchema } from "./user.schema";
import { z } from "zod";
import uuid from "../utils/uuid";
import { Status } from "../utils/status.enum";
import { bankDetailsVendSchema } from "./vendorBankDetails.schema";
import { createVendorSaleInfoSchema } from "./vendorsaleinfo.schema";
// Define the status enum
const VendorStatusEnum = z.enum([
  "pending",
  "approved",
  "rejected",
  "inactive",
  "suspended",
  "under_review",
]);
// export const CreatevendorSchema = object({
//   body: object({
//     name: string({
//       required_error: "Name is required",
//     }),
//     contactname: string({
//       required_error: "Contactname is required",
//     }),
//     contactphone: string({
//       required_error: "ContactPhone is required",
//     }),
//     gstn: string().optional(),
//     comments: string().optional(),
//     description: string({
//       required_error: "Description is required",
//     }),

//     address: addressSchema,
//     categoryId: string(),
//     status: VendorStatusEnum.optional(),
//     subcategoryId: string(),
//   }),
// });
// export type CreateVendorInput = z.infer<typeof CreatevendorSchema>["body"];




// Enum for Vendor Status
// export const VendorStatusEnum = z.enum(["pending", "approved", "rejected", "inactive", "suspended", "under_review"]);

// Zod schema for Vendor
export const vendorSchema = z.object({
  body: object({
  companyName: z.string().max(100).optional(),  // Matches the length in the entity
  officeAddress: addressSchema.optional(),      // OneToOne relation to Address entity
  officeContactNo: z.string().max(100).optional(),  // Matches the length in the entity
  email: z.string().max(100).email("Invalid email format").optional(),
  gstn: z.string().max(100).optional(),  // Matches the length in the entity
  gstnCopy: z.string().max(100).optional(),  // Matches the length in the entity
  ifGstnCopy: z.boolean().default(true).optional(),
  panNo: z.string().max(100).optional(),  // Matches the length in the entity
  panCardCopy: z.string().max(200).optional(),  // Matches the length in the entity
  ifPanCardCopy: z.boolean().default(true).optional(),
  msmeNo: z.string().max(200).optional(),  // Matches the length in the entity
  msmeCopy: z.string().max(200).optional(),  // Matches the length in the entity
  ifMsmeCopy: z.boolean().default(true).optional(),
  website: z.string().max(100).optional(),  // Matches the length in the entity
  creditTerms: z.string().max(200).optional(),  // Matches the length in the entity
  vendorCode: z.string().max(200).optional(),  // Matches the length in the entity
  vendorGrade: z.string().max(100).optional(),  // Matches the length in the entity
  registeredBy: z.string().max(100).optional(),  // Matches the length in the entity
  registeredDate: z.string().optional(),  // Date format
  dateOfIncorporation: z.string().optional(),  // Date format

  inFandVBusinessSince: z.string().optional(),  // No length specified, assuming string
  mainProductsToBeSupplied: z.string().optional(),
  listOfAllProducts: z.string().optional(),
  dispatchCenter: z.string().max(100).optional(),  // Matches the length in the entity
  warehouseLocations: z.string().optional(),
  packingCenterLocation: z.string().optional(),
  tradeLicenseNumber: z.string().max(200).optional(),  // Matches the length in the entity
  proposedPaymentTerms: z.string().optional(),
  anyDetailsTeamAndInfra: z.string().optional(),
  submittedBy: z.string().max(100).optional(),  // Matches the length in the entity
  status: z.nativeEnum(Status).default(Status.PENDING).optional(),  // Enum field
  category: z.string().optional(),  // Assuming string for category and subcategory
  subcategory: z.string().optional(),

  // Reference 1 fields
  ref1FName: z.string().max(400).optional(),  // Matches the length in the entity
  ref1MName: z.string().max(400).optional(),
  ref1LName: z.string().max(400).optional(),
  ref1PrimaryCNumb: z.string().max(150).optional(),  // Corrected field name and length
  ref1AltrCNumb: z.string().max(150).optional(),
  ref1Address: addressSchema.optional(),
  ref1Email: z.string().max(100).optional(),

  // Reference 2 fields
  ref2FName: z.string().max(400).optional(),  // Matches the length in the entity
  ref2MName: z.string().max(400).optional(),
  ref2LName: z.string().max(400).optional(),
  ref2PrimaryCNumb: z.string().max(150).optional(),  // Corrected field name and length
  ref2AltrCNumb: z.string().max(150).optional(),
  ref2Address: addressSchema.optional(),
  ref2Email: z.string().max(100).optional(),

  // Bank details
  bankDetails: bankDetailsVendSchema.optional(),  // OneToOne relation with BankDetails

  // Vendor Sale Info
  vendorSaleInfo: createVendorSaleInfoSchema.optional(),  // OneToOne relation with VendorSaleInfo
})
});

export type VendorSchema = TypeOf<typeof vendorSchema>["body"];


export const UpdateVendorSchema = object({
  body: object({
    partyName: string().optional(),
    contactPersonFirstName: string().optional(),
    contactPersonMiddleName: string().optional(),
    contactPersonLastName: string().optional(),
    inFandVBusinessSince: string().optional(),
    primaryContactNumber: string().optional(),
    alternateContactNumber: string().optional(),
    officeAddress: string().optional(),
    officeLandlineNumber: string().optional(),
    mainProductsToBeSupplied: string().optional(),
    listOfAllProducts: string().optional(),
    dispatchCenter: string().optional(),
    warehouseLocations: string().optional(),
    packingCenterLocation: string().optional(),
    panNo: string().optional(),
    tradeLicenseNumber: string().optional(),
    proposedLicenseTerms: string().optional(),
    anyOtherDetailsRegardingTeamAndInfrastructure: string().optional(),
    submittedBy: string().optional(),
    refOneFName: string().optional(),
    refOneMName: string().optional(),
    refOneLName: string().optional(),
    refOneAltrCNumb: string().optional(),
    refAddress: string().optional(),
    refEmail: string().optional(),
    address: updateaddressSchema.optional(), // Ensure your address schema is compatible with optional fields
    categoryId: string().optional(),
    status: VendorStatusEnum.optional(),
    subcategoryId: string().optional(),
  }),
});

export type UpdateVendor = z.infer<typeof UpdateVendorSchema>["body"]


