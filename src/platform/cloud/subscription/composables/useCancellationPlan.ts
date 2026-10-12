import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import {
  getTierFeatures,
  toTierKey
} from '@/platform/cloud/subscription/constants/tierPricing'
import { getPlanCreditGrant } from '@/platform/cloud/subscription/utils/planCreditGrant'
import { useWorkspaceTierLabel } from '@/platform/workspace/composables/useWorkspaceTierLabel'

export function useCancellationPlan() {
  const { t } = useI18n()
  const { tier, subscription, currentTeamCreditStop } = useBillingContext()
  const { formatTierName } = useWorkspaceTierLabel()

  const planName = computed(
    () =>
      formatTierName(tier.value, false) ||
      t('subscription.cancelFlow.genericPlanName')
  )

  const creditGrant = computed(() =>
    getPlanCreditGrant({
      tier: tier.value,
      duration: subscription.value?.duration,
      teamMonthlyCredits: currentTeamCreditStop.value?.credits_monthly
    })
  )

  const includesCustomLoRAs = computed(() => {
    const tierKey = tier.value ? toTierKey(tier.value) : null
    return tierKey ? getTierFeatures(tierKey).customLoRAs : false
  })

  return { planName, creditGrant, includesCustomLoRAs }
}
