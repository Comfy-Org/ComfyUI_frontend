<template>
  <div class="flex flex-col gap-4 px-3 pb-4">
    <div
      v-for="group in displayedJobGroups"
      :key="group.key"
      class="flex flex-col gap-2"
    >
      <div class="text-[12px] leading-none text-text-secondary">
        {{ group.label }}
      </div>
      <QueueJobItem
        v-for="ji in group.items"
        :key="ji.id"
        :job-id="ji.id"
        :workflow-id="ji.taskRef?.workflowId"
        :state="ji.state"
        :title="ji.title"
        :right-text="ji.meta"
        :icon-name="ji.iconName"
        :icon-image-url="ji.iconImageUrl"
        :show-clear="ji.showClear"
        :show-menu="true"
        :progress-total-percent="ji.progressTotalPercent"
        :progress-current-percent="ji.progressCurrentPercent"
        :running-node-name="ji.runningNodeName"
        :active-details-id="activeDetailsId"
        :is-focused="
          isConcurrentExecutionEnabled && ji.state === 'running'
            ? ji.id === String(executionStore.focusedJobId ?? '')
            : undefined
        "
        @cancel="emitCancelItem(ji)"
        @delete="emitDeleteItem(ji)"
        @menu="(ev) => $emit('menu', ji, ev)"
        @view="$emit('viewItem', ji)"
        @focus="executionStore.setFocusedJob(ji.id)"
        @details-enter="onDetailsEnter"
        @details-leave="onDetailsLeave"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import QueueJobItem from '@/components/queue/job/QueueJobItem.vue'
import { useConcurrentExecution } from '@/composables/useConcurrentExecution'
import type { JobGroup, JobListItem } from '@/composables/queue/useJobList'
import { useJobDetailsHover } from '@/composables/queue/useJobDetailsHover'
import { useExecutionStore } from '@/stores/executionStore'

const { displayedJobGroups } = defineProps<{ displayedJobGroups: JobGroup[] }>()

const executionStore = useExecutionStore()
const { isConcurrentExecutionEnabled } = useConcurrentExecution()

const emit = defineEmits<{
  (e: 'cancelItem', item: JobListItem): void
  (e: 'deleteItem', item: JobListItem): void
  (e: 'menu', item: JobListItem, ev: MouseEvent): void
  (e: 'viewItem', item: JobListItem): void
}>()

const {
  activeDetails: activeDetailsId,
  clearHoverTimers,
  scheduleDetailsHide,
  scheduleDetailsShow
} = useJobDetailsHover<string>({
  getActiveId: (jobId) => jobId,
  getDisplayedJobGroups: () => displayedJobGroups
})

function emitCancelItem(item: JobListItem) {
  emit('cancelItem', item)
}

function emitDeleteItem(item: JobListItem) {
  emit('deleteItem', item)
}

function onDetailsEnter(jobId: string) {
  if (activeDetailsId.value === jobId) {
    clearHoverTimers()
    return
  }

  scheduleDetailsShow(jobId)
}

function onDetailsLeave(jobId: string) {
  scheduleDetailsHide(jobId)
}
</script>
