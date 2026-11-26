import { computedAsync } from '@vueuse/core'
import { computed, watch } from 'vue'

import type {
  AddCreditsAutoTopUpOffer,
  AutoTopUpDefaultCard
} from '@comfyorg/account-core/billing'
import { addCreditsAutoTopUpOffer } from '@comfyorg/account-core/billing'
import type { SavedPaymentMethod } from '@comfyorg/billing-core'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { billingApi } from '@/platform/billing/api/billingApi'
import { reportSavedPaymentMethodsReadFailure } from '@/platform/billing/composables/reportSavedPaymentMethodsReadFailure'
import { useBillingAutoTopUpCard } from '@/platform/billing/composables/useBillingAutoTopUpCard'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import {
  openPlatformBilling,
  usePlatformHandoff
} from '@/platform/billing/composables/usePlatformHandoff'
import {
  offersAutoTopUpAtLocalCheckout,
  opensLocalBillingHandoff
} from '@/platform/billing/localBillingWebEnabled'
import { useBillingSdkStore } from '@/platform/billing/sdk/billingSdkStore'

type DefaultCardRead =
  | { readonly kind: 'pending' }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'loaded'; readonly card: AutoTopUpDefaultCard | null }

type SavedMethodsRead = ReturnType<
  ReturnType<typeof useBillingSdkStore>['readPaymentMethods']
>

async function readSavedMethods(): SavedMethodsRead {
  if (!opensLocalBillingHandoff())
    return useBillingSdkStore().readPaymentMethods()
  return billingApi.listSavedPaymentMethods().then(
    (value) => ({ status: 'ok', value }),
    () => ({ status: 'error', code: 'REQUEST_FAILED' })
  )
}

function defaultCardRead(
  methods: readonly SavedPaymentMethod[]
): DefaultCardRead {
  const method = methods.find((saved) => saved.is_default)
  if (!method) return { kind: 'loaded', card: null }
  const { brand, last4 } = method
  return brand && last4
    ? { kind: 'loaded', card: { brand, last4 } }
    : { kind: 'unknown' }
}

async function readDefaultCard(): Promise<DefaultCardRead> {
  const result = await readSavedMethods()
  if (result.status !== 'ok') {
    reportSavedPaymentMethodsReadFailure(
      result.code,
      'add_credits_payment_methods_read_failed'
    )
    return { kind: 'unknown' }
  }
  return defaultCardRead(result.value)
}

function cachedDefaultCard(): DefaultCardRead {
  if (opensLocalBillingHandoff()) return { kind: 'pending' }
  const methods = useBillingSdkStore().savedPaymentMethodsSnapshot()
  return methods ? defaultCardRead(methods) : { kind: 'pending' }
}

/** Starts the reads the Add credits dialog's auto top-up offer renders from, so the dialog opens with them settled. */
export function usePrefetchAddCreditsAutoTopUpOffer() {
  const { flags } = useFeatureFlags()
  const { autoTopUpEnabled, canManageAutoTopUp } = useBillingCapabilities()
  const { ensureRead } = useBillingAutoTopUpCard()
  const readEnabled = computed(() => {
    if (!autoTopUpEnabled.value) return false
    return canManageAutoTopUp.value
  })

  watch(
    readEnabled,
    (enabled) => {
      if (!enabled) return
      ensureRead()
      if (
        flags.billingAutoTopUpAtCheckoutEnabled &&
        !opensLocalBillingHandoff()
      ) {
        void useBillingSdkStore().readPaymentMethods()
      }
    },
    { immediate: true }
  )
}

/** The Add credits dialog's auto top-up offer from served facts: the checkbox only with `billing_auto_top_up_at_checkout_enabled`, served to Cloud or to a local web handoff, and a settled saved-cards read, else just the already-on line. */
export function useAddCreditsAutoTopUpOffer() {
  const { flags } = useFeatureFlags()
  const offersCheckbox = () =>
    opensLocalBillingHandoff()
      ? offersAutoTopUpAtLocalCheckout()
      : flags.billingAutoTopUpAtCheckoutEnabled
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
      offersCheckbox() && autoTopUpEnabled.value
        ? readDefaultCard()
        : { kind: 'pending' },
    cachedDefaultCard()
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
      (!offersCheckbox() || card.kind !== 'loaded')
      ? { kind: 'hidden' }
      : served
  })

  return {
    offer,
    activatesAtCheckout: offersCheckbox,
    billingUrl: href,
    open: () => openPlatformBilling(track)
  }
}
