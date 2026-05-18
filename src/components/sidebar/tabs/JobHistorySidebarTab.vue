<template>
  <SidebarTabTemplate :title="$t('queue.jobHistory')">
    <template #alt-title>
      <JobHistoryStatusWidgets
        class="ml-auto"
        :queued-count="queuedCount"
        :running-count="runningCount"
        @clear-queued="clearQueuedWorkflows"
      />
    </template>
    <template #tool-buttons>
      <JobHistoryActionsMenu @clear-history="onClearHistory" />
    </template>
    <template #header>
      <SidebarTopArea>
        <JobFilterActions
          v-model:selected-workflow-filter="selectedWorkflowFilter"
          v-model:selected-sort-mode="selectedSortMode"
          v-model:search-query="searchQuery"
          :hide-show-assets-action="true"
          :show-search="true"
          :search-placeholder="t('sideToolbar.queueProgressOverlay.searchJobs')"
        />
      </SidebarTopArea>
      <div class="px-2 pb-2 2xl:px-4">
        <TabList
          :model-value="selectedJobTab"
          @update:model-value="onUpdateSelectedJobTab"
        >
          <Tab v-for="tab in visibleJobTabs" :key="tab" :value="tab">
            {{ jobTabLabel(tab) }}
          </Tab>
        </TabList>
      </div>
    </template>
    <template #body>
      <div class="flex h-full min-h-0 flex-col">
        <JobAssetsList
          class="scrollbar-custom min-h-0 flex-1 pt-2"
          :displayed-job-groups="displayedJobGroups"
          @cancel-item="onCancelItem"
          @delete-item="onDeleteItem"
          @view-item="onViewItem"
          @menu="onMenuItem"
        />
        <JobContextMenu
          ref="jobContextMenuRef"
          :entries="jobMenuEntries"
          @action="onJobMenuAction"
        />
        <MediaLightbox
          v-model:active-index="galleryActiveIndex"
          :all-gallery-items="galleryItems"
        />
      </div>
    </template>
  </SidebarTabTemplate>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import JobAssetsList from '@/components/queue/job/JobAssetsList.vue'
import JobContextMenu from '@/components/queue/job/JobContextMenu.vue'
import JobFilterActions from '@/components/queue/job/JobFilterActions.vue'
import JobHistoryStatusWidgets from '@/components/queue/job/JobHistoryStatusWidgets.vue'
import JobHistoryActionsMenu from '@/components/queue/JobHistoryActionsMenu.vue'
import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
import type { MenuEntry } from '@/composables/queue/useJobMenu'
import { useJobMenu } from '@/composables/queue/useJobMenu'
import { jobTabs, useJobList } from '@/composables/queue/useJobList'
import type { JobListItem, JobTab } from '@/composables/queue/useJobList'
import { useQueueClearHistoryDialog } from '@/composables/queue/useQueueClearHistoryDialog'
import { useResultGallery } from '@/composables/queue/useResultGallery'
import { useErrorHandling } from '@/composables/useErrorHandling'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import SidebarTopArea from '@/components/sidebar/tabs/SidebarTopArea.vue'
import MediaLightbox from '@/components/sidebar/tabs/queue/MediaLightbox.vue'
import { useSurveyFeatureTracking } from '@/platform/surveys/useSurveyFeatureTracking'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'

const Load3dViewerContent = defineAsyncComponent(
  () => import('@/components/load3d/Load3dViewerContent.vue')
)

const { t } = useI18n()
const commandStore = useCommandStore()
const dialogStore = useDialogStore()
const executionStore = useExecutionStore()
const queueStore = useQueueStore()
const { showQueueClearHistoryDialog } = useQueueClearHistoryDialog()
const { wrapWithErrorHandlingAsync } = useErrorHandling()
const { trackFeatureUsed } = useSurveyFeatureTracking('queue-progress-overlay')

const onClearHistory = () => {
  trackFeatureUsed()
  showQueueClearHistoryDialog()
}

const onUpdateSelectedJobTab = (value: JobTab) => {
  trackFeatureUsed()
  selectedJobTab.value = value
}
const {
  selectedJobTab,
  selectedWorkflowFilter,
  selectedSortMode,
  searchQuery,
  hasFailedJobs,
  filteredTasks,
  groupedJobItems
} = useJobList()

const displayedJobGroups = computed(() => groupedJobItems.value)
const runningCount = computed(() => queueStore.runningTasks.length)
const queuedCount = computed(() => queueStore.pendingTasks.length)

const visibleJobTabs = computed(() =>
  hasFailedJobs.value ? jobTabs : jobTabs.filter((tab) => tab !== 'Failed')
)
const jobTabLabel = (tab: JobTab) => {
  if (tab === 'All') return t('g.all')
  if (tab === 'Completed') return t('g.completed')
  return t('g.failed')
}

const clearQueuedWorkflows = wrapWithErrorHandlingAsync(async () => {
  trackFeatureUsed()
  const pendingJobIds = queueStore.pendingTasks
    .map((task) => task.jobId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  await commandStore.execute('Comfy.ClearPendingTasks')
  executionStore.clearInitializationByJobIds(pendingJobIds)
})

const {
  galleryActiveIndex,
  galleryItems,
  onViewItem: openResultGallery
} = useResultGallery(() => filteredTasks.value)

const onViewItem = wrapWithErrorHandlingAsync(async (item: JobListItem) => {
  trackFeatureUsed()
  const previewOutput = item.taskRef?.previewOutput

  if (previewOutput?.is3D) {
    dialogStore.showDialog({
      key: 'asset-3d-viewer',
      title: item.title,
      component: Load3dViewerContent,
      props: {
        modelUrl: previewOutput.url || ''
      },
      dialogComponentProps: {
        style: 'width: 80vw; height: 80vh;',
        maximizable: true
      }
    })
    return
  }

  await openResultGallery(item)
})

const onInspectAsset = (item: JobListItem) => {
  void onViewItem(item)
}

const currentMenuItem = ref<JobListItem | null>(null)
const jobContextMenuRef = ref<InstanceType<typeof JobContextMenu> | null>(null)

const { jobMenuEntries, cancelJob } = useJobMenu(
  () => currentMenuItem.value,
  onInspectAsset
)

const onCancelItem = wrapWithErrorHandlingAsync(async (item: JobListItem) => {
  trackFeatureUsed()
  await cancelJob(item)
})

const onDeleteItem = wrapWithErrorHandlingAsync(async (item: JobListItem) => {
  trackFeatureUsed()
  if (!item.taskRef) return
  await queueStore.delete(item.taskRef)
})

const onMenuItem = (item: JobListItem, event: Event) => {
  currentMenuItem.value = item
  jobContextMenuRef.value?.open(event)
}

const onJobMenuAction = wrapWithErrorHandlingAsync(async (entry: MenuEntry) => {
  if (entry.kind === 'divider') return
  if (entry.onClick) await entry.onClick()
  jobContextMenuRef.value?.hide()
})
</script>
