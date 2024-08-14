<template>
  <SideBarTabTemplate :title="$t('sideToolbar.queue')">
    <template #body>
      <div v-if="tasks.length > 0" class="queue-grid">
        <div v-for="task in tasks" :key="task.promptId" class="queue-item">
          <div class="image-grid">
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
          </div>
          <div class="queue-item-details">
            <Tag :severity="taskTagSeverity(task.displayStatus)">
              {{ task.displayStatus.toUpperCase() }}
            </Tag>
            <div class="queue-time">
              <span v-if="task.isHistory">
                {{ formatTime(task.executionTimeInSeconds) }}
              </span>
              <i v-else-if="task.isRunning" class="pi pi-spin pi-spinner"></i>
              <span v-else>...</span>
            </div>
            <div class="queue-actions">
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
                @click="removeTask(task)"
              />
            </div>
          </div>
        </div>
      </div>
      <div v-else>
        <NoResultsPlaceholder
          icon="pi pi-info-circle"
          :title="$t('noTasksFound')"
          :message="$t('noTasksFoundMessage')"
        />
      </div>
    </template>
  </SideBarTabTemplate>
</template>

<script setup lang="ts">
import Image from 'primevue/image'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import SideBarTabTemplate from './SidebarTabTemplate.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import {
  TaskItemDisplayStatus,
  TaskItemImpl,
  useQueueStore
} from '@/stores/queueStore'
import { computed, onMounted, onUnmounted } from 'vue'
import { api } from '@/scripts/api'

const confirm = useConfirm()
const toast = useToast()
const queueStore = useQueueStore()

const tasks = computed(() => queueStore.tasks)
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
const removeTask = (task: TaskItemImpl) => {
  if (task.isRunning) {
    api.interrupt()
  }
  queueStore.delete(task)
}
const removeAllTasks = async () => {
  await queueStore.clear()
}
const confirmRemoveAll = (event) => {
  confirm.require({
    target: event.currentTarget,
    message: 'Do you want to delete all tasks?',
    icon: 'pi pi-info-circle',
    rejectProps: {
      label: 'Cancel',
      severity: 'secondary',
      outlined: true
    },
    acceptProps: {
      label: 'Delete',
      severity: 'danger'
    },
    accept: async () => {
      await removeAllTasks()
      toast.add({
        severity: 'info',
        summary: 'Confirmed',
        detail: 'Tasks deleted',
        life: 3000
      })
    }
  })
}

const onStatus = () => queueStore.update()
onMounted(() => {
  api.addEventListener('status', onStatus)

  queueStore.update()
})
onUnmounted(() => {
  api.removeEventListener('status', onStatus)
})
</script>

<style scoped>
.queue-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
  padding: 1rem;
}

.queue-item {
  display: flex;
  flex-direction: column;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  padding: 0.5rem;
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

.queue-item-details {
  padding: 0.5rem;
}

.queue-time {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #666;
}

.queue-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
}

.clear-all-button {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
}
</style>
