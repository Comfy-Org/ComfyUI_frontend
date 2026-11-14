import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useQueueStore } from '@/platform/queue/stores/queueStore'
import { useExecutionStore } from '@/stores/executionStore'

export function useQueueActions() {
  const commandStore = useCommandStore()
  const queueStore = useQueueStore()
  const executionStore = useExecutionStore()

  const clearPendingJobs = async () => {
    const pendingJobIds = queueStore.pendingTasks
      .map((task) => task.jobId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)

    await commandStore.execute('Comfy.ClearPendingTasks')
    executionStore.clearInitializationByJobIds(pendingJobIds)
  }

  return { clearPendingJobs }
}
