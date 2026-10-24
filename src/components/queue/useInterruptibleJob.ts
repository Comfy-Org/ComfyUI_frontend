import { computed } from 'vue'

import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'

export function useInterruptibleJob() {
  const executionStore = useExecutionStore()
  const queueStore = useQueueStore()

  const canInterrupt = computed(
    () =>
      executionStore.activeJobId !== null ||
      queueStore.runningTasks.length === 1
  )

  return { canInterrupt }
}
