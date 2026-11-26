import type { PlanRowFacts } from './planRow'

/** Cloud credit banners show only for a served active or ending plan; is_active decides when the server omits subscription_state. */
export function cloudCreditBannersAllowed(
  subscriptionState: PlanRowFacts['subscriptionState'],
  isActive: boolean
): boolean {
  if (subscriptionState === null) return isActive
  return (
    subscriptionState === 'active' || subscriptionState === 'cancel_scheduled'
  )
}
