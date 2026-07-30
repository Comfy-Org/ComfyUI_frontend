<template>
  <div
    class="flex flex-col gap-6 rounded-2xl border border-border-default bg-secondary-background p-6 shadow-sm"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex items-start gap-3">
        <div
          class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-background text-white"
        >
          <i class="icon-[lucide--credit-card] size-5" />
        </div>
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
        class="shrink-0 rounded-xl border border-border-subtle bg-base-background px-4 py-2 text-right"
      >
        <p class="m-0 text-xs text-muted-foreground">
          {{ $t('subscription.preview.planPrice') }}
        </p>
        <p class="m-0 mt-1 font-semibold text-base-foreground">
          {{ formattedAmount }}
        </p>
      </div>
    </div>
    <div
      v-if="configurationError"
      class="border-danger-background bg-danger-background/10 text-danger rounded-lg border px-3 py-2 text-sm"
    >
      {{ configurationError }}
    </div>
    <div
      class="rounded-xl border border-border-subtle bg-base-background p-4 shadow-sm"
    >
      <div ref="paymentElementTarget" />
    </div>
    <div
      class="flex flex-col gap-3 rounded-xl border border-border-subtle bg-base-background p-4"
    >
      <div class="flex items-center gap-2">
        <i
          class="icon-[lucide--badge-percent] size-4 text-primary-background"
        />
        <label class="text-sm font-medium text-base-foreground">
          {{ $t('subscription.preview.promotionCode') }}
        </label>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          v-model="promotionCode"
          class="min-w-0 flex-1"
          :placeholder="$t('subscription.preview.promotionCodePlaceholder')"
          autocomplete="off"
        />
        <p class="m-0 text-xs text-muted-foreground sm:max-w-52">
          {{ $t('subscription.preview.promotionCodeHelp') }}
        </p>
      </div>
    </div>
    <div
      class="flex items-start gap-3 rounded-xl bg-base-background/60 px-4 py-3 text-xs text-muted-foreground"
    >
      <i
        class="text-success-foreground mt-0.5 icon-[lucide--shield-check] size-4 shrink-0"
      />
      <p class="m-0">
        {{ $t('subscription.preview.alipayRenewalNote') }}
      </p>
    </div>
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'

const { amountCents, isLoading = false } = defineProps<{
  amountCents: number
  isLoading?: boolean
}>()

const emit = defineEmits<{
  confirm: [confirmationToken: string, promotionCode?: string]
}>()

const { t } = useI18n()
const paymentElementTarget = ref<HTMLDivElement>()
const stripeElements = ref<StripeElements>()
const configurationError = ref('')
const promotionCode = ref('')
const isSubmitting = ref(false)
const formattedAmount = computed(() =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD'
  }).format(amountCents / 100)
)
let stripe: Stripe | null = null
let paymentElement: StripePaymentElement | undefined
let isUnmounted = false

onMounted(async () => {
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  const paymentMethodConfiguration = import.meta.env
    .VITE_STRIPE_PAYMENT_METHOD_CONFIGURATION_ID
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
    appearance: {
      variables: {
        colorPrimary: resolveThemeColor('--primary-background'),
        colorBackground: resolveThemeColor('--base-background'),
        colorText: resolveThemeColor('--base-foreground'),
        colorTextSecondary: resolveThemeColor('--muted-foreground'),
        colorDanger: resolveThemeColor('--destructive-background'),
        fontFamily: getComputedStyle(document.body).fontFamily,
        borderRadius: '10px',
        spacingUnit: '5px'
      },
      rules: {
        '.AccordionItem': {
          border: `1px solid ${resolveThemeColor('--border-subtle')}`,
          boxShadow: 'none'
        },
        '.AccordionItem--selected': {
          borderColor: resolveThemeColor('--primary-background')
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
    },
    ...(paymentMethodConfiguration && { paymentMethodConfiguration })
  })
  paymentElement = stripeElements.value.create('payment', {
    layout: {
      type: 'accordion',
      defaultCollapsed: false,
      radios: 'always',
      spacedAccordionItems: true
    }
  })
  paymentElement.mount(paymentElementTarget.value)
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
    emit(
      'confirm',
      result.confirmationToken.id,
      promotionCode.value.trim() || undefined
    )
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
