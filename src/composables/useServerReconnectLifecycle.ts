import { useEventListener } from '@vueuse/core'

import { useReconnectingNotification } from '@/composables/useReconnectingNotification'
import { useReconnectNodeDefinitionRefresh } from '@/platform/customNodes/useReconnectNodeDefinitionRefresh'
import { useReconnectQueueRefresh } from '@/platform/queue/runtime/useReconnectQueueRefresh'
import { api } from '@/scripts/api'
import { reportError } from '@comfyorg/telemetry/reportError'

/** Runs every app behaviour for a ComfyUI `/ws` disconnect and reconnect until the calling scope is disposed. */
export function useServerReconnectLifecycle(): void {
  const { onReconnecting, onReconnected, onRevokedSocketEnded } =
    useReconnectingNotification()
  const refreshQueueOnReconnect = useReconnectQueueRefresh()
  const refreshNodeDefinitionsOnReconnect = useReconnectNodeDefinitionRefresh()

  useEventListener(api, 'reconnecting', onReconnecting)
  useEventListener(api, 'revokedSocketEnded', onRevokedSocketEnded)
  useEventListener(api, 'reconnected', async () => {
    onReconnected()
    void refreshNodeDefinitionsOnReconnect()
    try {
      await refreshQueueOnReconnect()
    } catch (error) {
      reportError(error, {
        surface: 'graph',
        errorType: 'failure_refreshing_queue_after_reconnect',
        level: 'warning'
      })
    }
  })
}
