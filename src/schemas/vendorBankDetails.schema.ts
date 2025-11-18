import { z } from "zod";
import { addressSchema } from "./user.schema";

// Enum for AccountType
const AccountTypeEnum = z.enum(['Savings', 'Current', 'Cash credit', 'Overdraft', 'Other']);

// Zod schema for BankDetailsVend
export const bankDetailsVendSchema = z.object({
  beneficiaryFName: z.string().max(40),
  beneficiaryMName: z.string().max(40),
  beneficiaryLName: z.string().max(40),
  bankName: z.string().max(40).optional(),
  
  // branchAddress should map to Address schema
  branchAddress: addressSchema.optional(),

  typeOfAcc: AccountTypeEnum,
  
  ifscCode: z.string().max(40).optional(),
  swiftNo: z.string().max(40).optional(),
  invoiceCurrency: z.string().max(40).optional(),
  cancelledChequeCopy: z.string().max(40).optional(),

  ifCancelledCheque: z.boolean().default(true).optional(),
});

export type BankDetailsVendSchema = z.infer<typeof bankDetailsVendSchema>;
