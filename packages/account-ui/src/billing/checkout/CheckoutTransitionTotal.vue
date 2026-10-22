<template>
  <!-- Immediate changes carry their addends: one sum under one divider
       (Figma 5344-35724). -->
  <div
    :class="
      cn(
        'flex flex-col gap-2 border-t border-border/50 pt-6',
        scheduled && 'mt-10'
      )
    "
  >
    <template v-if="discounts.length">
      <div class="flex items-center justify-between text-muted-foreground">
        <span>{{ discountComposition }}</span>
      </div>
      <div
        v-for="discount in discounts"
        :key="discount.key"
        class="flex items-center justify-between text-muted-foreground"
      >
        <span>{{ discount.label }}</span>
        <span class="text-foreground">
          {{ discount.name
          }}<template v-if="discount.amount">
            · −{{ discount.amount }}</template
          >
        </span>
      </div>
    </template>
    <div class="flex items-center justify-between text-base text-foreground">
      <span>
        {{ totalDueToday }}
      </span>
      <span class="font-bold tabular-nums">
        {{ amountDueToday }}
      </span>
    </div>
    <span class="text-muted-foreground">{{ renewalTerms }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * The plan-change confirm's charge block: the discounts an immediate change
 * applies, today's total, and the renewal terms.
 */
import { cn } from '@comfyorg/tailwind-utils'

const {
  discounts,
  discountComposition,
  totalDueToday,
  amountDueToday,
  renewalTerms,
  scheduled = false
} = defineProps<{
  discounts: readonly {
    readonly key: string
    readonly label: string
    readonly name: string
    readonly amount: string
  }[]
  discountComposition: string
  totalDueToday: string
  amountDueToday: string
  renewalTerms: string
  /** A change that takes effect later sets its total apart from the plan block. */
  scheduled?: boolean
}>()
</script>
