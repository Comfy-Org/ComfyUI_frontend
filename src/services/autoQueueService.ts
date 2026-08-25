import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import {
  isInstantRunningMode,
  useQueueSettingsStore
} from '@/stores/queueSettingsStore'
import { useQueuePendingTaskCountStore } from '@/stores/queueStore'

export function setupAutoQueueHandler() {
  const queueCountStore = useQueuePendingTaskCountStore()
  const queueSettingsStore = useQueueSettingsStore()

  let graphHasChanged = false
  let internalCount = 0 // Use an internal counter here so it is instantly updated when re-queuing

  const queueChange = () => {
    graphHasChanged = false
    // Claim the slot synchronously so a burst coalesces instead of double-queuing.
    internalCount++
    void app
      .queuePrompt(0, queueSettingsStore.batchCount, {
        intent: { trigger_source: 'auto_queue' }
      })
      .then((queued) => {
        if (queued) return
        // Nothing enqueued (e.g. gate rejected): release the slot or it stays stuck.
        internalCount--
        if (graphHasChanged && !internalCount) queueChange()
      })
  }

  api.addEventListener('autoQueueGraphChanged', () => {
    if (queueSettingsStore.mode === 'change') {
      if (internalCount) {
        graphHasChanged = true
      } else {
        queueChange()
      }
    }
  })

  queueCountStore.$subscribe(
    async () => {
      internalCount = queueCountStore.count
      if (!internalCount && !app.lastExecutionError) {
        if (
          isInstantRunningMode(queueSettingsStore.mode) ||
          (queueSettingsStore.mode === 'change' && graphHasChanged)
        ) {
          graphHasChanged = false
          await app.queuePrompt(0, queueSettingsStore.batchCount, {
            intent: { trigger_source: 'auto_queue' }
          })
        }
      }
    },
    { detached: true }
  )
}
