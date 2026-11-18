import { useEventListener } from '@vueuse/core'

import { useReconnectQueueRefresh } from '@/composables/useReconnectQueueRefresh'
import { useReconnectingNotification } from '@/composables/useReconnectingNotification'
import { useReconnectNodeDefinitionRefresh } from '@/platform/customNodes/useReconnectNodeDefinitionRefresh'
import { api } from '@/scripts/api'

/**
 * Owns what the app does when the ComfyUI `/ws` socket drops and comes back:
 * the reconnecting toast, the queue refresh and the node definition refresh.
 * A new "after the server comes back" behaviour is added here, not in a view.
 * Listeners are removed when the calling scope is disposed.
 */
export function useServerReconnectLifecycle(): void {
  const { onReconnecting, onReconnected } = useReconnectingNotification()
  const refreshQueueOnReconnect = useReconnectQueueRefresh()
  const refreshNodeDefinitionsOnReconnect = useReconnectNodeDefinitionRefresh()

  useEventListener(api, 'reconnecting', onReconnecting)
  useEventListener(api, 'reconnected', async () => {
    onReconnected()
    void refreshNodeDefinitionsOnReconnect()
    await refreshQueueOnReconnect()
  })
}
