<template>
  <SideBarTabTemplate :title="$t('queue')">
    <template #tool-buttons>
      <Button
        icon="pi pi-trash"
        text
        severity="primary"
        @click="confirmRemoveAll($event)"
        class="clear-all-button"
      />
    </template>
    <template #body>
      <div v-if="tasks.length > 0" class="queue-grid">
        <TaskItem
          v-for="task in tasks"
          :key="task.promptId"
          :task="task"
          @contextmenu="handleContextMenu"
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
  <ContextMenu ref="menu" :model="menuItems" />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ConfirmPopup from 'primevue/confirmpopup'
import Toast from 'primevue/toast'
import ContextMenu from 'primevue/contextmenu'
import TaskItem from './queue/TaskItem.vue'
import SideBarTabTemplate from './SidebarTabTemplate.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { TaskItemImpl, useQueueStore } from '@/stores/queueStore'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type MenuItem } from 'primevue/menuitem'
import { api } from '@/scripts/api'

const confirm = useConfirm()
const toast = useToast()
const queueStore = useQueueStore()
const { t } = useI18n()

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

const menu = ref(null)
const menuTargetTask = ref<TaskItemImpl | null>(null)
const menuItems = computed<MenuItem[]>(() => {
  return [
    {
      label: t('delete'),
      icon: 'pi pi-trash',
      command: () => removeTask(menuTargetTask.value!)
    },
    {
      label: t('loadWorkflow'),
      icon: 'pi pi-file-export',
      command: () => menuTargetTask.value?.loadWorkflow()
    }
  ]
})
const handleContextMenu = ({ task, event }) => {
  menuTargetTask.value = task
  menu.value.show(event)
}

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
</style>
