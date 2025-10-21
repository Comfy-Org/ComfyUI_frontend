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
        @clear="$emit('clearItem', ji)"
        @menu="(ev) => $emit('menu', ji, ev)"
        @view="$emit('viewItem', ji)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import QueueJobItem from '@/components/queue/QueueJobItem.vue'
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
</script>
