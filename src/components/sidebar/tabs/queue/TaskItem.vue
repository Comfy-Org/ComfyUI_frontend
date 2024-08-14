<template>
  <div class="task-item">
    <div :class="['image-grid', { compact: !isExpanded }]">
      <div v-if="!isExpanded" class="image-container">
        <Image
          :src="task.flatOutputs[0]?.url"
          alt="Task Output"
          width="100%"
          height="100%"
          preview
        />
      </div>
      <template v-else>
        <div
          v-for="(output, index) in task.flatOutputs"
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
      </template>
    </div>
    <div class="task-item-details">
      <div class="status-and-toggle">
        <Tag :severity="taskTagSeverity(task.displayStatus)">
          {{ task.displayStatus.toUpperCase() }}
        </Tag>
        <Button
          v-if="task.flatOutputs.length > 1"
          :icon="isExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
          text
          severity="secondary"
          @click="toggleExpand"
        />
      </div>
      <div class="task-time">
        <span v-if="task.isHistory">
          {{ formatTime(task.executionTimeInSeconds) }}
        </span>
        <i v-else-if="task.isRunning" class="pi pi-spin pi-spinner"></i>
        <span v-else>...</span>
      </div>
      <div class="task-actions">
        <Button
          icon="pi pi-file-export"
          text
          severity="primary"
          @click="task.loadWorkflow()"
        />
        <Button
          icon="pi pi-times"
          text
          severity="secondary"
          @click="$emit('remove', task)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Image from 'primevue/image'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import { TaskItemDisplayStatus, TaskItemImpl } from '@/stores/queueStore'

const props = defineProps<{
  task: TaskItemImpl
}>()

const emit = defineEmits<{
  (e: 'remove', task: TaskItemImpl): void
}>()

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
      return 'warning'
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
.task-item {
  display: flex;
  flex-direction: column;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.image-grid {
  display: grid;
  gap: 0.5rem;
  padding: 0.5rem;
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
  padding: 0.5rem;
}

.status-and-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-time {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #666;
}

.task-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
}
</style>
