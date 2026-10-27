import { computed } from 'vue'

import type { JobId } from '@/platform/remote/comfyui/execution/types'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'

export function useInterruptibleJob() {
  const executionStore = useExecutionStore()
  const queueStore = useQueueStore()

  const interruptibleJobId = computed<JobId | null>(() => {
    if (executionStore.activeJobId) return executionStore.activeJobId
    if (queueStore.runningTasks.length !== 1) return null
    const jobId = queueStore.runningTasks[0].jobId
    return typeof jobId === 'string' && jobId.length > 0 ? jobId : null
  })

  const canInterrupt = computed(() => interruptibleJobId.value !== null)

  return { interruptibleJobId, canInterrupt }
}
