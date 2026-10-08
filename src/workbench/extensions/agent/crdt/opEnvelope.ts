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

/**
 * The sequencing envelope: the fields the chunker classifies by (`op`), the
 * sender settles by (`op_id`), and the applier orders by (`base_version`,
 * `stamp`, `actor`). The wire must carry exactly the values minted onto the
 * semantic op.
 */
interface Envelope {
  readonly op: string
  readonly op_id: string
  readonly actor: Actor
  readonly base_version: number
  readonly stamp: Stamp
}

type WireOp = DocOp & Envelope

const WIRE_SCALAR_FIELDS = {
  op: 'string',
  op_id: 'string',
  actor: 'string',
  base_version: 'number'
} as const

function isStamp(value: unknown): value is Stamp {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isWireOp(value: unknown): value is WireOp {
  if (!isRecord(value)) return false
  const scalarsTyped = Object.entries(WIRE_SCALAR_FIELDS).every(
    ([field, type]) => typeof value[field] === type
  )
  return scalarsTyped && isStamp(value.stamp)
}

function envelopeOf({
  op,
  op_id,
  actor,
  base_version,
  stamp
}: Envelope): Envelope {
  return { op, op_id, actor, base_version, stamp: [stamp[0], stamp[1]] }
}

function sameEnvelope(a: Envelope, b: Envelope): boolean {
  return (
    a.op === b.op &&
    a.op_id === b.op_id &&
    a.actor === b.actor &&
    a.base_version === b.base_version &&
    a.stamp[0] === b.stamp[0] &&
    a.stamp[1] === b.stamp[1]
  )
}

export type WireMeasurement =
  | { readonly admitted: true; readonly sized: SizedOp }
  | { readonly admitted: false; readonly op: Op; readonly cause: unknown }

function stringifyOp(op: Op): { json: string } | { cause: unknown } {
  try {
    const json: unknown = JSON.stringify(op)
    return typeof json === 'string'
      ? { json }
      : { cause: new TypeError('Operation did not serialize to JSON') }
  } catch (cause) {
    return { cause }
  }
}

function rejected(op: Op, message: string): WireMeasurement {
  return { admitted: false, op, cause: new TypeError(message) }
}

/**
 * Serialize an op once to prove it can ride a `doc_ops` frame and learn its
 * wire form and size. Never throws: anything `JSON.stringify` cannot turn
 * into a wire object (a cycle in a custom-node value, a `toJSON` that throws
 * or yields a non-object) comes back as a rejection carrying the cause, and
 * so does any serializer that leaves the wire's {@link Envelope} different
 * from the one minted before serialization, or rewrites the semantic op's
 * own envelope while running. The envelope is captured before `toJSON` runs
 * and compared against both results afterwards, so a stateful serializer
 * cannot settle one sequence position while transmitting another. Callers
 * settle a rejected op at admission; the original op is never serialized
 * again.
 */
export function measureWireOp(op: Op): WireMeasurement {
  const minted = envelopeOf(op)
  const serialized = stringifyOp(op)
  if ('cause' in serialized)
    return { admitted: false, op, cause: serialized.cause }
  const wire: unknown = JSON.parse(serialized.json)
  if (!isWireOp(wire))
    return rejected(op, 'Operation did not serialize to a wire object')
  if (!sameEnvelope(wire, minted))
    return rejected(op, 'Operation serialized with a different envelope')
  if (!sameEnvelope(op, minted))
    return rejected(op, 'Operation changed its envelope while serializing')
  return {
    admitted: true,
    sized: { op, wire, bytes: new TextEncoder().encode(serialized.json).length }
  }
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
