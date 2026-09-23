<template>
  <StripePaymentForm
    :publishable-key="publishableKey"
    :amount-cents
    :currency
    :copy
    :payment-method-configuration-id="paymentMethodConfigurationId"
    :is-loading
    :verification-pending
    :can-submit
    @confirm="emit('confirm', $event)"
    @submitting-change="emit('submittingChange', $event)"
    @phase="emitPaymentJourneyPhase"
  >
    <template #submit="{ disabled, loading, verificationPending: pending }">
      <Button
        type="submit"
        :variant="pending ? 'tertiary' : 'inverted'"
        size="lg"
        class="w-full rounded-lg"
        :disabled="disabled"
        :loading="loading"
      >
        {{ t('subscription.preview.payAndSubscribe') }}
      </Button>
    </template>
  </StripePaymentForm>
</template>

<script setup lang="ts">
/**
 * The cloud app's binding of the shared payment form: its publishable key, its
 * translations, its button, and its checkout-journey telemetry. The provider
 * work lives in `@comfyorg/account-ui/billing/stripe` so `apps/billing-web`
 * renders the same form (ADR-PACKAGES-ACCOUNT-UI-0034).
 */
import type { StripePaymentPhase } from '@comfyorg/account-ui/billing/stripe'
import { StripePaymentForm } from '@comfyorg/account-ui/billing/stripe'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useTelemetry } from '@/platform/telemetry'
import {
  getActiveCheckoutJourney,
  toCheckoutJourneyContext
} from '@/platform/workspace/utils/checkoutJourney'

const {
  amountCents,
  currency,
  paymentMethodConfigurationId = '',
  isLoading = false,
  verificationPending = false,
  canSubmit = true
} = defineProps<{
  amountCents: number
  currency: string
  /** Stripe payment method configuration governing which methods Elements
   *  offers (served per-environment by the preview). */
  paymentMethodConfigurationId?: string
  isLoading?: boolean
  /** A 3DS verification is pending: Complete verification (rendered by the
   *  parent) is the primary action, so the pay button steps back. */
  verificationPending?: boolean
  canSubmit?: boolean
}>()

const emit = defineEmits<{
  confirm: [confirmationToken: string]
  submittingChange: [submitting: boolean]
}>()

const { t } = useI18n()
const telemetry = useTelemetry()

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? ''

const copy = computed(() => ({
  paymentMethod: t('subscription.preview.paymentMethod'),
  methodChoice: t('subscription.preview.stripeMethodChoice'),
  billingAddress: t('subscription.preview.billingAddress'),
  alipayRenewalNote: t('subscription.preview.alipayRenewalNote'),
  unavailable: t('subscription.preview.stripeUnavailable'),
  genericError: t('g.error')
}))

function emitPaymentJourneyPhase(phase: StripePaymentPhase): void {
  // The form stops reporting once unmounted; what it cannot know is whether
  // the active journey is still the one this checkout started.
  const journey = getActiveCheckoutJourney()
  if (!journey) return
  telemetry?.trackCheckoutJourneyEvent({
    ...toCheckoutJourneyContext(journey),
    ...phase
  })
}
</script>
