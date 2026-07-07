import type { AgentEventSource } from '../../composables/agent/useAgentSession'

/**
 * agentEventSource: adapts the host's ComfyUI socket into the AgentEventSource the
 * session root consumes. The panel never owns the socket lifecycle - connect/reconnect
 * belong to the host. createReconnectingEventSource follows the host across reconnects
 * (the host nulls and replaces its socket on close/reopen), so the panel is not left deaf
 * after a reconnect.
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

// The narrow host surface the reconnecting adapter needs: the CURRENT socket (nulled by
// the host on close, replaced on reconnect) plus the host's own 'reconnected' event so the
// adapter can re-bind to the fresh socket. ComfyApi satisfies this structurally; the
// subtree stays decoupled from the host class.
export interface ReconnectingHost {
  socket: EventTargetSocket | null
  addEventListener(type: 'reconnected', listener: () => void): void
  removeEventListener(type: 'reconnected', listener: () => void): void
}

/**
 * createReconnectingEventSource: binds to host.socket and follows it across reconnects.
 * The host nulls its socket on close and creates a NEW WebSocket on reconnect, then
 * dispatches 'reconnected'; this adapter detaches from the old socket and re-attaches to
 * the new one on that signal, so the panel is never left deaf after an api reconnect.
 */
export function createReconnectingEventSource(
  host: ReconnectingHost
): AgentEventSource {
  return {
    subscribe(listener) {
      const onMessage = (event: { data: unknown }): void => listener(event.data)
      let attached: EventTargetSocket | null = null

      const attach = (socket: EventTargetSocket): void => {
        socket.addEventListener('message', onMessage)
        attached = socket
      }
      const detach = (): void => {
        attached?.removeEventListener('message', onMessage)
        attached = null
      }
      const onReconnected = (): void => {
        detach()
        if (host.socket) attach(host.socket)
      }

      if (host.socket) attach(host.socket)
      else console.warn('[agent-panel] host /ws socket not connected yet')
      host.addEventListener('reconnected', onReconnected)

      return () => {
        detach()
        host.removeEventListener('reconnected', onReconnected)
      }
    },
    onStatus(listener) {
      const onOpen = (): void => listener(true)
      const onClose = (): void => listener(false)
      let attached: EventTargetSocket | null = null

      const attach = (socket: EventTargetSocket): void => {
        socket.addEventListener('open', onOpen)
        socket.addEventListener('close', onClose)
        attached = socket
        // A socket already open before (re)binding must report live once, or the
        // session's open-triggered draft resync would never fire for it.
        if (socket.readyState === OPEN) listener(true)
      }
      const detach = (): void => {
        attached?.removeEventListener('open', onOpen)
        attached?.removeEventListener('close', onClose)
        attached = null
      }
      const onReconnected = (): void => {
        detach()
        if (host.socket) attach(host.socket)
      }

      if (host.socket) attach(host.socket)
      host.addEventListener('reconnected', onReconnected)

      return () => {
        detach()
        host.removeEventListener('reconnected', onReconnected)
      }
    }
  }
}
