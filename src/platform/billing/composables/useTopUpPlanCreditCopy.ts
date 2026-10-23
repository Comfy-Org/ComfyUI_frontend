import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { topUpPlanCreditLine } from '@/platform/billing/topUpPlanCreditLine'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { isCloud } from '@/platform/distribution/types'

export function useTopUpPlanCreditCopy() {
  const { t } = useI18n()
  const { flags } = useFeatureFlags()
  const { subscriptionStatus } = useBillingContext()

  return computed(() => {
    const line = topUpPlanCreditLine({
      unifiedBillingSettingsEnabled: flags.unifiedBillingSettingsEnabled,
      isCloud,
      subscriptionStatus: subscriptionStatus.value
    })
    if (line === 'planRequiredSubscribe') {
      return t('credits.topUp.planRequiredSubscribe')
    }
    if (line === 'planRequiredResubscribe') {
      return t('credits.topUp.planRequiredResubscribe')
    }
    return t('credits.topUp.purchaseDisclosure')
  })
}
