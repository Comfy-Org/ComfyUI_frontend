import { computed, ref } from 'vue'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useTelemetry } from '@/platform/telemetry'
import { HAS_ACCOUNT_KEY } from '@/stores/firebaseAuthStore'

export function useFreeTierOnboarding(source: 'login' | 'signup') {
  const showEmailForm = ref(false)
  const freeTierCredits = computed(() => remoteConfig.value.free_tier_credits)
  const showFreeTierBadge = (() => {
    try {
      return !localStorage.getItem(HAS_ACCOUNT_KEY)
    } catch {
      return false
    }
  })()
  const telemetry = useTelemetry()

  function switchToEmailForm() {
    showEmailForm.value = true
    telemetry?.trackUiButtonClicked({
      button_id: `${source}_use_email_instead`
    })
  }

  function switchToSocialLogin() {
    showEmailForm.value = false
    telemetry?.trackUiButtonClicked({
      button_id: `${source}_back_to_social_login`
    })
  }

  return {
    showEmailForm,
    freeTierCredits,
    showFreeTierBadge,
    switchToEmailForm,
    switchToSocialLogin
  }
}
