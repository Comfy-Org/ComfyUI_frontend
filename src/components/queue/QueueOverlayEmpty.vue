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
      class="group flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)] py-1 pr-2 pl-4 text-left transition-colors duration-200 ease-in-out hover:cursor-pointer hover:border-[var(--color-charcoal-300)] hover:bg-[var(--color-charcoal-700)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-slate-200)]"
      :aria-label="t('sideToolbar.queueProgressOverlay.expandCollapsedQueue')"
      @click="$emit('expand')"
    >
      <span class="text-[14px] leading-none font-normal text-white">
        {{ t('sideToolbar.queueProgressOverlay.noActiveJobs') }}
      </span>
      <span
        class="flex items-center justify-center rounded p-1 text-[var(--color-slate-100)] transition-colors duration-200 ease-in-out group-hover:bg-[var(--color-charcoal-600)] group-hover:text-white"
      >
        <i class="icon-[lucide--chevron-down] block size-4 leading-none" />
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import CompletionSummaryBanner from '@/components/queue/CompletionSummaryBanner.vue'

type CompletionSummary = {
  mode: 'allSuccess' | 'mixed' | 'allFailed'
  completedCount: number
  failedCount: number
  thumbnailUrls: string[]
}

defineProps<{ summary: CompletionSummary | null }>()

defineEmits<{
  (e: 'summaryClick'): void
  (e: 'expand'): void
}>()

const { t } = useI18n()
</script>
