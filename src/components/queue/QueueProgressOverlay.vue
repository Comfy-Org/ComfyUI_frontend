<template>
  <div
    v-if="isOverlayVisible"
    class="flex justify-end w-full pointer-events-none"
  >
    <div
      class="pointer-events-auto flex w-[350px] min-w-[310px] max-h-[60vh] flex-col overflow-hidden rounded-lg border border-interface-stroke bg-interface-panel-surface font-inter shadow-interface"
    >
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
        :has-failed-jobs="hasFailedJobs"
        @show-assets="openAssetsSidebar"
        @clear-history="onClearHistoryFromMenu"
        @clear-queued="cancelQueuedWorkflows"
        @cancel-item="onCancelItem"
        @delete-item="onDeleteItem"
        @view-item="inspectJobAsset"
      />
      <QueueOverlayEmpty
        v-else-if="completionSummary"
        :summary="completionSummary"
        @summary-click="onSummaryClick"
      />
    </div>
  </div>

  <ResultGallery
    v-model:active-index="galleryActiveIndex"
    :all-gallery-items="galleryItems"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import QueueOverlayEmpty from '@/components/queue/QueueOverlayEmpty.vue'
import QueueOverlayExpanded from '@/components/queue/QueueOverlayExpanded.vue'
import QueueClearHistoryDialog from '@/components/queue/dialogs/QueueClearHistoryDialog.vue'
import ResultGallery from '@/components/sidebar/tabs/queue/ResultGallery.vue'
import { useCompletionSummary } from '@/composables/queue/useCompletionSummary'
import { useJobList } from '@/composables/queue/useJobList'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useResultGallery } from '@/composables/queue/useResultGallery'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useAssetSelectionStore } from '@/platform/assets/composables/useAssetSelectionStore'
import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/stores/assetsStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

const { expanded } = defineProps<{
  expanded?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:expanded', value: boolean): void
}>()

const { t } = useI18n()
const queueStore = useQueueStore()
const commandStore = useCommandStore()
const executionStore = useExecutionStore()
const sidebarTabStore = useSidebarTabStore()
const dialogStore = useDialogStore()
const assetsStore = useAssetsStore()
const assetSelectionStore = useAssetSelectionStore()
const { wrapWithErrorHandlingAsync } = useErrorHandling()

const internalExpanded = ref(false)
const isExpanded = computed({
  get: () => (expanded === undefined ? internalExpanded.value : expanded),
  set: (value) => {
    if (expanded === undefined) {
      internalExpanded.value = value
    }
    emit('update:expanded', value)
  }
})

const { summary: completionSummary, clearSummary } = useCompletionSummary()
const isOverlayVisible = computed(
  () => isExpanded.value || completionSummary.value !== null
)

const runningCount = computed(() => queueStore.runningTasks.length)
const queuedCount = computed(() => queueStore.pendingTasks.length)
const isExecuting = computed(() => !executionStore.isIdle)
const hasActiveJob = computed(() => runningCount.value > 0 || isExecuting.value)
const activeJobsCount = computed(() => runningCount.value + queuedCount.value)
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
  hasFailedJobs,
  filteredTasks,
  groupedJobItems
} = useJobList()

const displayedJobGroups = computed(() => groupedJobItems.value)

const onCancelItem = wrapWithErrorHandlingAsync(async (item: JobListItem) => {
  const promptId = item.taskRef?.promptId
  if (!promptId) return

  if (item.state === 'running' || item.state === 'initialization') {
    // Running/initializing jobs: interrupt execution
    // Cloud backend uses deleteItem, local uses interrupt
    if (isCloud) {
      await api.deleteItem('queue', promptId)
    } else {
      await api.interrupt(promptId)
    }
    executionStore.clearInitializationByPromptId(promptId)
    await queueStore.update()
  } else if (item.state === 'pending') {
    // Pending jobs: remove from queue
    await api.deleteItem('queue', promptId)
    await queueStore.update()
  }
})

const onDeleteItem = wrapWithErrorHandlingAsync(async (item: JobListItem) => {
  if (!item.taskRef) return
  await queueStore.delete(item.taskRef)
})

const {
  galleryActiveIndex,
  galleryItems,
  onViewItem: openResultGallery
} = useResultGallery(() => filteredTasks.value)

const onSummaryClick = () => {
  isExpanded.value = true
  clearSummary()
}

const openAssetsSidebar = () => {
  sidebarTabStore.activeSidebarTabId = 'assets'
}

const focusAssetInSidebar = async (item: JobListItem) => {
  const task = item.taskRef
  const promptId = task?.promptId
  const preview = task?.previewOutput
  if (!promptId || !preview) return

  const assetId = String(promptId)
  openAssetsSidebar()
  await nextTick()
  await assetsStore.updateHistory()
  const asset = assetsStore.historyAssets.find(
    (existingAsset) => existingAsset.id === assetId
  )
  if (!asset) {
    throw new Error('Asset not found in media assets panel')
  }
  assetSelectionStore.setSelection([assetId])
}

const inspectJobAsset = wrapWithErrorHandlingAsync(
  async (item: JobListItem) => {
    await openResultGallery(item)
    await focusAssetInSidebar(item)
  }
)

const cancelQueuedWorkflows = wrapWithErrorHandlingAsync(async () => {
  // Capture pending promptIds before clearing
  const pendingPromptIds = queueStore.pendingTasks
    .map((task) => task.promptId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  await commandStore.execute('Comfy.ClearPendingTasks')

  // Clear initialization state for removed prompts
  executionStore.clearInitializationByPromptIds(pendingPromptIds)
})

const showClearHistoryDialog = () => {
  dialogStore.showDialog({
    key: 'queue-clear-history',
    component: QueueClearHistoryDialog,
    dialogComponentProps: {
      headless: true,
      closable: false,
      closeOnEscape: true,
      dismissableMask: true,
      pt: {
        root: {
          class: 'max-w-[360px] w-auto bg-transparent border-none shadow-none'
        },
        content: {
          class: '!p-0 bg-transparent'
        }
      }
    }
  })
}

const onClearHistoryFromMenu = () => {
  showClearHistoryDialog()
}
</script>
