import { computed } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'

export function useTeamPlan() {
  const {
    isActiveSubscription,
    isInitialized,
    isTeamPlan,
    maxSeats,
    subscription,
    subscriptionStatus
  } = useBillingContext()

  const isCancelled = computed(() => subscription.value?.isCancelled ?? false)
  const isOnTeamPlan = computed(
    () => isTeamPlan.value && isActiveSubscription.value && !isCancelled.value
  )
  const hasLapsedTeamPlan = computed(
    () =>
      isTeamPlan.value &&
      (subscriptionStatus.value === 'canceled' ||
        subscriptionStatus.value === 'ended')
  )
  const hasMemberSeats = computed(
    () => maxSeats.value === 0 || (maxSeats.value ?? 0) > 1
  )
  const isPlanLoading = computed(() => !isInitialized.value)

  return {
    hasTeamPlan: isTeamPlan,
    isOnTeamPlan,
    isCancelled,
    hasLapsedTeamPlan,
    hasMemberSeats,
    isPlanLoading
  }
}
