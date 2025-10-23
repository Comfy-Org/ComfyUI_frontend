<template>
  <div
    v-show="isVisible"
    :class="['flex', 'justify-end', 'w-full', 'pointer-events-none']"
  >
    <div
      class="pointer-events-auto w-[350px] min-w-[310px] rounded-lg border font-inter transition-colors duration-200 ease-in-out"
      :class="containerClass"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
    >
      <!-- Expanded state -->
      <QueueOverlayExpanded
        v-if="isExpanded"
        :header-title="headerTitle"
        :show-concurrent-indicator="showConcurrentIndicator"
        :concurrent-workflow-count="concurrentWorkflowCount"
        :queued-count="queuedCount"
        :selected-job-tab="selectedJobTab"
        :selected-workflow-filter="selectedWorkflowFilter"
        :displayed-job-groups="displayedJobGroups"
        @update:selected-job-tab="(v) => (selectedJobTab = v)"
        @update:selected-workflow-filter="(v) => (selectedWorkflowFilter = v)"
        @close="closeExpanded"
        @show-assets="openQueueSidebar"
        @clear-history="onClearHistoryFromMenu"
        @clear-queued="cancelQueuedWorkflows"
        @sort-click="() => {}"
        @clear-item="onClearItem"
        @view-item="onViewItem"
      />

      <QueueOverlayActive
        v-else-if="hasActiveJob"
        :total-progress-style="totalProgressStyle"
        :current-node-progress-style="currentNodeProgressStyle"
        :total-percent-formatted="totalPercentFormatted"
        :current-node-percent="currentNodePercent"
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
import { useQueueActions } from '@/composables/queue/useQueueActions'
import { useQueueProgress } from '@/composables/queue/useQueueProgress'
import { useResultGallery } from '@/composables/queue/useResultGallery'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'

const { t } = useI18n()
const queueStore = useQueueStore()
const executionStore = useExecutionStore()

const {
  totalPercentFormatted,
  currentNodePercent,
  totalProgressStyle,
  currentNodeProgressStyle
} = useQueueProgress()
const isHovered = ref(false)
const isExpanded = ref(false)
const containerClass = computed(() =>
  showBackground.value
    ? 'border-[var(--color-charcoal-400)] bg-[var(--color-charcoal-800)] shadow-md'
    : 'border-transparent bg-transparent shadow-none'
)
const bottomRowClass = computed(
  () =>
    `flex items-center justify-end gap-[var(--spacing-spacing-md)] transition-opacity duration-200 ease-in-out ${
      isActiveState.value
        ? 'opacity-100 pointer-events-auto'
        : 'opacity-0 pointer-events-none'
    }`
)

const runningCount = computed(() => queueStore.runningTasks.length)
const queuedCount = computed(() => queueStore.pendingTasks.length)
const hasHistory = computed(() => queueStore.historyTasks.length > 0)
const isExecuting = computed(() => !executionStore.isIdle)
const hasActiveJob = computed(() => runningCount.value > 0 || isExecuting.value)
const activeJobsCount = computed(
  () => runningCount.value + queueStore.pendingTasks.length
)

const isFullyInvisible = computed(
  () => !hasActiveJob.value && !hasHistory.value
)
const isEmptyState = computed(() => !hasActiveJob.value && hasHistory.value)
const isActiveState = computed(() => hasActiveJob.value && isHovered.value)

const showBackground = computed(
  () => isExpanded.value || isActiveState.value || isEmptyState.value
)

const isVisible = computed(() => !isFullyInvisible.value)
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
  filteredTasks,
  groupedJobItems,
  currentNodeName
} = useJobList()

const displayedJobGroups = computed(() => groupedJobItems.value)

const onClearItem = async (item: JobListItem) => {
  if (!item.taskRef) return
  await queueStore.delete(item.taskRef)
}

// Job context menu handled in QueueOverlayExpanded

const { galleryActiveIndex, galleryItems, onViewItem } = useResultGallery(
  () => filteredTasks.value
)

const openExpandedFromEmpty = () => {
  isExpanded.value = true
}

const closeExpanded = () => {
  isExpanded.value = false
}

const viewAllJobs = async () => {
  isExpanded.value = true
}

const onSummaryClick = () => {
  openExpandedFromEmpty()
  clearSummary()
}

const { openQueueSidebar, cancelQueuedWorkflows, interruptAll } =
  useQueueActions()
const onClearHistoryFromMenu = async () => {
  await queueStore.clear(['history'])
}
</script>
