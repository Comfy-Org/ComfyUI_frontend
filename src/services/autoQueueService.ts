import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import {
  useQueuePendingTaskCountStore,
  useQueueSettingsStore
} from '@/stores/queueStore'

export function setupAutoQueueHandler() {
  const queueCountStore = useQueuePendingTaskCountStore()
  const queueSettingsStore = useQueueSettingsStore()

  let graphHasChanged = false
  let internalCount = 0 // Use an internal counter here so it is instantly updated when re-queuing
  api.addEventListener('graphChanged', () => {
    if (queueSettingsStore.mode === 'change') {
      if (internalCount) {
        graphHasChanged = true
      } else {
        graphHasChanged = false
        app.queuePrompt(0, queueSettingsStore.batchCount)
        internalCount++
      }
    }
  })

  queueCountStore.$subscribe(
    () => {
      internalCount = queueCountStore.count
      if (!internalCount && !app.lastExecutionError) {
        if (
          queueSettingsStore.mode === 'instant' ||
          (queueSettingsStore.mode === 'change' && graphHasChanged)
        ) {
          graphHasChanged = false
          app.queuePrompt(0, queueSettingsStore.batchCount)
        }
      }
    },
    { detached: true }
  )
}
