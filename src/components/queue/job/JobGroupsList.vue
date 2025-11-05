<template>
  <div
    class="flex flex-col gap-[var(--spacing-spacing-md)] px-[var(--spacing-spacing-sm)] pb-[var(--spacing-spacing-md)]"
  >
    <div
      v-for="group in displayedJobGroups"
      :key="group.key"
      class="flex flex-col gap-[var(--spacing-spacing-xs)]"
    >
      <div class="text-[12px] leading-none text-[var(--color-slate-100)]">
        {{ group.label }}
      </div>
      <QueueJobItem
        v-for="ji in group.items"
        :key="ji.id"
        :job-id="ji.id"
        :workflow-id="ji.taskRef?.workflow?.id"
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
        @clear="$emit('clearItem', ji)"
        @menu="(ev) => $emit('menu', ji, ev)"
        @view="$emit('viewItem', ji)"
        @details-enter="onDetailsEnter"
        @details-leave="onDetailsLeave"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import QueueJobItem from '@/components/queue/job/QueueJobItem.vue'
import type { JobState } from '@/types/queue'

type JobListItem = {
  id: string
  title: string
  meta: string
  state: JobState
  iconName?: string
  iconImageUrl?: string
  showClear?: boolean
  taskRef?: any
  progressTotalPercent?: number
  progressCurrentPercent?: number
  runningNodeName?: string
}
type JobGroup = { key: string; label: string; items: JobListItem[] }

defineProps<{ displayedJobGroups: JobGroup[] }>()

defineEmits<{
  (e: 'clearItem', item: any): void
  (e: 'menu', item: any, ev: Event): void
  (e: 'viewItem', item: any): void
}>()

const activeDetailsId = ref<string | null>(null)
const hideTimer = ref<number | null>(null)
const showTimer = ref<number | null>(null)
const clearHideTimer = () => {
  if (hideTimer.value !== null) {
    clearTimeout(hideTimer.value)
    hideTimer.value = null
  }
}
const clearShowTimer = () => {
  if (showTimer.value !== null) {
    clearTimeout(showTimer.value)
    showTimer.value = null
  }
}
const onDetailsEnter = (jobId: string) => {
  clearHideTimer()
  clearShowTimer()
  showTimer.value = window.setTimeout(() => {
    activeDetailsId.value = jobId
    showTimer.value = null
  }, 200)
}
const onDetailsLeave = (jobId: string) => {
  clearHideTimer()
  clearShowTimer()
  hideTimer.value = window.setTimeout(() => {
    if (activeDetailsId.value === jobId) activeDetailsId.value = null
    hideTimer.value = null
  }, 150)
}
</script>
