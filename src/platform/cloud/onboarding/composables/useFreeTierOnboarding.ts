import { useLocalStorage } from '@vueuse/core'
import { computed, ref } from 'vue'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { HAS_ACCOUNT_KEY } from '@/stores/firebaseAuthStore'

export function useFreeTierOnboarding() {
  const showEmailForm = ref(false)
  const freeTierCredits = computed(() => remoteConfig.value.free_tier_credits)

  // Returning users are detected by either:
  // - HAS_ACCOUNT_KEY: set by onAuthStateChanged after first login
  // - Comfy.PreviousWorkflow: set on every workflow save (covers existing
  //   users before HAS_ACCOUNT_KEY was introduced)
  // Reactive via useLocalStorage so the badge hides if the user signs in
  // during the current session.
  const hasAccount = useLocalStorage<string | null>(HAS_ACCOUNT_KEY, null)
  const previousWorkflow = useLocalStorage<string | null>(
    'Comfy.PreviousWorkflow',
    null
  )
  const showFreeTierBadge = computed(
    () => !hasAccount.value && !previousWorkflow.value
  )

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
