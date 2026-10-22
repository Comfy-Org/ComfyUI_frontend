import { computed } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'

export function useTeamPlan() {
  const {
    canAccessSubscriptionFeatures,
    isInitialized,
    isTeamPlan,
    maxSeats,
    subscription
  } = useBillingContext()

  const isCancelled = computed(() => subscription.value?.isCancelled ?? false)
  const isOnTeamPlan = computed(
    () =>
      isTeamPlan.value &&
      canAccessSubscriptionFeatures.value &&
      !isCancelled.value
  )
  const hasMemberSeats = computed(
    () => maxSeats.value === 0 || (maxSeats.value ?? 0) > 1
  )
  const isPlanLoading = computed(() => !isInitialized.value)

  return {
    maxSeats,
    hasTeamPlan: isTeamPlan,
    isOnTeamPlan,
    isCancelled,
    hasMemberSeats,
    isPlanLoading
  }
}
