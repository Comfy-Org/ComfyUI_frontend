import { useTimeoutFn } from '@vueuse/core'

import type { AgentEventSource } from '@/workbench/extensions/agent/composables/agent/useAgentSession'

export interface AgentEventSocket extends AgentEventSource {
  send(frame: string): boolean
  reconnect(): void
  onStatus(listener: (live: boolean) => void): () => void
}

/** Why a socket could not be established, for the telemetry the caller sends. */
export type AgentSocketFailure = 'auth_read' | 'socket_construct'

function refusalWithoutCredential(error: unknown): Error {
  const name = error instanceof Error ? error.name : 'unknown error'
  return new Error(`The browser refused the agent socket URL: ${name}`)
}

interface AgentEventSourceOptions {
  endpoint: string
  getAuthParams: () => Promise<URLSearchParams | null>
  reconnectDelayMs?: number
  maxReconnectDelayMs?: number
  random?: () => number
  reportFailure?: (error: unknown, failure: AgentSocketFailure) => void
}

type AuthRead =
  | { ok: true; params: URLSearchParams | null }
  | { ok: false; error: unknown }

export function createAgentEventSource({
  endpoint,
  getAuthParams,
  reconnectDelayMs = 1000,
  maxReconnectDelayMs = 30_000,
  random = Math.random,
  reportFailure = () => {}
}: AgentEventSourceOptions): AgentEventSocket {
  const listeners = new Set<(raw: unknown) => void>()
  const statusListeners = new Set<(live: boolean) => void>()
  let socket: WebSocket | null = null
  let nextReconnectDelayMs = reconnectDelayMs
  const reconnectTimer = useTimeoutFn(
    () => void connect(),
    () => nextReconnectDelayMs,
    {
      immediate: false
    }
  )
  let connectGeneration = 0
  let connecting = false
  let failedConnects = 0

  function eventUrl(authParams: URLSearchParams): string {
    const url = new URL(endpoint, window.location.href)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    for (const [name, value] of authParams) url.searchParams.set(name, value)
    return url.toString()
  }

  function notifyStatus(live: boolean): void {
    statusListeners.forEach((listener) => listener(live))
  }

  function scheduleReconnect(): void {
    if (listeners.size === 0 || reconnectTimer.isPending.value) return
    const ceiling = Math.min(
      maxReconnectDelayMs,
      reconnectDelayMs * 2 ** failedConnects
    )
    failedConnects += 1
    nextReconnectDelayMs = ceiling * (0.5 + 0.5 * random())
    reconnectTimer.start()
  }

  const reportedFailures = new Set<AgentSocketFailure>()

  function endFailureRun(): void {
    reportedFailures.clear()
  }

  function reportFailureOnce(
    error: unknown,
    failure: AgentSocketFailure
  ): void {
    if (reportedFailures.has(failure)) return
    reportedFailures.add(failure)
    try {
      reportFailure(error, failure)
    } catch {
      return
    }
  }

  async function readAuth(): Promise<AuthRead> {
    try {
      return { ok: true, params: await getAuthParams() }
    } catch (error) {
      return { ok: false, error }
    }
  }

  async function connect(): Promise<void> {
    if (listeners.size === 0 || socket !== null || connecting) return
    connecting = true
    const generation = connectGeneration
    const auth = await readAuth()
    // A stale read must leave the latch alone: `disconnect()` already cleared it and
    // bumped the generation, so by now it belongs to a newer `connect()`.
    if (generation !== connectGeneration) return
    // Released here rather than in `readAuth`, because everything from this point to
    // `open()` is synchronous. Clearing it before this continuation ran left a window
    // in which a `subscribe()` could start a second read in the same generation; both
    // would reach `open()`, and the second would overwrite `socket` without closing
    // the first, leaving an orphan whose handlers all bail on `socket !== current`.
    connecting = false
    if (listeners.size === 0) return
    // A credential that cannot be read right now — a rejected refresh, or a
    // token the provider has not minted yet — is retried on the backoff rather
    // than leaving the source dead until something else calls `reconnect()`.
    if (!auth.ok) reportFailureOnce(auth.error, 'auth_read')
    if (!auth.ok || auth.params === null) {
      notifyStatus(false)
      scheduleReconnect()
      return
    }
    open(eventUrl(auth.params))
  }

  function open(url: string): void {
    let current: WebSocket
    try {
      current = new WebSocket(url)
    } catch (error) {
      reportFailureOnce(refusalWithoutCredential(error), 'socket_construct')
      notifyStatus(false)
      scheduleReconnect()
      return
    }
    socket = current
    let openedAt: number | null = null
    current.addEventListener('open', () => {
      if (socket !== current) return
      openedAt = Date.now()
      notifyStatus(true)
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
      // Only a connection that lasted clears the backoff. A server that
      // accepts the upgrade, writes a frame and hangs up must not reset it, or
      // the panel reconnects in a tight loop that never widens.
      if (openedAt !== null && Date.now() - openedAt >= maxReconnectDelayMs) {
        failedConnects = 0
        endFailureRun()
      }
      socket = null
      notifyStatus(false)
      scheduleReconnect()
    })
  }

  function disconnect(): void {
    connectGeneration++
    endFailureRun()
    // An auth read that never settles would otherwise latch `connecting` and
    // make every later `connect()` — `reconnect()` included — a no-op.
    connecting = false
    reconnectTimer.stop()
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
