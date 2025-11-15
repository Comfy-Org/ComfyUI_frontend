<template>
  <div
    v-show="isVisible"
    :class="['flex', 'justify-end', 'w-full', 'pointer-events-none']"
  >
    <div
      class="pointer-events-auto flex w-[350px] min-w-[310px] max-h-[60vh] flex-col overflow-hidden rounded-lg border font-inter transition-colors duration-200 ease-in-out"
      :class="containerClass"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
    >
      <!-- Expanded state -->
      <QueueOverlayExpanded
        v-if="isExpanded"
        v-model:selected-job-tab="selectedJobTab"
        v-model:selected-workflow-filter="selectedWorkflowFilter"
        v-model:selected-sort-mode="selectedSortMode"
        class="flex-1 min-h-0"
        :header-title="headerTitle"
        :show-concurrent-indicator="showConcurrentIndicator"
        :concurrent-workflow-count="concurrentWorkflowCount"
        :queued-count="queuedCount"
        :displayed-job-groups="displayedJobGroups"
        @close="closeExpanded"
        @show-assets="openQueueSidebar"
        @clear-history="onClearHistoryFromMenu"
        @clear-queued="cancelQueuedWorkflows"
        @clear-item="onClearItem"
        @view-item="onViewItem"
      />

      <QueueOverlayActive
        v-else-if="hasActiveJob"
        :total-progress-style="totalProgressStyle"
        :current-node-progress-style="currentNodeProgressStyle"
        :total-percent-formatted="totalPercentFormatted"
        :current-node-percent-formatted="currentNodePercentFormatted"
        :current-node-name="currentNodeName"
        :running-count="runningCount"
        :bottom-row-class="bottomRowClass"
        @interrupt-all="interruptAll"
        @view-all-jobs="viewAllJobs"
      />

      <QueueOverlayEmpty
        v-else
        :summary="completionSummary"
        @summary-click="onSummaryClick"
        @expand="openExpandedFromEmpty"
      />
    </div>
  </div>

  <ResultGallery
    v-model:active-index="galleryActiveIndex"
    :all-gallery-items="galleryItems"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import QueueOverlayActive from '@/components/queue/QueueOverlayActive.vue'
import QueueOverlayEmpty from '@/components/queue/QueueOverlayEmpty.vue'
import QueueOverlayExpanded from '@/components/queue/QueueOverlayExpanded.vue'
import ResultGallery from '@/components/sidebar/tabs/queue/ResultGallery.vue'
import { useCompletionSummary } from '@/composables/queue/useCompletionSummary'
import { useJobList } from '@/composables/queue/useJobList'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import { useResultGallery } from '@/composables/queue/useResultGallery'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { api } from '@/scripts/api'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

type OverlayState = 'hidden' | 'empty' | 'active' | 'expanded'

const { t } = useI18n()
const queueStore = useQueueStore()
const commandStore = useCommandStore()
const executionStore = useExecutionStore()
const sidebarTabStore = useSidebarTabStore()
const { wrapWithErrorHandlingAsync } = useErrorHandling()

const {
  totalPercentFormatted,
  currentNodePercentFormatted,
  totalProgressStyle,
  currentNodeProgressStyle
} = useQueueProgress()
const isHovered = ref(false)
const isExpanded = ref(false)

const runningCount = computed(() => queueStore.runningTasks.length)
const queuedCount = computed(() => queueStore.pendingTasks.length)
const hasHistory = computed(() => queueStore.historyTasks.length > 0)
const isExecuting = computed(() => !executionStore.isIdle)
const hasActiveJob = computed(() => runningCount.value > 0 || isExecuting.value)
const activeJobsCount = computed(() => runningCount.value + queuedCount.value)

const overlayState = computed<OverlayState>(() => {
  if (isExpanded.value) return 'expanded'
  if (!hasActiveJob.value && !hasHistory.value) return 'hidden'
  if (!hasActiveJob.value && hasHistory.value) return 'empty'
  return 'active'
})

const showBackground = computed(
  () =>
    overlayState.value === 'expanded' ||
    overlayState.value === 'empty' ||
    (overlayState.value === 'active' && isHovered.value)
)

const isVisible = computed(() => overlayState.value !== 'hidden')

const containerClass = computed(() =>
  showBackground.value
    ? 'border-interface-stroke bg-interface-panel-surface shadow-interface'
    : 'border-transparent bg-transparent shadow-none'
)

const bottomRowClass = computed(
  () =>
    `flex items-center justify-end gap-4 transition-opacity duration-200 ease-in-out ${
      overlayState.value === 'active' && isHovered.value
        ? 'opacity-100 pointer-events-auto'
        : 'opacity-0 pointer-events-none'
    }`
)
const { summary: completionSummary, clearSummary } = useCompletionSummary()

const headerTitle = computed(() =>
  hasActiveJob.value
    ? `${activeJobsCount.value} ${t('sideToolbar.queueProgressOverlay.activeJobsSuffix')}`
    : t('sideToolbar.queueProgressOverlay.jobQueue')
)

const concurrentWorkflowCount = computed(
  () => executionStore.runningWorkflowCount
)
const showConcurrentIndicator = computed(
  () => concurrentWorkflowCount.value > 1
)

const {
  selectedJobTab,
  selectedWorkflowFilter,
  selectedSortMode,
  filteredTasks,
  groupedJobItems,
  currentNodeName
} = useJobList()

const displayedJobGroups = computed(() => groupedJobItems.value)

const onClearItem = wrapWithErrorHandlingAsync(async (item: JobListItem) => {
  if (!item.taskRef) return
  await queueStore.delete(item.taskRef)
})

const { galleryActiveIndex, galleryItems, onViewItem } = useResultGallery(
  () => filteredTasks.value
)

const setExpanded = (expanded: boolean) => {
  isExpanded.value = expanded
}

const openExpandedFromEmpty = () => {
  setExpanded(true)
}

const closeExpanded = () => {
  setExpanded(false)
}

const viewAllJobs = () => {
  setExpanded(true)
}

const onSummaryClick = () => {
  openExpandedFromEmpty()
  clearSummary()
}

const openQueueSidebar = () => {
  sidebarTabStore.activeSidebarTabId = 'queue'
}

const cancelQueuedWorkflows = wrapWithErrorHandlingAsync(async () => {
  await commandStore.execute('Comfy.ClearPendingTasks')
})

const interruptAll = wrapWithErrorHandlingAsync(async () => {
  const tasks = queueStore.runningTasks
  await Promise.all(
    tasks
      .filter((task) => task.promptId != null)
      .map((task) => api.interrupt(task.promptId))
  )
})

const onClearHistoryFromMenu = wrapWithErrorHandlingAsync(async () => {
  await queueStore.clear(['history'])
})
</script>
