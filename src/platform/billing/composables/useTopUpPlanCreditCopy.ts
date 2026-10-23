import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { topUpPlanCreditLine } from '@/platform/billing/topUpPlanCreditLine'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useFreeTierQuota } from '@/platform/billing/subscription/composables/useFreeTierQuota'
import { isCloud } from '@/platform/distribution/types'

const LINE_KEYS = {
  planRequiredFreeRuns: 'credits.topUp.planRequiredFreeRuns',
  planRequiredSubscribe: 'credits.topUp.planRequiredSubscribe',
  planRequiredResubscribe: 'credits.topUp.planRequiredResubscribe'
} as const

/** The plan-required Add credits line, or null when it does not apply. */
export function useTopUpPlanCreditCopy() {
  const { t } = useI18n()
  const { isInitialized, subscriptionState } = useBillingContext()
  const { canTopUp } = useBillingCapabilities()
  const { available: freeRunsRemaining } = useFreeTierQuota()

  return computed(() => {
    const line = topUpPlanCreditLine({
      isCloud,
      isBillingInitialized: isInitialized.value,
      canTopUp: canTopUp.value,
      subscriptionState: subscriptionState.value,
      freeRunsRemaining: freeRunsRemaining.value
    })
    return line === null ? null : t(LINE_KEYS[line])
  })
}
