import type { AgentEventSource } from '../../composables/agent/useAgentSession'

/**
 * The standalone agent's ONE socket. Chat frames come down it, and — because
 * the agent speaks the same document protocol on it that ingest speaks on the
 * cloud's /ws — document frames go up and down it too. `send` is what lets the
 * doc transport ride this socket instead of opening a second one: a
 * connection's follows are then frames, not a query string, so following a
 * workflow never reconnects the chat stream mid-turn.
 */
export interface StandaloneAgentEventSource extends AgentEventSource {
  /**
   * Best-effort send, never throws. `false` when the socket is not OPEN —
   * a normal state while the panel mounts — so a caller retries rather than
   * aborts.
   */
  send(frame: string): boolean
}

interface StandaloneAgentEventSourceOptions {
  createSocket?: (url: string) => WebSocket
  endpoint?: string
  reconnectDelayMs?: number
}

export function createStandaloneAgentEventSource({
  createSocket = (url) => new WebSocket(url),
  endpoint = '/api/agent/events',
  reconnectDelayMs = 1000
}: StandaloneAgentEventSourceOptions = {}): StandaloneAgentEventSource {
  const listeners = new Set<(raw: unknown) => void>()
  const statusListeners = new Set<(live: boolean) => void>()
  let socket: WebSocket | null = null
  let reconnectTimer: number | null = null

  function eventUrl(): string {
    const url = new URL(endpoint, window.location.href)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return url.toString()
  }

  function notifyStatus(live: boolean): void {
    statusListeners.forEach((listener) => listener(live))
  }

  function scheduleReconnect(): void {
    if (listeners.size === 0 || reconnectTimer !== null) return
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null
      connect()
    }, reconnectDelayMs)
  }

  function connect(): void {
    if (listeners.size === 0 || socket !== null) return
    const current = createSocket(eventUrl())
    socket = current
    current.addEventListener('open', () => {
      if (socket === current) notifyStatus(true)
    })
    current.addEventListener('message', (event) => {
      if (socket !== current) return
      let frame: unknown = event.data
      if (typeof event.data === 'string') {
        try {
          frame = JSON.parse(event.data)
        } catch {
          frame = event.data
        }
      }
      listeners.forEach((listener) => listener(frame))
    })
    current.addEventListener('error', () => {
      if (socket === current) current.close()
    })
    current.addEventListener('close', () => {
      if (socket !== current) return
      socket = null
      notifyStatus(false)
      scheduleReconnect()
    })
  }

  function disconnect(): void {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    const current = socket
    socket = null
    if (current === null) return
    current.close()
    notifyStatus(false)
  }

  return {
    send(frame) {
      if (socket?.readyState !== WebSocket.OPEN) return false
      socket.send(frame)
      return true
    },
    subscribe(listener) {
      listeners.add(listener)
      connect()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) disconnect()
      }
    },
    onStatus(listener) {
      statusListeners.add(listener)
      if (socket?.readyState === WebSocket.OPEN) listener(true)
      return () => statusListeners.delete(listener)
    }
  }
}
