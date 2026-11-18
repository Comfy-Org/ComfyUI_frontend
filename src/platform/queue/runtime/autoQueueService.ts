import { partnerRunGateBlocksAutoQueue } from '@/platform/auth/partnerNode/usePartnerNodesRunGate'
import { api } from '@/scripts/api'
import { useApp } from '@/scripts/appInstance'
import {
  isInstantRunningMode,
  useQueueSettingsStore
} from '@/platform/queue/stores/queueSettingsStore'
import { useQueuePendingTaskCountStore } from '@/platform/queue/stores/queueStore'

export function setupAutoQueueHandler() {
  const queueCountStore = useQueuePendingTaskCountStore()
  const queueSettingsStore = useQueueSettingsStore()

  let graphHasChanged = false
  let internalCount = queueCountStore.count
  const onGraphChanged = () => {
    if (partnerRunGateBlocksAutoQueue()) return
    if (queueSettingsStore.mode === 'change') {
      if (internalCount) {
        graphHasChanged = true
      } else {
        graphHasChanged = false
        void useApp().queuePrompt(0, queueSettingsStore.batchCount, {
          intent: { trigger_source: 'auto_queue' }
        })
        internalCount++
      }
    }
  }
  api.addEventListener('autoQueueGraphChanged', onGraphChanged)

  const unsubscribe = queueCountStore.$subscribe(
    async () => {
      internalCount = queueCountStore.count
      if (
        !internalCount &&
        !useApp().lastExecutionError &&
        !partnerRunGateBlocksAutoQueue()
      ) {
        if (
          isInstantRunningMode(queueSettingsStore.mode) ||
          (queueSettingsStore.mode === 'change' && graphHasChanged)
        ) {
          graphHasChanged = false
          await useApp().queuePrompt(0, queueSettingsStore.batchCount, {
            intent: { trigger_source: 'auto_queue' }
          })
        }
      }
    },
    { detached: true }
  )

  return () => {
    api.removeEventListener('autoQueueGraphChanged', onGraphChanged)
    unsubscribe()
  }
}
