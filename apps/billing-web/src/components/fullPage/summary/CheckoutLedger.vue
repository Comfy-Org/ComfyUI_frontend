<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { SummaryLedger } from '@/checkout/summaryLedger'
import LedgerRows from '@/components/fullPage/summary/LedgerRows.vue'

const { ledger } = defineProps<{ ledger: SummaryLedger }>()

const { t } = useI18n()
</script>

<template>
  <div class="mt-16 flex flex-col gap-2">
    <p class="m-0 text-sm text-muted-foreground">{{ ledger.eyebrow }}</p>
    <p
      class="m-0 flex items-baseline gap-1.5 text-2xl font-semibold text-base-foreground tabular-nums"
    >
      <i
        v-if="ledger.headline.icon"
        class="icon-[lucide--coins] size-5 shrink-0 self-center text-muted-foreground"
        aria-hidden="true"
      />
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

  <LedgerRows :ledger />

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
