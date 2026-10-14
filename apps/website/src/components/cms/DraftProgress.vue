<script setup lang="ts">
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

/** How far the review has got, shown until something is approved for the final review. */
const {
  reviewed,
  total,
  locale = 'en'
} = defineProps<{ reviewed: number; total: number; locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <div class="grid min-w-44 gap-1.5 text-xs" role="status">
    <span class="flex justify-between gap-3 text-admin-muted">
      <span>{{ t('cmsAdmin.progress.label') }}</span>
      <span class="text-admin-fg tabular-nums">
        {{ t('cmsAdmin.progress.count', { reviewed, total }) }}
      </span>
    </span>
    <span class="h-1 overflow-hidden rounded-full bg-admin-line">
      <span
        class="block h-full rounded-full bg-admin-fg transition-[width]"
        :style="{ width: `${total ? (reviewed / total) * 100 : 0}%` }"
      />
    </span>
  </div>
</template>
