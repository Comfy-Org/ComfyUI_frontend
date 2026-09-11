<script setup lang="ts">
import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  reason,
  variant = 'pill',
  locale = 'en'
} = defineProps<{
  reason: WorkshopModel['incompleteReason']
  variant?: 'pill' | 'notice'
  locale?: Locale
}>()
</script>

<template>
  <span
    v-if="reason && variant === 'pill'"
    class="border-primary-comfy-orange/50 text-primary-comfy-orange inline-flex w-fit shrink-0 items-center rounded-full border bg-primary-comfy-ink px-3 py-1 text-xs font-medium"
    data-testid="model-incomplete-badge"
  >
    {{ t('workshop.model.incomplete', locale) }}
  </span>
  <div
    v-else-if="reason"
    class="border-primary-comfy-orange/40 bg-primary-comfy-orange/10 rounded-2xl border p-4 text-sm text-primary-warm-white"
    data-testid="model-incomplete-notice"
  >
    <p class="mb-2 font-bold">{{ t('workshop.model.incomplete', locale) }}</p>
    <p>
      {{ t('workshop.model.missingInputSchema', locale) }}
    </p>
  </div>
</template>
