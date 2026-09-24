import type { AgentEventSource } from '../../composables/agent/useAgentSession'

/**
 * The agent's ONE socket, `/api/agent/events`, on every backend: in the cloud
 * ingest serves it from the agent's Redis channels, locally the agent serves
 * it itself. Chat frames come down it, and document frames go up and down it
 * too (see agentDocFrameTransport). `send` is what lets the doc transport ride
 * this socket instead of opening a second one: a connection's follows are
 * then frames, not a query string, so following a workflow never reconnects
 * the chat stream mid-turn.
 *
 * A browser cannot set headers on a WebSocket, so the caller's credential
 * rides `?token=`, the way ingest's sockets have always read it. It is read
 * afresh for every connect, so a reconnect never presents an expired token.
 */
export interface AgentEventSocket extends AgentEventSource {
  /**
   * Best-effort send, never throws. `false` when the socket is not OPEN —
   * a normal state while the panel mounts — so a caller retries rather than
   * aborts.
   */
  send(frame: string): boolean
}

interface AgentEventSourceOptions {
  /** The caller's credential for `?token=`; `undefined` connects without. */
  getToken?: () => Promise<string | undefined>
  createSocket?: (url: string) => WebSocket
  endpoint?: string
  reconnectDelayMs?: number
}

export function createAgentEventSource({
  getToken = async () => undefined,
  createSocket = (url) => new WebSocket(url),
  endpoint = '/api/agent/events',
  reconnectDelayMs = 1000
}: AgentEventSourceOptions = {}): AgentEventSocket {
  const listeners = new Set<(raw: unknown) => void>()
  const statusListeners = new Set<(live: boolean) => void>()
  let socket: WebSocket | null = null
  let reconnectTimer: number | null = null
  // Bumped by every disconnect: a connect still awaiting its token when the
  // last listener leaves opens nothing, and starts over if one has returned.
  let connectGeneration = 0
  let connecting = false

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
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null
      void connect()
    }, reconnectDelayMs)
  }

  async function connect(): Promise<void> {
    if (listeners.size === 0 || socket !== null || connecting) return
    connecting = true
    const generation = connectGeneration
    let token: string | undefined
    try {
      token = await getToken()
    } catch {
      // Connect without one: the server refuses the upgrade and the ordinary
      // reconnect path retries with a fresh read.
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
    const current = createSocket(url)
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
      if (socket?.readyState === WebSocket.OPEN) listener(true)
      return () => statusListeners.delete(listener)
    }
  }
}
