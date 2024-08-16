<template>
  <div class="task-item" @contextmenu="handleContextMenu">
    <div class="task-result-preview">
      <div
        v-if="task.displayStatus === TaskItemDisplayStatus.Completed"
        class="result-grid"
      >
        <ResultItem v-if="flatOutputs.length" :result="flatOutputs[0]" />
      </div>
      <i
        v-else-if="task.displayStatus === TaskItemDisplayStatus.Running"
        class="pi pi-spin pi-spinner"
      ></i>
      <span v-else-if="task.displayStatus === TaskItemDisplayStatus.Pending"
        >...</span
      >
      <i
        v-else-if="task.displayStatus === TaskItemDisplayStatus.Cancelled"
        class="pi pi-exclamation-triangle"
      ></i>
      <i
        v-else-if="task.displayStatus === TaskItemDisplayStatus.Failed"
        class="pi pi-exclamation-circle"
      ></i>
    </div>

    <div class="task-item-details">
      <div class="tag-wrapper">
        <Tag :severity="taskTagSeverity(task.displayStatus)">
          <span v-html="taskStatusText(task.displayStatus)"></span>
          <span v-if="task.isHistory" class="task-time">
            {{ formatTime(task.executionTimeInSeconds) }}
          </span>
          <span v-if="isFlatTask" class="task-prompt-id">
            {{ task.promptId.split('-')[0] }}
          </span>
        </Tag>
      </div>
      <div class="tag-wrapper">
        <Tag v-if="task.isHistory && flatOutputs.length > 1">
          <span>{{ flatOutputs.length }}</span>
        </Tag>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Tag from 'primevue/tag'
import ResultItem from './ResultItem.vue'
import { TaskItemDisplayStatus, type TaskItemImpl } from '@/stores/queueStore'

const props = defineProps<{
  task: TaskItemImpl
  isFlatTask: boolean
}>()

const flatOutputs = props.task.flatOutputs

const emit = defineEmits<{
  (e: 'contextmenu', { task: TaskItemImpl, event: MouseEvent }): void
}>()

const handleContextMenu = (e: MouseEvent) => {
  emit('contextmenu', { task: props.task, event: e })
}

const taskTagSeverity = (status: TaskItemDisplayStatus) => {
  switch (status) {
    case TaskItemDisplayStatus.Pending:
      return 'secondary'
    case TaskItemDisplayStatus.Running:
      return 'info'
    case TaskItemDisplayStatus.Completed:
      return 'success'
    case TaskItemDisplayStatus.Failed:
      return 'danger'
    case TaskItemDisplayStatus.Cancelled:
      return 'warn'
  }
}

const taskStatusText = (status: TaskItemDisplayStatus) => {
  switch (status) {
    case TaskItemDisplayStatus.Pending:
      return 'Pending'
    case TaskItemDisplayStatus.Running:
      return 'Running'
    case TaskItemDisplayStatus.Completed:
      return '<i class="pi pi-check" style="font-weight: bold"></i>'
    case TaskItemDisplayStatus.Failed:
      return 'Failed'
    case TaskItemDisplayStatus.Cancelled:
      return 'Cancelled'
  }
}

const formatTime = (time?: number) => {
  if (time === undefined) {
    return ''
  }
  return `${time.toFixed(2)}s`
}
</script>

<style scoped>
.task-result-preview {
  aspect-ratio: 1 / 1;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
}

.task-result-preview i,
.task-result-preview span {
  font-size: 2rem;
}

.task-item {
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.result-grid {
  display: grid;
  padding: 0.25rem;
}

.result-grid.compact {
  grid-template-columns: 1fr;
}

.result-grid:not(.compact) {
  grid-template-columns: repeat(2, 1fr);
}

.task-item-details {
  position: absolute;
  bottom: 0;
  padding: 0.6rem;
  display: flex;
  justify-content: space-between;
  width: 100%;
}

/* In dark mode, transparent background color for tags is not ideal for tags that
are floating on top of images. */
.tag-wrapper {
  background-color: var(--p-primary-contrast-color);
  border-radius: 6px;
  display: inline-flex;
}
</style>
