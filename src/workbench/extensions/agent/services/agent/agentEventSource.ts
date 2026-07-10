import type { AgentEventSource } from '../../composables/agent/useAgentSession'
import { AGENT_WS_EVENT_TYPES } from '../../schemas/agentApiSchema'

// The surface of the host api singleton this adapter binds to. The api JSON-parses
// every /ws frame ONCE and dispatches frames whose type was registered (via
// addCustomEventListener) as CustomEvents on itself — listeners survive socket
// reconnects because they bind to the api EventTarget, not the socket. Registering
// the agent types also stops the api's once-per-type "Unknown message type" throw.
export interface AgentEventHost {
  socket: { readyState: number } | null
  addCustomEventListener(
    type: string,
    listener: (event: CustomEvent<unknown>) => void
  ): void
  removeCustomEventListener(
    type: string,
    listener: (event: CustomEvent<unknown>) => void
  ): void
  addEventListener(
    type: 'reconnecting' | 'reconnected',
    listener: () => void
  ): void
  removeEventListener(
    type: 'reconnecting' | 'reconnected',
    listener: () => void
  ): void
}

const OPEN = 1 // WebSocket.OPEN

export function createAgentEventSource(host: AgentEventHost): AgentEventSource {
  return {
    subscribe(listener) {
      // The api dispatches only the frame's data as the event detail; rebuild the
      // {type, data} envelope the zod event schema validates.
      const unbinders = [...AGENT_WS_EVENT_TYPES].map((type) => {
        const onEvent = (event: CustomEvent<unknown>): void =>
          listener({ type, data: event.detail })
        host.addCustomEventListener(type, onEvent)
        return () => host.removeCustomEventListener(type, onEvent)
      })
      return () => unbinders.forEach((unbind) => unbind())
    },
    onStatus(listener) {
      const onDown = (): void => listener(false)
      const onUp = (): void => listener(true)
      host.addEventListener('reconnecting', onDown)
      host.addEventListener('reconnected', onUp)
      // A socket already open before (re)binding must report live once, else the
      // session's open-triggered draft resync never fires for it.
      if (host.socket?.readyState === OPEN) listener(true)
      return () => {
        host.removeEventListener('reconnecting', onDown)
        host.removeEventListener('reconnected', onUp)
      }
    }
  }
}
