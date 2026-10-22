import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFreeTierQuota } from '@/platform/cloud/subscription/composables/useFreeTierQuota'
import { isSalesManagedTier } from '@/platform/cloud/subscription/constants/tierPricing'
import type { SubscriptionTier } from '@/platform/workspace/api/workspaceApi'
import { resolveSubscriptionTierKey } from '@/platform/workspace/components/subscriptionPanelWorkspace.logic'
import { derivePlanRow } from '@/platform/workspace/components/dialogs/settings/billing/planRow'
import { useScheduledPlanChange } from '@/platform/workspace/composables/useScheduledPlanChange'

export function useBillingPlanRow() {
  const { t } = useI18n()
  const {
    subscription,
    subscriptionStatus,
    subscriptionState,
    billingStatus,
    isTeamPlan
  } = useBillingContext()
  const { quotaEnabled, available, maxAvailable } = useFreeTierQuota()
  const scheduled = useScheduledPlanChange()

  function planNameFor(tier: SubscriptionTier | null): string | null {
    if (tier === null || isSalesManagedTier(tier)) return null
    if (isTeamPlan.value) return t('subscription.teamPlanName')
    return t(`subscription.tiers.${resolveSubscriptionTierKey(tier)}.name`)
  }

  const scheduledChange = computed(() => {
    const change = scheduled.scheduledChange.value
    const planName = scheduled.planName.value
    return change && planName
      ? { planName, effectiveAt: change.effective_at }
      : null
  })

  const freeRuns = computed(() =>
    quotaEnabled.value
      ? { remaining: available.value, total: maxAvailable.value }
      : null
  )

  const subscriptionFacts = computed(() => ({
    duration: subscription.value?.duration ?? null,
    planName: planNameFor(subscription.value?.tier ?? null),
    renewalDate: subscription.value?.renewalDate ?? null,
    endDate: subscription.value?.endDate ?? null
  }))

  const state = computed(() =>
    derivePlanRow({
      ...subscriptionFacts.value,
      subscriptionStatus: subscriptionStatus.value,
      subscriptionState: subscriptionState.value,
      billingStatus: billingStatus.value,
      scheduledChange: scheduledChange.value,
      freeRuns: freeRuns.value
    })
  )

  return { state }
}
