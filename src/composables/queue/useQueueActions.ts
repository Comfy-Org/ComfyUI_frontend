import { api } from '@/scripts/api'
import { useQueueStore } from '@/stores/queueStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

/**
 * Common queue actions used by the overlay controls.
 */
export function useQueueActions() {
  const sidebarTabStore = useSidebarTabStore()
  const queueStore = useQueueStore()

  const openQueueSidebar = () => {
    sidebarTabStore.activeSidebarTabId = 'queue'
  }

  const cancelQueuedWorkflows = async () => {
    const pending = [...queueStore.pendingTasks]
    for (const task of pending) {
      await api.deleteItem('queue', task.promptId)
    }
    await queueStore.update()
  }

  const interruptAll = async () => {
    const tasks = queueStore.runningTasks
    for (const task of tasks) {
      await api.interrupt(task.promptId)
    }
  }

  return {
    openQueueSidebar,
    cancelQueuedWorkflows,
    interruptAll
  }
}
