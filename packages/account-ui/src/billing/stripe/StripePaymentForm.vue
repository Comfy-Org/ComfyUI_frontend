<template>
  <form class="flex min-h-0 flex-col gap-6 xl:flex-1" @submit.prevent="submit">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h3 class="m-0 text-base font-semibold text-base-foreground">
          {{ copy.paymentMethod }}
        </h3>
        <p class="m-0 mt-1 max-w-md text-sm text-muted-foreground">
          {{ copy.methodChoice }}
        </p>
      </div>
    </div>
    <div
      v-if="configurationError"
      class="rounded-lg border border-destructive-background bg-destructive-background/10 px-3 py-2 text-sm text-destructive-background"
    >
      {{ configurationError }}
    </div>
    <!-- Only the form region scrolls; the header above and the pay action
         below hold their positions regardless of which method is expanded. -->
    <div
      class="flex flex-col gap-6 xl:min-h-0 xl:flex-1 xl:overflow-x-hidden xl:overflow-y-auto xl:pr-1"
    >
      <div ref="paymentElementTarget" />
      <div class="flex flex-col gap-3">
        <h4 class="m-0 text-sm font-medium text-base-foreground">
          {{ copy.billingAddress }}
        </h4>
        <div ref="addressElementTarget" />
      </div>
      <div
        v-if="selectedMethodType === 'alipay'"
        class="flex items-start gap-3 rounded-xl bg-base-background/60 px-4 py-3 text-xs text-muted-foreground"
      >
        <i
          class="mt-0.5 icon-[lucide--shield-check] size-4 shrink-0 text-(--success-foreground)"
        />
        <p class="m-0">
          {{ copy.alipayRenewalNote }}
        </p>
      </div>
    </div>
    <slot
      name="submit"
      :disabled="submitDisabled"
      :loading="isLoading || isSubmitting"
      :verification-pending="verificationPending"
    />
  </form>
</template>

<script setup lang="ts">
/**
 * The provider-bound half of checkout: mounts Stripe's Payment and Address
 * Elements, validates them, and turns them into a confirmation token the
 * caller hands to `subscribe`. Everything host-shaped arrives as an input —
 * the publishable key, the copy, the pay button through the `submit` slot —
 * and every observation leaves as a `phase` event, so the package chooses no
 * design system, no i18n runtime and no telemetry sink.
 */
import type {
  Appearance,
  Stripe,
  StripeAddressElement,
  StripeElements,
  StripeError,
  StripePaymentElement
} from '@stripe/stripe-js'
import { loadStripe } from '@stripe/stripe-js/pure'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type {
  StripePaymentCopy,
  StripePaymentPhase,
  StripeSubmitPhase
} from './stripePaymentPhase'

const {
  publishableKey,
  amountCents,
  currency,
  copy,
  paymentMethodConfigurationId = '',
  isLoading = false,
  verificationPending = false,
  canSubmit = true,
  themeKey = ''
} = defineProps<{
  publishableKey: string
  amountCents: number
  currency: string
  copy: StripePaymentCopy
  /** Stripe payment method configuration governing which methods Elements
   *  offers (served per-environment by the preview). */
  paymentMethodConfigurationId?: string
  isLoading?: boolean
  /** A 3DS verification is pending: the host's own verification action is
   *  primary, so the pay button steps back. */
  verificationPending?: boolean
  canSubmit?: boolean
  /** Changes whenever the host switches theme, so the mounted Elements
   *  re-read their appearance in place instead of keeping the colours
   *  resolved at creation. */
  themeKey?: string
}>()

const emit = defineEmits<{
  confirm: [confirmationToken: string]
  submittingChange: [submitting: boolean]
  phase: [phase: StripePaymentPhase]
}>()

let isUnmounted = false

function reportPhase(phase: StripePaymentPhase): void {
  // A callback or awaited continuation can fire after unmount; the host's
  // journey may then belong to a later checkout, so never report for it.
  if (isUnmounted) return
  emit('phase', phase)
}

const paymentElementTarget = ref<HTMLDivElement>()
const addressElementTarget = ref<HTMLDivElement>()
const stripeElements = ref<StripeElements>()
const configurationError = ref('')
const isSubmitting = ref(false)
const selectedMethodType = ref('')
let stripe: Stripe | null = null
let paymentElement: StripePaymentElement | undefined
let addressElement: StripeAddressElement | undefined

const submitDisabled = computed(
  () => !stripeElements.value || !canSubmit || verificationPending
)

const submitBlocked = computed(
  () => submitDisabled.value || isSubmitting.value || isLoading
)

function failElementInit(): void {
  configurationError.value = copy.unavailable
  reportPhase({
    phase: 'payment_element_failed',
    element: 'payment',
    element_phase: 'init'
  })
}

function failSubmit(submitPhase: StripeSubmitPhase, error?: StripeError): void {
  configurationError.value = error?.message ?? copy.genericError
  reportPhase({
    phase: 'payment_submit_failed',
    submit_phase: submitPhase,
    ...(error?.code && { error_code: error.code })
  })
}

function mountPaymentElement(
  elements: StripeElements,
  target: HTMLDivElement
): void {
  paymentElement = elements.create('payment', {
    layout: {
      type: 'accordion',
      defaultCollapsed: false,
      radios: 'always',
      spacedAccordionItems: true
    },
    // The Address Element below is the single source of billing address.
    // Left at the default, card would also render its own country/postal
    // inputs, and a customer who filled the two differently would send the
    // issuer an address that contradicts the one we collected for AVS.
    fields: { billingDetails: { address: 'never' } },
    // The host's terms note carries the recurring-charge authorization;
    // Stripe's card mandate text would say it twice.
    terms: { card: 'never' }
  })
  paymentElement.mount(target)
  paymentElement.on('ready', () => {
    reportPhase({ phase: 'payment_element_ready', element: 'payment' })
  })
  paymentElement.on('loaderror', (event) => {
    reportPhase({
      phase: 'payment_element_failed',
      element: 'payment',
      element_phase: 'mount',
      ...(event.error?.code && { error_code: event.error.code })
    })
  })
  // Method-specific notes (e.g. the Alipay auto-renewal disclosure) key off
  // whichever payment method the user has selected inside the element.
  paymentElement.on('change', (event) => {
    selectedMethodType.value = event.value?.type ?? ''
  })
}

/**
 * A full billing address feeds AVS to the issuer and Radar. In billing mode
 * every field is required, and because the address shares the Payment
 * Element's group, createConfirmationToken folds it into the token's
 * billing_details.
 */
function mountAddressElement(
  elements: StripeElements,
  target: HTMLDivElement
): void {
  addressElement = elements.create('address', { mode: 'billing' })
  addressElement.mount(target)
  addressElement.on('ready', () => {
    reportPhase({ phase: 'payment_element_ready', element: 'address' })
  })
  addressElement.on('loaderror', (event) => {
    reportPhase({
      phase: 'payment_element_failed',
      element: 'address',
      element_phase: 'mount',
      ...(event.error?.code && { error_code: event.error.code })
    })
  })
}

onMounted(async () => {
  if (!publishableKey || !paymentMethodConfigurationId) {
    failElementInit()
    return
  }
  // A non-positive amount means the caller mounted this before its quote
  // resolved. Stay silent rather than latching an error the caller cannot
  // clear: callers gate on a ready quote, and a wrong error here reads to the
  // customer as "payment is broken" when the amount is merely still loading.
  if (amountCents <= 0) return

  try {
    stripe = await loadStripe(publishableKey)
  } catch {
    failElementInit()
    return
  }
  if (!stripe || !paymentElementTarget.value || isUnmounted) {
    failElementInit()
    return
  }
  stripeElements.value = stripe.elements({
    mode: 'subscription',
    amount: amountCents,
    currency: currency.toLowerCase(),
    // Intent-wide by policy: every method offered here must be chargeable
    // off-session at renewal, so Stripe's dynamic filtering is the gate —
    // a configuration-enabled method without off-session support (or without
    // this account's permission for it) simply never renders.
    setupFutureUsage: 'off_session',
    paymentMethodConfiguration: paymentMethodConfigurationId,
    appearance: resolveAppearance(paymentElementTarget.value)
  })
  mountPaymentElement(stripeElements.value, paymentElementTarget.value)
  if (addressElementTarget.value) {
    mountAddressElement(stripeElements.value, addressElementTarget.value)
  }
})

watch([() => amountCents, () => currency], ([amount, nextCurrency]) => {
  if (!stripeElements.value || amount <= 0) return

  stripeElements.value
    .update({ amount, currency: nextCurrency.toLowerCase() })
    .catch(() => {
      if (isUnmounted) return
      configurationError.value = copy.genericError
      reportPhase({
        phase: 'payment_element_failed',
        element: 'payment',
        element_phase: 'update'
      })
    })
})

watch(
  () => themeKey,
  () => {
    if (!stripeElements.value || !paymentElementTarget.value) return
    stripeElements.value
      .update({ appearance: resolveAppearance(paymentElementTarget.value) })
      .catch(() => {
        reportPhase({
          phase: 'payment_element_failed',
          element: 'payment',
          element_phase: 'update'
        })
      })
  },
  { flush: 'post' }
)

onBeforeUnmount(() => {
  isUnmounted = true
  paymentElement?.destroy()
  addressElement?.destroy()
})

async function mintConfirmationToken(
  elements: StripeElements,
  client: Stripe
): Promise<string | undefined> {
  // Validation boundary: submit() normally resolves with an error field, but
  // an unexpected rejection here is still a pre-token validation failure.
  let submitResult
  try {
    submitResult = await elements.submit()
  } catch {
    failSubmit('validation')
    return undefined
  }
  if (submitResult.error) {
    failSubmit('validation', submitResult.error)
    return undefined
  }
  const result = await client.createConfirmationToken({ elements })
  if (result.error) {
    failSubmit('token_creation', result.error)
    return undefined
  }
  return result.confirmationToken.id
}

async function submit() {
  if (submitBlocked.value || !stripeElements.value || !stripe) return
  isSubmitting.value = true
  emit('submittingChange', true)
  configurationError.value = ''
  reportPhase({ phase: 'payment_submit_attempted' })
  try {
    const confirmationToken = await mintConfirmationToken(
      stripeElements.value,
      stripe
    )
    // Same hazard as reportPhase, with money on it: the customer may have
    // closed this checkout while the token was minting, and a confirm the
    // host acts on would charge them for a flow they left.
    if (confirmationToken && !isUnmounted) emit('confirm', confirmationToken)
  } catch {
    failSubmit('token_creation')
  } finally {
    isSubmitting.value = false
    if (!isUnmounted) emit('submittingChange', false)
  }
}

/**
 * Stripe takes appearance as concrete values, so every token is resolved
 * against the form's own theme root, where the host's theme class applies.
 */
function resolveAppearance(themeRoot: HTMLElement): Appearance {
  const resolveThemeColor = (variable: string) =>
    resolveColorIn(themeRoot, variable)
  return {
    variables: {
      // Selection (radio, selected label, accordion highlight) uses the
      // theme-aware foreground rather than brand blue.
      colorPrimary: resolveThemeColor('--base-foreground'),
      colorBackground: resolveThemeColor('--base-background'),
      colorText: resolveThemeColor('--base-foreground'),
      colorTextSecondary: resolveThemeColor('--muted-foreground'),
      colorDanger: resolveThemeColor('--destructive-background'),
      // Same token as the pricing table's "Save 20%" pill, so all
      // deal/discount badges share one accent.
      colorSuccess: resolveThemeColor('--primary-background'),
      fontFamily: getComputedStyle(themeRoot).fontFamily,
      borderRadius: '10px',
      spacingUnit: '5px'
    },
    rules: {
      '.AccordionItem': {
        backgroundColor: resolveThemeColor('--base-background'),
        // Transparent (not none) so rows keep their size when the
        // selected item paints its outline.
        border: '1px solid transparent',
        boxShadow: 'none'
      },
      '.AccordionItem--selected': {
        borderColor: resolveThemeColor('--base-foreground')
      },
      '.Input': {
        backgroundColor: resolveThemeColor('--input-surface'),
        borderColor: resolveThemeColor('--border-default'),
        boxShadow: 'none'
      },
      '.Input:focus': {
        borderColor: resolveThemeColor('--primary-background'),
        boxShadow: `0 0 0 1px ${resolveThemeColor('--primary-background')}`
      },
      '.Label': {
        fontWeight: '500'
      }
    }
  }
}

function resolveColorIn(themeRoot: HTMLElement, variable: string) {
  const probe = document.createElement('span')
  probe.style.color = `var(${variable})`
  themeRoot.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}
</script>
