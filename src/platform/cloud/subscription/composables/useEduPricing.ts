import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

/** Gate for EDU promo pricing: cloud only, remote-config flag AND the customer's is_edu marker. */
export function useEduPricing() {
  const { flags } = useFeatureFlags()
  const { isEduCustomer } = useSubscription()

  // Dev-only: localStorage.setItem('ff:edu_customer', 'true') fakes the marker locally.
  const isEduPricingActive = computed(
    () =>
      isCloud &&
      flags.eduPricingEnabled &&
      (getDevOverride<boolean>('edu_customer') ?? isEduCustomer.value)
  )

  return { isEduPricingActive }
}
