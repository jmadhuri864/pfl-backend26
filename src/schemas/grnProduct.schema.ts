import { z } from "zod";

export const grnProductSchema = z.object({
    grn: z.object({ id: z.string() }), // Reference to GRN ID
    product: z.object({ id: z.string() }), // Reference to Product ID
    uom: z.object({ id: z.string() }), // Reference to UOM ID
    quantity: z.number().positive(), // Quantity must be a positive number
    rate: z.number().positive(), // Rate must be a positive number
    revisedRate: z.number().positive().optional(), // Optional, must be a positive number if provided
    amt: z.number().positive(), // Amount must be a positive number
    grade: z.string().max(100).optional(), // Optional grade, max length 100
    rtv: z.string().max(100).optional(), // Optional RTV, max length 100
    purchaseDate: z.date().optional(), // Optional purchase date
    expectedHarvestDate: z.date().optional(), // Optional expected harvest date
    dispatchDate: z.date().optional(), // Optional dispatch date
    deliveryDate: z.date().optional(), // Optional delivery date
    deliveryLocation: z.string().optional(), // Optional delivery location
  });
  