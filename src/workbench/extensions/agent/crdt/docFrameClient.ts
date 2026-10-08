import type { Op } from '@comfyorg/comfy-multi-player'
import type { DocResetData } from '@comfyorg/ingest-types'

import { reportError } from '@/platform/telemetry/reportError'

export const DOC_PROTOCOL_VERSION = 1
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
  update: Uint8Array
  actor?: string
  /** Accepted semantic op identities folded into this effect frame (DQ-9). */
  opIds?: string[]
}

export interface DocSubscribed {
  workflowId: string
  ok: boolean
  seq?: number
  expectedSeq?: number
  code?: string
  message?: string
}

export interface DocOpFailure {
  index: number
  /** Absent when the relay cannot map the failing index to an op id. */
  op_id?: string
  code: string
  message: string
}

export interface DocOpsResult {
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

export interface DocReseedResult {
  workflowId: string
  ok: boolean
  seq?: number
  outcome?: string
  code?: string
  message?: string
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
  | { type: 'doc_reseed_result'; data: DocReseedResult }
  | { type: 'awareness'; data: DocAwareness }

/** A frame as it travels the wire, before {@link parseServerDocFrame} reads it. */
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
  expected_seq?: unknown
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
  outcome?: unknown
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

function parseSequence(value: unknown): number | null {
  if (isSequence(value)) return value
  if (
    typeof value === 'bigint' &&
    value >= 0n &&
    value <= BigInt(Number.MAX_SAFE_INTEGER)
  )
    return Number(value)
  return null
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

function parseDocReseedResult(
  workflowId: string,
  ok: boolean,
  data: WireData
): DocReseedResult {
  const outcome = parseBoundedString(data.outcome, MAX_ERROR_CODE_LENGTH)
  const code = parseBoundedString(data.code, MAX_ERROR_CODE_LENGTH)
  const message = parseBoundedString(data.message, MAX_ERROR_MESSAGE_LENGTH)
  return {
    workflowId,
    ok,
    ...(isSequence(data.seq) && { seq: data.seq }),
    ...(outcome !== undefined && { outcome }),
    ...(code !== undefined && { code }),
    ...(message !== undefined && { message })
  }
}

function parseDocSubscribed(
  workflowId: string,
  ok: boolean,
  data: WireData
): DocSubscribed {
  const code = parseBoundedString(data.code, MAX_ERROR_CODE_LENGTH)
  const message = parseBoundedString(data.message, MAX_ERROR_MESSAGE_LENGTH)
  return {
    workflowId,
    ok,
    ...(isSequence(data.seq) && { seq: data.seq }),
    ...(isSequence(data.expected_seq) && { expectedSeq: data.expected_seq }),
    ...(code !== undefined && { code }),
    ...(message !== undefined && { message })
  }
}

type ServerFrameParsers = {
  [K in ServerDocFrame['type']]: (
    workflowId: string,
    data: WireData
  ) => Extract<ServerDocFrame, { type: K }> | null
}

function parseResultMetadata(data: WireData) {
  const code = parseBoundedString(data.code, MAX_ERROR_CODE_LENGTH)
  const message = parseBoundedString(data.message, MAX_ERROR_MESSAGE_LENGTH)
  const seq = parseSequence(data.seq)
  return {
    ...(seq !== null && { seq }),
    ...(code !== undefined && { code }),
    ...(message !== undefined && { message })
  }
}

function fitsAwarenessBudget(state: Record<string, unknown>): boolean {
  const stateSize = encodedJsonSize(state)
  return stateSize !== null && stateSize <= MAX_AWARENESS_STATE_BYTES
}

type AwarenessStateResult =
  | { kind: 'present'; state: Record<string, unknown> }
  | { kind: 'absent' }
  | { kind: 'invalid' }

function parseAwarenessState(value: unknown): AwarenessStateResult {
  if (isAbsent(value)) return { kind: 'absent' }
  const state = parseRecord(value)
  if (state === null || !fitsAwarenessBudget(state)) return { kind: 'invalid' }
  return { kind: 'present', state }
}

const serverFrameParsers: ServerFrameParsers = {
  doc_update: (workflowId, data) => {
    const seq = parseSequence(data.seq)
    if (seq === null || typeof data.update_b64 !== 'string') return null
    const update = decodeBase64(data.update_b64)
    if (update === null) return null
    if (!isAbsent(data.op_ids) && !isStringArray(data.op_ids)) return null
    const actor = parseAdvisoryActor(data.actor)
    return {
      type: 'doc_update',
      data: {
        workflowId,
        seq,
        update,
        ...(actor !== undefined && { actor }),
        ...(isStringArray(data.op_ids) && { opIds: data.op_ids })
      }
    }
  },
  doc_subscribed: (workflowId, data) =>
    typeof data.ok === 'boolean'
      ? {
          type: 'doc_subscribed',
          data: parseDocSubscribed(workflowId, data.ok, data)
        }
      : null,
  doc_ops_result: (workflowId, data) => {
    if (typeof data.ok !== 'boolean') return null
    const applied = parseOptionalStringArray(data.applied)
    const skipped = parseOptionalStringArray(data.skipped)
    if (applied === null || skipped === null) return null
    const failed = parseDocOpFailure(data.failed) ?? undefined
    return {
      type: 'doc_ops_result',
      data: {
        workflowId,
        ok: data.ok,
        applied,
        skipped,
        ...parseResultMetadata(data),
        ...(failed !== undefined && { failed })
      }
    }
  },
  doc_reset: (workflowId, data) => {
    const reset: Partial<Record<keyof DocResetData, unknown>> = data
    const seq = parseSequence(reset.seq)
    const lineageSeq = parseSequence(reset.lineage_seq)
    if (seq === null || lineageSeq === null) return null
    const actor = parseAdvisoryActor(reset.actor)
    return {
      type: 'doc_reset',
      data: {
        workflowId,
        seq,
        lineageSeq,
        ...(actor !== undefined && { actor })
      }
    }
  },
  doc_reseed_result: (workflowId, data) =>
    typeof data.ok === 'boolean'
      ? {
          type: 'doc_reseed_result',
          data: parseDocReseedResult(workflowId, data.ok, data)
        }
      : null,
  awareness: (workflowId, data) => {
    if (typeof data.actor !== 'string' || !isValidActor(data.actor)) return null
    const parsed = parseAwarenessState(data.state)
    if (parsed.kind === 'invalid') return null
    if (!isAbsent(data.expires_at) && !isSequence(data.expires_at)) return null
    return {
      type: 'awareness',
      data: {
        workflowId,
        actor: data.actor,
        ...(parsed.kind === 'present' && { state: parsed.state }),
        ...(isSequence(data.expires_at) && { expiresAt: data.expires_at })
      }
    }
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

  if (typeof frame.type !== 'string' || !isServerFrameType(frame.type))
    return null
  return serverFrameParsers[frame.type](data.workflow_id, data)
}

function isServerFrameType(type: string): type is ServerDocFrame['type'] {
  return Object.hasOwn(serverFrameParsers, type)
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
      'doc_reseed_result',
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
          surface: 'agent',
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
      state_vector_b64: encodeBase64(stateVector),
      supports_reseed: true
    })
  }

  reseed(
    workflowId: string,
    expectedSeq: number,
    workflow: Record<string, unknown>
  ): boolean {
    return this.send('doc_reseed', {
      v: DOC_PROTOCOL_VERSION,
      workflow_id: workflowId,
      expected_seq: expectedSeq,
      workflow
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
