<template>
  <div class="flex flex-col gap-4 rounded-lg border border-border-subtle p-4">
    <div>
      <h3 class="m-0 text-base font-semibold text-base-foreground">
        {{ $t('subscription.preview.paymentMethod') }}
      </h3>
      <p class="m-0 mt-1 text-sm text-muted-foreground">
        {{ $t('subscription.preview.stripeMethodChoice') }}
      </p>
    </div>
    <div v-if="configurationError" class="text-sm text-error">
      {{ configurationError }}
    </div>
    <div ref="paymentElementTarget" />
    <p class="m-0 text-xs text-muted-foreground">
      {{ $t('subscription.preview.alipayRenewalNote') }}
    </p>
    <Button
      size="lg"
      class="w-full rounded-lg"
      :disabled="!stripeElements"
      :loading="isLoading || isSubmitting"
      @click="submit"
    >
      {{ $t('subscription.preview.payAndSubscribe') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { loadStripe } from '@stripe/stripe-js'
import type {
  Stripe,
  StripeElements,
  StripePaymentElement
} from '@stripe/stripe-js'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

const { amountCents, isLoading = false } = defineProps<{
  amountCents: number
  isLoading?: boolean
}>()

const emit = defineEmits<{
  confirm: [confirmationToken: string]
}>()

const { t } = useI18n()
const paymentElementTarget = ref<HTMLDivElement>()
const stripeElements = ref<StripeElements>()
const configurationError = ref('')
const isSubmitting = ref(false)
let stripe: Stripe | null = null
let paymentElement: StripePaymentElement | undefined

onMounted(async () => {
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (!publishableKey) {
    configurationError.value = t('subscription.preview.stripeUnavailable')
    return
  }

  stripe = await loadStripe(publishableKey)
  if (!stripe || !paymentElementTarget.value) {
    configurationError.value = t('subscription.preview.stripeUnavailable')
    return
  }

  stripeElements.value = stripe.elements({
    mode: 'subscription',
    amount: amountCents,
    currency: 'usd',
    setupFutureUsage: 'off_session'
  })
  paymentElement = stripeElements.value.create('payment', {
    layout: 'accordion'
  })
  paymentElement.mount(paymentElementTarget.value)
})

onBeforeUnmount(() => paymentElement?.destroy())

async function submit() {
  if (!stripeElements.value || !stripe) return
  isSubmitting.value = true
  configurationError.value = ''
  try {
    const submitResult = await stripeElements.value.submit()
    if (submitResult.error) {
      configurationError.value = submitResult.error.message ?? t('g.error')
      return
    }
    const result = await stripe.createConfirmationToken({
      elements: stripeElements.value
    })
    if (result.error) {
      configurationError.value = result.error.message ?? t('g.error')
      return
    }
    emit('confirm', result.confirmationToken.id)
  } finally {
    isSubmitting.value = false
  }
}
</script>
