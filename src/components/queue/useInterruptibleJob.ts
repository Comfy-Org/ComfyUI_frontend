import { computed } from 'vue'

import type { JobId } from '@/platform/remote/comfyui/execution/types'
import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'

/**
 * Resolves the run a single-job stop control cancels, and whether there is one.
 *
 * `executionStore.activeJobId` is a poor answer on its own: it is populated
 * from this client's own `execution_start` frame, and the backend addresses
 * that frame to the `client_id` that queued the prompt rather than
 * broadcasting it (ComfyUI `execution.py`, `add_message(..., broadcast=False)`).
 * A run started by the Agent is queued by the Agent's own connection, so this
 * client never sees `execution_start` for it and `activeJobId` stays null while
 * the backend is genuinely busy — PM-2219, where the toolbar's stop control sat
 * disabled throughout an Agent-started run.
 *
 * `queueStore.runningTasks` comes from the jobs list endpoint, which is not
 * scoped to a client. That is why the job-history route can already cancel
 * those runs, and reading it here makes both routes agree.
 *
 * The execution store is still preferred when it has an answer: it is updated
 * from a websocket frame and so leads the queue refresh at the start of a run,
 * and it is already scoped to the workflow that queued the job.
 */
export function useInterruptibleJob() {
  const executionStore = useExecutionStore()
  const queueStore = useQueueStore()

  const interruptibleJobId = computed<JobId | null>(() => {
    if (executionStore.activeJobId) return executionStore.activeJobId
    const jobId = queueStore.runningTasks[0]?.jobId
    return typeof jobId === 'string' && jobId.length > 0 ? jobId : null
  })

  /**
   * False only when the backend has nothing running, so a stop control bound
   * to this stays disabled rather than becoming a button that does nothing.
   */
  const canInterrupt = computed(() => interruptibleJobId.value !== null)

  return { interruptibleJobId, canInterrupt }
}
