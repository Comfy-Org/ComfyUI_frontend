import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { isCloud } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { getDevOverride } from '@/utils/devFeatureFlagOverride'

/**
 * Gate for EDU promo pricing: cloud only, remote-config flag AND the personal
 * customer's is_edu marker (cloud#8725). Also surfaces team/workspace
 * eligibility for the unified pricing table's team tab.
 */
export function useEduPricing() {
  const { flags } = useFeatureFlags()
  const { isEduCustomer } = useSubscription()
  const workspaceStore = useTeamWorkspaceStore()

  // Dev-only: localStorage.setItem('ff:edu_customer', 'true') fakes the marker locally.
  const isEduPricingActive = computed(
    () =>
      isCloud &&
      flags.eduPricingEnabled &&
      (getDevOverride<boolean>('edu_customer') ?? isEduCustomer.value)
  )

  // Team/workspace eligibility (any current member carrying is_edu). The
  // backend field this reads isn't exposed on any member-list response yet —
  // that's a separate, not-yet-shipped backend PR — so this reads as false
  // today and starts reporting true once a loaded member carries it.
  const isTeamEduEligible = computed(
    () =>
      isCloud &&
      flags.eduPricingEnabled &&
      workspaceStore.members.some((member) => member.isEdu === true)
  )

  return { isEduPricingActive, isTeamEduEligible }
}
