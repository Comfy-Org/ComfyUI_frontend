import type { Op } from '@comfyorg/comfy-multi-player'

const DOC_PROTOCOL_VERSION = 1
const MAX_AWARENESS_STATE_BYTES = 8 * 1024

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
  failed?: unknown
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
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  )
}

function parseAwarenessState(
  value: unknown
): Record<string, unknown> | undefined | null {
  if (value === undefined) return undefined
  const state = parseRecord(value)
  if (state === null) return null

  try {
    return new TextEncoder().encode(JSON.stringify(state)).byteLength <=
      MAX_AWARENESS_STATE_BYTES
      ? state
      : null
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
        ...(typeof data.actor === 'string' && { actor: data.actor }),
        ...(Array.isArray(data.op_ids) && {
          opIds: data.op_ids.filter(
            (item): item is string => typeof item === 'string'
          )
        })
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
        ...(typeof data.message === 'string' && { message: data.message }),
        // PoC diagnostics: surface the failure verbatim (object, not array).
        ...(data.failed != null && { failed: data.failed })
      }
    }
  }

  if (frame.type === 'doc_reset' && typeof data.seq === 'number') {
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
    const state = parseAwarenessState(data.state)
    if (
      state === null ||
      (data.expires_at !== undefined && !isNonNegativeInteger(data.expires_at))
    )
      return null

    return {
      type: frame.type,
      data: {
        workflowId: data.workflow_id,
        actor: data.actor,
        ...(state !== undefined && { state }),
        ...(data.expires_at !== undefined && {
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
