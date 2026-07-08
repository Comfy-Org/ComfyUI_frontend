import type { AgentEventSource } from '../../composables/agent/useAgentSession'

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

// The host nulls its socket on close and creates a NEW one on reconnect; this adapter
// re-binds on the 'reconnected' signal so the panel is not left deaf after a reconnect.
export interface ReconnectingHost {
  socket: EventTargetSocket | null
  addEventListener(type: 'reconnected', listener: () => void): void
  removeEventListener(type: 'reconnected', listener: () => void): void
}

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
        // A socket already open before (re)binding must report live once, else the
        // session's open-triggered draft resync never fires for it.
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
