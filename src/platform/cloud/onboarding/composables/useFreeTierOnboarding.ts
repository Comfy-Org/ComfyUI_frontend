import { computed, ref } from 'vue'

import { getTierCredits } from '@/platform/billing/subscription/constants/tierPricing'
import { useRemoteConfigStore } from '@/platform/remoteConfig/remoteConfigStore'

export function useFreeTierOnboarding() {
  const remoteConfigStore = useRemoteConfigStore()
  const showEmailForm = ref(false)
  const freeTierCredits = computed(() => getTierCredits('free'))
  const isFreeTierEnabled = computed(
    () => remoteConfigStore.config.new_free_tier_subscriptions ?? false
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
    isFreeTierEnabled,
    switchToEmailForm,
    switchToSocialLogin
  }
}
