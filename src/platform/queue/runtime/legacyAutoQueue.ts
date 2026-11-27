import type { LegacyQueueApp } from '@/platform/queue/legacy/types'
import { api } from '@/scripts/api'

type LegacyAutoQueueState = {
  app: Pick<LegacyQueueApp, 'lastExecutionError' | 'queuePrompt'>
  batchCount: number
  lastQueueSize: number
  autoQueueMode: string
  graphHasChanged: boolean
  autoQueueEnabled: boolean
}

export function setupLegacyAutoQueue(
  state: LegacyAutoQueueState,
  signal: AbortSignal
) {
  api.addEventListener(
    'autoQueueGraphChanged',
    () => {
      if (state.autoQueueMode === 'change' && state.autoQueueEnabled) {
        if (state.lastQueueSize === 0) {
          state.graphHasChanged = false
          void state.app.queuePrompt(0, state.batchCount, {
            intent: { trigger_source: 'auto_queue' }
          })
        } else {
          state.graphHasChanged = true
        }
      }
    },
    { signal }
  )
}

export function updateLegacyAutoQueueStatus(
  state: LegacyAutoQueueState,
  queueRemaining: number
) {
  if (
    state.lastQueueSize != 0 &&
    queueRemaining == 0 &&
    state.autoQueueEnabled &&
    (state.autoQueueMode === 'instant' || state.graphHasChanged) &&
    !state.app.lastExecutionError
  ) {
    void state.app.queuePrompt(0, state.batchCount, {
      intent: { trigger_source: 'auto_queue' }
    })
    state.graphHasChanged = false
    state.lastQueueSize = queueRemaining + state.batchCount
  } else {
    state.lastQueueSize = queueRemaining
  }
}
