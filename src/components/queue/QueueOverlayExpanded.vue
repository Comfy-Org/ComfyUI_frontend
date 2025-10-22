<template>
  <div class="flex w-full flex-col gap-[var(--spacing-spacing-md)]">
    <QueueOverlayHeader
      :header-title="headerTitle"
      :show-concurrent-indicator="showConcurrentIndicator"
      :concurrent-workflow-count="concurrentWorkflowCount"
      @close="$emit('close')"
      @show-assets="$emit('showAssets')"
      @clear-history="$emit('clearHistory')"
    />

    <div
      class="flex items-center justify-between px-[var(--spacing-spacing-sm)]"
    >
      <button
        class="inline-flex grow items-center justify-center gap-[var(--spacing-spacing-xxs)] rounded border-0 bg-[var(--color-charcoal-500)] p-[var(--spacing-spacing-xs)] text-center font-inter text-[12px] leading-none text-white hover:bg-[var(--color-charcoal-600)] hover:opacity-90"
        :aria-label="t('sideToolbar.queueProgressOverlay.showAssets')"
        @click="$emit('showAssets')"
      >
        <i-comfy:image-ai-edit
          class="pointer-events-none block size-4 shrink-0 leading-none"
          aria-hidden="true"
        />
        <span>{{ t('sideToolbar.queueProgressOverlay.showAssets') }}</span>
      </button>
      <div class="ml-[var(--spacing-spacing-md)] inline-flex items-center">
        <div
          class="inline-flex h-6 items-center text-[12px] leading-none text-white opacity-90"
        >
          <span class="font-bold">{{ queuedCount }}</span>
          <span class="ml-[var(--spacing-spacing-xss)]">{{
            t('sideToolbar.queueProgressOverlay.queuedSuffix')
          }}</span>
        </div>
        <button
          v-if="queuedCount > 0"
          class="ml-[var(--spacing-spacing-xs)] inline-flex size-6 items-center justify-center rounded border-0 bg-[var(--color-charcoal-500)] p-0 hover:bg-[var(--color-charcoal-600)] hover:opacity-90"
          :aria-label="t('sideToolbar.queueProgressOverlay.clearQueued')"
          @click="$emit('clearQueued')"
        >
          <i
            class="pointer-events-none icon-[lucide--list-x] block size-4 leading-none text-white"
          />
        </button>
      </div>
    </div>

    <JobFiltersBar
      :selected-job-tab="selectedJobTab"
      :selected-workflow-filter="selectedWorkflowFilter"
      @update:selected-job-tab="$emit('update:selectedJobTab', $event)"
      @update:selected-workflow-filter="
        $emit('update:selectedWorkflowFilter', $event)
      "
      @sort-click="$emit('sortClick')"
    />

    <JobGroupsList
      :displayed-job-groups="displayedJobGroups"
      @clear-item="$emit('clearItem', $event)"
      @view-item="$emit('viewItem', $event)"
      @menu="onMenuItem"
    />

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

import type { JobListItem } from '@/composables/queue/useJobList'
import { useJobMenu } from '@/composables/queue/useJobMenu'

import QueueOverlayHeader from './QueueOverlayHeader.vue'
import JobContextMenu from './job/JobContextMenu.vue'
import JobFiltersBar from './job/JobFiltersBar.vue'
import JobGroupsList from './job/JobGroupsList.vue'

type JobTab = 'All' | 'Completed' | 'Failed'
type JobGroup = { key: string; label: string; items: JobListItem[] }

defineProps<{
  headerTitle: string
  showConcurrentIndicator: boolean
  concurrentWorkflowCount: number
  queuedCount: number
  selectedJobTab: JobTab
  selectedWorkflowFilter: 'all' | 'current'
  displayedJobGroups: JobGroup[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'showAssets'): void
  (e: 'clearHistory'): void
  (e: 'clearQueued'): void
  (e: 'sortClick'): void
  (e: 'update:selectedJobTab', value: JobTab): void
  (e: 'update:selectedWorkflowFilter', value: 'all' | 'current'): void
  (e: 'clearItem', item: JobListItem): void
  (e: 'viewItem', item: JobListItem): void
}>()

const { t } = useI18n()

const currentMenuItem = ref<JobListItem | null>(null)
const jobContextMenuRef = ref<InstanceType<typeof JobContextMenu> | null>(null)

const { jobMenuEntries } = useJobMenu(
  () => currentMenuItem.value,
  (item) => emit('viewItem', item)
)

const onMenuItem = (item: JobListItem, event: Event) => {
  currentMenuItem.value = item
  jobContextMenuRef.value?.open(event)
}

const onJobMenuAction = async (entry: any) => {
  if (entry.kind === 'divider') return
  if (entry.onClick) await entry.onClick()
  jobContextMenuRef.value?.hide()
}
</script>
