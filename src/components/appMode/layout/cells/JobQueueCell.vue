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
    class="job-queue-cell"
    data-testid="layout-job-queue-cell"
    :aria-label="t('sideToolbar.queueProgressOverlay.expandCollapsedQueue')"
    :title="t('sideToolbar.queueProgressOverlay.expandCollapsedQueue')"
    @click="handleClick"
  >
    <i class="job-queue-cell__icon icon-[lucide--layers]" />
    <span class="job-queue-cell__label">
      {{
        t(
          'sideToolbar.queueProgressOverlay.activeJobsShort',
          { count: n(activeJobsCount) },
          activeJobsCount
        )
      }}
    </span>
  </button>
</template>

<style scoped>
.job-queue-cell {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 12px;
  border: none;
  border-radius: inherit;
  background: transparent;
  color: var(--layout-color-text);
  font-family: inherit;
  font-size: var(--layout-font-md);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background-color var(--layout-transition-duration)
    var(--layout-transition-easing);
}

.job-queue-cell:hover {
  background-color: var(--layout-color-cell-hover);
}

.job-queue-cell__icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.job-queue-cell__label {
  white-space: nowrap;
}
</style>
