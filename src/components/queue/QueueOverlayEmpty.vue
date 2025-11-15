<template>
  <div class="pointer-events-auto">
    <CompletionSummaryBanner
      v-if="summary"
      :mode="summary.mode"
      :completed-count="summary.completedCount"
      :failed-count="summary.failedCount"
      :thumbnail-urls="summary.thumbnailUrls"
      :aria-label="t('sideToolbar.queueProgressOverlay.expandCollapsedQueue')"
      @click="$emit('summaryClick')"
    />
    <button
      v-else
      type="button"
      class="group flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-interface-stroke bg-interface-panel-surface py-1 pr-2 pl-4 text-left transition-colors duration-200 ease-in-out hover:cursor-pointer hover:border-border-subtle hover:bg-interface-panel-hover-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-background"
      :aria-label="t('sideToolbar.queueProgressOverlay.expandCollapsedQueue')"
      @click="$emit('expand')"
    >
      <span class="text-[14px] leading-none font-normal text-text-primary">
        {{ t('sideToolbar.queueProgressOverlay.noActiveJobs') }}
      </span>
      <span
        class="flex items-center justify-center rounded p-1 text-text-secondary transition-colors duration-200 ease-in-out group-hover:bg-secondary-background group-hover:text-text-primary"
      >
        <i class="icon-[lucide--chevron-down] block size-4 leading-none" />
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import CompletionSummaryBanner from '@/components/queue/CompletionSummaryBanner.vue'
import type { CompletionSummary } from '@/composables/queue/useCompletionSummary'

defineProps<{ summary: CompletionSummary | null }>()

defineEmits<{
  (e: 'summaryClick'): void
  (e: 'expand'): void
}>()

const { t } = useI18n()
</script>
