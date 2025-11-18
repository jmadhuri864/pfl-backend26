import { z } from 'zod';
import { FileType } from '../utils/status.enum';

export const createBankDetailsSchema = z.object({
  accountHolderName: z.string().nonempty({ message: 'Account holder name is required' }),
  bankName: z.string().nonempty({ message: 'Bank name is required' }),
  branch: z.string().nonempty({ message: 'Branch is required' }),
  accountNumber: z.string().nonempty({ message: 'Account number is required' }),
  ifscCode: z.string().nonempty({ message: 'IFSC code is required' }),
  typeOfAccount: z.string().nonempty({ message: 'Type of account is required' }),
  bankAddress: z.string().optional(),
  city: z.string().optional(),
  chequeCopyPath: z.string().optional(),
  chequeCopyType: z.enum([FileType.IMAGE, FileType.PDF]).optional()
});
export const updateBankDetailsSchema = z.object({
  accountHolderName: z.string().optional(),
  bankName: z.string().optional(),
  branch: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  typeOfAccount: z.string().optional(),
  bankAddress: z.string().optional(),
});

export type CreateBankDetailsInput = z.infer<typeof createBankDetailsSchema>;
export type UpdateBankDetailsInput = z.infer<typeof updateBankDetailsSchema>;
