import { workshopModelFlag } from '../config/workshop-model-availability'
import { useWorkshopFlag } from './posthog'

/** Whether this visitor sees a slug: always, or once its PostHog flag is on. */
export function isWorkshopModelShown(slug: string): boolean {
  const flag = workshopModelFlag(slug)
  return flag === undefined || useWorkshopFlag(flag).value
}
