<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { SuccessBreakdown } from '@/checkout/successBreakdown'
import LedgerDeduction from '@/components/fullPage/summary/LedgerDeduction.vue'
import LedgerItem from '@/components/fullPage/summary/LedgerItem.vue'

export interface EndingPlan {
  readonly name: string
  readonly price: string
  readonly period: string
}

const { plan, creditsAdded, breakdown } = defineProps<{
  plan: EndingPlan
  creditsAdded?: number
  breakdown?: SuccessBreakdown
}>()

const { t, locale } = useI18n()

const credits = (count: number) =>
  new Intl.NumberFormat(locale.value).format(count)
</script>

<template>
  <div
    class="flex w-full flex-col gap-2 rounded-lg bg-secondary-background p-6 text-left"
    data-testid="checkout-ending-plan"
  >
    <p class="m-0 text-base font-bold text-base-foreground">
      {{ plan.name }}
    </p>
    <p class="m-0 text-base-foreground tabular-nums">
      <span class="text-[2rem] font-semibold">{{ plan.price }}</span>
      {{ plan.period }}
    </p>
    <p
      v-if="creditsAdded !== undefined"
      class="m-0 flex items-center gap-1.5 text-sm text-muted-foreground"
    >
      <i class="icon-[lucide--coins] size-4 shrink-0" aria-hidden="true" />
      <span class="tabular-nums">
        {{
          t('checkout.fullPage.ending.receipt.creditsAddedLine', {
            count: credits(creditsAdded)
          })
        }}
      </span>
    </p>
    <template v-if="breakdown">
      <hr class="my-2 border-border-default" />
      <ul
        class="m-0 flex list-none flex-col gap-4 p-0"
        data-testid="checkout-ending-paid-today"
      >
        <LedgerDeduction
          v-for="(row, index) in breakdown.deductions"
          :key="`deduction-${index}`"
          :row
        />
        <LedgerItem :row="breakdown.paidToday" />
      </ul>
    </template>
  </div>
</template>
