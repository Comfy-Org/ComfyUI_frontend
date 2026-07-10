<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <!-- Invoice history and downloads live in Stripe, so this tab just surfaces
         the upcoming charge and links out; the local history table is hidden
         for now. When paused there's no upcoming invoice — the parent's
         "Subscription paused" banner covers that state and hosts the history
         link, so we drop this banner to avoid stacking two. Hidden until the
         API can supply the upcoming amount. -->
    <div
      v-if="!isPaused && nextInvoiceCents !== null"
      class="flex flex-col gap-4 rounded-2xl border border-interface-stroke/60 p-4 @2xl:flex-row @2xl:items-center @2xl:justify-between"
    >
      <div class="flex flex-col gap-2">
        <span class="text-sm text-muted-foreground">
          {{ $t('workspacePanel.overview.nextInvoice') }}
        </span>
        <p class="m-0 text-2xl font-semibold text-base-foreground">
          {{ formatWholeUsd(nextInvoiceCents) }}
          <span class="text-base font-normal text-base-foreground">
            {{ $t('workspacePanel.overview.usd') }}
          </span>
        </p>
      </div>
      <Button variant="secondary" size="lg" @click="openHistory">
        {{ $t('workspacePanel.invoices.fullHistory') }}
        <i class="icon-[lucide--external-link] size-4" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useWorkspaceInvoices } from '@/platform/workspace/composables/useWorkspaceInvoices'

const { n } = useI18n()
const { isPaused, manageSubscription } = useBillingContext()

const { nextInvoiceCents } = useWorkspaceInvoices()

function formatWholeUsd(cents: number | null): string {
  if (cents === null) return ''

  return n(cents / 100, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}

function openHistory() {
  void manageSubscription()
}
</script>
