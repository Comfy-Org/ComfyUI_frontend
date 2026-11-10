import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AddCreditsPlanLine } from '@comfyorg/account-core/billing'
import { topUpPlanCreditLine } from '@/platform/billing/topUpPlanCreditLine'
import type { TopUpPlanCreditLine } from '@/platform/billing/topUpPlanCreditLine'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useFreeTierQuota } from '@/platform/billing/subscription/composables/useFreeTierQuota'
import { isCloud } from '@/platform/distribution/types'

export const TOP_UP_PLAN_CREDIT_LINE_KEYS = {
  planRequiredFreeRuns: 'credits.topUp.planRequiredFreeRuns',
  planRequiredSubscribe: 'credits.topUp.planRequiredSubscribe',
  planRequiredResubscribe: 'credits.topUp.planRequiredResubscribe'
} as const

const ADD_CREDITS_LINES = {
  planRequiredFreeRuns: 'free_runs',
  planRequiredSubscribe: 'no_plan',
  planRequiredResubscribe: 'ended'
} as const satisfies Record<TopUpPlanCreditLine, AddCreditsPlanLine>

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

/** The same line as the Add credits dialog's plan-line fact. */
export function useAddCreditsPlanLine() {
  const line = usePlanCreditLine()
  return computed(() =>
    line.value === null ? undefined : ADD_CREDITS_LINES[line.value]
  )
}
