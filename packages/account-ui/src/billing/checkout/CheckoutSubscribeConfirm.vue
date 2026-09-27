<template>
  <div
    :class="
      cn(
        'mx-auto flex h-full max-w-[400px] flex-col items-stretch justify-between text-sm motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-bottom-2',
        // Edge-to-edge Stripe-checkout split on desktop: the summary is a
        // flush full-height sidebar on base-background, payment beside it on
        // the shell. Mobile keeps the stacked flow.
        captureMode &&
          'xl:min-h-0 xl:w-full xl:max-w-none xl:flex-1 xl:flex-row xl:items-stretch xl:gap-0'
      )
    "
  >
    <div
      :class="
        cn(
          captureMode &&
            'xl:w-[42%] xl:shrink-0 xl:border-r xl:border-border-subtle xl:bg-base-background xl:px-12 xl:py-10',
          // Below xl the same dual tone runs vertically: the summary bleeds
          // dark to the dialog edges, payment continues on the shell below.
          captureMode &&
            'max-xl:-mx-4 max-xl:-mt-6 max-xl:rounded-t-2xl max-xl:bg-base-background max-xl:p-6'
        )
      "
    >
      <div
        :class="cn('mb-8 flex items-center gap-3', captureMode && 'xl:mb-10')"
      >
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
        <h2
          :class="
            cn(
              'm-0 flex-1 text-center text-xl font-semibold text-base-foreground lg:text-2xl',
              // In the sidebar the title goes quiet and the money block leads.
              captureMode &&
                'xl:text-left xl:text-base xl:font-medium xl:text-muted-foreground'
            )
          "
        >
          {{ copy.confirmPayment }}
        </h2>
      </div>
      <div class="flex flex-col gap-2">
        <span class="text-sm text-base-foreground">
          {{ plan.name }}
        </span>
        <div class="flex items-baseline gap-2">
          <span
            class="text-2xl font-semibold text-base-foreground tabular-nums"
          >
            ${{ displayPrice }}
          </span>
          <span class="text-base text-base-foreground">
            {{ copy.usdPerMonth }}
          </span>
        </div>
        <span class="text-muted-foreground">
          {{
            isYearly
              ? copy.billedYearly(annualTotalFormatted)
              : copy.billedMonthly
          }}
        </span>
        <span class="text-muted-foreground">
          {{ copy.startingToday }}
        </span>
      </div>

      <div
        :class="
          cn(
            'flex flex-col gap-3 pt-16 pb-8',
            usePaymentElement && 'xl:pt-6 xl:pb-4'
          )
        "
      >
        <div class="flex items-center justify-between">
          <span class="text-base-foreground">
            {{
              isYearly
                ? copy.eachYearCreditsRefill
                : copy.eachMonthCreditsRefill
            }}
          </span>
          <div class="flex items-center gap-1">
            <i class="icon-[lucide--coins] size-4 shrink-0 bg-credit" />
            <span class="font-bold text-base-foreground tabular-nums">
              {{ refillCredits }}
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="totalDueToday"
        :class="
          cn(
            'flex flex-col gap-2 border-t border-border-subtle pt-8',
            usePaymentElement && 'xl:pt-6'
          )
        "
      >
        <div class="flex items-center justify-between text-base">
          <span class="text-base-foreground">
            {{ copy.totalDueToday }}
          </span>
          <span class="font-bold text-base-foreground tabular-nums">
            {{ totalDueToday }}
          </span>
        </div>
        <span class="text-sm text-muted-foreground">
          {{ renewalTerms }}
        </span>
      </div>
      <div
        v-if="previewData?.discounts?.length"
        class="flex flex-col gap-2 pt-4 text-sm"
      >
        <div
          v-for="discount in previewData.discounts"
          :key="`${discount.kind}:${discount.code}`"
          class="flex items-center justify-between text-muted-foreground"
        >
          <span>{{ copy.discount[discount.kind] }}</span>
          <span class="text-base-foreground">
            {{ discount.name || discount.code
            }}<template v-if="discount.amount_off_cents">
              · −{{
                formatQuoteMoney(
                  discount.amount_off_cents,
                  previewData?.currency,
                  locale
                )
              }}</template
            >
          </span>
        </div>
      </div>
      <CheckoutPromotionCode
        v-if="embeddedCheckoutEnabled"
        :applied-code="previewData?.promotion_code"
        :disabled="interactionLocked"
        :copy
        @apply="emit('applyPromotionCode', $event)"
        @invalidate="emit('invalidateQuote')"
      />
      <CheckoutSavedMethods
        v-if="embeddedCheckoutEnabled && savedMethods?.length"
        v-model:selected-method-id="selectedSavedMethodId"
        :methods="savedMethods"
        :copy="copy.savedMethod"
        @change-payment-method="emit('changePaymentMethod')"
      />
    </div>

    <div
      :class="
        cn(
          'flex flex-col gap-2 pt-8 pb-4',
          captureMode && 'xl:min-h-0 xl:min-w-0 xl:flex-1 xl:px-16 xl:py-10',
          // Match the summary panel's 24px edge inset (root p-4 provides 16).
          captureMode && 'max-xl:px-2'
        )
      "
    >
      <CheckoutPaymentNotices
        :embedded-checkout-enabled
        :reconciliation-operation-id
        :authentication-state
        :authentication-error
        :copy
      />

      <div v-if="parkedCheckoutRecovery" class="flex flex-col gap-2">
        <div
          role="alert"
          class="rounded-lg border border-interface-stroke bg-secondary-background p-4 text-sm text-base-foreground"
        >
          {{ copy.parkedCheckoutDetail }}
        </div>
        <CheckoutButton
          variant="inverted"
          size="lg"
          class="w-full rounded-lg"
          :loading="isLoading"
          :disabled="payDisabled"
          @click="emit('addCreditCard')"
        >
          {{ copy.completePayment }}
        </CheckoutButton>
      </div>

      <CheckoutVerificationPrompt
        v-if="verificationOffered && actionUrl"
        :action-url
        :copy
      />

      <CheckoutPaymentForm
        v-if="captureMode && quoteReady && !parkedCheckoutRecovery"
        :key="`${previewData?.quote_id}:${previewData?.quote_version}`"
        :publishable-key
        :amount-cents="amountDueCents"
        :currency="previewData?.currency ?? ''"
        :copy="copy.payment"
        :submit-label="copy.payAndSubscribe"
        :payment-method-configuration-id="
          previewData?.payment_method_configuration_id ?? ''
        "
        :is-loading
        :verification-pending="Boolean(actionUrl) || verificationRecoveryActive"
        :can-submit="quoteIsCurrent"
        :theme-key
        @submitting-change="stripeSubmissionPending = $event"
        @confirm="emit('confirmPayment', $event)"
        @phase="emit('paymentPhase', $event)"
      />

      <CheckoutButton
        v-if="
          (captureMode && !quoteReady && !parkedCheckoutRecovery) ||
          (savedMethods?.length && !parkedCheckoutRecovery)
        "
        variant="inverted"
        size="lg"
        class="w-full rounded-lg"
        :loading="isLoading"
        :disabled="payDisabled"
        @click="emit('addCreditCard')"
      >
        {{ copy.payAndSubscribe }}
      </CheckoutButton>

      <CheckoutButton
        v-if="
          !usePaymentElement && !savedMethods?.length && !parkedCheckoutRecovery
        "
        variant="tertiary"
        size="lg"
        class="w-full rounded-lg"
        :loading="isLoading"
        :disabled="payDisabled"
        @click="emit('addCreditCard')"
      >
        {{ copy.subscribeToPlan(plan.name) }}
      </CheckoutButton>

      <CheckoutTermsNote class="mt-2" :copy="copy.terms" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The confirm step of a new subscription: the plan and today's charge on one
 * side, and the way to pay on the other — the card form, the saved methods
 * that stand in for it, or a hosted continuation the host opens.
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
import CheckoutPaymentForm from './CheckoutPaymentForm.vue'
import CheckoutPaymentNotices from './CheckoutPaymentNotices.vue'
import CheckoutPromotionCode from './CheckoutPromotionCode.vue'
import CheckoutSavedMethods from './CheckoutSavedMethods.vue'
import CheckoutTermsNote from './CheckoutTermsNote.vue'
import CheckoutVerificationPrompt from './CheckoutVerificationPrompt.vue'
import type { CheckoutCopy } from './checkoutCopy'
import type { CheckoutBillingCycle, CheckoutPlan } from './checkoutQuote'
import {
  formatAmountDueToday,
  formatNumber,
  formatQuoteMoney,
  formatRenewalAmount,
  isYearlyCheckout,
  resolveRenewalDate
} from './checkoutQuote'
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
  embeddedCheckoutEnabled = false
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
const payDisabled = computed(
  () =>
    interactionLocked.value ||
    !quoteIsUsable.value ||
    verificationRecoveryActive.value
)

const isYearly = computed(() =>
  isYearlyCheckout(previewData?.new_plan.duration, billingCycle)
)
const quotedPrice = computed(() =>
  plan.pricedByQuote ? previewData?.new_plan : undefined
)

const displayPrice = computed(() => {
  if (quotedPrice.value) {
    const cents = quotedPrice.value.price_cents
    return ((isYearly.value ? cents / 12 : cents) / 100).toFixed(0)
  }
  return formatNumber(
    isYearly.value ? plan.monthlyPriceUsd.yearly : plan.monthlyPriceUsd.monthly,
    locale
  )
})

const annualTotalFormatted = computed(() => {
  const usd = quotedPrice.value
    ? quotedPrice.value.price_cents / 100
    : plan.monthlyPriceUsd.yearly * 12
  return `$${formatNumber(usd, locale)}`
})

const refillCredits = computed(() =>
  formatNumber(
    isYearly.value ? plan.monthlyCredits * 12 : plan.monthlyCredits,
    locale
  )
)

const totalDueToday = computed(() =>
  previewData ? formatAmountDueToday(previewData, locale) : ''
)

const renewalTerms = computed(() => {
  if (!previewData) return ''
  const amount = formatRenewalAmount(previewData, locale)
  if (!amount) return ''
  const renewsAt = resolveRenewalDate(previewData)
  if (!renewsAt) return copy.renewsAtAmount(amount)
  const date = new Date(renewsAt).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  })
  return copy.renewsAt(amount, date)
})
</script>
