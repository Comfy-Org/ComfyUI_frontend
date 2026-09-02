import type { Op } from '@comfyorg/comfy-multi-player'

import { reportError } from '@/platform/telemetry/reportError'

const DOC_PROTOCOL_VERSION = 1
const MAX_DOC_UPDATE_BYTES = 8 << 20
const MAX_WORKFLOW_ID_LENGTH = 128
const MAX_ACTOR_LENGTH = 256
const MAX_AWARENESS_STATE_BYTES = 8 << 10
const MAX_DOC_OPS_PER_FRAME = 256
const MAX_OP_ID_LENGTH = 128
const MAX_ERROR_CODE_LENGTH = 128
const MAX_ERROR_MESSAGE_LENGTH = 8 << 10
const utf8 = new TextEncoder()

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
  /** Absent when the relay cannot map the failing index to an op id. */
  op_id?: string
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
  /** Validated diagnostics for the first rejected operation in a batch. */
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
  if (value === '' || value.length % 4 !== 0) return null
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0
  if ((value.length / 4) * 3 - padding > MAX_DOC_UPDATE_BYTES) return null

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

function isAbsent(value: unknown): value is null | undefined {
  return value === null || value === undefined
}

function hasBoundedUtf8Length(value: string, maxBytes: number): boolean {
  return value.length <= maxBytes && utf8.encode(value).length <= maxBytes
}

function isValidWorkflowId(value: string): boolean {
  return (
    value.length > 0 &&
    hasBoundedUtf8Length(value, MAX_WORKFLOW_ID_LENGTH) &&
    !/[\0\n\r\t :*?[\]]/.test(value)
  )
}

function isValidActor(value: string): boolean {
  if (
    value.length === 0 ||
    !hasBoundedUtf8Length(value, MAX_ACTOR_LENGTH) ||
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
  return (
    Array.isArray(value) &&
    value.length <= MAX_DOC_OPS_PER_FRAME &&
    value.every(
      (item) =>
        typeof item === 'string' && hasBoundedUtf8Length(item, MAX_OP_ID_LENGTH)
    )
  )
}

function hasValidDiagnostics(data: WireData): boolean {
  return (
    (isAbsent(data.code) ||
      (typeof data.code === 'string' &&
        hasBoundedUtf8Length(data.code, MAX_ERROR_CODE_LENGTH))) &&
    (isAbsent(data.message) ||
      (typeof data.message === 'string' &&
        hasBoundedUtf8Length(data.message, MAX_ERROR_MESSAGE_LENGTH)))
  )
}

/**
 * The relay serialises `applied`/`skipped` with `omitempty`, so an empty list
 * arrives as an absent field. Absent means empty; present-but-malformed is a
 * protocol violation.
 */
function parseOptionalStringArray(value: unknown): string[] | null {
  if (value === undefined) return []
  return isStringArray(value) ? value : null
}

function parseDocOpFailure(value: unknown): DocOpFailure | null {
  const failure = parseWireData(value)
  if (
    failure === null ||
    !isSequence(failure.index) ||
    (!isAbsent(failure.op_id) &&
      (typeof failure.op_id !== 'string' ||
        !hasBoundedUtf8Length(failure.op_id, MAX_OP_ID_LENGTH))) ||
    typeof failure.code !== 'string' ||
    !hasBoundedUtf8Length(failure.code, MAX_ERROR_CODE_LENGTH) ||
    typeof failure.message !== 'string' ||
    !hasBoundedUtf8Length(failure.message, MAX_ERROR_MESSAGE_LENGTH)
  )
    return null

  return {
    index: failure.index,
    ...(!isAbsent(failure.op_id) && { op_id: failure.op_id }),
    code: failure.code,
    message: failure.message
  }
}

function encodedJsonSize(value: Record<string, unknown>): number | null {
  try {
    const encoded = JSON.stringify(value)
    if (encoded.length > MAX_AWARENESS_STATE_BYTES) return encoded.length
    return utf8.encode(encoded).length
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
    if (data.op_ids !== undefined && !isStringArray(data.op_ids)) return null
    const actor =
      typeof data.actor === 'string' && isValidActor(data.actor)
        ? data.actor
        : undefined
    return {
      type: frame.type,
      data: {
        workflowId: data.workflow_id,
        seq: data.seq,
        update,
        ...(actor !== undefined && { actor }),
        ...(Array.isArray(data.op_ids) && {
          opIds: data.op_ids
        })
      }
    }
  }

  if (frame.type === 'doc_subscribed' && typeof data.ok === 'boolean') {
    if (
      (!isAbsent(data.seq) && !isSequence(data.seq)) ||
      !hasValidDiagnostics(data)
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
    const applied = parseOptionalStringArray(data.applied)
    const skipped = parseOptionalStringArray(data.skipped)
    if (applied === null || skipped === null) return null
    if (
      (!isAbsent(data.seq) && !isSequence(data.seq)) ||
      !hasValidDiagnostics(data)
    )
      return null
    let failed: DocOpFailure | undefined
    if (!isAbsent(data.failed)) {
      const parsedFailure = parseDocOpFailure(data.failed)
      if (parsedFailure === null) return null
      failed = parsedFailure
    }
    return {
      type: frame.type,
      data: {
        workflowId: data.workflow_id,
        ok: data.ok,
        applied,
        skipped,
        ...(isSequence(data.seq) && { seq: data.seq }),
        ...(typeof data.code === 'string' && { code: data.code }),
        ...(typeof data.message === 'string' && { message: data.message }),
        ...(failed !== undefined && { failed })
      }
    }
  }

  if (frame.type === 'doc_reset' && isSequence(data.seq)) {
    const actor =
      typeof data.actor === 'string' && isValidActor(data.actor)
        ? data.actor
        : undefined
    return {
      type: frame.type,
      data: {
        workflowId: data.workflow_id,
        seq: data.seq,
        ...(actor !== undefined && { actor })
      }
    }
  }

  if (frame.type === 'awareness' && typeof data.actor === 'string') {
    if (!isValidActor(data.actor)) return null
    const state = parseRecord(data.state)
    if (!isAbsent(data.state) && state === null) return null
    if (state !== null) {
      const stateSize = encodedJsonSize(state)
      if (stateSize === null || stateSize > MAX_AWARENESS_STATE_BYTES)
        return null
    }
    if (!isAbsent(data.expires_at) && !isSequence(data.expires_at)) return null
    return {
      type: frame.type,
      data: {
        workflowId: data.workflow_id,
        actor: data.actor,
        ...(state !== null && { state }),
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
        if (parsed) {
          this.dispatchEvent(new CustomEvent(type, { detail: parsed.data }))
          return
        }
        reportError(new Error('Discarded invalid server document frame'), {
          errorType: 'agent_crdt_invalid_server_frame',
          tags: { frame_type: type },
          level: 'warning'
        })
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
