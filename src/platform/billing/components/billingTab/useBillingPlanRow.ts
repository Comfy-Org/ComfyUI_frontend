import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useFreeTierQuota } from '@/platform/billing/subscription/composables/useFreeTierQuota'
import { isSalesManagedTier } from '@/platform/billing/subscription/constants/tierPricing'
import type { SubscriptionTier } from '@/platform/workspace/api/workspaceApi'
import { resolveSubscriptionTierKey } from '@/platform/billing/components/subscriptionPanelWorkspace.logic'
import { derivePlanRow } from '@/platform/billing/components/billingTab/planRow'
import { useScheduledPlanChange } from '@/platform/billing/composables/useScheduledPlanChange'

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
