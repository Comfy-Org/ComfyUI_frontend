<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { InlineOutcome } from '@/checkout/checkoutPage'

const { outcome } = defineProps<{
  outcome: Exclude<InlineOutcome, { kind: 'reconciling' }>
}>()

const { t } = useI18n()

const card = useTemplateRef<HTMLDivElement>('card')

onMounted(() => {
  card.value?.scrollIntoView({ block: 'center' })
  card.value?.focus({ preventScroll: true })
})
</script>

<template>
  <div
    ref="card"
    role="alert"
    tabindex="-1"
    class="flex flex-col gap-2 rounded-lg bg-tertiary-background p-4 focus-visible:outline-none"
  >
    <p
      class="m-0 flex items-center gap-2 text-sm/5 font-medium text-base-foreground"
    >
      <i
        class="icon-[lucide--circle-alert] size-4 shrink-0 text-warning-background"
        aria-hidden="true"
      />
      {{ t(`checkout.fullPage.outcome.${outcome.kind}.title`) }}
    </p>
    <p class="m-0 text-sm/5 text-muted-foreground">
      {{
        t(`checkout.fullPage.outcome.${outcome.kind}.body`, {
          code: outcome.kind === 'promo_expired' ? outcome.code : ''
        })
      }}
    </p>
    <p
      v-if="outcome.kind === 'declined' && outcome.reason"
      class="m-0 text-sm/5 text-muted-foreground"
    >
      {{
        t('checkout.fullPage.outcome.reportedIssue', {
          reason: t(`checkout.fullPage.outcome.reasons.${outcome.reason}`)
        })
      }}
    </p>
  </div>
</template>
