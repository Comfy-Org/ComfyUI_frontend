import type { AgentEventSource } from '../../composables/agent/useAgentSession'

export interface AgentEventSocket extends AgentEventSource {
  /** `false` while the socket is not OPEN, so a caller retries rather than aborts. */
  send(frame: string): boolean
  reconnect(): void
  onStatus(listener: (live: boolean) => void): () => void
}

interface AgentEventSourceOptions {
  endpoint: string
  // Browsers cannot set WebSocket headers, so the credential rides ?token=.
  getToken: () => Promise<string | undefined>
  reconnectDelayMs?: number
  maxReconnectDelayMs?: number
  /** Jitter source in [0, 1); the delay is scaled into [50%, 100%]. */
  random?: () => number
}

export function createAgentEventSource({
  endpoint,
  getToken,
  reconnectDelayMs = 1000,
  maxReconnectDelayMs = 30_000,
  random = Math.random
}: AgentEventSourceOptions): AgentEventSocket {
  const listeners = new Set<(raw: unknown) => void>()
  const statusListeners = new Set<(live: boolean) => void>()
  let socket: WebSocket | null = null
  let reconnectTimer: number | null = null
  let connectGeneration = 0
  let connecting = false
  // Reset by the first frame a socket delivers, not by its open: a server
  // that accepts the upgrade and then closes still backs off.
  let failedConnects = 0

  function eventUrl(token: string | undefined): string {
    const url = new URL(endpoint, window.location.href)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    if (token) url.searchParams.set('token', token)
    return url.toString()
  }

  function notifyStatus(live: boolean): void {
    statusListeners.forEach((listener) => listener(live))
  }

  function scheduleReconnect(): void {
    if (listeners.size === 0 || reconnectTimer !== null) return
    const ceiling = Math.min(
      maxReconnectDelayMs,
      reconnectDelayMs * 2 ** failedConnects
    )
    failedConnects += 1
    reconnectTimer = window.setTimeout(
      () => {
        reconnectTimer = null
        void connect()
      },
      ceiling * (0.5 + 0.5 * random())
    )
  }

  async function connect(): Promise<void> {
    if (listeners.size === 0 || socket !== null || connecting) return
    connecting = true
    const generation = connectGeneration
    let token: string | undefined
    try {
      token = await getToken()
    } catch {
      token = undefined
    } finally {
      connecting = false
    }
    if (generation !== connectGeneration) {
      void connect()
      return
    }
    if (listeners.size === 0) return
    open(eventUrl(token))
  }

  function open(url: string): void {
    const current = new WebSocket(url)
    socket = current
    current.addEventListener('open', () => {
      if (socket !== current) return
      notifyStatus(true)
    })
    current.addEventListener('message', (event) => {
      if (socket !== current) return
      failedConnects = 0
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
    connectGeneration++
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
    reconnect() {
      disconnect()
      failedConnects = 0
      void connect()
    },
    send(frame) {
      if (socket?.readyState !== WebSocket.OPEN) return false
      socket.send(frame)
      return true
    },
    subscribe(listener) {
      listeners.add(listener)
      void connect()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) disconnect()
      }
    },
    onStatus(listener) {
      statusListeners.add(listener)
      listener(socket?.readyState === WebSocket.OPEN)
      return () => statusListeners.delete(listener)
    }
  }
}
