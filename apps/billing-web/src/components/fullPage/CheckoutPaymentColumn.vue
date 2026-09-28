<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  StripePaymentCopy,
  StripePaymentPhase
} from '@comfyorg/account-ui/billing/stripe'
import { StripePaymentForm } from '@comfyorg/account-ui/billing/stripe'

import type { CheckoutPage } from '@/checkout/checkoutPage'
import CheckoutPayAction from '@/components/fullPage/CheckoutPayAction.vue'
import PaymentFormError from '@/components/fullPage/PaymentFormError.vue'

export interface CheckoutCharge {
  readonly amountCents: number
  readonly currency: string
  readonly paymentMethodConfigurationId: string
}

const { page, charge, publishableKey, canPay, submitting, failure } =
  defineProps<{
    page: Extract<CheckoutPage, { kind: 'resolving' | 'capture' }>
    charge?: CheckoutCharge
    publishableKey: string
    canPay: boolean
    submitting: boolean
    failure?: string
  }>()

const emit = defineEmits<{
  phase: [phase: StripePaymentPhase]
  pay: [confirmationToken?: string]
  retry: []
}>()

const { t } = useI18n()

const copy = computed<StripePaymentCopy>(() => ({
  paymentMethod: t('checkout.paymentMethod'),
  methodChoice: t('checkout.methodChoice'),
  billingAddress: t('checkout.billingAddress'),
  alipayRenewalNote: t('checkout.alipayRenewalNote'),
  unavailable: t('checkout.unavailable'),
  genericError: t('checkout.genericError')
}))
</script>

<template>
  <section class="flex lg:w-1/2">
    <div class="flex w-full flex-col px-6 py-12 lg:max-w-lg lg:px-16">
      <div v-if="page.kind === 'resolving'" class="flex flex-col gap-6">
        <h3 class="m-0 text-base font-semibold text-base-foreground">
          {{ t('checkout.paymentMethod') }}
        </h3>
        <div class="h-84 rounded-lg bg-secondary-background-hover" />
        <h4 class="m-0 text-sm font-medium text-base-foreground">
          {{ t('checkout.billingAddress') }}
        </h4>
        <div class="h-84 rounded-lg bg-secondary-background-hover" />
        <CheckoutPayAction disabled />
      </div>
      <PaymentFormError
        v-else-if="
          page.rail.method === 'new_card' && page.rail.element === 'failed'
        "
        @retry="emit('retry')"
      />
      <StripePaymentForm
        v-else-if="page.rail.method === 'new_card' && charge"
        :publishable-key
        :amount-cents="charge.amountCents"
        :currency="charge.currency"
        :copy
        :payment-method-configuration-id="charge.paymentMethodConfigurationId"
        :is-loading="submitting"
        :can-submit="canPay"
        @phase="emit('phase', $event)"
        @confirm="emit('pay', $event)"
      >
        <template #submit="{ disabled, loading }">
          <CheckoutPayAction :disabled :loading :failure />
        </template>
      </StripePaymentForm>
      <form
        v-else-if="page.rail.method === 'on_file'"
        class="flex flex-col gap-6"
        @submit.prevent="emit('pay')"
      >
        <CheckoutPayAction :disabled="!canPay" :loading="submitting" :failure />
      </form>
    </div>
  </section>
</template>
