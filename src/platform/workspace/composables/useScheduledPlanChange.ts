import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import {
  isEnterprisePlanSlug,
  isUnknownTier
} from '@/platform/cloud/subscription/constants/tierPricing'
import {
  formatSubscriptionDate,
  resolveSubscriptionTierKey
} from '@/platform/workspace/components/subscriptionPanelWorkspace.logic'

export function useScheduledPlanChange() {
  const { t, locale } = useI18n()
  const { subscription, plans } = useBillingContext()

  const scheduledChange = computed(
    () => subscription.value?.scheduledChange ?? null
  )

  const formattedDate = computed(() =>
    formatSubscriptionDate(scheduledChange.value?.effective_at, locale.value)
  )

  const planName = computed(() => {
    const slug = scheduledChange.value?.plan_slug
    if (isEnterprisePlanSlug(slug)) {
      return t('subscription.tiers.enterprise.name')
    }

    const plan = plans.value.find(({ slug: planSlug }) => planSlug === slug)
    if (!plan) return ''
    if (plan.tier === 'ENTERPRISE') {
      return t('subscription.tiers.enterprise.name')
    }
    if (plan.slug.startsWith('team')) {
      return t('subscription.teamPlanName')
    }
    if (isUnknownTier(plan.tier)) {
      return t('subscription.unknownTierName')
    }
    return t(`subscription.tiers.${resolveSubscriptionTierKey(plan.tier)}.name`)
  })

  const isDisplayable = computed(
    () => Boolean(planName.value) && Boolean(formattedDate.value)
  )

  return { scheduledChange, planName, formattedDate, isDisplayable }
}
