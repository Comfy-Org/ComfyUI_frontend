import { DEFERRED_OPS, FROZEN_OPS } from '@comfyorg/comfy-multi-player'

import { isRecord } from '@e2e/fixtures/utils/isRecord'

const WIRE_OP_KINDS: readonly string[] = [...FROZEN_OPS, ...DEFERRED_OPS]

/**
 * The minimal fields this parser actually checks on a client-declared op:
 * `op` one of `WIRE_OP_KINDS` (frozen or deferred) and a non-empty `op_id`.
 * Deliberately not the package's `WireOp`: this type claims nothing about
 * `actor`, `base_version`, `stamp`, or a kind's payload — `applyOps`'s own
 * `validateEnvelope` remains the judge of all of that, including a deferred
 * kind such as `reset_doc` (rejected there with `op_deferred`).
 */
export interface WireOpEnvelope {
  op: string
  op_id: string
}

function isWireEnvelopeShaped(value: unknown): value is WireOpEnvelope {
  if (!isRecord(value)) return false
  const { op, op_id } = value
  return (
    typeof op === 'string' &&
    WIRE_OP_KINDS.includes(op) &&
    typeof op_id === 'string' &&
    op_id.length > 0
  )
}

/**
 * The result of validating one client batch's envelope shape: either every
 * member cleared the check, or the whole frame is invalid. This gate is
 * frame-blind — it doesn't know whether the caller is a `doc_subscribe`
 * (whose absent `ops` is a valid empty batch) or a `doc_ops` frame, whose
 * stricter non-empty/unique-id contract {@link isValidDocOpsBatch} enforces
 * separately.
 */
export type ParsedWireBatch =
  | { ok: true; ops: WireOpEnvelope[] }
  | { ok: false; reason: 'invalid_frame' }

/**
 * Validates an untyped JSON value as one client batch. A missing value (a
 * frame that carries no `ops` at all, such as `doc_subscribe`) is a valid
 * empty batch. Otherwise every member must be wire-shaped or the whole
 * frame is rejected as `invalid_frame` — a batch is never filtered
 * member-by-member, so a malformed or deferred entry (e.g. `reset_doc`)
 * either travels with its batch in place, to reach `applyOps` and produce
 * its real abort-remainder verdict, or the whole frame is rejected before
 * `applyOps` ever sees it.
 */
export function parseWireOps(value: unknown): ParsedWireBatch {
  if (value === undefined) return { ok: true, ops: [] }
  if (!Array.isArray(value)) return { ok: false, reason: 'invalid_frame' }
  return value.every(isWireEnvelopeShaped)
    ? { ok: true, ops: value }
    : { ok: false, reason: 'invalid_frame' }
}

/**
 * The cloud relay's stricter contract for a `doc_ops` frame specifically —
 * unlike `doc_subscribe`, which may omit `ops` entirely, a `doc_ops` batch
 * must be non-empty and every `op_id` must be unique within it. The relay
 * checks this before the batch ever reaches the host's applier, so a batch
 * failing this gate never mutates anything: the whole frame is rejected as
 * `invalid_frame`, the same as a structurally invalid one.
 */
export function isValidDocOpsBatch(ops: WireOpEnvelope[]): boolean {
  if (ops.length === 0) return false
  const seen = new Set(ops.map((op) => op.op_id))
  return seen.size === ops.length
}
