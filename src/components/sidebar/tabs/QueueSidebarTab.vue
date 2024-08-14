<template>
  <SideBarTabTemplate :title="$t('queue')">
    <template #body>
      <div v-if="tasks.length > 0" class="queue-grid">
        <TaskItem
          v-for="task in tasks"
          :key="task.promptId"
          :task="task"
          @remove="removeTask"
        />
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
  <Toast />
  <ConfirmPopup />
  <Button
    icon="pi pi-trash"
    text
    severity="primary"
    @click="confirmRemoveAll($event)"
    class="clear-all-button"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ConfirmPopup from 'primevue/confirmpopup'
import Toast from 'primevue/toast'
import TaskItem from './queue/TaskItem.vue'
import SideBarTabTemplate from './SidebarTabTemplate.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { TaskItemImpl, useQueueStore } from '@/stores/queueStore'
import { computed, onMounted, onUnmounted } from 'vue'
import { api } from '@/scripts/api'

const confirm = useConfirm()
const toast = useToast()
const queueStore = useQueueStore()

const tasks = computed(() => queueStore.tasks)

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
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  padding: 1rem;
}

.clear-all-button {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
}
</style>
