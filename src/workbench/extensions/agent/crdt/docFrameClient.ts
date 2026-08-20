const DOC_PROTOCOL_VERSION = 1

export interface DocOp {
  op_id: string
  actor: string
  [key: string]: unknown
}

export interface DocUpdate {
  workflowId: string
  seq: number
  update: Uint8Array
  actor?: string
}

interface DocSubscribed {
  workflowId: string
  ok: boolean
  seq?: number
  code?: string
  message?: string
}

interface DocOpsResult {
  workflowId: string
  ok: boolean
  seq?: number
  applied: string[]
  skipped: string[]
  code?: string
  message?: string
}

interface DocAwareness {
  workflowId: string
  actor: string
  state?: Record<string, unknown>
  expiresAt?: number
}

export type ServerDocFrame =
  | { type: 'doc_update'; data: DocUpdate }
  | { type: 'doc_subscribed'; data: DocSubscribed }
  | { type: 'doc_ops_result'; data: DocOpsResult }
  | { type: 'awareness'; data: DocAwareness }

export interface DocFrameTransport {
  send(frame: string): void
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

interface WireData {
  v?: unknown
  workflow_id?: unknown
  seq?: unknown
  update_b64?: unknown
  actor?: unknown
  ok?: unknown
  code?: unknown
  message?: unknown
  applied?: unknown
  skipped?: unknown
  state?: unknown
  expires_at?: unknown
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export function encodeBase64(value: Uint8Array): string {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function parseWireData(value: unknown): WireData | null {
  return typeof value === 'object' && value !== null ? value : null
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? Object.fromEntries(Object.entries(value))
    : null
}

export function parseServerDocFrame(value: unknown): ServerDocFrame | null {
  if (typeof value !== 'object' || value === null) return null
  const frame = value as { type?: unknown; data?: unknown }
  const data = parseWireData(frame.data)
  if (
    data === null ||
    data.v !== DOC_PROTOCOL_VERSION ||
    typeof data.workflow_id !== 'string'
  )
    return null

  if (
    frame.type === 'doc_update' &&
    typeof data.seq === 'number' &&
    typeof data.update_b64 === 'string'
  ) {
    return {
      type: frame.type,
      data: {
        workflowId: data.workflow_id,
        seq: data.seq,
        update: decodeBase64(data.update_b64),
        ...(typeof data.actor === 'string' && { actor: data.actor })
      }
    }
  }

  if (frame.type === 'doc_subscribed' && typeof data.ok === 'boolean') {
    return {
      type: frame.type,
      data: {
        workflowId: data.workflow_id,
        ok: data.ok,
        ...(typeof data.seq === 'number' && { seq: data.seq }),
        ...(typeof data.code === 'string' && { code: data.code }),
        ...(typeof data.message === 'string' && { message: data.message })
      }
    }
  }

  if (frame.type === 'doc_ops_result' && typeof data.ok === 'boolean') {
    return {
      type: frame.type,
      data: {
        workflowId: data.workflow_id,
        ok: data.ok,
        applied: Array.isArray(data.applied)
          ? data.applied.filter(
              (item): item is string => typeof item === 'string'
            )
          : [],
        skipped: Array.isArray(data.skipped)
          ? data.skipped.filter(
              (item): item is string => typeof item === 'string'
            )
          : [],
        ...(typeof data.seq === 'number' && { seq: data.seq }),
        ...(typeof data.code === 'string' && { code: data.code }),
        ...(typeof data.message === 'string' && { message: data.message })
      }
    }
  }

  if (frame.type === 'awareness' && typeof data.actor === 'string') {
    const state = parseRecord(data.state)
    return {
      type: frame.type,
      data: {
        workflowId: data.workflow_id,
        actor: data.actor,
        ...(state !== null && { state }),
        ...(typeof data.expires_at === 'number' && {
          expiresAt: data.expires_at
        })
      }
    }
  }

  return null
}

export class DocFrameClient extends EventTarget {
  private readonly listeners = new Map<string, EventListener>()

  constructor(private readonly transport: DocFrameTransport) {
    super()
    for (const type of [
      'doc_update',
      'doc_subscribed',
      'doc_ops_result',
      'awareness'
    ]) {
      const listener: EventListener = (event) => {
        if (!(event instanceof CustomEvent)) return
        const parsed = parseServerDocFrame({ type, data: event.detail })
        if (parsed)
          this.dispatchEvent(new CustomEvent(type, { detail: parsed.data }))
      }
      this.listeners.set(type, listener)
      transport.addEventListener(type, listener)
    }
  }

  subscribe(workflowId: string, stateVector: Uint8Array): void {
    this.send('doc_subscribe', {
      v: DOC_PROTOCOL_VERSION,
      workflow_id: workflowId,
      state_vector_b64: encodeBase64(stateVector)
    })
  }

  unsubscribe(workflowId: string): void {
    this.send('doc_unsubscribe', {
      v: DOC_PROTOCOL_VERSION,
      workflow_id: workflowId
    })
  }

  sendOps(workflowId: string, tab: string, ops: DocOp[]): void {
    this.send('doc_ops', {
      v: DOC_PROTOCOL_VERSION,
      workflow_id: workflowId,
      tab,
      ops
    })
  }

  destroy(): void {
    for (const [type, listener] of this.listeners)
      this.transport.removeEventListener(type, listener)
    this.listeners.clear()
  }

  private send(type: string, data: Record<string, unknown>): void {
    this.transport.send(JSON.stringify({ type, data }))
  }
}
