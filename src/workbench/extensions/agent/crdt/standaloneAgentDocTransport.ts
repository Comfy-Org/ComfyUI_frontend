import { api } from '@/scripts/api'

import type { DocFrameTransport } from './docFrameClient'

const DOC_PROTOCOL_VERSION = 1
const RECONNECT_DELAY_MS = 1000

interface StandaloneAgentDocTransportOptions {
  createSocket?: (url: string) => WebSocket
  request?: (route: string, init: RequestInit) => Promise<Response>
  reconnectDelayMs?: number
}

interface ClientFrame {
  type?: unknown
  data?: Record<string, unknown>
}

interface ResyncResponse {
  workflow_id: string
  seq: number
  missing_b64: string
}

interface OpsResponse {
  workflow_id: string
  seq: number
  applied: string[]
  skipped: string[]
  failed?: unknown
}

/**
 * Adapts the standalone Agent's server-only event socket and HTTP document
 * endpoints to the bidirectional cloud socket contract used by DocFrameClient.
 * Authentication stays at the Vite/Desktop proxy boundary; this transport
 * never reads or stores the standalone bearer token.
 */
export function createStandaloneAgentDocTransport({
  createSocket = (url) => new WebSocket(url),
  request = (route, init) => api.fetchApi(route, init),
  reconnectDelayMs = RECONNECT_DELAY_MS
}: StandaloneAgentDocTransportOptions = {}): DocFrameTransport {
  const events = new EventTarget()
  let listenerCount = 0
  let workflowId: string | null = null
  let socket: WebSocket | null = null
  let generation = 0
  let reconnectTimer: number | null = null

  function dispatch(type: string, data: Record<string, unknown>): void {
    events.dispatchEvent(new CustomEvent(type, { detail: data }))
  }

  function eventUrl(id: string): string {
    const url = new URL('/api/agent/events', window.location.href)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.searchParams.set('workflow_id', id)
    return url.toString()
  }

  function closeSocket(): void {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    const current = socket
    socket = null
    current?.close()
  }

  function errorMessage(body: unknown, fallback: string): string {
    if (typeof body !== 'object' || body === null) return fallback
    const error = (body as { error?: unknown }).error
    return typeof error === 'string' ? error : fallback
  }

  async function readJson(response: Response): Promise<unknown> {
    try {
      return await response.json()
    } catch {
      return undefined
    }
  }

  async function resync(id: string, stateVectorB64: string, run: number) {
    try {
      const response = await request('/agent/doc/resync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          v: DOC_PROTOCOL_VERSION,
          workflow_id: id,
          state_vector_b64: stateVectorB64
        })
      })
      const body = await readJson(response)
      if (run !== generation || id !== workflowId) return
      if (!response.ok) {
        dispatch('doc_subscribed', {
          v: DOC_PROTOCOL_VERSION,
          workflow_id: id,
          ok: false,
          code: String(response.status),
          message: errorMessage(body, response.statusText)
        })
        return
      }
      const result = body as ResyncResponse
      dispatch('doc_subscribed', {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: result.workflow_id,
        ok: true,
        seq: result.seq
      })
      if (result.missing_b64 !== '') {
        dispatch('doc_update', {
          v: DOC_PROTOCOL_VERSION,
          workflow_id: result.workflow_id,
          seq: result.seq,
          update_b64: result.missing_b64
        })
      }
    } catch (error) {
      if (run !== generation || id !== workflowId) return
      dispatch('doc_subscribed', {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: id,
        ok: false,
        code: 'transport_error',
        message:
          error instanceof Error ? error.message : 'Document resync failed'
      })
    }
  }

  function connect(id: string, stateVectorB64: string, run: number): void {
    if (run !== generation || id !== workflowId || socket !== null) return
    const current = createSocket(eventUrl(id))
    socket = current
    current.addEventListener('open', () => {
      if (socket === current && run === generation)
        void resync(id, stateVectorB64, run)
    })
    current.addEventListener('message', (event) => {
      if (socket !== current || run !== generation) return
      try {
        const frame = JSON.parse(String(event.data)) as ClientFrame
        if (typeof frame.type === 'string' && frame.data)
          dispatch(frame.type, frame.data)
      } catch {
        // Invalid server frames are ignored, matching DocFrameClient's gate.
      }
    })
    current.addEventListener('error', () => {
      if (socket === current) current.close()
    })
    current.addEventListener('close', () => {
      if (socket !== current || run !== generation) return
      socket = null
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        connect(id, stateVectorB64, run)
      }, reconnectDelayMs)
    })
  }

  async function sendOps(data: Record<string, unknown>, run: number) {
    const id = data.workflow_id
    if (typeof id !== 'string') return
    try {
      const response = await request('/agent/doc/ops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const body = await readJson(response)
      if (run !== generation || id !== workflowId) return
      const result = body as Partial<OpsResponse>
      dispatch('doc_ops_result', {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: id,
        ok: response.ok,
        seq: result.seq,
        applied: result.applied ?? [],
        skipped: result.skipped ?? [],
        ...(result.failed !== undefined && { failed: result.failed }),
        ...(!response.ok && {
          code: String(response.status),
          message: errorMessage(body, response.statusText)
        })
      })
    } catch (error) {
      if (run !== generation || id !== workflowId) return
      dispatch('doc_ops_result', {
        v: DOC_PROTOCOL_VERSION,
        workflow_id: id,
        ok: false,
        applied: [],
        skipped: [],
        code: 'transport_error',
        message:
          error instanceof Error ? error.message : 'Document operation failed'
      })
    }
  }

  return {
    send(raw) {
      let frame: ClientFrame
      try {
        frame = JSON.parse(raw) as ClientFrame
      } catch {
        return false
      }
      const data = frame.data
      if (!data) return false
      const id = data.workflow_id
      if (typeof id !== 'string') return false
      if (frame.type === 'doc_subscribe') {
        generation += 1
        workflowId = id
        closeSocket()
        const stateVector = data.state_vector_b64
        connect(
          id,
          typeof stateVector === 'string' ? stateVector : '',
          generation
        )
        return true
      }
      if (frame.type === 'doc_unsubscribe') {
        generation += 1
        workflowId = null
        closeSocket()
        return true
      }
      if (frame.type === 'doc_ops' && id === workflowId) {
        void sendOps(data, generation)
        return true
      }
      return false
    },
    addEventListener(type, listener) {
      listenerCount += 1
      events.addEventListener(type, listener)
    },
    removeEventListener(type, listener) {
      events.removeEventListener(type, listener)
      listenerCount = Math.max(0, listenerCount - 1)
      if (listenerCount === 0) {
        generation += 1
        workflowId = null
        closeSocket()
      }
    }
  }
}
