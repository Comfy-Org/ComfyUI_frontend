import { useWorkshopFlag } from './posthog'

/** Whether this visitor sees an entry: always, or once its PostHog flag is on. */
export function isWorkshopModelShown(model: {
  readonly flag?: string
}): boolean {
  return model.flag === undefined || useWorkshopFlag(model.flag).value
}
