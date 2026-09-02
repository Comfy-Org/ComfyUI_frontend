import { useExecutionStore } from '@/stores/executionStore'
import { useQueueStore } from '@/stores/queueStore'

/**
 * After a WebSocket reconnect, refresh the queue from the server and clear
 * any active job that finished during the disconnect window. Returns the
 * handler so the caller can wire it to the `reconnected` api event.
 *
 * `update()` preserves the previous queue snapshot when the fetch fails, so
 * if the network is still flaky we reconcile against the last known good
 * state rather than an empty (and falsely "stale") set.
 */
export function useReconnectQueueRefresh() {
  const queueStore = useQueueStore()
  const executionStore = useExecutionStore()

  return async function refreshOnReconnect() {
    await queueStore.update()
    const activeJobIds = new Set([
      ...queueStore.runningTasks.map((t) => t.jobId),
      ...queueStore.pendingTasks.map((t) => t.jobId)
    ])
    executionStore.clearActiveJobIfStale(activeJobIds)
  }
}
