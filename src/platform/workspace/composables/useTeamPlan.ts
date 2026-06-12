import { computed } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { TIER_TO_KEY } from '@/platform/cloud/subscription/constants/tierPricing'

/** Seat-based team-plan proxy until BE-1254 exposes per-workspace plan seats. */
export function useTeamPlan() {
  const { isActiveSubscription, subscription, getMaxSeats } =
    useBillingContext()

  const maxSeats = computed(() => {
    const tier = subscription.value?.tier
    if (!tier) return 1
    const tierKey = TIER_TO_KEY[tier]
    if (!tierKey) return 1
    return getMaxSeats(tierKey)
  })

  const isOnTeamPlan = computed(
    () => isActiveSubscription.value && maxSeats.value > 1
  )

  return { maxSeats, isOnTeamPlan }
}
