<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { SummaryLedger } from '@/checkout/summaryLedger'

const { ledger } = defineProps<{ ledger: SummaryLedger }>()

const { t } = useI18n()
</script>

<template>
  <div class="mt-16 flex flex-col gap-2">
    <p class="m-0 text-sm text-muted-foreground">{{ ledger.eyebrow }}</p>
    <p class="m-0 text-2xl font-semibold text-base-foreground tabular-nums">
      {{ ledger.headline.amount }}
      <span class="text-base font-normal">
        {{ ledger.headline.currency }}
        <template v-if="ledger.headline.rate">
          {{ ledger.headline.rate }}
        </template>
      </span>
    </p>
    <p
      v-if="ledger.credits"
      class="m-0 flex items-start gap-1.5 text-base text-muted-foreground"
    >
      <i class="mt-1 icon-[lucide--coins] size-4 shrink-0" aria-hidden="true" />
      <span>
        <span class="tabular-nums">{{ ledger.credits.count }}</span>
        {{ ledger.credits.qualifier }}
      </span>
    </p>
  </div>

  <template v-if="ledger.items.length + ledger.adjustments.length > 0">
    <hr class="mt-8 mb-0 border-border-default" />
    <ul class="m-0 flex list-none flex-col gap-4 p-0 pt-6">
      <li
        v-for="row in ledger.items"
        :key="row.label"
        class="flex flex-col gap-1"
      >
        <div class="flex items-baseline justify-between gap-4">
          <span class="text-sm font-semibold text-base-foreground">
            {{ row.label }}
          </span>
          <span class="shrink-0 text-sm text-base-foreground tabular-nums">
            {{ row.amount }}
          </span>
        </div>
        <span
          v-for="subline in row.sublines"
          :key="subline"
          class="text-xs text-muted-foreground"
        >
          {{ subline }}
        </span>
      </li>
      <li
        v-for="row in ledger.adjustments"
        :key="row.label"
        class="flex items-baseline justify-between gap-4"
      >
        <span class="text-sm font-semibold text-base-foreground">
          {{ row.label }}
        </span>
        <span class="shrink-0 text-sm text-base-foreground tabular-nums">
          {{ row.amount }}
        </span>
      </li>
    </ul>
  </template>

  <template v-if="ledger.subtotal">
    <hr class="mt-6 mb-0 border-border-default" />
    <div
      class="flex items-baseline justify-between gap-4 pt-4 text-sm text-muted-foreground"
    >
      <span>{{ t('checkout.fullPage.summary.subtotal') }}</span>
      <span class="tabular-nums">{{ ledger.subtotal }}</span>
    </div>
  </template>

  <div
    v-if="ledger.promo"
    class="flex items-baseline justify-between gap-4 pt-4"
  >
    <span class="text-sm font-semibold text-base-foreground">
      {{ ledger.promo.label }}
    </span>
    <span class="shrink-0 text-sm text-base-foreground tabular-nums">
      {{ ledger.promo.amount }}
    </span>
  </div>

  <div class="pt-4 empty:hidden">
    <slot />
  </div>

  <hr class="mt-6 mb-0 border-border-default" />
  <div class="flex items-center justify-between gap-4 pt-6">
    <span class="text-base font-semibold text-base-foreground">
      {{ t('checkout.totalDueToday') }}
    </span>
    <span class="text-base font-semibold text-base-foreground tabular-nums">
      {{ ledger.total }}
    </span>
  </div>
  <ul
    v-if="ledger.trailing.length > 0"
    class="m-0 mt-3 flex list-none flex-col gap-1 p-0"
  >
    <li
      v-for="line in ledger.trailing"
      :key="line"
      class="text-xs text-muted-foreground"
    >
      {{ line }}
    </li>
  </ul>
</template>
