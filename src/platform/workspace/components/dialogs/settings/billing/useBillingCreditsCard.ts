import { computed } from 'vue'
import type { Ref } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { getPlanCreditGrant } from '@/platform/cloud/subscription/utils/planCreditGrant'
import { isCloud } from '@/platform/distribution/types'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { deriveCreditsCard } from '@/platform/workspace/components/dialogs/settings/billing/creditsCard'
import type { PlanRowState } from '@/platform/workspace/components/dialogs/settings/billing/planRow'

export function useBillingCreditsCard(planRow: Ref<PlanRowState>) {
  const { balance, billingStatus, subscription, currentTeamCreditStop } =
    useBillingContext()
  const { canManageSubscription } = useBillingCapabilities()

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
      billingStatus: billingStatus.value,
      planPoolCredits: planPoolCredits.value,
      isCloud,
      canManageSubscription: canManageSubscription.value
    })
  )

  return { state }
}
