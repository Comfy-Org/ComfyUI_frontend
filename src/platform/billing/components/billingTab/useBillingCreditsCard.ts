import { computed } from 'vue'
import type { Ref } from 'vue'

import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { getPlanCreditGrant } from '@/platform/billing/subscription/utils/planCreditGrant'
import { deriveCreditsCard } from '@/platform/billing/components/billingTab/creditsCard'
import type { PlanRowState } from '@/platform/billing/components/billingTab/planRow'

export function useBillingCreditsCard(planRow: Ref<PlanRowState>) {
  const {
    balance,
    billingStatus,
    subscription,
    currentTeamCreditStop,
    renewalDate,
    periodCreditGrant
  } = useBillingContext()
  const { planKind } = useBillingCapabilities()

  const planPoolCredits = computed(
    () =>
      getPlanCreditGrant({
        tier: subscription.value?.tier,
        duration: subscription.value?.duration,
        teamMonthlyCredits: currentTeamCreditStop.value?.credits_monthly
      })?.credits ?? null
  )

  const state = computed(() =>
    deriveCreditsCard({
      balance: balance.value,
      planKind: planRow.value.kind,
      servedPlanKind: planKind.value,
      billingStatus: billingStatus.value,
      periodCreditGrant: periodCreditGrant.value,
      planPoolCredits: planPoolCredits.value,
      renewalDate: renewalDate.value,
      endDate: planRow.value.kind === 'ending' ? planRow.value.endsAt : null
    })
  )

  return { state }
}
