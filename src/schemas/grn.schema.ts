import { z } from "zod";
import { grnProductSchema } from "./grnProduct.schema";
import { paymentInfoForGRNSchema } from "./grnpaymentinfo.schema";

const grnSchema = z.object({
    companyName: z.string().optional(), // Optional company name
    purchaseRequestByWhom: z.string().optional(), // Optional purchase requestor
    requestingDepartment: z.enum(["Purchase", "Sales", "Finance", "Human Resources", "Operations", "Logistics", "Quality Assurance"]).optional(),
    grnNo: z.string().min(1), // GRN No must be a non-empty string
    dealSlip: z.object({ id: z.string() }).optional(), // Reference to DealSlip ID
    rfpa: z.object({ id: z.string() }).optional(), // Reference to RFPA ID
    purchaseLocation: z.string().optional(), // Optional purchase location
    purchaseForWhich: z.string().optional(), // Optional purchase purpose
    source: z.enum(["vendor", "farmer"]).optional(), // Source must be either 'vendor' or 'farmer'
    selectedVendor: z.object({ id: z.string() }).optional(), // Reference to Vendor ID
    selectedFarmer: z.object({ id: z.string() }).optional(), // Reference to Farmer ID
    billNo: z.string().optional(), // Optional bill number
    billImage: z.string().optional(), // Optional bill image
    serialNo: z.string().optional(), // Optional serial number
    subTotalAmt: z.number().positive(), // Subtotal must be a positive number
    freight: z.number().positive(), // Freight must be a positive number
    otherCharges: z.number().positive(), // Other charges must be a positive number
    totalAmt: z.number().optional(), // Optional total amount
    amtWords: z.string().optional(), // Optional amount in words
    purchasedBy: z.string().optional(), // Optional purchaser
    approvalNote: z.string().optional(), // Optional approval note
    receivedThrough: z.string(), // Required transport mode
    vehicleNo: z.string(), // Required vehicle number
    timeIn: z.string().optional(), // Optional time in
    cratesIn: z.number().positive().optional(), // Optional crates in
    deliveryReceivingPerson: z.string().optional(), // Optional delivery receiving person
    validityOfQuote: z.string().optional(), // Optional validity of quote
    packingInstruction: z.string().optional(), // Optional packing instruction
    products: z.array(grnProductSchema).optional(), // Optional array of GRN products
    baseLocation: z.string().optional(), // Optional base location
    approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]), // Approval status
    grnApprovedAt: z.date().optional(), // Optional approval date
    createdAt: z.date(), // Required creation date
    requestedBy: z.object({ id: z.string() }).optional(), // Reference to requested by User ID
    paymentInfo: paymentInfoForGRNSchema.optional(), // Optional payment information
  });
  