/**
 * A `DocFrameTransport` for the LOCAL (standalone) agent.
 *
 * The cloud transport (`apiTransport` in useAgentCrdtFollower) rides ComfyUI's
 * same-origin `/ws`, because ingest relays the agent's document frames onto it.
 * A standalone agent has no ingest, and ComfyUI's socket carries nothing from
 * it, so a follower wired that way can never see a document update. That is why
 * an agent could edit a workflow, report it accurately, and leave the canvas
 * untouched.
 *
 * The local agent already exposes everything needed, just addressed
 * differently:
 *
 *   inbound   GET  /api/agent/events?workflow_id=<id>   doc_update / doc_reset
 *   catch-up  POST /api/agent/doc/resync                whole doc when the
 *                                                       state vector is empty
 *   outbound  POST /api/agent/doc/ops                   human edits
 *
 * ITS OWN SOCKET, ON PURPOSE. The agent fixes a connection's workflow
 * subscription at connect time from the query string, so following a different
 * workflow means reconnecting. The chat stream must NOT be what reconnects: the
 * workflow binds partway through the first turn, and tearing the chat socket
 * down at that moment drops every progress frame published while it is
 * re-establishing — the panel goes silent for the rest of the turn. Dropping
 * THIS socket is harmless by comparison, because the follower resubscribes and
 * catches up through resync, so no document state is lost.
 */
import type { DocFrameTransport } from './docFrameClient'

/** Frames the agent sends us. Anything else on the socket is not ours. */
const INBOUND_DOC_FRAMES = new Set([
  'doc_update',
  'doc_subscribed',
  'doc_ops_result',
  'doc_reset',
  'awareness'
])

/** The wire envelope every agent frame arrives in. */
interface AgentFrame {
  type?: unknown
  data?: unknown
}

/**
 * Shapes describing what the agent sends, not a guarantee. These are parsed
 * from the wire, so every field a caller dereferences is optional here and the
 * defaults below are load-bearing rather than decorative.
 */
interface ResyncResponse {
  workflow_id?: string
  seq?: number
  missing_b64?: string
}

interface OpsResponse {
  workflow_id?: string
  seq?: number
  applied?: string[]
  skipped?: string[]
  failed?: unknown
}

export interface StandaloneDocFrameTransportOptions {
  /** Overridable for tests; defaults to the panel's same-origin agent routes. */
  basePath?: string
  fetchImpl?: typeof fetch
  createSocket?: (url: string) => WebSocket
  reconnectDelayMs?: number
  /** Reported instead of thrown: a transport must never break the follower. */
  onError?: (error: unknown, context: string) => void
}

export interface StandaloneDocFrameTransport extends DocFrameTransport {
  /**
   * Follow this workflow's document channel. Reconnects only on a real change,
   * so it is safe to call on every tab activation. `null` disconnects.
   */
  follow(workflowId: string | null): void
  destroy(): void
}

export function createStandaloneDocFrameTransport({
  basePath = '/api/agent',
  fetchImpl = fetch,
  createSocket = (url) => new WebSocket(url),
  reconnectDelayMs = 1000,
  onError = () => {}
}: StandaloneDocFrameTransportOptions = {}): StandaloneDocFrameTransport {
  const target = new EventTarget()
  let followed: string | null = null
  let socket: WebSocket | null = null
  let reconnectTimer: number | null = null
  let destroyed = false

  function emit(type: string, data: unknown): void {
    target.dispatchEvent(new CustomEvent(type, { detail: data }))
  }

  function socketUrl(workflowId: string): string {
    const url = new URL(`${basePath}/events`, window.location.href)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    // Repeated parameter, matching the server: it reads every `workflow_id` and
    // subscribes that workflow's document channel. A connection naming none
    // receives chat only, which is exactly the bug this transport exists to fix.
    url.searchParams.append('workflow_id', workflowId)
    return url.toString()
  }

  function disconnect(): void {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    const current = socket
    socket = null
    current?.close()
  }

  function connect(): void {
    if (destroyed || followed === null || socket !== null) return
    const current = createSocket(socketUrl(followed))
    socket = current
    current.addEventListener('message', (event) => {
      if (socket !== current) return
      if (typeof event.data !== 'string') return
      let frame: AgentFrame
      try {
        frame = JSON.parse(event.data) as AgentFrame
      } catch {
        return
      }
      if (typeof frame.type !== 'string') return
      if (!INBOUND_DOC_FRAMES.has(frame.type)) return
      emit(frame.type, frame.data)
    })
    current.addEventListener('error', () => {
      if (socket === current) current.close()
    })
    current.addEventListener('close', () => {
      if (socket !== current) return
      socket = null
      if (destroyed || followed === null || reconnectTimer !== null) return
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        connect()
      }, reconnectDelayMs)
    })
  }

  async function post<T>(path: string, body: unknown): Promise<T | null> {
    try {
      const response = await fetchImpl(`${basePath}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!response.ok) {
        onError(new Error(`HTTP ${response.status}`), path)
        return null
      }
      return (await response.json()) as T
    } catch (error) {
      onError(error, path)
      return null
    }
  }

  /**
   * A resync answers with the state we are missing. Re-emit it as the two
   * frames a subscribing client expects: the acknowledgement, then the state
   * itself as an ordinary update. An empty payload means we were already
   * current, so only the acknowledgement is emitted.
   */
  async function resync(data: Record<string, unknown>): Promise<void> {
    const workflowId = String(data.workflow_id ?? '')
    const answer = await post<ResyncResponse>('/doc/resync', data)
    if (!answer) {
      emit('doc_subscribed', {
        workflow_id: workflowId,
        ok: false,
        code: 'resync_failed'
      })
      return
    }
    emit('doc_subscribed', {
      workflow_id: answer.workflow_id ?? workflowId,
      ok: true,
      seq: answer.seq
    })
    if (answer.missing_b64) {
      emit('doc_update', {
        workflow_id: answer.workflow_id ?? workflowId,
        seq: answer.seq,
        update_b64: answer.missing_b64
      })
    }
  }

  async function sendOps(data: Record<string, unknown>): Promise<void> {
    const workflowId = String(data.workflow_id ?? '')
    const answer = await post<OpsResponse>('/doc/ops', data)
    if (!answer) {
      emit('doc_ops_result', {
        workflow_id: workflowId,
        ok: false,
        applied: [],
        skipped: [],
        code: 'ops_failed'
      })
      return
    }
    emit('doc_ops_result', {
      workflow_id: answer.workflow_id ?? workflowId,
      ok: answer.failed === undefined || answer.failed === null,
      seq: answer.seq,
      applied: answer.applied ?? [],
      skipped: answer.skipped ?? [],
      ...(answer.failed ? { failed: answer.failed } : {})
    })
    // The agent broadcasts the resulting update to followers of this workflow,
    // and this socket is one of them, so the effect arrives on its own.
  }

  return {
    /**
     * Optimistically true. These are HTTP calls rather than socket writes, so
     * there is no "socket not open" state to report, and the real outcome
     * arrives as a frame. Returning false would stop the bridge latching the
     * workflow it just subscribed to, and it would retry forever.
     */
    send(frame: string): boolean {
      let parsed: AgentFrame
      try {
        parsed = JSON.parse(frame) as AgentFrame
      } catch (error) {
        onError(error, 'parse outbound frame')
        return false
      }
      const data = (parsed.data ?? {}) as Record<string, unknown>
      switch (parsed.type) {
        case 'doc_subscribe':
          void resync(data)
          return true
        case 'doc_unsubscribe':
          // Nothing to tear down: the subscription is per-connection and the
          // agent drops it when this socket closes.
          return true
        case 'doc_ops':
          void sendOps(data)
          return true
        default:
          // Awareness and anything else the cloud multiplexes onto /ws has no
          // local equivalent. Swallow it rather than reporting a failure the
          // caller cannot act on.
          return true
      }
    },
    addEventListener(type, listener) {
      target.addEventListener(type, listener)
    },
    removeEventListener(type, listener) {
      target.removeEventListener(type, listener)
    },
    follow(workflowId) {
      if (workflowId === followed) return
      followed = workflowId
      disconnect()
      connect()
    },
    destroy() {
      destroyed = true
      followed = null
      disconnect()
    }
  }
}
