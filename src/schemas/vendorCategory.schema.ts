
import { z } from "zod";

// Common Schema for Vendor Category
const vendorCategoryBaseSchema = z.object({
  name: z.string().min(1, "Category name is required"), // Name must be a non-empty string
});

// Schema for Create Category
export const createVendorCategorySchema = z.object({
  body: vendorCategoryBaseSchema,
});

// Schema for Get Category by ID
export const getVendorCategoryByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid category ID format"), // Ensures ID is a valid UUID
  }),
});

export const updateVendorCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid category ID format"), // Ensures ID is a valid UUID
  }),
  body: z.object({
    name: z.string().min(1, "Category name is required").optional(), // Optional for partial updates
  }),
});


// Schema for Delete Category
export const deleteVendorCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid category ID format"), // Ensures ID is a valid UUID
  }),
});

// Schema for Get All Categories (no parameters required)
export const getAllVendorCategoriesSchema = z.object({});




// vendorCategory.schema.ts

// import * as z from "zod";

// export const VendorcategorySchema = z.object({
//   body: z.object({
//     name: z.string().min(1, "Category name is required"), // Require name
//   }),
// });

// export const CreateVendorSubcategorySchema = z.object({
//   body: z.object({
//     name: z.string({ required_error: "Name is required" }),
//     categoryId: z.string({ required_error: "Category ID is required" }),
//   }),
// });

// export const UpdateVendorSubcategorySchema = z.object({
//   body: z.object({
//     name: z.string().optional(),
//     categoryId: z.string().optional(),
//   }),
// });



