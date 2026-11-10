import { computed, watch } from 'vue'

import type { AddCreditsAutoTopUpOffer } from '@comfyorg/account-core/billing'
import { addCreditsAutoTopUpOffer } from '@comfyorg/account-core/billing'

import { useBillingAutoTopUpCard } from '@/platform/billing/composables/useBillingAutoTopUpCard'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePlatformHandoff } from '@/platform/billing/composables/usePlatformHandoff'

/** The Add credits dialog's "Auto top-up is on" line from the served status, and its Billing link. */
export function useAddCreditsAutoTopUpLine() {
  const { autoTopUpEnabled, canManageAutoTopUp, autoTopUpSetup } =
    useBillingCapabilities()
  const { state, ensureRead } = useBillingAutoTopUpCard()
  const { href } = usePlatformHandoff('/profile/billing', {
    target: 'auto_top_up',
    action: 'manage'
  })

  watch(
    autoTopUpEnabled,
    (enabled) => {
      if (enabled) ensureRead()
    },
    { immediate: true }
  )

  const offer = computed<AddCreditsAutoTopUpOffer>(() => {
    const read = state.value
    const served = addCreditsAutoTopUpOffer({
      autoTopUpEnabled: autoTopUpEnabled.value,
      canManageAutoTopUp: canManageAutoTopUp.value,
      setup: autoTopUpSetup.value,
      settings: read.kind === 'loaded' ? read.settings : null,
      defaultCard: null
    })
    return served.kind === 'on' ? served : { kind: 'hidden' }
  })

  return { offer, billingUrl: href }
}
