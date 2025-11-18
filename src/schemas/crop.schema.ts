import { z } from "zod";

export const CropSchema = z.object({
  crop: z.string({ required_error: "Crop name is required" }).max(100, "Crop name too long"),
  variety: z.string().max(100).optional(),
  noOfPlants: z.number().optional(),
  pruningDate: z.string().optional(), 
  expectedHarvestDate: z.string().optional(), 
  expectedQuantityInTonnes: z.number().optional(),
});

export type CropType = z.infer<typeof CropSchema>;