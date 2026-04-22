<script setup lang="ts">
/**
 * JobQueueCell — active-jobs indicator that mirrors the graph-view
 * "N active" button. Rendered in App Mode's top-right cluster only
 * while `activeJobsCount > 0`; clicking opens the job history sidebar
 * (or the legacy queue overlay, depending on feature flag).
 */
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import { useQueueFeatureFlags } from '@/composables/queue/useQueueFeatureFlags'
import { useCommandStore } from '@/stores/commandStore'
import { useQueueStore } from '@/stores/queueStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const { t, n } = useI18n()
const { activeJobsCount } = storeToRefs(useQueueStore())
const sidebarTabStore = useSidebarTabStore()
const commandStore = useCommandStore()
const { isQueuePanelV2Enabled } = useQueueFeatureFlags()

function handleClick() {
  if (isQueuePanelV2Enabled.value) {
    sidebarTabStore.toggleSidebarTab('job-history')
    return
  }
  void commandStore.execute('Comfy.Queue.ToggleOverlay')
}
</script>

<template>
  <button
    type="button"
    class="duration-layout flex size-full cursor-pointer items-center justify-center gap-2 rounded-[inherit] border-none bg-transparent px-3 font-inter text-layout-md text-layout-text tabular-nums transition-colors ease-layout hover:bg-layout-cell-hover"
    data-testid="layout-job-queue-cell"
    :title="t('sideToolbar.queueProgressOverlay.expandCollapsedQueue')"
    @click="handleClick"
  >
    <i class="icon-[lucide--layers] size-4.5 shrink-0" aria-hidden="true" />
    <span class="whitespace-nowrap">
      {{
        t(
          'sideToolbar.queueProgressOverlay.activeJobsShort',
          { count: n(activeJobsCount) },
          activeJobsCount
        )
      }}
    </span>
    <span class="sr-only">
      {{ t('sideToolbar.queueProgressOverlay.expandCollapsedQueue') }}
    </span>
  </button>
</template>
