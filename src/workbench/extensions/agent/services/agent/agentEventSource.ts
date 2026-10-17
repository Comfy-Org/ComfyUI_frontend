import type { AgentEventSource } from '../../composables/agent/useAgentSession'
import { AGENT_WS_EVENT_TYPES } from '../../schemas/agentApiSchema'

export interface AgentEventHost {
  socket: {
    readyState: number
    addEventListener?(type: 'open', listener: () => void): void
    removeEventListener?(type: 'open', listener: () => void): void
  } | null
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

const OPEN = 1

export function createAgentEventSource(host: AgentEventHost): AgentEventSource {
  return {
    subscribe(listener) {
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
      const initialSocket = host.socket
      host.addEventListener('reconnecting', onDown)
      host.addEventListener('reconnected', onUp)
      if (initialSocket?.readyState === OPEN) listener(true)
      else initialSocket?.addEventListener?.('open', onUp)
      return () => {
        initialSocket?.removeEventListener?.('open', onUp)
        host.removeEventListener('reconnecting', onDown)
        host.removeEventListener('reconnected', onUp)
      }
    }
  }
}
