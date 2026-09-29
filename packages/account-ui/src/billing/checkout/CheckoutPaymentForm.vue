<template>
  <StripePaymentForm
    :publishable-key
    :amount-cents
    :currency
    :copy
    :payment-method-configuration-id
    :is-loading
    :verification-pending
    :can-submit
    :theme-key
    @confirm="emit('confirm', $event)"
    @submitting-change="emit('submittingChange', $event)"
    @phase="emit('phase', $event)"
  >
    <template #submit="{ disabled, loading, verificationPending: pending }">
      <CheckoutButton
        type="submit"
        :variant="pending ? 'tertiary' : 'inverted'"
        size="lg"
        class="w-full rounded-lg"
        :disabled
        :loading
      >
        {{ submitLabel }}
      </CheckoutButton>
    </template>
  </StripePaymentForm>
</template>

<script setup lang="ts">
/**
 * The payment form with the checkout's pay button: the card entry both the
 * cloud app and billing-web show when no saved method stands in for it.
 */
import StripePaymentForm from '../stripe/StripePaymentForm.vue'
import type {
  StripePaymentCopy,
  StripePaymentPhase
} from '../stripe/stripePaymentPhase'
import CheckoutButton from './CheckoutButton.vue'

const {
  publishableKey,
  amountCents,
  currency,
  copy,
  submitLabel,
  paymentMethodConfigurationId = '',
  isLoading = false,
  verificationPending = false,
  canSubmit = true,
  themeKey
} = defineProps<{
  publishableKey: string
  amountCents: number
  currency: string
  copy: StripePaymentCopy
  submitLabel: string
  /** Governs which methods Elements offers (served per environment). */
  paymentMethodConfigurationId?: string
  isLoading?: boolean
  /** A 3DS verification is pending: the pay button steps back. */
  verificationPending?: boolean
  canSubmit?: boolean
  themeKey?: string
}>()

const emit = defineEmits<{
  confirm: [confirmationToken: string]
  submittingChange: [submitting: boolean]
  phase: [phase: StripePaymentPhase]
}>()
</script>
