<script setup lang="ts">
import { AlertTriangle } from '@lucide/vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { id, locale = 'en' } = defineProps<{
  id: string
  locale?: Locale
}>()
</script>

<template>
  <!-- Announced politely, not as an alert: this follows the reader's own
  choice of frame and costs them a better result, never the run. -->
  <div
    :id
    role="status"
    data-testid="frame-ratio-notice"
    class="flex items-start gap-3 rounded-2xl border border-primary-comfy-orange/40 bg-primary-comfy-orange/10 p-4 text-sm text-primary-warm-white"
  >
    <AlertTriangle
      class="mt-0.5 size-5 shrink-0 text-primary-comfy-orange"
      aria-hidden="true"
    />
    <div class="flex min-w-0 flex-col gap-1">
      <p class="font-bold">
        {{ t('workshop.field.frameRatioMismatchTitle', locale) }}
      </p>
      <p>{{ t('workshop.field.frameRatioMismatch', locale) }}</p>
    </div>
  </div>
</template>
