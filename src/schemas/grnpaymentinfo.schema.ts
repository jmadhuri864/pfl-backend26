import { z } from "zod";

export const paymentInfoForGRNSchema = z.object({
  paymentMode: z.string().max(100),
  paymentDate: z.date().optional(),
  advancePaidAmt: z.number().positive().optional(),
  paymentTerms: z.string().optional(),
});
