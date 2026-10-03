/**
 * The transport boundary of the human write leg (plan 3.3): mints wire
 * identity onto semantic {@link GraphOperation}s and chunks batches to the
 * wire caps clients respect (contract layer, verified against comfy-cli's
 * vocabulary): 256 ops and 4 MiB per batch, under the package's own library
 * budgets. `clear` is catastrophic-by-nature and never rides inside a batch
 * (plan D4): it always ships as a batch of exactly one.
 */
import { BATCHABLE_OPS } from '@comfyorg/comfy-multi-player'
import type { Actor, Op, Stamp } from '@comfyorg/comfy-multi-player'

import { createUuidv4 } from '@/utils/uuid'

import type { DocOp } from './docFrameClient'
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

/**
 * A minted op as admitted: the semantic `op` callers get back at settlement,
 * the `wire` object the transport sends, and its UTF-8 size. `wire` is the
 * parsed result of the one serialization performed at admission: plain JSON
 * data with no `toJSON` and no cycles, so encoding the frame later yields
 * exactly the measured bytes however the original op's values behave.
 */
export interface SizedOp {
  readonly op: Op
  readonly wire: DocOp
  readonly bytes: number
}

function isDocOp(value: unknown): value is DocOp {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'op_id' in value &&
    typeof value.op_id === 'string' &&
    'actor' in value &&
    typeof value.actor === 'string'
  )
}

/**
 * Serialize an op once to prove it can ride a `doc_ops` frame and learn its
 * wire form and size. Throws `TypeError` for anything `JSON.stringify` cannot
 * turn into a wire object (a cycle in a custom-node value, a `toJSON` that
 * yields a non-object). Callers reject such an op at admission; the original
 * op is never serialized again.
 */
export function measureWireOp(op: Op): SizedOp {
  const json = JSON.stringify(op)
  if (typeof json !== 'string')
    throw new TypeError('Operation did not serialize to JSON')
  const wire: unknown = JSON.parse(json)
  if (!isDocOp(wire))
    throw new TypeError('Operation did not serialize to a wire object')
  return { op, wire, bytes: new TextEncoder().encode(json).length }
}

/**
 * Split measured ops into wire batches: order-preserving, at most
 * {@link WIRE_MAX_OPS_PER_BATCH} ops and {@link WIRE_MAX_BATCH_BYTES} bytes
 * per batch; every non-batchable op (`clear`) is a batch of one. A single op
 * larger than the byte cap still ships alone — the host, not the chunker,
 * owns rejecting it. Pure arithmetic over sizes measured at admission: it
 * cannot throw.
 */
export function chunkWireOps(ops: readonly SizedOp[]): SizedOp[][] {
  const batches: SizedOp[][] = []
  let current: SizedOp[] = []
  let currentBytes = 0

  const flush = (): void => {
    if (current.length > 0) batches.push(current)
    current = []
    currentBytes = 0
  }

  for (const sized of ops) {
    if (!isBatchable(sized.op)) {
      flush()
      batches.push([sized])
      continue
    }
    const overOps = current.length + 1 > WIRE_MAX_OPS_PER_BATCH
    const overBytes =
      current.length > 0 && currentBytes + sized.bytes > WIRE_MAX_BATCH_BYTES
    if (overOps || overBytes) flush()
    current.push(sized)
    currentBytes += sized.bytes
  }
  flush()
  return batches
}
