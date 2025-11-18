import { z } from "zod";
import { Source, Department, Status } from "../utils/status.enum";

// Enum for Department
const DepartmentEnum = z.enum([
  Department.PURCHASE,
  Department.SALES,
  Department.FINANCE,
  Department.HUMAN_RESOURCES,
  Department.OPERATIONS,
  Department.LOGISTICS,
  Department.QUALITY_ASSURANCE,
]);

// Enum for Source
const SourceEnum = z.enum(["VENDOR", "FARMER"]);

// Enum for Status
const StatusEnum = z.enum([
  Status.PENDING,
  Status.APPROVED,
  Status.REJECTED,
  // Add any other statuses if needed
]);

// RFPA Product schema if it has required fields
const RFPAProductSchema = z.object({
  productId: z.string().nonempty("Product ID is required"), // Example field
  quantity: z.number().min(1, "Quantity must be at least 1"), // Example field
  // Add any other fields specific to RFPAProduct
});

// Main schema for creating an RFPA
export const CreateRfpaSchema = z.object({
  companyName: z.string().uuid().optional(),
 baseLocation: z.string().uuid().nonempty("Base location is required"),
  purchaseLocation: z.string().uuid().nonempty("Purchase location is required"),
  purchaseForWhich: z.string().uuid().nonempty("Purchase for which is required"),
  deliveryReceivingPerson: z.string().optional(),
packingInstruction: z.string().optional(),
  selectedParty: z.string().uuid().optional(), // Vendor ID
 specialRequest: z.string().optional(),
  source: SourceEnum.optional(),
  paymentInfo: z.object({
    // Define the structure of payment info based on PaymentInfoForRFPA
    paymentMode: z.string().nonempty("Payment mode is required"),
    paymentDate: z.string().optional(), // Use string for date
    advancePaidAmount: z.number().optional(),
    validityOfQuote: z.string().optional(),
    paymentTerms: z.string().optional(),
    // Add any other fields from PaymentInfoForRFPA
  }).optional(),
  rfpaProducts: z.array(RFPAProductSchema).optional(), // Array of RFPAProduct
});

// Usage in your controller
