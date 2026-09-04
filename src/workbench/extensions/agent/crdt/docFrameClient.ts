import type { Op } from '@comfyorg/comfy-multi-player'

import { reportError } from '@/platform/telemetry/reportError'

const DOC_PROTOCOL_VERSION = 1
/** Keep this encoded-field cap aligned with cloud's `MaxDocFrameB64Len`. */
const MAX_DOC_UPDATE_B64_LENGTH = 8 << 20
const MAX_WORKFLOW_ID_LENGTH = 128
const MAX_ACTOR_LENGTH = 256
const MAX_AWARENESS_STATE_BYTES = 8 << 10
const MAX_DOC_OPS_PER_FRAME = 256
const MAX_OP_ID_LENGTH = 128
const MAX_ERROR_CODE_LENGTH = 128
const MAX_ERROR_MESSAGE_LENGTH = 8 << 10
const BASE64_SINGLE_PADDING_END = /[AEIMQUYcgkosw048]=$/
const BASE64_DOUBLE_PADDING_END = /[AQgw]==$/
const utf8 = new TextEncoder()

export interface DocOp {
  op_id: string
  actor: string
  [key: string]: unknown
}

export interface DocUpdate {
  workflowId: string
  seq: number
  lineageSeq: number
  update: Uint8Array
  actor?: string
  /** Accepted semantic op identities folded into this effect frame (DQ-9). */
  opIds?: string[]
}

export interface DocSubscribed {
  workflowId: string
  ok: boolean
  seq?: number
  lineageSeq?: number
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
  lineageSeq: number
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
   * (leaking listeners and a live projector). Callers reconcile intent against
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
  lineage_seq?: unknown
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
  if (value.length > MAX_DOC_UPDATE_B64_LENGTH) return null

  // `atob` is permissive about missing padding, so require canonical standard
  // base64 before decoding the untrusted wire value.
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return null

  if (padding === 2 && !BASE64_DOUBLE_PADDING_END.test(value)) return null
  if (padding === 1 && !BASE64_SINGLE_PADDING_END.test(value)) return null

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

/**
 * Attribution on effect frames is advisory, unlike awareness's actor key.
 * Preserve the load-bearing effect and omit attribution that fails grammar.
 */
function parseAdvisoryActor(value: unknown): string | undefined {
  return typeof value === 'string' && isValidActor(value) ? value : undefined
}

function isSequence(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isValidOpId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    hasBoundedUtf8Length(value, MAX_OP_ID_LENGTH) &&
    !/[\0\n\r\t]/.test(value)
  )
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_DOC_OPS_PER_FRAME &&
    value.every(isValidOpId)
  )
}

function parseBoundedString(
  value: unknown,
  maxBytes: number
): string | undefined {
  return typeof value === 'string' && hasBoundedUtf8Length(value, maxBytes)
    ? value
    : undefined
}

/**
 * The relay serialises `applied`/`skipped` with `omitempty`, so an empty list
 * arrives as an absent field. Absent means empty; present-but-malformed is a
 * protocol violation.
 */
function parseOptionalStringArray(value: unknown): string[] | null {
  if (isAbsent(value)) return []
  return isStringArray(value) ? value : null
}

function parseDocOpFailure(value: unknown): DocOpFailure | null {
  const failure = parseWireData(value)
  if (
    failure === null ||
    !isSequence(failure.index) ||
    (!isAbsent(failure.op_id) && !isValidOpId(failure.op_id)) ||
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

// Defence in depth behind the server's identical cap. The counts are not
// byte-identical: Go's json.Marshal HTML-escapes `<`, `>` and `&`, so the
// server always counts >= this and is the stricter of the two.
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
    isSequence(data.lineage_seq) &&
    data.lineage_seq <= data.seq &&
    typeof data.update_b64 === 'string'
  ) {
    const update = decodeBase64(data.update_b64)
    if (update === null) return null
    if (!isAbsent(data.op_ids) && !isStringArray(data.op_ids)) return null
    const actor = parseAdvisoryActor(data.actor)
    return {
      type: frame.type,
      data: {
        workflowId: data.workflow_id,
        seq: data.seq,
        lineageSeq: data.lineage_seq,
        update,
        ...(actor !== undefined && { actor }),
        ...(isStringArray(data.op_ids) && {
          opIds: data.op_ids
        })
      }
    }
  }

  // The server omits `lineage_seq` from the ack while a doc is still on the
  // migration default lineage 0 (`omitempty`), so absent means 0 here. A
  // present value must still be a well-formed lineage: unlike `seq`, lineage
  // is load-bearing on the ack, so a malformed one rejects the frame.
  const ackLineageSeq = isAbsent(data.lineage_seq) ? 0 : data.lineage_seq
  if (
    frame.type === 'doc_subscribed' &&
    typeof data.ok === 'boolean' &&
    (!data.ok ||
      (isSequence(ackLineageSeq) &&
        (!isSequence(data.seq) || ackLineageSeq <= data.seq)))
  ) {
    const code = parseBoundedString(data.code, MAX_ERROR_CODE_LENGTH)
    const message = parseBoundedString(data.message, MAX_ERROR_MESSAGE_LENGTH)
    return {
      type: frame.type,
      data: {
        workflowId: data.workflow_id,
        ok: data.ok,
        ...(isSequence(data.seq) && { seq: data.seq }),
        ...(data.ok &&
          isSequence(ackLineageSeq) && { lineageSeq: ackLineageSeq }),
        ...(code !== undefined && { code }),
        ...(message !== undefined && { message })
      }
    }
  }

  if (frame.type === 'doc_ops_result' && typeof data.ok === 'boolean') {
    const applied = parseOptionalStringArray(data.applied)
    const skipped = parseOptionalStringArray(data.skipped)
    if (applied === null || skipped === null) return null
    const code = parseBoundedString(data.code, MAX_ERROR_CODE_LENGTH)
    const message = parseBoundedString(data.message, MAX_ERROR_MESSAGE_LENGTH)
    let failed: DocOpFailure | undefined
    if (!isAbsent(data.failed)) {
      const parsedFailure = parseDocOpFailure(data.failed)
      if (parsedFailure !== null) failed = parsedFailure
    }
    return {
      type: frame.type,
      data: {
        workflowId: data.workflow_id,
        ok: data.ok,
        applied,
        skipped,
        ...(isSequence(data.seq) && { seq: data.seq }),
        ...(code !== undefined && { code }),
        ...(message !== undefined && { message }),
        ...(failed !== undefined && { failed })
      }
    }
  }

  if (
    frame.type === 'doc_reset' &&
    isSequence(data.seq) &&
    isSequence(data.lineage_seq) &&
    data.lineage_seq === data.seq
  ) {
    const actor = parseAdvisoryActor(data.actor)
    return {
      type: frame.type,
      data: {
        workflowId: data.workflow_id,
        seq: data.seq,
        lineageSeq: data.lineage_seq,
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
    const reportedTypes = new Set<string>()
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
        if (reportedTypes.has(type)) return
        reportedTypes.add(type)
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
  subscribe(
    workflowId: string,
    stateVector: Uint8Array,
    knownLineageSeq: number
  ): boolean {
    return this.send('doc_subscribe', {
      v: DOC_PROTOCOL_VERSION,
      workflow_id: workflowId,
      state_vector_b64: encodeBase64(stateVector),
      known_lineage_seq: knownLineageSeq
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
