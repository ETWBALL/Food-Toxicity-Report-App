import { z } from 'zod';

/** Strong password: length + uppercase, lowercase, digit, special character */
export const strongPasswordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const registerBodySchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm password is required'),
    /** Optional display name; defaults to the email local-part when omitted */
    name: z.string().min(1).max(120).optional(),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginBodySchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  })
  .strict();

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
