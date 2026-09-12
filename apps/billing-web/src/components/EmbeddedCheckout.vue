<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const {
  phase = 'payment',
  planName,
  monthlyPriceCents,
  amountDueCents,
  creditsPerMonth,
  billingCycle,
  checkoutEnabled = true
} = defineProps<{
  phase?: 'payment' | 'success'
  planName: string
  monthlyPriceCents: number
  amountDueCents: number
  creditsPerMonth: number
  billingCycle: 'monthly' | 'yearly'
  checkoutEnabled?: boolean
}>()

const emit = defineEmits<{
  back: []
  close: []
  confirm: []
}>()

const { n, t } = useI18n()
const monthlyPrice = computed(() => formatUsd(monthlyPriceCents))
const amountDue = computed(() => formatUsd(amountDueCents))
const billedPeriod = computed(() =>
  billingCycle === 'yearly'
    ? t('checkout.billedYearly', { amount: amountDue.value })
    : t('checkout.billedMonthly')
)

function formatUsd(amountCents: number): string {
  return n(amountCents / 100, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
}
</script>

<template>
  <section
    :aria-labelledby="
      phase === 'payment' ? 'checkout-heading' : 'success-heading'
    "
    class="relative flex min-h-[min(740px,90vh)] w-full overflow-hidden rounded-2xl border border-border-subtle bg-secondary-background shadow-2xl shadow-black/35"
  >
    <button
      type="button"
      :aria-label="t('checkout.close')"
      class="absolute top-5 right-5 z-10 flex size-11 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none"
      @click="emit('close')"
    >
      <i class="icon-[lucide--x] size-5" aria-hidden="true" />
    </button>

    <div v-if="phase === 'payment'" class="flex w-full flex-col xl:flex-row">
      <div
        class="flex shrink-0 flex-col border-b border-border-subtle bg-base-background p-6 xl:w-5/12 xl:border-r xl:border-b-0 xl:px-12 xl:py-10"
      >
        <div class="mb-10 flex items-center gap-3">
          <button
            type="button"
            :aria-label="t('checkout.back')"
            class="flex size-11 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none"
            @click="emit('back')"
          >
            <i class="icon-[lucide--arrow-left] size-5" aria-hidden="true" />
          </button>
          <h1
            id="checkout-heading"
            class="m-0 text-base font-medium text-muted-foreground"
          >
            {{ t('checkout.confirmPayment') }}
          </h1>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium text-base-foreground">
            {{ planName }}
          </span>
          <div class="flex items-baseline gap-2">
            <span
              class="text-3xl font-semibold text-base-foreground tabular-nums"
            >
              {{ monthlyPrice }}
            </span>
            <span class="text-base text-base-foreground">
              {{ t('checkout.perMonth') }}
            </span>
          </div>
          <span class="text-sm text-muted-foreground">{{ billedPeriod }}</span>
          <span class="text-sm text-muted-foreground">
            {{ t('checkout.startingToday') }}
          </span>
        </div>

        <dl class="mt-12 flex flex-col gap-6">
          <div class="flex items-center justify-between gap-4">
            <dt class="text-sm text-base-foreground">
              {{ t('checkout.creditsRefill') }}
            </dt>
            <dd
              class="m-0 flex items-center gap-2 font-semibold text-base-foreground tabular-nums"
            >
              <i
                class="icon-[lucide--coins] size-4 text-warning-background"
                aria-hidden="true"
              />
              {{ n(creditsPerMonth) }}
            </dd>
          </div>
          <div
            class="flex items-center justify-between gap-4 border-t border-border-subtle pt-6"
          >
            <dt class="text-base text-base-foreground">
              {{ t('checkout.totalDueToday') }}
            </dt>
            <dd class="m-0 font-semibold text-base-foreground tabular-nums">
              {{ amountDue }}
            </dd>
          </div>
        </dl>

        <div class="mt-8 flex gap-2">
          <label for="promotion-code" class="sr-only">
            {{ t('checkout.promotionCode') }}
          </label>
          <input
            id="promotion-code"
            type="text"
            :disabled="!checkoutEnabled"
            :placeholder="t('checkout.promotionCode')"
            class="h-11 min-w-0 flex-1 rounded-lg border border-interface-stroke bg-secondary-background px-3 text-base-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none disabled:cursor-not-allowed"
          />
          <button
            type="button"
            :disabled="!checkoutEnabled"
            class="h-11 cursor-pointer rounded-lg bg-secondary-background px-4 font-medium text-base-foreground transition-colors hover:bg-secondary-background-hover focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:text-muted-foreground"
          >
            {{ t('checkout.apply') }}
          </button>
        </div>
      </div>

      <div class="flex min-w-0 flex-1 flex-col p-6 xl:px-16 xl:py-10">
        <div class="pr-12">
          <h2 class="m-0 text-base font-semibold text-base-foreground">
            {{ t('checkout.paymentMethod') }}
          </h2>
          <p class="mt-1 mb-0 text-sm text-muted-foreground">
            {{ t('checkout.stripeSecurity') }}
          </p>
        </div>

        <div
          class="mt-8 flex flex-col gap-4 rounded-xl border border-border-default bg-base-background p-4"
        >
          <div class="flex items-center gap-3">
            <span
              class="flex size-5 items-center justify-center rounded-full border border-base-foreground"
            >
              <span class="size-2.5 rounded-full bg-base-foreground" />
            </span>
            <i
              class="icon-[lucide--credit-card] size-5 text-base-foreground"
              aria-hidden="true"
            />
            <span class="font-medium text-base-foreground">
              {{ t('checkout.card') }}
            </span>
          </div>
          <div
            class="grid h-11 grid-cols-[1fr_auto] items-center rounded-lg border border-border-default bg-input-surface px-3 text-sm text-muted-foreground"
          >
            <span>{{ t('checkout.cardNumber') }}</span>
            <span>{{ t('checkout.cardDetails') }}</span>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div
              class="flex h-11 items-center rounded-lg border border-border-default bg-input-surface px-3 text-sm text-muted-foreground"
            >
              {{ t('checkout.country') }}
            </div>
            <div
              class="flex h-11 items-center rounded-lg border border-border-default bg-input-surface px-3 text-sm text-muted-foreground"
            >
              {{ t('checkout.postalCode') }}
            </div>
          </div>
        </div>

        <div
          class="mt-3 flex items-center gap-3 rounded-xl bg-base-background p-4 text-sm text-muted-foreground"
        >
          <span class="size-5 rounded-full border border-border-default" />
          <i class="icon-[lucide--wallet] size-5" aria-hidden="true" />
          {{ t('checkout.alipay') }}
        </div>

        <div class="mt-auto pt-8">
          <button
            type="button"
            :disabled="!checkoutEnabled"
            class="h-12 w-full cursor-pointer rounded-lg bg-base-foreground px-5 font-semibold text-base-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            @click="emit('confirm')"
          >
            {{ t('checkout.payAndSubscribe') }}
          </button>
          <p class="mt-3 mb-0 text-center text-xs/5 text-muted-foreground">
            {{
              checkoutEnabled ? t('checkout.terms') : t('checkout.sdkPending')
            }}
          </p>
        </div>
      </div>
    </div>

    <div
      v-else
      class="mx-auto flex w-full max-w-md flex-col items-center justify-center px-8 py-16 text-center"
    >
      <div
        class="flex size-16 items-center justify-center rounded-full bg-success-background/15 text-success-background"
      >
        <i class="icon-[lucide--circle-check] size-9" aria-hidden="true" />
      </div>
      <h1
        id="success-heading"
        class="mt-6 mb-0 text-2xl font-semibold text-base-foreground"
      >
        {{ t('checkout.successTitle') }}
      </h1>
      <p class="mt-3 mb-0 text-sm/6 text-muted-foreground">
        {{ t('checkout.successBody') }}
      </p>
      <div class="mt-8 w-full rounded-xl bg-base-background p-5 text-left">
        <span class="text-sm text-base-foreground">{{ planName }}</span>
        <div class="mt-1 flex items-baseline gap-2">
          <span class="text-2xl font-semibold text-base-foreground">
            {{ monthlyPrice }}
          </span>
          <span class="text-sm text-muted-foreground">
            {{ t('checkout.perMonth') }}
          </span>
        </div>
        <div class="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <i class="icon-[lucide--coins] size-4" aria-hidden="true" />
          {{ n(creditsPerMonth) }} {{ t('checkout.creditsPerMonth') }}
        </div>
      </div>
      <button
        type="button"
        class="mt-10 h-12 w-full cursor-pointer rounded-lg bg-base-foreground px-5 font-semibold text-base-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none"
        @click="emit('close')"
      >
        {{ t('checkout.close') }}
      </button>
    </div>
  </section>
</template>
