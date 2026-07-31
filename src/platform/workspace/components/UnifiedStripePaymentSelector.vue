<template>
  <div class="flex min-h-0 flex-col gap-6 xl:flex-1">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h3 class="m-0 text-base font-semibold text-base-foreground">
          {{ $t('subscription.preview.paymentMethod') }}
        </h3>
        <p class="m-0 mt-1 max-w-md text-sm text-muted-foreground">
          {{ $t('subscription.preview.stripeMethodChoice') }}
        </p>
      </div>
    </div>
    <div
      v-if="configurationError"
      class="border-danger-background bg-danger-background/10 text-danger rounded-lg border px-3 py-2 text-sm"
    >
      {{ configurationError }}
    </div>
    <!-- Only the form region scrolls; the header above and the pay action
         below hold their positions regardless of which method is expanded. -->
    <div
      class="flex flex-col gap-6 xl:min-h-0 xl:flex-1 xl:overflow-x-hidden xl:overflow-y-auto xl:pr-1"
    >
      <div ref="paymentElementTarget" />
      <div
        v-if="selectedMethodType === 'alipay'"
        class="flex items-start gap-3 rounded-xl bg-base-background/60 px-4 py-3 text-xs text-muted-foreground"
      >
        <i
          class="text-success-foreground mt-0.5 icon-[lucide--shield-check] size-4 shrink-0"
        />
        <p class="m-0">
          {{ $t('subscription.preview.alipayRenewalNote') }}
        </p>
      </div>
    </div>
    <Button
      :variant="verificationPending ? 'tertiary' : 'inverted'"
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

const {
  amountCents,
  isLoading = false,
  verificationPending = false
} = defineProps<{
  amountCents: number
  isLoading?: boolean
  /** A 3DS verification is pending: Complete verification (rendered by the
   *  parent) is the primary action, so the pay button steps back. */
  verificationPending?: boolean
}>()

const emit = defineEmits<{
  confirm: [confirmationToken: string]
}>()

const { t } = useI18n()
const paymentElementTarget = ref<HTMLDivElement>()
const stripeElements = ref<StripeElements>()
const configurationError = ref('')
const isSubmitting = ref(false)
const selectedMethodType = ref('')
let stripe: Stripe | null = null
let paymentElement: StripePaymentElement | undefined
let isUnmounted = false

onMounted(async () => {
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (!publishableKey || amountCents <= 0) {
    configurationError.value = t('subscription.preview.stripeUnavailable')
    return
  }

  stripe = await loadStripe(publishableKey)
  if (!stripe || !paymentElementTarget.value || isUnmounted) {
    configurationError.value = t('subscription.preview.stripeUnavailable')
    return
  }

  stripeElements.value = stripe.elements({
    mode: 'subscription',
    amount: amountCents,
    currency: 'usd',
    setupFutureUsage: 'off_session',
    paymentMethodTypes: ['card', 'alipay'],
    appearance: {
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
        fontFamily: getComputedStyle(document.body).fontFamily,
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
  })
  paymentElement = stripeElements.value.create('payment', {
    layout: {
      type: 'accordion',
      defaultCollapsed: false,
      radios: 'always',
      spacedAccordionItems: true
    },
    // Our terms note carries the recurring-charge authorization; Stripe's
    // card mandate text would say it twice.
    terms: { card: 'never' }
  })
  paymentElement.mount(paymentElementTarget.value)
  // Method-specific notes (e.g. the Alipay auto-renewal disclosure) key off
  // whichever payment method the user has selected inside the element.
  paymentElement.on('change', (event) => {
    selectedMethodType.value = event.value?.type ?? ''
  })
})

onBeforeUnmount(() => {
  isUnmounted = true
  paymentElement?.destroy()
})

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
  } catch {
    configurationError.value = t('g.error')
  } finally {
    isSubmitting.value = false
  }
}

function resolveThemeColor(variable: string) {
  const probe = document.createElement('span')
  probe.style.color = `var(${variable})`
  document.body.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}
</script>
