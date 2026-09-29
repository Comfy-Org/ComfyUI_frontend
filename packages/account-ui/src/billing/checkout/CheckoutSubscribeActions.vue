<template>
  <CheckoutPaymentNotices
    :embedded-checkout-enabled
    :reconciliation-operation-id
    :authentication-state
    :authentication-error
    :copy
  />

  <div v-if="payAction === 'parked'" class="flex flex-col gap-2">
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
    v-if="verificationUrl"
    :action-url="verificationUrl"
    :copy
  />

  <CheckoutPaymentForm
    v-if="payAction === 'form' && previewData"
    :key="`${previewData.quote_id}:${previewData.quote_version}`"
    :publishable-key
    :amount-cents="previewData.amount_due_cents ?? 0"
    :currency="previewData.currency ?? ''"
    :copy="copy.payment"
    :submit-label="copy.payAndSubscribe"
    :payment-method-configuration-id="
      previewData.payment_method_configuration_id ?? ''
    "
    :is-loading
    :verification-pending
    :can-submit="quoteIsCurrent"
    :theme-key
    @submitting-change="emit('submittingChange', $event)"
    @confirm="emit('confirmPayment', $event)"
    @phase="emit('paymentPhase', $event)"
  />

  <CheckoutButton
    v-if="payAction === 'pay' || payAction === 'subscribe'"
    :variant="payAction === 'pay' ? 'inverted' : 'tertiary'"
    size="lg"
    class="w-full rounded-lg"
    :loading="isLoading"
    :disabled="payDisabled"
    @click="emit('addCreditCard')"
  >
    {{
      payAction === 'pay'
        ? copy.payAndSubscribe
        : copy.subscribeToPlan(planName)
    }}
  </CheckoutButton>

  <CheckoutTermsNote class="mt-2" :copy="copy.terms" />
</template>

<script setup lang="ts">
/**
 * The new-subscription confirm's pay column: what an earlier attempt left to
 * read or finish, then the one way to pay `payAction` names, then the terms.
 */
import type {
  BillingAuthenticationState,
  SubscriptionPreview
} from '@comfyorg/account-core/billing'

import type { StripePaymentPhase } from '../stripe/stripePaymentPhase'
import CheckoutButton from './CheckoutButton.vue'
import CheckoutPaymentForm from './CheckoutPaymentForm.vue'
import CheckoutPaymentNotices from './CheckoutPaymentNotices.vue'
import CheckoutTermsNote from './CheckoutTermsNote.vue'
import CheckoutVerificationPrompt from './CheckoutVerificationPrompt.vue'
import type { CheckoutCopy } from './checkoutCopy'
import type { CheckoutPayAction } from './checkoutRecovery'

const {
  payAction,
  copy,
  planName,
  previewData,
  publishableKey,
  themeKey,
  isLoading,
  payDisabled,
  verificationUrl,
  verificationPending,
  quoteIsCurrent,
  embeddedCheckoutEnabled,
  reconciliationOperationId,
  authenticationState,
  authenticationError
} = defineProps<{
  payAction: CheckoutPayAction
  copy: CheckoutCopy
  planName: string
  previewData: SubscriptionPreview | null
  publishableKey: string
  themeKey?: string
  isLoading: boolean
  payDisabled: boolean
  /** Set while a 3DS verification is on offer. */
  verificationUrl: string | null
  verificationPending: boolean
  quoteIsCurrent: boolean
  embeddedCheckoutEnabled: boolean
  reconciliationOperationId: string | null
  authenticationState: BillingAuthenticationState | null
  authenticationError: string | null
}>()

const emit = defineEmits<{
  addCreditCard: []
  confirmPayment: [confirmationToken: string]
  submittingChange: [submitting: boolean]
  paymentPhase: [phase: StripePaymentPhase]
}>()
</script>
