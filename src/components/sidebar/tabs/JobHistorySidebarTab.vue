<template>
  <SidebarTabTemplate :title="$t('queue.jobHistory')">
    <template #alt-title>
      <div class="ml-auto flex shrink-0 items-center">
        <JobHistoryActionsMenu @clear-history="showQueueClearHistoryDialog" />
      </div>
    </template>
    <template #header>
      <JobFiltersBar
        class="pb-1"
        :selected-job-tab="selectedJobTab"
        :selected-workflow-filter="selectedWorkflowFilter"
        :selected-sort-mode="selectedSortMode"
        :has-failed-jobs="hasFailedJobs"
        :hide-show-assets-action="true"
        @update:selected-job-tab="onSelectedJobTabUpdate"
        @update:selected-workflow-filter="onSelectedWorkflowFilterUpdate"
        @update:selected-sort-mode="onSelectedSortModeUpdate"
      />
    </template>
    <template #body>
      <div class="h-full" />
    </template>
  </SidebarTabTemplate>
</template>

<script setup lang="ts">
import JobFiltersBar from '@/components/queue/job/JobFiltersBar.vue'
import JobHistoryActionsMenu from '@/components/queue/JobHistoryActionsMenu.vue'
import { useJobList } from '@/composables/queue/useJobList'
import type { JobSortMode, JobTab } from '@/composables/queue/useJobList'
import { useQueueClearHistoryDialog } from '@/composables/queue/useQueueClearHistoryDialog'
import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'

const { showQueueClearHistoryDialog } = useQueueClearHistoryDialog()
const {
  selectedJobTab,
  selectedWorkflowFilter,
  selectedSortMode,
  hasFailedJobs
} = useJobList()

const onSelectedJobTabUpdate = (value: JobTab) => {
  selectedJobTab.value = value
}

const onSelectedWorkflowFilterUpdate = (value: 'all' | 'current') => {
  selectedWorkflowFilter.value = value
}

const onSelectedSortModeUpdate = (value: JobSortMode) => {
  selectedSortMode.value = value
}
</script>
