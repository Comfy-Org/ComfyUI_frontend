import rawAvailability from '@/data/workshop-model-availability.json'
import { workshopModelAvailabilitySchema } from './workshop-model-availability-schema'

export const workshopModelAvailability = new Map(
  Object.entries(workshopModelAvailabilitySchema.parse(rawAvailability))
)

export function isWorkshopModelDisabled(slug: string): boolean {
  return workshopModelAvailability.get(slug)?.disabled === true
}

/** The PostHog flag a slug is shown behind, if any. */
export function workshopModelFlag(slug: string): string | undefined {
  return workshopModelAvailability.get(slug)?.flag
}
