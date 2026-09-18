import { z } from 'astro/zod'

import rawAvailability from '../data/workshop-model-availability.json'

const availabilitySchema = z.record(
  z.string(),
  z
    .object({
      disabled: z.boolean(),
      reason: z.string().trim().min(1)
    })
    .strict()
)

export const workshopModelAvailability = new Map(
  Object.entries(availabilitySchema.parse(rawAvailability))
)

export function isWorkshopModelDisabled(slug: string): boolean {
  return workshopModelAvailability.get(slug)?.disabled === true
}
