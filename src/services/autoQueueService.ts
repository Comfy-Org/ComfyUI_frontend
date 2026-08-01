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
  api.addEventListener('autoQueueGraphChanged', () => {
    if (queueSettingsStore.mode === 'change') {
      if (internalCount) {
        graphHasChanged = true
      } else {
        graphHasChanged = false
        // Queue the prompt in the background
        void app.queuePrompt(0, queueSettingsStore.batchCount, {
          intent: { trigger_source: 'auto_queue' }
        })
        internalCount++
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
