import type { Op } from '@comfyorg/comfy-multi-player'

const DOC_PROTOCOL_VERSION = 1
const MAX_DOC_FRAME_B64_LENGTH = 8 << 20
const MAX_WORKFLOW_ID_LENGTH = 128
const MAX_ACTOR_LENGTH = 256
const MAX_AWARENESS_STATE_BYTES = 8 << 10

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
  /** Accepted semantic op identities folded into this effect frame (DQ-9). */
  opIds?: string[]
}

export interface DocSubscribed {
  workflowId: string
  ok: boolean
  seq?: number
  code?: string
  message?: string
}

interface DocOpFailure {
  index: number
  op_id: string
  code: string
  message: string
}

interface DocOpsResult {
  workflowId: string
  ok: boolean
  seq?: number
  applied: string[]
  skipped: string[]
  code?: string
  message?: string
  /**
   * PoC diagnostics: the batch's failure, forwarded verbatim. The wire type is
   * a single object (`DocOpFailure {op_id, code, message}`), not an array.
   */
  failed?: DocOpFailure
}

interface DocAwareness {
  workflowId: string
  actor: string
  state?: Record<string, unknown>
  expiresAt?: number
}

/**
 * Host→follower lineage break: the document was re-minted, so updates from
 * before this frame do NOT compose with what comes after. Deliberately
 * payload-less — the fresh state arrives through the ordinary subscribe
 * catch-up path, never a second snapshot channel.
 */
export interface DocReset {
  workflowId: string
  seq: number
  actor?: string
}

export type ServerDocFrame =
  | { type: 'doc_update'; data: DocUpdate }
  | { type: 'doc_subscribed'; data: DocSubscribed }
  | { type: 'doc_ops_result'; data: DocOpsResult }
  | { type: 'doc_reset'; data: DocReset }
  | { type: 'awareness'; data: DocAwareness }

export interface DocFrameTransport {
  /**
   * Best-effort send. Returns `true` when the frame left the transport and
   * `false` when the transport cannot currently carry it (socket not OPEN).
   *
   * It MUST NOT throw. "The socket is not connected yet" is a normal,
   * recoverable state of a follower that mounted while `createSocket` was still
   * awaiting its auth token — not an exception. Throwing here aborted the
   * `watch(..., { immediate: true })` subscribe (leaving the follower
   * permanently inert) and aborted `onBeforeUnmount` before `client.destroy()`
   * (leaking listeners and a live adapter). Callers reconcile intent against
   * the returned boolean instead.
   */
  send(frame: string): boolean
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

interface WireData {
  v?: unknown
  workflow_id?: unknown
  seq?: unknown
  update_b64?: unknown
  actor?: unknown
  op_ids?: unknown
  ok?: unknown
  code?: unknown
  message?: unknown
  applied?: unknown
  skipped?: unknown
  failed?: unknown
  state?: unknown
  expires_at?: unknown
  index?: unknown
  op_id?: unknown
}

function decodeBase64(value: string): Uint8Array | null {
  if (value === '' || value.length > MAX_DOC_FRAME_B64_LENGTH) return null
  // `atob` is permissive about missing padding, so require canonical standard
  // base64 before decoding the untrusted wire value.
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value
    )
  )
    return null
  try {
    const binary = atob(value)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    return null
  }
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
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null
}

function isValidWorkflowId(value: string): boolean {
  return (
    value.length > 0 &&
    new TextEncoder().encode(value).length <= MAX_WORKFLOW_ID_LENGTH &&
    !/[\0\n\r\t :*?[\]]/.test(value)
  )
}

function isValidActor(value: string): boolean {
  if (
    value.length === 0 ||
    new TextEncoder().encode(value).length > MAX_ACTOR_LENGTH ||
    /[\0\n\r\t ]/.test(value)
  )
    return false
  if (value === 'system:mint') return true
  const match = /^(?:agent|human):([^:]+):([^:]+)$/.exec(value)
  return match !== null
}

function isSequence(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function parseDocOpFailure(value: unknown): DocOpFailure | null {
  const failure = parseWireData(value)
  return failure !== null &&
    isSequence(failure.index) &&
    typeof failure.op_id === 'string' &&
    typeof failure.code === 'string' &&
    typeof failure.message === 'string'
    ? (failure as DocOpFailure)
    : null
}

function encodedJsonSize(value: Record<string, unknown>): number | null {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length
  } catch {
    return null
  }
}

export function parseServerDocFrame(value: unknown): ServerDocFrame | null {
  if (typeof value !== 'object' || value === null) return null
  const frame = value as { type?: unknown; data?: unknown }
  const data = parseWireData(frame.data)
  if (
    data === null ||
    data.v !== DOC_PROTOCOL_VERSION ||
    typeof data.workflow_id !== 'string' ||
    !isValidWorkflowId(data.workflow_id)
  )
    return null

  if (
    frame.type === 'doc_update' &&
    isSequence(data.seq) &&
    typeof data.update_b64 === 'string'
  ) {
    const update = decodeBase64(data.update_b64)
    if (update === null) return null
    if (
      data.actor !== undefined &&
      (typeof data.actor !== 'string' || !isValidActor(data.actor))
    )
      return null
    if (data.op_ids !== undefined && !isStringArray(data.op_ids)) return null
    return {
      type: frame.type,
      data: {
        workflowId: data.workflow_id,
        seq: data.seq,
        update,
        ...(typeof data.actor === 'string' && { actor: data.actor }),
        ...(Array.isArray(data.op_ids) && {
          opIds: data.op_ids
        })
      }
    }
  }

  if (frame.type === 'doc_subscribed' && typeof data.ok === 'boolean') {
    if (
      data.ok
        ? !isSequence(data.seq)
        : typeof data.code !== 'string' || typeof data.message !== 'string'
    )
      return null
    return {
      type: frame.type,
      data: {
        workflowId: data.workflow_id,
        ok: data.ok,
        ...(isSequence(data.seq) && { seq: data.seq }),
        ...(typeof data.code === 'string' && { code: data.code }),
        ...(typeof data.message === 'string' && { message: data.message })
      }
    }
  }

  if (frame.type === 'doc_ops_result' && typeof data.ok === 'boolean') {
    if (!isStringArray(data.applied) || !isStringArray(data.skipped))
      return null
    if (
      data.ok
        ? !isSequence(data.seq)
        : typeof data.code !== 'string' || typeof data.message !== 'string'
    )
      return null
    let failed: DocOpFailure | undefined
    if (data.failed !== undefined) {
      const parsedFailure = parseDocOpFailure(data.failed)
      if (parsedFailure === null) return null
      failed = parsedFailure
    }
    return {
      type: frame.type,
      data: {
        workflowId: data.workflow_id,
        ok: data.ok,
        applied: data.applied,
        skipped: data.skipped,
        ...(isSequence(data.seq) && { seq: data.seq }),
        ...(typeof data.code === 'string' && { code: data.code }),
        ...(typeof data.message === 'string' && { message: data.message }),
        // PoC diagnostics: surface the failure verbatim (object, not array).
        ...(failed !== undefined && { failed })
      }
    }
  }

  if (frame.type === 'doc_reset' && isSequence(data.seq)) {
    if (
      data.actor !== undefined &&
      (typeof data.actor !== 'string' || !isValidActor(data.actor))
    )
      return null
    return {
      type: frame.type,
      data: {
        workflowId: data.workflow_id,
        seq: data.seq,
        ...(typeof data.actor === 'string' && { actor: data.actor })
      }
    }
  }

  if (frame.type === 'awareness' && typeof data.actor === 'string') {
    if (!isValidActor(data.actor)) return null
    const state = data.state == null ? undefined : parseRecord(data.state)
    if (state === null) return null
    if (state !== undefined) {
      const stateSize = encodedJsonSize(state)
      if (stateSize === null || stateSize > MAX_AWARENESS_STATE_BYTES)
        return null
    }
    if (data.expires_at !== undefined && !isSequence(data.expires_at))
      return null
    return {
      type: frame.type,
      data: {
        workflowId: data.workflow_id,
        actor: data.actor,
        ...(state !== undefined && { state }),
        ...(isSequence(data.expires_at) && {
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
      'doc_reset',
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

  /** @returns whether the subscribe frame actually left the transport. */
  subscribe(workflowId: string, stateVector: Uint8Array): boolean {
    return this.send('doc_subscribe', {
      v: DOC_PROTOCOL_VERSION,
      workflow_id: workflowId,
      state_vector_b64: encodeBase64(stateVector)
    })
  }

  /** @returns whether the unsubscribe frame actually left the transport. */
  unsubscribe(workflowId: string): boolean {
    return this.send('doc_unsubscribe', {
      v: DOC_PROTOCOL_VERSION,
      workflow_id: workflowId
    })
  }

  /** @returns whether the ops frame actually left the transport. */
  sendOps(workflowId: string, tab: string, ops: DocOp[] | Op[]): boolean {
    return this.send('doc_ops', {
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

  private send(type: string, data: Record<string, unknown>): boolean {
    return this.transport.send(JSON.stringify({ type, data }))
  }
}
