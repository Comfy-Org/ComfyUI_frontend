import { z } from 'astro/zod'

export const workshopModelAvailabilitySchema = z.record(
  z.string(),
  z
    .object({
      disabled: z.boolean(),
      reason: z.string().trim().min(1)
    })
    .strict()
)
