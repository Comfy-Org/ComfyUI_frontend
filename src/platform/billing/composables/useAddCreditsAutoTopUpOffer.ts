import { computedAsync } from '@vueuse/core'
import { computed, watch } from 'vue'

import type {
  AddCreditsAutoTopUpOffer,
  AutoTopUpDefaultCard
} from '@comfyorg/account-core/billing'
import { addCreditsAutoTopUpOffer } from '@comfyorg/account-core/billing'
import { reportError } from '@comfyorg/telemetry/reportError'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useBillingAutoTopUpCard } from '@/platform/billing/composables/useBillingAutoTopUpCard'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import {
  openPlatformBilling,
  usePlatformHandoff
} from '@/platform/billing/composables/usePlatformHandoff'
import { useBillingSdkStore } from '@/platform/billing/sdk/billingSdkStore'

type DefaultCardRead =
  | { readonly kind: 'pending' }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'loaded'; readonly card: AutoTopUpDefaultCard | null }

async function readDefaultCard(): Promise<DefaultCardRead> {
  const result = await useBillingSdkStore().readPaymentMethods()
  if (result.status !== 'ok') {
    reportError(
      new Error(`Saved payment methods read failed: ${result.code}`),
      {
        errorType: 'add_credits_payment_methods_read_failed',
        surface: 'billing'
      }
    )
    return { kind: 'unknown' }
  }
  const method = result.value.find((saved) => saved.is_default)
  if (!method) return { kind: 'loaded', card: null }
  const { brand, last4 } = method
  return brand && last4
    ? { kind: 'loaded', card: { brand, last4 } }
    : { kind: 'unknown' }
}

/** The Add credits dialog's auto top-up offer from served facts: the checkbox only with `billing_auto_top_up_at_checkout_enabled` and a settled saved-cards read, else just the already-on line. */
export function useAddCreditsAutoTopUpOffer() {
  const { flags } = useFeatureFlags()
  const { autoTopUpEnabled, canManageAutoTopUp, autoTopUpSetup } =
    useBillingCapabilities()
  const { state, ensureRead } = useBillingAutoTopUpCard()
  const { href, track } = usePlatformHandoff('/profile/billing', {
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

  const defaultCard = computedAsync<DefaultCardRead>(
    () =>
      flags.billingAutoTopUpAtCheckoutEnabled && autoTopUpEnabled.value
        ? readDefaultCard()
        : { kind: 'pending' },
    { kind: 'pending' }
  )

  const offer = computed<AddCreditsAutoTopUpOffer>(() => {
    const read = state.value
    const card = defaultCard.value
    const served = addCreditsAutoTopUpOffer({
      autoTopUpEnabled: autoTopUpEnabled.value,
      canManageAutoTopUp: canManageAutoTopUp.value,
      setup: autoTopUpSetup.value,
      settings: read.kind === 'loaded' ? read.settings : null,
      defaultCard: card.kind === 'loaded' ? card.card : null
    })
    return served.kind === 'checkbox' &&
      (!flags.billingAutoTopUpAtCheckoutEnabled || card.kind !== 'loaded')
      ? { kind: 'hidden' }
      : served
  })

  return { offer, billingUrl: href, open: () => openPlatformBilling(track) }
}
