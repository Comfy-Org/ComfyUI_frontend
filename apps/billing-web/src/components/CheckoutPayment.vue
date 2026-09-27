<script setup lang="ts">
/**
 * The payment step before a subscribe: the Stripe card form when the plan
 * needs a new payment method, otherwise just the pay action, which the server
 * charges to the saved method on file.
 */
import type { StripePaymentCopy } from '@comfyorg/account-ui/billing/stripe'
import { StripePaymentForm } from '@comfyorg/account-ui/billing/stripe'

import CheckoutSubmit from '@/components/CheckoutSubmit.vue'

const {
  needsPaymentMethod,
  publishableKey,
  amountCents,
  currency,
  copy,
  paymentMethodConfigurationId,
  submitting,
  canSubmit,
  reactivationRequired,
  failure
} = defineProps<{
  needsPaymentMethod: boolean
  publishableKey: string
  amountCents: number
  currency: string
  copy: StripePaymentCopy
  paymentMethodConfigurationId: string
  submitting: boolean
  canSubmit: boolean
  reactivationRequired: boolean
  failure?: string
}>()

const confirmed = defineModel<boolean>('confirmed', { required: true })

const emit = defineEmits<{
  confirm: [confirmationToken?: string]
}>()
</script>

<template>
  <StripePaymentForm
    v-if="needsPaymentMethod"
    :publishable-key="publishableKey"
    :amount-cents="amountCents"
    :currency="currency"
    :copy="copy"
    :payment-method-configuration-id="paymentMethodConfigurationId"
    :is-loading="submitting"
    :can-submit="canSubmit"
    @confirm="emit('confirm', $event)"
  >
    <template #submit="{ disabled, loading }">
      <CheckoutSubmit
        v-model:confirmed="confirmed"
        :amount-cents="amountCents"
        :disabled="disabled"
        :submitting="loading"
        :reactivation-required="reactivationRequired"
        :failure="failure"
      />
    </template>
  </StripePaymentForm>
  <form
    v-else
    class="flex min-h-0 flex-col gap-6 xl:flex-1"
    @submit.prevent="emit('confirm')"
  >
    <CheckoutSubmit
      v-model:confirmed="confirmed"
      :amount-cents="amountCents"
      :disabled="!canSubmit"
      :submitting="submitting"
      :reactivation-required="reactivationRequired"
      :failure="failure"
    />
  </form>
</template>
