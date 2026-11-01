import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useFreeTierQuota } from '@/platform/billing/subscription/composables/useFreeTierQuota'
import { isSalesManagedTier } from '@/platform/billing/subscription/constants/tierPricing'
import type { SubscriptionTier } from '@comfyorg/billing-core'
import { resolveSubscriptionTierKey } from '@/platform/billing/components/subscriptionPanelWorkspace.logic'
import { derivePlanRow } from '@/platform/billing/components/billingTab/planRow'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
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
  const { planKind } = useBillingCapabilities()

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

  const subscriptionFacts = computed(() => {
    const current = subscription.value
    if (!current) {
      return {
        duration: null,
        planName: null,
        renewalDate: null,
        endDate: null
      }
    }
    return {
      duration: current.duration,
      planName: planNameFor(current.tier),
      renewalDate: current.renewalDate,
      endDate: current.endDate,
      endedAt: current.endedAt
    }
  })

  const state = computed(() =>
    derivePlanRow({
      ...subscriptionFacts.value,
      subscriptionStatus: subscriptionStatus.value,
      subscriptionState: subscriptionState.value,
      billingStatus: billingStatus.value,
      scheduledChange: scheduledChange.value,
      freeRuns: freeRuns.value,
      planKind: planKind.value
    })
  )

  return { state }
}
