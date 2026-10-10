<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { ReadinessGap } from '@/lib/cms/readiness'

/** A compact warning that an item still lacks something the Hub needs. */
const { gaps, locale = 'en' } = defineProps<{
  gaps: ReadinessGap[]
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const detail = gaps
  .map((gap) => t(`cmsAdmin.readiness.missing.${gap}`))
  .join(' · ')
</script>

<template>
  <span
    v-if="gaps.length"
    class="inline-flex items-center gap-1 text-admin-warning"
    :title="detail"
  >
    <TriangleAlert class="size-3.5" aria-hidden="true" />
    {{ t('cmsAdmin.readiness.toCheck', { count: gaps.length }, gaps.length) }}
    <span class="sr-only">: {{ detail }}</span>
  </span>
</template>
