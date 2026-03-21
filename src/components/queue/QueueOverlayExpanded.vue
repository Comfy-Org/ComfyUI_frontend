<template>
  <div class="flex w-full flex-col gap-4">
    <QueueOverlayHeader
      :header-title="headerTitle"
      :queued-count="queuedCount"
      @clear-history="$emit('clearHistory')"
      @clear-queued="$emit('clearQueued')"
    />

    <JobFiltersBar
      :selected-job-tab="selectedJobTab"
      :selected-workflow-filter="selectedWorkflowFilter"
      :selected-sort-mode="selectedSortMode"
      :has-failed-jobs="hasFailedJobs"
      @show-assets="$emit('showAssets')"
      @update:selected-job-tab="$emit('update:selectedJobTab', $event)"
      @update:selected-workflow-filter="
        $emit('update:selectedWorkflowFilter', $event)
      "
      @update:selected-sort-mode="$emit('update:selectedSortMode', $event)"
    />

    <div class="min-h-0 flex-1 overflow-y-auto">
      <JobAssetsList
        :displayed-job-groups="displayedJobGroups"
        :get-menu-entries="getJobMenuEntries"
        @cancel-item="onCancelItemEvent"
        @delete-item="onDeleteItemEvent"
        @menu-action="onJobMenuAction"
        @view-item="$emit('viewItem', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  JobGroup,
  JobListItem,
  JobSortMode,
  JobTab
} from '@/composables/queue/useJobList'
import type { MenuActionEntry } from '@/types/menuTypes'
import { useJobMenu } from '@/composables/queue/useJobMenu'
import { useErrorHandling } from '@/composables/useErrorHandling'

import QueueOverlayHeader from './QueueOverlayHeader.vue'
import JobAssetsList from './job/JobAssetsList.vue'
import JobFiltersBar from './job/JobFiltersBar.vue'

defineProps<{
  headerTitle: string
  queuedCount: number
  selectedJobTab: JobTab
  selectedWorkflowFilter: 'all' | 'current'
  selectedSortMode: JobSortMode
  displayedJobGroups: JobGroup[]
  hasFailedJobs: boolean
}>()

const emit = defineEmits<{
  (e: 'showAssets'): void
  (e: 'clearHistory'): void
  (e: 'clearQueued'): void
  (e: 'update:selectedJobTab', value: JobTab): void
  (e: 'update:selectedWorkflowFilter', value: 'all' | 'current'): void
  (e: 'update:selectedSortMode', value: JobSortMode): void
  (e: 'cancelItem', item: JobListItem): void
  (e: 'deleteItem', item: JobListItem): void
  (e: 'viewItem', item: JobListItem): void
}>()

const { wrapWithErrorHandlingAsync } = useErrorHandling()

const { getJobMenuEntries } = useJobMenu(undefined, (item) =>
  emit('viewItem', item)
)

const onCancelItemEvent = (item: JobListItem) => {
  emit('cancelItem', item)
}

const onDeleteItemEvent = (item: JobListItem) => {
  emit('deleteItem', item)
}

const onJobMenuAction = wrapWithErrorHandlingAsync(
  async (entry: MenuActionEntry) => {
    if (entry.onClick) await entry.onClick()
  }
)
</script>
