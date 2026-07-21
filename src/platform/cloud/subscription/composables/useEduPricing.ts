import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'

/** Gate for EDU promo pricing: remote-config flag AND the customer's is_edu marker. */
export function useEduPricing() {
  const { flags } = useFeatureFlags()
  const { isEduCustomer } = useSubscription()

  const isEduPricingActive = computed(
    () => flags.eduPricingEnabled && isEduCustomer.value
  )

  return { isEduPricingActive }
}
