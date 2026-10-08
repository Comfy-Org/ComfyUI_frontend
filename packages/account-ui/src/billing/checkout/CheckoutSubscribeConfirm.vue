<template>
  <div :class="layout.root">
    <div :class="layout.summary">
      <div :class="layout.header">
        <CheckoutButton
          size="icon"
          variant="muted-textonly"
          class="shrink-0 rounded-full"
          :aria-label="copy.back"
          :disabled="interactionLocked"
          @click="emit('back')"
        >
          <i class="pi pi-arrow-left text-base" />
        </CheckoutButton>
        <h2 :class="layout.title">
          {{ copy.confirmPayment }}
        </h2>
      </div>
      <slot v-if="summaryReplaced" name="summary" />
      <template v-else>
        <CheckoutSubscribeSummary
          :plan
          :copy
          :locale
          :preview-data
          :billing-cycle
          :compact="usePaymentElement"
        />
        <CheckoutPromotionCode
          v-if="embeddedCheckoutEnabled"
          :applied-code="previewData?.promotion_code"
          :disabled="interactionLocked"
          :copy
          @apply="emit('applyPromotionCode', $event)"
          @invalidate="emit('invalidateQuote')"
        />
      </template>
      <CheckoutSavedMethods
        v-if="showSavedMethods && savedMethods"
        v-model:selected-method-id="selectedSavedMethodId"
        :methods="savedMethods"
        :copy="copy.savedMethod"
        @change-payment-method="emit('changePaymentMethod')"
      />
    </div>

    <div :class="layout.footer">
      <CheckoutSubscribeActions
        :pay-action
        :copy
        :plan-name="plan.name"
        :preview-data
        :publishable-key
        :theme-key
        :is-loading
        :pay-disabled
        :verification-url="verificationOffered ? actionUrl : null"
        :verification-pending="Boolean(actionUrl) || verificationRecoveryActive"
        :quote-is-current
        :embedded-checkout-enabled
        :reconciliation-operation-id
        :authentication-state
        :authentication-error
        @add-credit-card="emit('addCreditCard')"
        @confirm-payment="emit('confirmPayment', $event)"
        @submitting-change="stripeSubmissionPending = $event"
        @payment-phase="emit('paymentPhase', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The confirm step of a new subscription: the plan and today's charge on one
 * side, and the way to pay on the other — the card form, the saved methods
 * that stand in for it, or a hosted continuation the host opens. A host
 * following a payment it did not quote here replaces the plan and charge
 * through the `summary` slot and `summaryReplaced`.
 */
import { computed, ref } from 'vue'

import type {
  BillingAuthenticationState,
  SavedPaymentMethod,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'
import { cn } from '@comfyorg/tailwind-utils'

import type { StripePaymentPhase } from '../stripe/stripePaymentPhase'
import CheckoutButton from './CheckoutButton.vue'
import CheckoutPromotionCode from './CheckoutPromotionCode.vue'
import CheckoutSavedMethods from './CheckoutSavedMethods.vue'
import CheckoutSubscribeActions from './CheckoutSubscribeActions.vue'
import CheckoutSubscribeSummary from './CheckoutSubscribeSummary.vue'
import type { CheckoutCopy } from './checkoutCopy'
import type { CheckoutBillingCycle, CheckoutPlan } from './checkoutQuote'
import type { CheckoutPayAction } from './checkoutRecovery'
import {
  isVerificationOffered,
  isVerificationRecoveryActive
} from './checkoutRecovery'

const {
  plan,
  copy,
  locale,
  publishableKey,
  themeKey,
  billingCycle = 'monthly',
  isLoading = false,
  previewData = null,
  actionUrl = null,
  authenticationState = null,
  authenticationError = null,
  reconciliationOperationId = null,
  parkedCheckoutRecovery = false,
  usePaymentElement = false,
  savedMethods = null,
  quoteIsCurrent = false,
  isApplyingPromotionCode = false,
  embeddedCheckoutEnabled = false,
  summaryReplaced = false
} = defineProps<{
  plan: CheckoutPlan
  copy: CheckoutCopy
  locale: string
  publishableKey: string
  themeKey?: string
  billingCycle?: CheckoutBillingCycle
  isLoading?: boolean
  previewData?: SubscriptionPreview | null
  actionUrl?: string | null
  authenticationState?: BillingAuthenticationState | null
  authenticationError?: string | null
  reconciliationOperationId?: string | null
  /** Subscribe landed on a checkout already waiting for a card; only another
   *  subscribe can re-issue its payment link. */
  parkedCheckoutRecovery?: boolean
  usePaymentElement?: boolean
  /** When present the card form is skipped and the confirm renders as one
   *  narrow column. */
  savedMethods?: readonly SavedPaymentMethod[] | null
  quoteIsCurrent?: boolean
  isApplyingPromotionCode?: boolean
  embeddedCheckoutEnabled?: boolean
  /** The host summarizes a payment it did not quote here in the `summary` slot. */
  summaryReplaced?: boolean
}>()

const emit = defineEmits<{
  addCreditCard: []
  confirmPayment: [confirmationToken: string]
  back: []
  changePaymentMethod: []
  applyPromotionCode: [code: string]
  invalidateQuote: []
  paymentPhase: [phase: StripePaymentPhase]
}>()

const selectedSavedMethodId = defineModel<string | null>(
  'selectedSavedMethodId',
  { default: null }
)

// The wide capture split only applies while a payment method is being
// collected; with a saved method the confirm is a single narrow column.
const captureMode = computed(() => usePaymentElement && !savedMethods?.length)
const showSavedMethods = computed(
  () => embeddedCheckoutEnabled && Boolean(savedMethods?.length)
)

const layout = computed(() => {
  const split = captureMode.value
  return {
    root: cn(
      'mx-auto flex h-full min-h-0 max-w-[400px] flex-col items-stretch justify-between overflow-y-auto text-sm motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-bottom-2',
      // Edge-to-edge Stripe-checkout split on desktop: the summary is a
      // flush full-height sidebar on base-background, payment beside it on
      // the shell. Mobile keeps the stacked flow.
      split &&
        'xl:min-h-0 xl:w-full xl:max-w-none xl:flex-1 xl:flex-row xl:items-stretch xl:gap-0 xl:overflow-visible'
    ),
    summary: cn(
      split &&
        'xl:w-[42%] xl:shrink-0 xl:border-r xl:border-border-subtle xl:bg-base-background xl:px-12 xl:py-10',
      // Below xl the same dual tone runs vertically: the summary bleeds
      // dark to the dialog edges, payment continues on the shell below.
      split &&
        'max-xl:-mx-4 max-xl:-mt-6 max-xl:rounded-t-2xl max-xl:bg-base-background max-xl:p-6'
    ),
    header: cn('mb-8 flex items-center gap-3', split && 'xl:mb-10'),
    title: cn(
      'm-0 flex-1 text-center text-xl font-semibold text-base-foreground lg:text-2xl',
      // In the sidebar the title goes quiet and the money block leads.
      split &&
        'xl:text-left xl:text-base xl:font-medium xl:text-muted-foreground'
    ),
    footer: cn(
      'flex flex-col gap-2 pt-8 pb-4',
      split && 'xl:min-h-0 xl:min-w-0 xl:flex-1 xl:px-16 xl:py-10',
      // Match the summary panel's 24px edge inset (root p-4 provides 16).
      split && 'max-xl:px-2'
    )
  }
})

const amountDueCents = computed(() => previewData?.amount_due_cents ?? 0)
// Stripe Elements are configured once, on mount, from the amount and
// currency. Mounting before the quote arrives permanently latches the
// "payment options are unavailable" error, because nothing re-initializes
// the element when the props later fill in.
const quoteReady = computed(
  () =>
    amountDueCents.value > 0 &&
    Boolean(previewData?.currency) &&
    Boolean(previewData?.quote_id) &&
    previewData?.quote_version !== undefined
)
const recoveryState = computed(() => ({
  actionUrl,
  authenticationState,
  reconciliationOperationId,
  embeddedCheckoutEnabled
}))
const verificationOffered = computed(() =>
  isVerificationOffered(recoveryState.value)
)
const verificationRecoveryActive = computed(() =>
  isVerificationRecoveryActive(recoveryState.value)
)
const quoteIsUsable = computed(() => !embeddedCheckoutEnabled || quoteIsCurrent)

const stripeSubmissionPending = ref(false)
const interactionLocked = computed(
  () => isLoading || isApplyingPromotionCode || stripeSubmissionPending.value
)
const payAction = computed<CheckoutPayAction>(() => {
  if (parkedCheckoutRecovery) return 'parked'
  if (captureMode.value) return quoteReady.value ? 'form' : 'pay'
  return savedMethods?.length ? 'pay' : 'subscribe'
})

const payDisabled = computed(
  () =>
    interactionLocked.value ||
    !quoteIsUsable.value ||
    verificationRecoveryActive.value
)
</script>
