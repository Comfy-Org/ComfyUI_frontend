<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SubscriptionPreview } from '@comfyorg/account-core/billing'

import { useHostedCopy } from '@/composables/useHostedCopy'

const { preview, loading, failureCode } = defineProps<{
  preview?: SubscriptionPreview
  loading: boolean
  failureCode?: string
}>()

const { t } = useI18n()
const { coded, date, money } = useHostedCopy()

const rows = computed(() => {
  if (!preview) return []
  return [
    {
      label: t('hosted.quote.costToday'),
      value: money(preview.cost_today_cents)
    },
    {
      label: t('hosted.quote.costNextPeriod'),
      value: money(preview.cost_next_period_cents)
    },
    {
      label: t('hosted.quote.creditsToday'),
      value: money(preview.credits_today_cents)
    },
    {
      label: t('hosted.quote.creditsNextPeriod'),
      value: money(preview.credits_next_period_cents)
    },
    { label: t('hosted.quote.effectiveAt'), value: date(preview.effective_at) },
    {
      label: t('hosted.quote.transition'),
      value: coded('transition', preview.transition_type)
    },
    ...(preview.amount_due_cents === undefined
      ? []
      : [
          {
            label: t('hosted.quote.amountDue'),
            value: money(preview.amount_due_cents)
          }
        ]),
    ...(preview.renewal_at === undefined
      ? []
      : [
          {
            label: t('hosted.quote.renewalAt'),
            value: date(preview.renewal_at)
          }
        ])
  ]
})

const blockedReason = computed(() =>
  preview && !preview.allowed ? coded('quoteReason', preview.reason) : undefined
)
</script>

<template>
  <section
    class="rounded-xl border border-border-subtle bg-secondary-background p-4"
  >
    <h2 class="m-0 text-base font-semibold text-base-foreground">
      {{ t('hosted.quote.title') }}
    </h2>
    <p v-if="loading" class="mt-2 mb-0 text-sm text-muted-foreground">
      {{ t('hosted.loading') }}
    </p>
    <p v-if="failureCode" class="mt-2 mb-0 text-sm text-destructive-background">
      {{ coded('failure', failureCode) }}
    </p>
    <p v-if="blockedReason" class="mt-2 mb-0 text-sm text-muted-foreground">
      {{ blockedReason }}
    </p>
    <dl class="mt-3 mb-0 flex flex-col gap-2">
      <div
        v-for="row in rows"
        :key="row.label"
        class="flex items-center justify-between gap-4 text-sm"
      >
        <dt class="text-muted-foreground">{{ row.label }}</dt>
        <dd class="m-0 text-base-foreground tabular-nums">{{ row.value }}</dd>
      </div>
    </dl>
    <button
      type="button"
      disabled
      class="mt-4 h-11 w-full rounded-lg bg-base-foreground px-4 font-semibold text-base-background disabled:cursor-not-allowed disabled:opacity-40"
    >
      {{ t('checkout.payAndSubscribe') }}
    </button>
    <p class="mt-2 mb-0 text-center text-xs text-muted-foreground">
      {{ t('checkout.sdkPending') }}
    </p>
  </section>
</template>
