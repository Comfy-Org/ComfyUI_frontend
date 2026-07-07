import type { AgentEventSource } from '../../composables/agent/useAgentSession'

/**
 * agentEventSource: adapts one live WebSocket-like into the AgentEventSource the
 * session root consumes. The host wraps its EXISTING ComfyUI socket here (the panel
 * never owns the host socket lifecycle - connect/reconnect belong to the owner);
 * the dev harness wraps a socket it created itself.
 */

// The narrow event-target surface this adapter needs. Native WebSocket satisfies it.
export interface EventTargetSocket {
  addEventListener(
    type: 'message',
    listener: (event: { data: unknown }) => void
  ): void
  addEventListener(type: 'open' | 'close', listener: () => void): void
  removeEventListener(
    type: 'message',
    listener: (event: { data: unknown }) => void
  ): void
  removeEventListener(type: 'open' | 'close', listener: () => void): void
  readyState?: number
}

const OPEN = 1

export function createWebSocketEventSource(
  socket: EventTargetSocket
): AgentEventSource {
  return {
    subscribe(listener) {
      const onMessage = (event: { data: unknown }): void => listener(event.data)
      socket.addEventListener('message', onMessage)
      return () => socket.removeEventListener('message', onMessage)
    },
    onStatus(listener) {
      const onOpen = (): void => listener(true)
      const onClose = (): void => listener(false)
      socket.addEventListener('open', onOpen)
      socket.addEventListener('close', onClose)
      // A socket that opened before this subscription must still report live once,
      // or the session's open-triggered draft resync would never fire.
      if (socket.readyState === OPEN) listener(true)
      return () => {
        socket.removeEventListener('open', onOpen)
        socket.removeEventListener('close', onClose)
      }
    }
  }
}
