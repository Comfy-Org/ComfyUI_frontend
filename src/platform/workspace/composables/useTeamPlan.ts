import { computed } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'

export function useTeamPlan() {
  const {
    isActiveSubscription,
    isInitialized,
    isTeamPlan,
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
  const isPlanLoading = computed(() => !isInitialized.value)

  return {
    hasTeamPlan: isTeamPlan,
    isOnTeamPlan,
    isCancelled,
    hasLapsedTeamPlan,
    isPlanLoading
  }
}
