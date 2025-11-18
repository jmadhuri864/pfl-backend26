import { z } from "zod";

// Define the Product schema
export const ProductSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(255, "Name is too long"),
    image: z.string().min(1, "Image is required").max(255, "Image is too long").nullable(), // Updated to be nullable
    description: z.string().optional(),
    classification: z.string().uuid("Invalid UUID format for classification").optional(), // Optional classification
    category: z.string().uuid("Invalid UUID format for category").nullable(), // Nullable category
    subcategory: z.string().uuid("Invalid UUID format for subcategory").nullable(), // Nullable subcategory
    uom: z.string().uuid("Invalid UUID format for uom").nullable(), // Nullable uom
    productOrigin: z.string().max(100, "Product origin is too long").nullable(), // Optional product origin
    count: z.array(z.string()),
    packingType: z.string().max(100, "Packing type is too long").nullable(), // Optional packing type
    shelfLife: z.number().nullable(), // Optional shelf life
    storageTemp: z.number().nullable() // Optional storage temperature
  })
});

// Export the inferred type for use in your application
export type ProductInput = z.infer<typeof ProductSchema>["body"];
