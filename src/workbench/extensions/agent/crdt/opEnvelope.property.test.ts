/**
 * Property coverage for the human write leg's transport boundary.
 *
 * `opEnvelope.test.ts` pins the chunker with hand-sized fixtures — 600 ops
 * splits `[256, 256, 88]`, a half-cap payload splits three ways. Those examples
 * fix the caps at points chosen to hit them; they say nothing about arbitrary
 * mixes of kinds and sizes, which is exactly where a chunker goes wrong:
 * dropping the tail, reordering across a `clear` flush, or splitting one op
 * early and silently halving throughput.
 *
 * Four properties hold for every generated input:
 *
 *   TOTALITY   — `chunkWireOps(ops).flat()` is `ops`: same ops, same order,
 *                nothing dropped, nothing duplicated. This is the one that
 *                matters, because a dropped op is a silently lost human edit.
 *   CAPS       — no batch exceeds the op cap or (above one op) the byte cap.
 *   ISOLATION  — `clear` is catastrophic-by-nature and always ships alone.
 *   MAXIMALITY — a batch is only ended early when a cap forces it. Without this
 *                a chunker that emits one op per batch passes all three above.
 *
 * It also checks the envelope itself (`mintWireOps`) without coupling this
 * transport suite to the applier or the retired store-first projection path.
 */
import { BATCHABLE_OPS } from '@comfyorg/comfy-multi-player'
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import type { GraphOperation } from './graphOperations'
import {
  WIRE_MAX_BATCH_BYTES,
  WIRE_MAX_OPS_PER_BATCH,
  chunkWireOps,
  mintOpId,
  mintWireOps
} from './opEnvelope'

const FC_OPTIONS = { numRuns: 100 } as const

const MINT = { actor: 'human:pbt-user:tab-1', baseVersion: 7 }
const utf8 = new TextEncoder()

function addNode(id: number): GraphOperation {
  return {
    op: 'add_node',
    node_id: id,
    class_type: 'TestNode',
    pos: [id, id],
    node: {
      id,
      type: 'TestNode',
      pos: [id, id],
      inputs: [],
      outputs: [],
      widgets_values: []
    }
  }
}

function setWidget(id: number, value: unknown): GraphOperation {
  return { op: 'set_widget', node_id: id, widget: 'text', value }
}

function deleteNode(id: number): GraphOperation {
  return { op: 'delete_node', node_id: id, removed_links: [] }
}

function clear(ids: number[]): GraphOperation {
  return { op: 'clear', removed_nodes: ids }
}

function serializedBatchBytes(batch: unknown[]): number {
  return utf8.encode(JSON.stringify(batch)).length
}

/**
 * Small operations spanning the common write kinds. Separate fixtures below
 * exercise the operation and byte caps without putting multi-megabyte strings
 * through the shrinker.
 */
const operationArb: fc.Arbitrary<GraphOperation> = fc.oneof(
  { arbitrary: fc.integer({ min: 0, max: 40 }).map(addNode), weight: 4 },
  {
    arbitrary: fc
      .tuple(fc.integer({ min: 0, max: 40 }), fc.string({ maxLength: 32 }))
      .map(([id, value]) => setWidget(id, value)),
    weight: 4
  },
  { arbitrary: fc.integer({ min: 0, max: 40 }).map(deleteNode), weight: 2 },
  {
    arbitrary: fc
      .array(fc.integer({ min: 0, max: 40 }), { maxLength: 4 })
      .map(clear),
    weight: 1
  }
)

const operationsArb = fc.array(operationArb, { maxLength: 40 })

describe('chunkWireOps (property)', () => {
  it('is total and order-preserving: flattening the batches returns the input', () => {
    fc.assert(
      fc.property(operationsArb, (operations) => {
        const ops = mintWireOps(operations, MINT)

        const flattened = chunkWireOps(ops).flat()

        expect(flattened).toHaveLength(ops.length)
        // Reference identity, not structural equality: a chunker that rebuilt
        // ops (and could therefore re-mint an op_id) must not pass.
        for (const [index, op] of flattened.entries()) {
          expect(op).toBe(ops[index])
        }
      }),
      FC_OPTIONS
    )
    const overCap = mintWireOps(
      Array.from({ length: WIRE_MAX_OPS_PER_BATCH + 1 }, (_, i) => addNode(i)),
      MINT
    )
    expect(chunkWireOps(overCap).map((batch) => batch.length)).toEqual([
      WIRE_MAX_OPS_PER_BATCH,
      1
    ])
  })

  it('never emits an empty batch and never exceeds the op cap', () => {
    fc.assert(
      fc.property(operationsArb, (operations) => {
        for (const batch of chunkWireOps(mintWireOps(operations, MINT))) {
          expect(batch.length).toBeGreaterThan(0)
          expect(batch.length).toBeLessThanOrEqual(WIRE_MAX_OPS_PER_BATCH)
        }
      }),
      FC_OPTIONS
    )
  })

  it('isolates every non-batchable op in a batch of exactly one', () => {
    fc.assert(
      fc.property(operationsArb, (operations) => {
        for (const batch of chunkWireOps(mintWireOps(operations, MINT))) {
          if (
            batch.some((op) => !BATCHABLE_OPS.some((kind) => kind === op.op))
          ) {
            expect(batch).toHaveLength(1)
          }
        }
      }),
      FC_OPTIONS
    )

    expect(chunkWireOps(mintWireOps([clear([])], MINT))).toHaveLength(1)
  })

  it('keeps multi-op batches under the byte cap, and ships an oversize op alone', () => {
    fc.assert(
      fc.property(operationsArb, (operations) => {
        for (const batch of chunkWireOps(mintWireOps(operations, MINT))) {
          const bytes = serializedBatchBytes(batch)
          if (batch.length > 1) {
            expect(bytes).toBeLessThanOrEqual(WIRE_MAX_BATCH_BYTES)
          }
        }
      }),
      FC_OPTIONS
    )

    const oversize = mintWireOps(
      [setWidget(1, 'x'.repeat(WIRE_MAX_BATCH_BYTES + 16))],
      MINT
    )
    expect(chunkWireOps(oversize)).toEqual([oversize])
    const third = Math.floor(WIRE_MAX_BATCH_BYTES / 3) - 1024
    const thirds = mintWireOps(
      [1, 2, 3, 4].map((id) => setWidget(id, 'x'.repeat(third))),
      MINT
    )
    expect(chunkWireOps(thirds).map((batch) => batch.length)).toEqual([3, 1])

    const multibyte = mintWireOps(
      [1, 2, 3, 4].map((id) => setWidget(id, 'é'.repeat(third))),
      MINT
    )
    expect(chunkWireOps(multibyte).map((batch) => batch.length)).toEqual([
      1, 1, 1, 1
    ])
  })

  it('is maximal: a batch only ends early when a cap or a clear forces it', () => {
    fc.assert(
      fc.property(operationsArb, (operations) => {
        const ops = mintWireOps(operations, MINT)
        const batches = chunkWireOps(ops)

        for (let i = 0; i < batches.length - 1; i++) {
          const batch = batches[i]
          const next = batches[i + 1]
          const head = next[0]
          // A clear on either side legitimately forces the boundary.
          if (
            batch.some((op) => !BATCHABLE_OPS.some((kind) => kind === op.op)) ||
            !BATCHABLE_OPS.some((kind) => kind === head.op)
          ) {
            continue
          }
          const overOps = batch.length + 1 > WIRE_MAX_OPS_PER_BATCH
          const overBytes =
            serializedBatchBytes([...batch, head]) > WIRE_MAX_BATCH_BYTES
          expect(overOps || overBytes).toBe(true)
        }
      }),
      FC_OPTIONS
    )
  })
})

describe('mintWireOps (property)', () => {
  it('mints a unique 32-hex op_id per op and never reuses one across batches', () => {
    fc.assert(
      fc.property(operationsArb, operationsArb, (first, second) => {
        const ids = [
          ...mintWireOps(first, MINT),
          ...mintWireOps(second, MINT)
        ].map((op) => op.op_id)

        for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/)
        expect(new Set(ids).size).toBe(ids.length)
      }),
      FC_OPTIONS
    )
  })

  it('attaches the envelope and leaves the semantic payload byte-identical', () => {
    fc.assert(
      fc.property(
        operationsArb,
        fc.string({ minLength: 1, maxLength: 24 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        (operations, actor, baseVersion) => {
          const context = { actor, baseVersion }
          const minted = mintWireOps(operations, context)

          expect(minted).toHaveLength(operations.length)
          for (const [index, op] of minted.entries()) {
            const original = operations[index]
            expect(op.actor).toBe(actor)
            expect(op.base_version).toBe(baseVersion)
            expect(op.stamp).toEqual([baseVersion, actor])
            expect(op).toEqual({
              ...original,
              op_id: expect.stringMatching(/^[0-9a-f]{32}$/),
              actor,
              base_version: baseVersion,
              stamp: [baseVersion, actor]
            })
          }
        }
      ),
      FC_OPTIONS
    )
  })

  it('mints ids that are unique across many direct mintOpId calls', () => {
    const ids = Array.from({ length: 512 }, () => mintOpId())
    expect(new Set(ids).size).toBe(512)
  })
})
