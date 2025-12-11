<template>
  <div class="flex w-full flex-col gap-2">
    <QueueOverlayHeader
      :header-title="headerTitle"
      :show-concurrent-indicator="showConcurrentIndicator"
      :concurrent-workflow-count="concurrentWorkflowCount"
      @clear-history="$emit('clearHistory')"
      @close="$emit('close')"
    />

    <div
      class="flex h-8 items-center justify-between px-3 text-[12px] leading-none"
    >
      <span class="text-muted-foreground">
        {{ activeJobsCount }}
        {{ t('sideToolbar.queueProgressOverlay.activeJobsSuffix') }}
      </span>
      <div
        v-if="queuedCount > 0"
        class="inline-flex items-center gap-2 text-text-primary"
      >
        <span class="opacity-90">
          {{ t('sideToolbar.queueProgressOverlay.clearQueue') }}
        </span>
        <IconButton
          type="transparent"
          size="sm"
          class="size-8 rounded-lg bg-destructive-background text-base-foreground hover:bg-destructive-background-hover transition-colors"
          :aria-label="t('sideToolbar.queueProgressOverlay.clearQueue')"
          @click="$emit('clearQueued')"
        >
          <i class="icon-[lucide--list-x] size-4" />
        </IconButton>
      </div>
    </div>

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

import IconButton from '@/components/button/IconButton.vue'
import type { JobGroup, JobListItem } from '@/composables/queue/useJobList'
import type { MenuEntry } from '@/composables/queue/useJobMenu'
import { useJobMenu } from '@/composables/queue/useJobMenu'

import QueueOverlayHeader from './QueueOverlayHeader.vue'
import JobContextMenu from './job/JobContextMenu.vue'
import JobGroupsList from './job/JobGroupsList.vue'

defineProps<{
  headerTitle: string
  showConcurrentIndicator: boolean
  concurrentWorkflowCount: number
  queuedCount: number
  activeJobsCount: number
  displayedJobGroups: JobGroup[]
}>()

const emit = defineEmits<{
  (e: 'clearHistory'): void
  (e: 'clearQueued'): void
  (e: 'close'): void
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
