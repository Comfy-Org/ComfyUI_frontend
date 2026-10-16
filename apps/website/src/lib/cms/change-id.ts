import { z } from 'astro/zod'

export const changeID = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  .refine((value) => value.trim() === value)
  .optional()
