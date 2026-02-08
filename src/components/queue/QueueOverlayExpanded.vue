<template>
  <div class="flex w-full flex-col gap-4">
    <QueueOverlayHeader
      :header-title="headerTitle"
      :show-concurrent-indicator="showConcurrentIndicator"
      :concurrent-workflow-count="concurrentWorkflowCount"
      @clear-history="$emit('clearHistory')"
    />

    <div class="flex items-center justify-between px-3">
      <Button
        class="grow gap-1 justify-center"
        variant="secondary"
        size="sm"
        @click="$emit('showAssets')"
      >
        <i class="icon-[comfy--image-ai-edit] size-4" />
        <span>{{ t('sideToolbar.queueProgressOverlay.showAssets') }}</span>
      </Button>
      <div class="ml-4 inline-flex items-center">
        <div
          class="inline-flex h-6 items-center text-[12px] leading-none text-text-primary opacity-90"
        >
          <span class="font-bold">{{ queuedCount }}</span>
          <span class="ml-1">{{
            t('sideToolbar.queueProgressOverlay.queuedSuffix')
          }}</span>
        </div>
        <Button
          v-if="queuedCount > 0"
          class="ml-2"
          variant="destructive"
          size="icon"
          :aria-label="t('sideToolbar.queueProgressOverlay.clearQueued')"
          @click="$emit('clearQueued')"
        >
          <i class="icon-[lucide--list-x] size-4" />
        </Button>
      </div>
    </div>

    <JobFiltersBar
      :selected-job-tab="selectedJobTab"
      :selected-workflow-filter="selectedWorkflowFilter"
      :selected-sort-mode="selectedSortMode"
      :has-failed-jobs="hasFailedJobs"
      @update:selected-job-tab="$emit('update:selectedJobTab', $event)"
      @update:selected-workflow-filter="
        $emit('update:selectedWorkflowFilter', $event)
      "
      @update:selected-sort-mode="$emit('update:selectedSortMode', $event)"
    />

    <div class="flex-1 min-h-0 overflow-y-auto">
      <JobGroupsList
        :displayed-job-groups="displayedJobGroups"
        @cancel-item="onCancelItemEvent"
        @delete-item="onDeleteItemEvent"
        @view-item="$emit('viewItem', $event)"
        @menu="onMenuItem"
      />
    </div>

    <JobContextMenu
      ref="jobContextMenuRef"
      :entries="jobMenuEntries"
      @action="onJobMenuAction"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type {
  JobGroup,
  JobListItem,
  JobSortMode,
  JobTab
} from '@/composables/queue/useJobList'
import type { MenuEntry } from '@/composables/queue/useJobMenu'
import { useJobMenu } from '@/composables/queue/useJobMenu'

import QueueOverlayHeader from './QueueOverlayHeader.vue'
import JobContextMenu from './job/JobContextMenu.vue'
import JobFiltersBar from './job/JobFiltersBar.vue'
import JobGroupsList from './job/JobGroupsList.vue'

const {
  headerTitle,
  showConcurrentIndicator,
  concurrentWorkflowCount,
  queuedCount,
  selectedJobTab,
  selectedWorkflowFilter,
  selectedSortMode,
  displayedJobGroups,
  hasFailedJobs
} = defineProps<{
  headerTitle: string
  showConcurrentIndicator: boolean
  concurrentWorkflowCount: number
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

const { t } = useI18n()

const currentMenuItem = ref<JobListItem | null>(null)
const jobContextMenuRef = ref<InstanceType<typeof JobContextMenu> | null>(null)

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

const onMenuItem = (item: JobListItem, event: Event) => {
  currentMenuItem.value = item
  jobContextMenuRef.value?.open(event)
}

const onJobMenuAction = async (entry: MenuEntry) => {
  if (entry.kind === 'divider') return
  if (entry.onClick) await entry.onClick()
  jobContextMenuRef.value?.hide()
}
</script>
