import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useEmailVerification } from '@/composables/auth/useEmailVerification'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { isLikelyEduEmail } from '@/platform/cloud/subscription/utils/eduEmail'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

/**
 * Gate for EDU promo pricing: cloud only, remote-config flag AND either the
 * subscriber's is_edu marker (personal) or the workspace's team-eligibility
 * marker (team — always false today; see `isTeamEduEligible` on
 * `useBillingContext`).
 */
export function useEduPricing() {
  const { flags } = useFeatureFlags()
  const { isEduCustomer, isTeamEduEligible } = useBillingContext()
  const { userEmail } = useCurrentUser()
  const { isEmailVerified } = useEmailVerification()

  const eduPricingEnabled = computed(() => isCloud && flags.eduPricingEnabled)

  // Dev-only: localStorage.setItem('ff:edu_customer', 'true') fakes the
  // personal marker locally.
  const isEduPricingActive = computed(
    () =>
      eduPricingEnabled.value &&
      (getDevOverride<boolean>('edu_customer') ?? isEduCustomer.value)
  )

  const isTeamEduPricingActive = computed(
    () => eduPricingEnabled.value && isTeamEduEligible.value
  )

  // Unverified edu-looking email: nudge to verify instead of showing the discount.
  const needsEduVerification = computed(
    () =>
      eduPricingEnabled.value &&
      !isEduPricingActive.value &&
      isEmailVerified.value === false &&
      isLikelyEduEmail(userEmail.value)
  )

  return { isEduPricingActive, isTeamEduPricingActive, needsEduVerification }
}
