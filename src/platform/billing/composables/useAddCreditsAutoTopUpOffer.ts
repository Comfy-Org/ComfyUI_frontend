import { computed, watch } from 'vue'

import type { AddCreditsAutoTopUpOffer } from '@comfyorg/account-core/billing'
import { addCreditsAutoTopUpOffer } from '@comfyorg/account-core/billing'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useBillingAutoTopUpCard } from '@/platform/billing/composables/useBillingAutoTopUpCard'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePlatformHandoff } from '@/platform/billing/composables/usePlatformHandoff'

/** The Add credits dialog's auto top-up offer from served facts: the checkbox only with `billing_auto_top_up_at_checkout_enabled`, else just the already-on line. */
export function useAddCreditsAutoTopUpOffer() {
  const { flags } = useFeatureFlags()
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
    return served.kind === 'checkbox' &&
      !flags.billingAutoTopUpAtCheckoutEnabled
      ? { kind: 'hidden' }
      : served
  })

  return { offer, billingUrl: href }
}
