import { computed } from 'vue'

import { useEmailVerification } from '@/composables/auth/useEmailVerification'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isLikelyEduEmail } from '@/platform/cloud/subscription/utils/eduEmail'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

/** Gate for EDU promo pricing: cloud only, remote-config flag AND the customer's is_edu marker. */
export function useEduPricing() {
  const { flags } = useFeatureFlags()
  const { isEduCustomer } = useSubscription()
  const { userEmail } = useCurrentUser()
  const { isEmailVerified } = useEmailVerification()

  // Dev-only: localStorage.setItem('ff:edu_customer', 'true') fakes the marker locally.
  const isEduPricingActive = computed(
    () =>
      isCloud &&
      flags.eduPricingEnabled &&
      (getDevOverride<boolean>('edu_customer') ?? isEduCustomer.value)
  )

  // Unverified edu-looking email: nudge to verify instead of showing the discount.
  const needsEduVerification = computed(
    () =>
      isCloud &&
      flags.eduPricingEnabled &&
      !isEduPricingActive.value &&
      isEmailVerified.value === false &&
      isLikelyEduEmail(userEmail.value)
  )

  return { isEduPricingActive, needsEduVerification }
}
