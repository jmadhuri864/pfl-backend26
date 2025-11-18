import { object, string, TypeOf, z } from 'zod';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[+\d][\d\s]+$/;
export const loginUserSchema = object({
  body: object({
    uid: z.string().min(1, "UID is required.").refine(
      (val) => emailRegex.test(val) || phoneRegex.test(val) || val.length >= 3, // Allow username with min 3 chars
      {
        message: "UID must be a valid email, phone number, or username (min 3 chars).",
      }
    ),
    password: string({
      required_error: 'Password is required',
    }).min(6, 'Invalid email or password'),
  }),
});


  export type LoginUserInput = TypeOf<typeof loginUserSchema>['body'];