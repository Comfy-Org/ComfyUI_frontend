<script setup lang="ts">
import type { SummaryLedger } from '@/checkout/summaryLedger'

const { row } = defineProps<{ row: SummaryLedger['items'][number] }>()
</script>

<template>
  <li class="flex flex-col gap-1">
    <div class="flex items-baseline justify-between gap-4">
      <span class="text-sm font-semibold text-base-foreground">
        {{ row.label }}
      </span>
      <span class="shrink-0 text-sm text-base-foreground tabular-nums">
        {{ row.amount }}
      </span>
    </div>
    <i18n-t
      v-if="row.comparedRate"
      :keypath="row.comparedRate.keypath"
      tag="span"
      class="text-xs text-muted-foreground tabular-nums"
    >
      <template #amount>{{ row.comparedRate.amount }}</template>
      <template #listAmount>
        <s>{{ row.comparedRate.listAmount }}</s>
      </template>
    </i18n-t>
    <span
      v-for="subline in row.sublines"
      :key="subline"
      class="text-xs text-muted-foreground"
    >
      {{ subline }}
    </span>
  </li>
</template>
