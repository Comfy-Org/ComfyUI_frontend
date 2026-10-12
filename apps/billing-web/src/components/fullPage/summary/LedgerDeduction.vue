<script setup lang="ts">
import type { SummaryLedger } from '@/checkout/summaryLedger'

const { row } = defineProps<{ row: SummaryLedger['discounts'][number] }>()
</script>

<template>
  <li class="flex flex-col gap-1">
    <div class="flex items-baseline justify-between gap-4">
      <span class="text-sm font-semibold text-base-foreground">
        {{ row.label }}
      </span>
      <span class="shrink-0 text-sm text-muted-foreground tabular-nums">
        {{ row.amount }}
      </span>
    </div>
    <span v-if="row.subline" class="text-xs text-muted-foreground">
      {{ row.subline }}
    </span>
  </li>
</template>
