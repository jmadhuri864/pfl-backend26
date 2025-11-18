import { TypeOf, z } from 'zod';
import { Status } from '../utils/status.enum';
import { updateaddressSchema } from './user.schema';

// Define Zod schema for Drivers
export const driverSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email("Invalid email address").optional(),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 characters").optional(),
  address: updateaddressSchema.optional(),
  status: z.nativeEnum(Status).default(Status.PENDING),
  vehicleType: z.string().optional(),
  vehicleNo: z.string().optional(),
});


export type UpdateDriverInput = TypeOf<typeof driverSchema>;