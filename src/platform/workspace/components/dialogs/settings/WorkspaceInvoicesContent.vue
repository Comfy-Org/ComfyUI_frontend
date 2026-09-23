<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <!-- Billing data still loading: avoid rendering a false $0 charge -->
    <div
      v-if="isLoading && !subscription"
      class="rounded-2xl border border-interface-stroke p-6"
    >
      <div class="flex items-center gap-2 py-4 text-muted-foreground">
        <i class="pi pi-spin pi-spinner" />
        <span>{{ $t('g.loading') }}</span>
      </div>
    </div>

    <!-- Billing fetch failed: offer retry rather than a misleading amount -->
    <div
      v-else-if="error && !subscription"
      class="flex flex-col items-start gap-3 rounded-2xl border border-interface-stroke p-6"
    >
      <div class="flex items-center gap-2 text-text-secondary">
        <i class="pi pi-exclamation-circle text-danger" />
        <span class="text-sm">{{ $t('subscription.planLoadError') }}</span>
      </div>
      <Button
        variant="secondary"
        size="lg"
        class="rounded-lg px-4 text-sm font-normal"
        :loading="isLoading"
        @click="handleRetry"
      >
        {{ $t('subscription.planLoadErrorRetry') }}
      </Button>
    </div>

    <!-- Invoice history and per-invoice downloads live in Stripe by design, so
         this tab surfaces the upcoming charge and links out. The amount drops
         out while the subscription is paused — there is no upcoming charge
         then, and the shared billing banner already reports that state — but
         the history link stays reachable in every state. -->
    <div
      v-else
      class="flex flex-col gap-4 rounded-2xl border border-interface-stroke/60 p-4 @2xl:flex-row @2xl:items-center @2xl:justify-between"
    >
      <div v-if="upcomingAmount" class="flex flex-col gap-2">
        <span class="text-sm text-muted-foreground">
          {{ $t('workspacePanel.invoices.nextInvoice') }}
        </span>
        <p class="m-0 text-2xl font-semibold text-base-foreground">
          {{ upcomingAmount }}
          <span class="text-base font-normal text-base-foreground">
            {{ $t('workspacePanel.invoices.usd') }}
          </span>
        </p>
      </div>
      <Button
        variant="secondary"
        size="lg"
        class="@2xl:ml-auto"
        :loading="isOpeningHistory"
        @click="openHistory"
      >
        {{ $t('workspacePanel.invoices.fullHistory') }}
        <i class="icon-[lucide--external-link] size-4" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useNextInvoice } from '@/composables/billing/useNextInvoice'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { formatUsdCents } from '@/utils/numberUtil'

const { locale } = useI18n()
const { toastErrorHandler } = useErrorHandling()
const {
  billingStatus,
  subscription,
  isLoading,
  error,
  initialize,
  manageSubscription
} = useBillingContext()
const { nextInvoice } = useNextInvoice()

const upcomingAmount = computed(() => {
  if (billingStatus.value === 'paused') return null

  const invoice = nextInvoice.value
  return invoice ? formatUsdCents(locale.value, invoice.amountCents) : null
})

const isOpeningHistory = ref(false)

// `manageSubscription` carries no in-flight guard, so a second click would
// start another portal request and open another window. It also rethrows once
// the request fails, and this panel only renders its own error state before
// billing has loaded, so the failure would otherwise be silent.
function openHistory() {
  if (isOpeningHistory.value) return

  isOpeningHistory.value = true
  void manageSubscription()
    .catch(toastErrorHandler)
    .finally(() => {
      isOpeningHistory.value = false
    })
}

// `initialize` rethrows so callers can react; the failure is already mirrored
// into `error`, which drives this panel, so swallow it rather than surfacing an
// unhandled rejection from a click handler.
function handleRetry() {
  void initialize().catch(() => undefined)
}
</script>
