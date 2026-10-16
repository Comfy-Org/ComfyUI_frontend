import { z } from 'astro/zod'

// Comfy users.id is opaque and case-sensitive; resource and edit IDs stay UUIDs.
export const accountID = z
  .string()
  .min(1)
  .refine(
    (value) =>
      value !== '00000000-0000-0000-0000-000000000000' &&
      !/[\p{White_Space}\p{Cc}\p{Cs}]/u.test(value),
    'Expected a canonical Comfy account ID'
  )
