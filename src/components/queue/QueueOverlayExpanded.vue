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
      @update:selected-job-tab="onUpdateSelectedJobTab"
      @update:selected-workflow-filter="
        $emit('update:selectedWorkflowFilter', $event)
      "
      @update:selected-sort-mode="$emit('update:selectedSortMode', $event)"
    />

    <div class="min-h-0 flex-1">
      <JobAssetsList
        :displayed-job-groups="displayedJobGroups"
        @cancel-item="onCancelItemEvent"
        @delete-item="onDeleteItemEvent"
        @view-item="$emit('viewItem', $event)"
        @menu="onMenuItem"
      />
    </div>

    <Menu v-bind="jobMenuProps" :items="jobMenuEntries" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import Menu from '@/components/ui/menu/Menu.vue'
import { usePointMenu } from '@/components/ui/menu/usePointMenu'
import type {
  JobGroup,
  JobListItem,
  JobSortMode,
  JobTab
} from '@/composables/queue/useJobList'
import { useJobMenu } from '@/composables/queue/useJobMenu'
import { useSurveyFeatureTracking } from '@/platform/surveys/useSurveyFeatureTracking'

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

const currentMenuItem = ref<JobListItem | null>(null)
const {
  menuProps: jobMenuProps,
  show: showJobMenu,
  toggle: toggleJobMenu
} = usePointMenu()
const { trackFeatureUsed } = useSurveyFeatureTracking('queue-progress-overlay')

const { jobMenuEntries } = useJobMenu(
  () => currentMenuItem.value,
  (item) => emit('viewItem', item)
)
const onCancelItemEvent = (item: JobListItem) => {
  emit('cancelItem', item)
}

const onDeleteItemEvent = (item: JobListItem) => {
  emit('deleteItem', item)
}

const onUpdateSelectedJobTab = (value: JobTab) => {
  trackFeatureUsed()
  emit('update:selectedJobTab', value)
}

const onMenuItem = (item: JobListItem, event: Event) => {
  const isSameJob = currentMenuItem.value?.id === item.id
  currentMenuItem.value = item
  if (event.type === 'click' && isSameJob) toggleJobMenu(event)
  else showJobMenu(event)
}
</script>
