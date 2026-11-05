import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { topUpPlanCreditLine } from '@/platform/billing/topUpPlanCreditLine'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useFreeTierQuota } from '@/platform/billing/subscription/composables/useFreeTierQuota'
import { isCloud } from '@/platform/distribution/types'

export const TOP_UP_PLAN_CREDIT_LINE_KEYS = {
  planRequiredFreeRuns: 'credits.topUp.planRequiredFreeRuns',
  planRequiredSubscribe: 'credits.topUp.planRequiredSubscribe',
  planRequiredResubscribe: 'credits.topUp.planRequiredResubscribe'
} as const

/** Which plan-required line applies on Cloud, or null when none does. */
export function usePlanCreditLine() {
  const { isInitialized, subscriptionState } = useBillingContext()
  const { canTopUp } = useBillingCapabilities()
  const { available: freeRunsRemaining } = useFreeTierQuota()

  return computed(() =>
    topUpPlanCreditLine({
      isCloud,
      isBillingInitialized: isInitialized.value,
      canTopUp: canTopUp.value,
      subscriptionState: subscriptionState.value,
      freeRunsRemaining: freeRunsRemaining.value
    })
  )
}

/** The plan-required Add credits line, or null when it does not apply. */
export function useTopUpPlanCreditCopy() {
  const { t } = useI18n()
  const line = usePlanCreditLine()
  return computed(() =>
    line.value === null ? null : t(TOP_UP_PLAN_CREDIT_LINE_KEYS[line.value])
  )
}
