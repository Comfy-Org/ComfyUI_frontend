/**
 * The transport boundary of the human write leg (plan 3.3): mints wire
 * identity onto semantic {@link GraphOperation}s and chunks batches to the
 * wire caps clients respect (contract layer, verified against comfy-cli's
 * vocabulary): 256 ops and 4 MiB per batch, under the package's own library
 * budgets. `clear` is catastrophic-by-nature and never rides inside a batch
 * (plan D4): it always ships as a batch of exactly one.
 */
import {
  BATCHABLE_OPS,
  DEFERRED_OPS,
  FROZEN_OPS
} from '@comfyorg/comfy-multi-player'
import type { Actor, Op, Stamp } from '@comfyorg/comfy-multi-player'

import { createUuidv4 } from '@/utils/uuid'

import type { GraphOperation } from './graphOperations'

export const WIRE_MAX_OPS_PER_BATCH = 256
export const WIRE_MAX_BATCH_BYTES = 4 * 1024 * 1024

export interface MintContext {
  actor: Actor
  /** Doc version the ops are minted against (`base_version` on every op). */
  baseVersion: number
}

/** uuid4 hex: 32 lowercase `[0-9a-f]` chars (vocabulary §8.2). */
export function mintOpId(): string {
  return createUuidv4().replaceAll('-', '')
}

function withEnvelope<T extends GraphOperation>(
  operation: T,
  { actor, baseVersion }: MintContext
): T & { op_id: string; actor: Actor; base_version: number; stamp: Stamp } {
  return {
    ...operation,
    op_id: mintOpId(),
    actor,
    base_version: baseVersion,
    stamp: [baseVersion, actor]
  }
}

/**
 * Attach wire identity to every operation. `op_id` is minted exactly once
 * here — a retry re-sends the SAME minted ops (the sender never re-mints;
 * changed-payload reuse rejects host-side).
 */
export function mintWireOps(
  operations: GraphOperation[],
  context: MintContext
): Op[] {
  return operations.map((operation) => withEnvelope(operation, context))
}

function isBatchable(op: Op): boolean {
  return (BATCHABLE_OPS as readonly string[]).includes(op.op)
}

function wireSize(op: Op): number {
  return new TextEncoder().encode(JSON.stringify(op)).length
}

/**
 * Split minted ops into wire batches: order-preserving, at most
 * {@link WIRE_MAX_OPS_PER_BATCH} ops and {@link WIRE_MAX_BATCH_BYTES} bytes
 * per batch; every non-batchable op (`clear`) is a batch of one. A single op
 * larger than the byte cap still ships alone — the host, not the chunker,
 * owns rejecting it.
 */
export function chunkWireOps(ops: Op[]): Op[][] {
  const batches: Op[][] = []
  let current: Op[] = []
  let currentBytes = 0

  const flush = (): void => {
    if (current.length > 0) batches.push(current)
    current = []
    currentBytes = 0
  }

  for (const op of ops) {
    if (!isBatchable(op)) {
      flush()
      batches.push([op])
      continue
    }
    const bytes = wireSize(op)
    const overOps = current.length + 1 > WIRE_MAX_OPS_PER_BATCH
    const overBytes =
      current.length > 0 && currentBytes + bytes > WIRE_MAX_BATCH_BYTES
    if (overOps || overBytes) flush()
    current.push(op)
    currentBytes += bytes
  }
  flush()
  return batches
}

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
  if (typeof value !== 'object' || value === null) return false
  const { op, op_id } = value as { op?: unknown; op_id?: unknown }
  return (
    typeof op === 'string' &&
    WIRE_OP_KINDS.includes(op) &&
    typeof op_id === 'string' &&
    op_id.length > 0
  )
}

/**
 * The result of validating one client batch: either every member cleared
 * the envelope check, or the whole frame is invalid. Mirrors the cloud
 * relay, which rejects a structurally invalid or duplicate-id frame as
 * `invalid_frame` before it ever reaches `applyOps` — distinct from a frame
 * that clears this gate but carries an unknown or semantically malformed
 * op, which still reaches `applyOps` and gets its own verdict there (e.g.
 * `op_deferred`/`batch_aborted`).
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
