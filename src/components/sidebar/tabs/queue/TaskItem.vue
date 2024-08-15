<template>
  <div class="task-item" @contextmenu="handleContextMenu">
    <div class="task-result-preview">
      <div
        v-if="task.displayStatus === TaskItemDisplayStatus.Completed"
        :class="['image-grid', { compact: !isExpanded }]"
      >
        <div
          v-for="(output, index) in isExpanded
            ? task.flatOutputs
            : task.flatOutputs.slice(0, 1)"
          :key="index"
          class="image-container"
        >
          <Image
            :src="output.url"
            alt="Task Output"
            width="100%"
            height="100%"
            preview
          />
        </div>
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
      <Tag :severity="taskTagSeverity(task.displayStatus)">
        <span v-html="taskStatusText(task.displayStatus)"></span>
        <span v-if="task.isHistory" class="task-time">
          {{ formatTime(task.executionTimeInSeconds) }}
        </span>
      </Tag>
      <Tag v-if="task.isHistory" :style="{ marginLeft: '10px' }">
        <span>{{ task.flatOutputs.length }}</span>
      </Tag>
      <Button
        v-if="task.flatOutputs.length > 1"
        :icon="isExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
        text
        severity="secondary"
        @click="toggleExpand"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import Image from 'primevue/image'
import Tag from 'primevue/tag'
import { TaskItemDisplayStatus, type TaskItemImpl } from '@/stores/queueStore'

const props = defineProps<{
  task: TaskItemImpl
}>()

const emit = defineEmits<{
  (e: 'contextmenu', { task: TaskItemImpl, event: MouseEvent }): void
}>()

const handleContextMenu = (e: MouseEvent) => {
  emit('contextmenu', { task: props.task, event: e })
}

const isExpanded = ref(false)

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
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

.image-grid {
  display: grid;
  padding: 0.25rem;
}

.image-grid.compact {
  grid-template-columns: 1fr;
}

.image-grid:not(.compact) {
  grid-template-columns: repeat(2, 1fr);
}

.image-container {
  aspect-ratio: 1 / 1;
  overflow: hidden;
}

.image-container img {
  object-fit: cover;
  width: 100%;
  height: 100%;
}

.task-item-details {
  position: absolute;
  bottom: 0;
  padding: 0.6rem;
}
</style>
