import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import {
  isInstantRunningMode,
  useQueuePendingTaskCountStore,
  useQueueSettingsStore
} from '@/stores/queueStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

export function setupAutoQueueHandler() {
  const queueCountStore = useQueuePendingTaskCountStore()
  const queueSettingsStore = useQueueSettingsStore()

  let graphHasChanged = false
  let internalCount = 0 // Use an internal counter here so it is instantly updated when re-queuing
  let instantWorkflow: LoadedComfyWorkflow | null = null

  queueSettingsStore.$subscribe(
    (_, state) => {
      if (isInstantRunningMode(state.mode)) {
        instantWorkflow ??= useWorkspaceStore().workflow.activeWorkflow
      } else {
        instantWorkflow = null
      }
    },
    { detached: true, flush: 'sync' }
  )

  api.addEventListener('graphChanged', () => {
    if (queueSettingsStore.mode === 'change') {
      if (internalCount) {
        graphHasChanged = true
      } else {
        graphHasChanged = false
        // Queue the prompt in the background
        void app.queuePrompt(0, queueSettingsStore.batchCount)
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
          await app.queuePrompt(
            0,
            queueSettingsStore.batchCount,
            undefined,
            isInstantRunningMode(queueSettingsStore.mode)
              ? instantWorkflow
              : undefined
          )
        }
      }
    },
    { detached: true }
  )
}
