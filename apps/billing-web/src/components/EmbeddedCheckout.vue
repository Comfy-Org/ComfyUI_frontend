<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const {
  phase = 'payment',
  planName,
  priceCents,
  amountDueCents,
  creditsCents,
  billingCycle
} = defineProps<{
  phase?: 'payment' | 'success'
  planName: string
  /** The plan's price for one billing period, in cents. */
  priceCents: number
  amountDueCents: number
  /** The credits one period refills, in cents. */
  creditsCents: number
  billingCycle: 'monthly' | 'yearly'
}>()

const emit = defineEmits<{
  back: []
  close: []
}>()

const { n, t } = useI18n()
const price = computed(() => formatUsd(priceCents))
const amountDue = computed(() => formatUsd(amountDueCents))
const credits = computed(() => formatUsd(creditsCents))
const pricePeriod = computed(() =>
  billingCycle === 'yearly' ? t('checkout.perYear') : t('checkout.perMonth')
)
const billedPeriod = computed(() =>
  billingCycle === 'yearly'
    ? t('checkout.billedYearly', { amount: amountDue.value })
    : t('checkout.billedMonthly')
)

function formatUsd(amountCents: number): string {
  return n(amountCents / 100, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
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
              {{ price }}
            </span>
            <span class="text-base text-base-foreground">
              {{ pricePeriod }}
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
              {{ credits }}
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
      </div>

      <div class="flex min-w-0 flex-1 flex-col p-6 xl:px-16 xl:py-10">
        <!-- The provider form, rendered by the host so this layout never
             imports the payment provider itself. -->
        <slot name="form" />
        <p class="mt-3 mb-0 text-center text-xs/5 text-muted-foreground">
          {{ t('checkout.terms') }}
        </p>
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
      <p class="mt-3 mb-0 text-sm text-muted-foreground">
        {{ t('checkout.successBody') }}
      </p>
      <p class="mt-6 mb-0 text-sm font-medium text-base-foreground">
        {{ planName }}
      </p>
      <slot name="done" />
    </div>
  </section>
</template>
