<template>
  <SidebarTabTemplate
    data-testid="job-history-sidebar"
    :title="$t('queue.jobHistory')"
  >
    <template #tool-buttons>
      <JobHistoryActionsMenu @clear-history="onClearHistory" />
    </template>
    <template #header>
      <div class="overflow-x-auto px-4 pt-2 pb-px">
        <TabList
          :aria-label="$t('queue.jobHistory')"
          :model-value="selectedJobTab"
          @update:model-value="onUpdateSelectedJobTab"
        >
          <Tab v-for="tab in visibleJobTabs" :key="tab" :value="tab">
            {{ t(jobTabLabelKeys[tab]) }}
          </Tab>
        </TabList>
      </div>
      <JobFilterActions
        v-model:selected-workflow-filter="selectedWorkflowFilter"
        v-model:selected-sort-mode="selectedSortMode"
        v-model:search-query="searchQuery"
        class="px-4 py-2"
        :hide-show-assets-action="true"
        :show-search="true"
        :search-placeholder="t('g.searchPlaceholder', { subject: t('g.jobs') })"
      />
      <div
        class="flex items-center justify-between px-4 pb-2 text-xs leading-none text-text-primary"
      >
        <span class="text-text-secondary">{{ activeQueueSummary }}</span>
        <div class="flex items-center gap-2">
          <span class="text-xs text-base-foreground">
            {{ t('sideToolbar.queueProgressOverlay.clearQueueTooltip') }}
          </span>
          <Button
            variant="destructive"
            size="icon"
            :aria-label="
              t('sideToolbar.queueProgressOverlay.clearQueueTooltip')
            "
            :disabled="queuedCount === 0"
            @click="clearQueuedWorkflows"
          >
            <i class="icon-[lucide--list-x] size-4" />
          </Button>
        </div>
      </div>
    </template>
    <template #body>
      <div class="flex h-full min-h-0 flex-col">
        <div
          :id="`tabpanel-${selectedJobTab}`"
          role="tabpanel"
          :aria-labelledby="`tab-${selectedJobTab}`"
          class="flex min-h-0 flex-1 flex-col"
        >
          <JobAssetsList
            class="scrollbar-custom min-h-0 flex-1"
            :displayed-job-groups="displayedJobGroups"
            @cancel-item="onCancelItem"
            @delete-item="onDeleteItem"
            @view-item="onViewItem"
            @menu="onMenuItem"
          />
        </div>
        <ContextMenu ref="jobContextMenuRef" :model="jobMenuEntries" />
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

import { LOAD3D_VIEWER_DIALOG_PROPS } from '@/components/load3d/load3dViewerDialog'
import JobFilterActions from '@/components/queue/job/JobFilterActions.vue'
import JobAssetsList from '@/components/queue/job/JobAssetsList.vue'
import JobHistoryActionsMenu from '@/components/queue/JobHistoryActionsMenu.vue'
import ContextMenu from '@/components/ui/menu/ContextMenu.vue'
import { useJobMenu } from '@/composables/queue/useJobMenu'
import { getVisibleJobTabs, jobTabLabelKeys } from '@/composables/queue/jobTabs'
import type { JobTab } from '@/composables/queue/jobTabs'
import { useJobList } from '@/composables/queue/useJobList'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useQueueClearHistoryDialog } from '@/composables/queue/useQueueClearHistoryDialog'
import { useResultGallery } from '@/composables/queue/useResultGallery'
import { useErrorHandling } from '@/composables/useErrorHandling'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import MediaLightbox from '@/components/sidebar/tabs/queue/MediaLightbox.vue'
import Tab from '@/components/tab/Tab.vue'
import TabList from '@/components/tab/TabList.vue'
import Button from '@/components/ui/button/Button.vue'
import { useSurveyFeatureTracking } from '@/platform/surveys/useSurveyFeatureTracking'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'
import { is3DResult } from '@/utils/resultItem'

const Load3dViewerContent = defineAsyncComponent(
  () => import('@/components/load3d/Load3dViewerContent.vue')
)

const { t, n } = useI18n()
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

const visibleJobTabs = computed(() => getVisibleJobTabs(hasFailedJobs.value))

const displayedJobGroups = computed(() => groupedJobItems.value)
const runningCount = computed(() => queueStore.runningTasks.length)
const queuedCount = computed(() => queueStore.pendingTasks.length)

const runningJobsLabel = computed(() =>
  t('sideToolbar.queueProgressOverlay.runningJobsLabel', {
    count: n(runningCount.value)
  })
)
const queuedJobsLabel = computed(() =>
  t('sideToolbar.queueProgressOverlay.queuedJobsLabel', {
    count: n(queuedCount.value)
  })
)
const activeQueueSummary = computed(() => {
  if (runningCount.value === 0 && queuedCount.value === 0) {
    return t('sideToolbar.queueProgressOverlay.noActiveJobs')
  }
  if (queuedCount.value === 0) {
    return runningJobsLabel.value
  }
  if (runningCount.value === 0) {
    return queuedJobsLabel.value
  }
  return t('sideToolbar.queueProgressOverlay.runningQueuedSummary', {
    running: runningJobsLabel.value,
    queued: queuedJobsLabel.value
  })
})

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

  if (previewOutput && is3DResult(previewOutput)) {
    dialogStore.showDialog({
      key: 'asset-3d-viewer',
      title: item.title,
      component: Load3dViewerContent,
      props: {
        modelUrl: previewOutput.url || ''
      },
      dialogComponentProps: LOAD3D_VIEWER_DIALOG_PROPS
    })
    return
  }

  await openResultGallery(item)
})

const onInspectAsset = (item: JobListItem) => {
  void onViewItem(item)
}

const currentMenuItem = ref<JobListItem | null>(null)
const jobContextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null)

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
  const isSameClickTarget =
    event.type === 'click' && currentMenuItem.value?.id === item.id
  currentMenuItem.value = item
  if (isSameClickTarget) jobContextMenuRef.value?.toggle(event)
  else jobContextMenuRef.value?.show(event)
}
</script>
