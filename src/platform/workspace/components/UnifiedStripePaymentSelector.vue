<template>
  <div class="flex flex-col gap-4 rounded-lg border border-border-subtle p-4">
    <div>
      <h3 class="m-0 text-base font-semibold text-base-foreground">
        {{ $t('subscription.preview.paymentMethod') }}
      </h3>
      <p class="m-0 mt-1 text-sm text-muted-foreground">
        {{
          $t(
            hasStripeConfiguration
              ? 'subscription.preview.stripeMethodChoice'
              : 'subscription.preview.prototypeMethodChoice'
          )
        }}
      </p>
    </div>
    <div v-if="configurationError" class="text-sm text-error">
      {{ configurationError }}
    </div>
    <div v-if="!hasStripeConfiguration" class="flex flex-col gap-3">
      <div
        class="rounded-lg border border-border-subtle bg-secondary-background p-3"
      >
        <p class="m-0 font-semibold text-base-foreground">
          {{ $t('subscription.preview.interactivePrototype') }}
        </p>
        <p class="m-0 mt-1 text-sm text-muted-foreground">
          {{ $t('subscription.preview.prototypeNoProvider') }}
        </p>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="method in prototypeMethods"
          :key="method"
          type="button"
          :aria-pressed="selectedPrototypeMethod === method"
          :class="
            cn(
              'cursor-pointer rounded-lg border bg-transparent p-3 text-left text-sm text-base-foreground',
              selectedPrototypeMethod === method
                ? 'border-primary-background bg-secondary-background'
                : 'border-border-subtle'
            )
          "
          @click="selectPrototypeMethod(method)"
        >
          {{ $t(`subscription.preview.${method}`) }}
        </button>
      </div>
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t(`subscription.preview.${selectedPrototypeMethod}PrototypeNote`) }}
      </p>
      <Button variant="secondary" class="w-full" @click="previewHandoff">
        {{ $t('subscription.preview.previewHandoff') }}
      </Button>
      <p v-if="prototypeStatus" class="m-0 text-sm text-base-foreground">
        {{ prototypeStatus }}
      </p>
    </div>
    <div v-else ref="paymentElementTarget" />
    <p class="m-0 text-xs text-muted-foreground">
      {{ $t('subscription.preview.alipayRenewalNote') }}
    </p>
    <Button
      size="lg"
      class="w-full rounded-lg"
      :disabled="!elements"
      :loading="isLoading || isSubmitting"
      @click="submit"
    >
      {{
        $t(
          hasStripeConfiguration
            ? 'subscription.preview.payAndSubscribe'
            : 'subscription.preview.livePaymentUnavailable'
        )
      }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { loadStripe } from '@stripe/stripe-js'
import type { StripeElements, StripePaymentElement } from '@stripe/stripe-js'
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
const hasStripeConfiguration = Boolean(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
)
const prototypeMethods = ['card', 'alipay'] as const
type PrototypeMethod = (typeof prototypeMethods)[number]
const paymentElementTarget = ref<HTMLDivElement>()
const elements = ref<StripeElements>()
const configurationError = ref('')
const isSubmitting = ref(false)
const selectedPrototypeMethod = ref<PrototypeMethod>('card')
const prototypeStatus = ref('')
let paymentElement: StripePaymentElement | undefined

onMounted(async () => {
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (!publishableKey) {
    return
  }

  const stripe = await loadStripe(publishableKey)
  if (!stripe || !paymentElementTarget.value) {
    configurationError.value = t('subscription.preview.stripeUnavailable')
    return
  }

  elements.value = stripe.elements({
    mode: 'subscription',
    amount: Math.max(amountCents, 50),
    currency: 'usd',
    setupFutureUsage: 'off_session'
  })
  const element = elements.value.create('payment', {
    layout: 'accordion'
  })
  element.mount(paymentElementTarget.value)
  paymentElement = element
})

onBeforeUnmount(() => paymentElement?.destroy())

function selectPrototypeMethod(method: PrototypeMethod) {
  selectedPrototypeMethod.value = method
  prototypeStatus.value = ''
}

function previewHandoff() {
  prototypeStatus.value = t(
    `subscription.preview.${selectedPrototypeMethod.value}PrototypeStatus`
  )
}

async function submit() {
  if (!elements.value) return
  isSubmitting.value = true
  configurationError.value = ''
  try {
    const submitResult = await elements.value.submit()
    if (submitResult.error) {
      configurationError.value = submitResult.error.message ?? t('g.error')
      return
    }
    const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
    if (!stripe) return
    const result = await stripe.createConfirmationToken({
      elements: elements.value
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
