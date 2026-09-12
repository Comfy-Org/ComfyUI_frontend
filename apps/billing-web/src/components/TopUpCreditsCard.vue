<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { usdToCredits } from '@comfyorg/shared-frontend-utils/creditsUtil'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

const { checkoutEnabled = true } = defineProps<{
  checkoutEnabled?: boolean
}>()

const emit = defineEmits<{
  checkout: [amountCents: number]
}>()

const presetAmounts = [10, 25, 50, 100]
const minimumAmount = 5
const maximumAmount = 10_000
const creditsPerDollar = usdToCredits(1)

const { n, t } = useI18n()
const amountInputId = useId()
const amountHintId = `${amountInputId}-hint`
const amountUsd = ref(50)

const credits = computed(() => usdToCredits(amountUsd.value))
const isValidAmount = computed(
  () => amountUsd.value >= minimumAmount && amountUsd.value <= maximumAmount
)
const amountError = computed(() => {
  if (amountUsd.value < minimumAmount) {
    return t('billing.minimumPurchase', { amount: minimumAmount })
  }
  if (amountUsd.value > maximumAmount) {
    return t('billing.maximumPurchase', {
      amount: n(maximumAmount)
    })
  }
  return null
})

function formatUsd(amount: number): string {
  return n(amount, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
}

function getStepAmount(amount: number): number {
  if (amount < 100) return 5
  if (amount < 1000) return 50
  return 100
}

function selectAmount(amount: number) {
  amountUsd.value = amount
}

function handleAmountInput(event: Event) {
  const input = event.target as HTMLInputElement
  amountUsd.value = Number.isNaN(input.valueAsNumber)
    ? 0
    : Math.round(input.valueAsNumber)
}

function decreaseAmount() {
  amountUsd.value = Math.max(
    0,
    amountUsd.value - getStepAmount(amountUsd.value)
  )
}

function increaseAmount() {
  amountUsd.value = Math.min(
    maximumAmount,
    amountUsd.value + getStepAmount(amountUsd.value)
  )
}

function requestCheckout() {
  if (!checkoutEnabled || !isValidAmount.value) return
  emit('checkout', amountUsd.value * 100)
}
</script>

<template>
  <section
    aria-labelledby="top-up-heading"
    class="w-full overflow-hidden rounded-3xl border border-border-default bg-base-background shadow-2xl shadow-black/30"
  >
    <div class="border-b border-border-subtle p-6 sm:px-8">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="m-0 text-sm font-medium text-muted-foreground">
            {{ t('billing.eyebrow') }}
          </p>
          <h1
            id="top-up-heading"
            class="mt-2 mb-0 text-2xl font-semibold tracking-tight text-base-foreground"
          >
            {{ t('billing.title') }}
          </h1>
        </div>
        <div
          class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-warning-background/15 text-warning-background"
        >
          <i class="icon-[lucide--coins] size-6" aria-hidden="true" />
        </div>
      </div>
      <p class="mt-3 mb-0 max-w-md text-sm/6 text-muted-foreground">
        {{ t('billing.description') }}
      </p>
    </div>

    <div class="p-6 sm:p-8">
      <fieldset class="m-0 border-0 p-0">
        <legend class="mb-3 text-sm font-medium text-muted-foreground">
          {{ t('billing.selectAmount') }}
        </legend>
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="amount in presetAmounts"
            :key="amount"
            type="button"
            :aria-pressed="amountUsd === amount"
            class="h-11 cursor-pointer rounded-xl border border-transparent bg-secondary-background text-sm font-semibold text-base-foreground transition-colors hover:bg-secondary-background-hover focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none aria-pressed:border-border-default aria-pressed:bg-secondary-background-selected"
            @click="selectAmount(amount)"
          >
            {{ formatUsd(amount) }}
          </button>
        </div>
      </fieldset>

      <div class="mt-7 grid gap-5 sm:grid-cols-2">
        <div>
          <label
            :for="amountInputId"
            class="mb-3 block text-sm font-medium text-muted-foreground"
          >
            {{ t('billing.amountLabel') }}
          </label>
          <div
            class="flex h-12 items-center rounded-xl bg-secondary-background focus-within:ring-2 focus-within:ring-base-foreground"
          >
            <button
              type="button"
              :aria-label="t('billing.decreaseAmount')"
              :disabled="amountUsd <= 0"
              class="flex h-full w-11 cursor-pointer items-center justify-center rounded-l-xl text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
              @click="decreaseAmount"
            >
              <i class="icon-[lucide--minus] size-4" aria-hidden="true" />
            </button>
            <span class="text-base font-semibold text-base-foreground">$</span>
            <input
              :id="amountInputId"
              :value="amountUsd"
              type="number"
              inputmode="numeric"
              :min="minimumAmount"
              :max="maximumAmount"
              step="1"
              :aria-invalid="!isValidAmount"
              :aria-describedby="amountHintId"
              class="min-w-0 flex-1 appearance-none border-0 bg-transparent px-1 text-center text-lg font-semibold text-base-foreground outline-none [&::-webkit-inner-spin-button]:appearance-none"
              @input="handleAmountInput"
            />
            <button
              type="button"
              :aria-label="t('billing.increaseAmount')"
              :disabled="amountUsd >= maximumAmount"
              class="flex h-full w-11 cursor-pointer items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
              @click="increaseAmount"
            >
              <i class="icon-[lucide--plus] size-4" aria-hidden="true" />
            </button>
          </div>
          <p
            :id="amountHintId"
            :class="
              cn(
                'mt-2 mb-0 min-h-5 text-xs',
                amountError
                  ? 'text-destructive-background'
                  : 'text-muted-foreground'
              )
            "
          >
            {{
              amountError ??
              t('billing.creditsPerDollar', {
                credits: n(creditsPerDollar)
              })
            }}
          </p>
        </div>

        <div>
          <p class="mb-3 text-sm font-medium text-muted-foreground">
            {{ t('billing.creditsLabel') }}
          </p>
          <div
            class="flex h-12 items-center justify-center gap-2 rounded-xl border border-border-subtle bg-secondary-background/40 text-lg font-semibold text-base-foreground"
          >
            <i
              class="icon-[lucide--coins] size-4 text-warning-background"
              aria-hidden="true"
            />
            <span class="tabular-nums">{{ n(credits) }}</span>
          </div>
        </div>
      </div>

      <dl
        class="mt-7 grid gap-3 rounded-2xl border border-border-subtle bg-secondary-background/30 p-4"
      >
        <div class="flex items-center justify-between gap-4">
          <dt class="text-sm text-muted-foreground">
            {{ t('billing.estimatedCredits') }}
          </dt>
          <dd class="m-0 font-medium text-base-foreground tabular-nums">
            {{ n(credits) }} {{ t('billing.creditsLabel') }}
          </dd>
        </div>
        <div
          class="flex items-center justify-between gap-4 border-t border-border-subtle pt-3"
        >
          <dt class="text-sm text-muted-foreground">
            {{ t('billing.purchaseAmount') }}
          </dt>
          <dd class="m-0 font-semibold text-base-foreground tabular-nums">
            {{ formatUsd(amountUsd) }}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        :disabled="!checkoutEnabled || !isValidAmount"
        class="mt-6 h-12 w-full cursor-pointer rounded-xl bg-primary-background px-5 font-semibold text-base-foreground transition-colors hover:bg-primary-background-hover focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-base-background focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-secondary-background disabled:text-muted-foreground"
        @click="requestCheckout"
      >
        {{ t('billing.continueToCheckout') }}
      </button>
      <p
        class="mt-3 mb-0 flex items-center justify-center gap-2 text-xs text-muted-foreground"
      >
        <i class="icon-[lucide--lock-keyhole] size-3" aria-hidden="true" />
        {{
          checkoutEnabled
            ? t('billing.secureCheckout')
            : t('billing.checkoutPending')
        }}
      </p>
    </div>
  </section>
</template>
