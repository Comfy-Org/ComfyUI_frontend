<template>
  <div class="flex flex-col gap-2">
    <span class="text-sm text-base-foreground">
      {{ plan.name }}
    </span>
    <div class="flex items-baseline gap-2">
      <span class="text-2xl font-semibold text-base-foreground tabular-nums">
        ${{ displayPrice }}
      </span>
      <span class="text-base text-base-foreground">
        {{ copy.usdPerMonth }}
      </span>
    </div>
    <span class="text-muted-foreground">
      {{ billedLabel }}
    </span>
    <span class="text-muted-foreground">
      {{ copy.startingToday }}
    </span>
  </div>

  <div
    :class="cn('flex flex-col gap-3 pt-16 pb-8', compact && 'xl:pt-6 xl:pb-4')"
  >
    <div class="flex items-center justify-between">
      <span class="text-base-foreground">
        {{ refillLabel }}
      </span>
      <div class="flex items-center gap-1">
        <i class="icon-[lucide--coins] size-4 shrink-0 bg-credit" />
        <span class="font-bold text-base-foreground tabular-nums">
          {{ refillCredits }}
        </span>
      </div>
    </div>
  </div>

  <div
    v-if="totalDueToday"
    :class="
      cn(
        'flex flex-col gap-2 border-t border-border-subtle pt-8',
        compact && 'xl:pt-6'
      )
    "
  >
    <div class="flex items-center justify-between text-base">
      <span class="text-base-foreground">
        {{ copy.totalDueToday }}
      </span>
      <span class="font-bold text-base-foreground tabular-nums">
        {{ totalDueToday }}
      </span>
    </div>
    <span class="text-sm text-muted-foreground">
      {{ renewalTerms }}
    </span>
  </div>
  <div v-if="discounts.length" class="flex flex-col gap-2 pt-4 text-sm">
    <div
      v-for="discount in discounts"
      :key="discount.key"
      class="flex items-center justify-between text-muted-foreground"
    >
      <span>{{ discount.label }}</span>
      <span class="text-base-foreground">
        {{ discount.name
        }}<template v-if="discount.amount"> · −{{ discount.amount }}</template>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The new-subscription confirm's money block: the plan and its price, the
 * credits a period refills, today's charge with the renewal terms, and the
 * discounts the quote applied.
 */
import { computed } from 'vue'

import type { SubscriptionPreview } from '@comfyorg/account-core/billing'
import { cn } from '@comfyorg/tailwind-utils'

import type { CheckoutCopy } from './checkoutCopy'
import type { CheckoutBillingCycle, CheckoutPlan } from './checkoutQuote'
import {
  formatAmountDueToday,
  formatNumber,
  formatQuoteMoney,
  formatRenewalAmount,
  isYearlyCheckout,
  resolveRenewalDate
} from './checkoutQuote'

const {
  plan,
  copy,
  locale,
  previewData,
  billingCycle,
  compact = false
} = defineProps<{
  plan: CheckoutPlan
  copy: CheckoutCopy
  locale: string
  previewData: SubscriptionPreview | null
  billingCycle: CheckoutBillingCycle
  /** The embedded card form sits beside the summary, so it tightens up. */
  compact?: boolean
}>()

const isYearly = computed(() =>
  isYearlyCheckout(previewData?.new_plan.duration, billingCycle)
)
const quotedPrice = computed(() =>
  plan.pricedByQuote ? previewData?.new_plan : undefined
)

const displayPrice = computed(() => {
  if (quotedPrice.value) {
    const cents = quotedPrice.value.price_cents
    return ((isYearly.value ? cents / 12 : cents) / 100).toFixed(0)
  }
  return formatNumber(
    isYearly.value ? plan.monthlyPriceUsd.yearly : plan.monthlyPriceUsd.monthly,
    locale
  )
})

const billedLabel = computed(() => {
  if (!isYearly.value) return copy.billedMonthly
  const usd = quotedPrice.value
    ? quotedPrice.value.price_cents / 100
    : plan.monthlyPriceUsd.yearly * 12
  return copy.billedYearly(`$${formatNumber(usd, locale)}`)
})

const refillLabel = computed(() =>
  isYearly.value ? copy.eachYearCreditsRefill : copy.eachMonthCreditsRefill
)

const refillCredits = computed(() =>
  formatNumber(
    isYearly.value ? plan.monthlyCredits * 12 : plan.monthlyCredits,
    locale
  )
)

const totalDueToday = computed(() =>
  previewData ? formatAmountDueToday(previewData, locale) : ''
)

const renewalTerms = computed(() => {
  if (!previewData) return ''
  const amount = formatRenewalAmount(previewData, locale)
  if (!amount) return ''
  const renewsAt = resolveRenewalDate(previewData)
  if (!renewsAt) return copy.renewsAtAmount(amount)
  const date = new Date(renewsAt).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  })
  return copy.renewsAt(amount, date)
})

const discounts = computed(() =>
  (previewData?.discounts ?? []).map((discount) => ({
    key: `${discount.kind}:${discount.code}`,
    label: copy.discount[discount.kind],
    name: discount.name || discount.code,
    amount: discount.amount_off_cents
      ? formatQuoteMoney(
          discount.amount_off_cents,
          previewData?.currency,
          locale
        )
      : ''
  }))
)
</script>
