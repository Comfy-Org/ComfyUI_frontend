import { computed, ref } from 'vue'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { HAS_ACCOUNT_KEY } from '@/stores/firebaseAuthStore'

export function useFreeTierOnboarding() {
  const showEmailForm = ref(false)
  const freeTierCredits = computed(() => remoteConfig.value.free_tier_credits)
  // Evaluated once at mount — localStorage won't change mid-session
  const showFreeTierBadge = (() => {
    try {
      return !localStorage.getItem(HAS_ACCOUNT_KEY)
    } catch {
      return false
    }
  })()

  function switchToEmailForm() {
    showEmailForm.value = true
  }

  function switchToSocialLogin() {
    showEmailForm.value = false
  }

  return {
    showEmailForm,
    freeTierCredits,
    showFreeTierBadge,
    switchToEmailForm,
    switchToSocialLogin
  }
}
