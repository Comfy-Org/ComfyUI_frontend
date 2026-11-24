import { canSetUpAutoTopUp } from '@comfyorg/account-core/billing'
import { computed, watch } from 'vue'

import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingAutoTopUpCard } from '@/platform/billing/legacy160/platform/billing/composables/useBillingAutoTopUpCard'

/** Whether the Add credits dialog offers auto top-up set up, reading the settings as soon as the served facts allow it. */
export function useAutoTopUpSetupPrompt() {
  const { autoTopUpEnabled, canManageAutoTopUp, autoTopUpSetup } =
    useBillingCapabilities()
  const { state, ensureRead } = useBillingAutoTopUpCard()

  const canSetUp = computed(() =>
    canSetUpAutoTopUp({
      autoTopUpEnabled: autoTopUpEnabled.value,
      canManageAutoTopUp: canManageAutoTopUp.value,
      setup: autoTopUpSetup.value
    })
  )

  watch(
    canSetUp,
    (allowed) => {
      if (allowed) ensureRead()
    },
    { immediate: true }
  )

  return computed(() => {
    if (!canSetUp.value) return false
    const read = state.value
    return read.kind === 'loaded' && read.settings.status === 'off'
  })
}
