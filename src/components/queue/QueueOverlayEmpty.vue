<template>
  <div class="pointer-events-auto">
    <CompletionSummaryBanner
      :mode="summary.mode"
      :completed-count="summary.completedCount"
      :failed-count="summary.failedCount"
      :thumbnail-urls="summary.thumbnailUrls"
      :aria-label="t('sideToolbar.queueProgressOverlay.expandCollapsedQueue')"
      @click="$emit('summaryClick')"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import CompletionSummaryBanner from '@/components/queue/CompletionSummaryBanner.vue'
import type { CompletionSummary } from '@/composables/queue/useCompletionSummary'

const { summary } = defineProps<{ summary: CompletionSummary }>()

defineEmits<{
  (e: 'summaryClick'): void
}>()

const { t } = useI18n()
</script>
