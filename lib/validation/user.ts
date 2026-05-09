import { z } from 'zod';

export const userUpdateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    email: z.string().email().optional(),
    country: z.union([z.string().max(120), z.null()]).optional(),
    avatarUrl: z.union([z.string().url(), z.null(), z.literal('')]).optional(),
    age: z.union([z.number().int().min(0).max(150), z.null()]).optional(),
  })
  .strict();

export type UserUpdateBody = z.infer<typeof userUpdateSchema>;
