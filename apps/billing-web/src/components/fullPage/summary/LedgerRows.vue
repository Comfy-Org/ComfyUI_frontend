<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import type { SummaryLedger } from '@/checkout/summaryLedger'
import LedgerDeduction from '@/components/fullPage/summary/LedgerDeduction.vue'
import LedgerItem from '@/components/fullPage/summary/LedgerItem.vue'

const { ledger } = defineProps<{ ledger: SummaryLedger }>()

const { t } = useI18n()

/** The balance comes off the final amount, so it is the last deduction. */
const deductions = computed(() =>
  ledger.balance === undefined
    ? ledger.discounts
    : [...ledger.discounts, ledger.balance]
)

/** Deductions continue the item list unless a Subtotal divides them off. */
const continuesItems = computed(
  () => ledger.items.length > 0 && ledger.subtotal === undefined
)
</script>

<template>
  <template v-if="ledger.items.length + deductions.length > 0">
    <hr class="mt-8 mb-0 border-border-default" />
    <ul
      v-if="ledger.items.length > 0"
      class="m-0 flex list-none flex-col gap-4 p-0 pt-6"
    >
      <LedgerItem
        v-for="(row, index) in ledger.items"
        :key="`item-${index}`"
        :row
      />
    </ul>
    <template v-if="ledger.subtotal">
      <hr class="mt-6 mb-0 border-border-default" />
      <div
        class="flex items-baseline justify-between gap-4 pt-4 text-sm text-muted-foreground"
      >
        <span>{{ t('checkout.fullPage.summary.subtotal') }}</span>
        <span class="tabular-nums">{{ ledger.subtotal }}</span>
      </div>
    </template>
    <ul
      v-if="deductions.length > 0"
      :class="
        cn(
          'm-0 flex list-none flex-col gap-4 p-0',
          continuesItems ? 'pt-4' : 'pt-6'
        )
      "
    >
      <LedgerDeduction
        v-for="(row, index) in deductions"
        :key="`deduction-${index}`"
        :row
      />
    </ul>
  </template>
</template>
