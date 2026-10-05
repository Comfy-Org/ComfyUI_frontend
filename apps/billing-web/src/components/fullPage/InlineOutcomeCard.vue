<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { InlineOutcome } from '@/checkout/checkoutPage'
import { useHostedCopy } from '@/composables/useHostedCopy'

const { outcome } = defineProps<{
  outcome: Exclude<InlineOutcome, { kind: 'reconciling' }>
}>()

const { t } = useI18n()
const { refusal } = useHostedCopy()

/** A Pay the server refused outright is worded by its code, or by the sentence the server wrote. */
const body = computed(() => {
  if (outcome.kind === 'processing_error' && 'code' in outcome)
    return refusal(outcome)
  return t(`checkout.fullPage.outcome.${outcome.kind}.body`, {
    code: outcome.kind === 'promo_expired' ? outcome.code : ''
  })
})

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
      {{ body }}
    </p>
    <p
      v-if="outcome.kind === 'declined' && outcome.reason"
      class="m-0 text-sm/5 text-base-foreground"
    >
      {{
        t('checkout.fullPage.outcome.reportedIssue', {
          reason: t(`checkout.fullPage.outcome.reasons.${outcome.reason}`)
        })
      }}
    </p>
  </div>
</template>
