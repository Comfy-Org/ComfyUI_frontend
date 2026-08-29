/**
 * Property tests for the mint half of the human write leg: the envelope
 * `opEnvelope.ts` attaches, and the chunker that splits minted ops into wire
 * batches.
 *
 * The invariants under test are the ones a reviewer cannot check by reading a
 * handful of examples: conservation (nothing the caller enqueued may vanish or
 * duplicate on the way to the wire), envelope totality (every op carries a
 * complete, well-formed identity), and the batch caps holding for arbitrary
 * op mixes rather than the two shapes the example tests happen to use.
 */
import { BATCHABLE_OPS } from '@comfyorg/comfy-multi-player'
import type { Op } from '@comfyorg/comfy-multi-player'
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

const ENVELOPE_KEYS = ['op_id', 'actor', 'base_version', 'stamp'] as const

const arbActor = fc
  .stringMatching(/^[a-z0-9]{1,8}$/)
  .map((user) => `human:${user}:tab-1`)

const arbWidgetValue = fc.oneof(
  fc.integer(),
  fc.stringMatching(/^[A-Za-z0-9 _-]{0,20}$/),
  fc.boolean(),
  fc.constant(null)
)

const arbNodeId = fc.oneof(
  fc.integer({ min: 1, max: 9999 }),
  fc.stringMatching(/^[0-9]{1,4}$/)
)

const arbSetWidget: fc.Arbitrary<GraphOperation> = fc.record({
  op: fc.constant('set_widget' as const),
  node_id: arbNodeId,
  widget: fc.stringMatching(/^[a-z_]{1,12}$/),
  value: arbWidgetValue,
  old: arbWidgetValue
})

const arbAddNode: fc.Arbitrary<GraphOperation> = fc
  .record({
    node_id: arbNodeId,
    class_type: fc.stringMatching(/^[A-Za-z]{1,12}$/),
    x: fc.integer({ min: -5000, max: 5000 }),
    y: fc.integer({ min: -5000, max: 5000 })
  })
  .map(({ node_id, class_type, x, y }) => ({
    op: 'add_node' as const,
    node_id,
    class_type,
    pos: [x, y] as [number, number],
    node: { id: node_id, type: class_type, pos: [x, y] as [number, number] }
  }))

const arbConnect: fc.Arbitrary<GraphOperation> = fc.record({
  op: fc.constant('connect' as const),
  link_id: fc.integer({ min: 1, max: 9999 }),
  from_node: arbNodeId,
  from_slot: fc.integer({ min: 0, max: 8 }),
  to_node: arbNodeId,
  to_slot: fc.integer({ min: 0, max: 8 }),
  link_type: fc.constantFrom('IMAGE', 'LATENT', 'MODEL', '*')
})

const arbDeleteNode: fc.Arbitrary<GraphOperation> = fc.record({
  op: fc.constant('delete_node' as const),
  node_id: arbNodeId,
  removed_links: fc.array(fc.integer({ min: 1, max: 9999 }), { maxLength: 4 })
})

/** `clear` is the only non-batchable kind the FE mints (opEnvelope.ts:80-84). */
const arbClear: fc.Arbitrary<GraphOperation> = fc.record({
  op: fc.constant('clear' as const),
  removed_nodes: fc.array(arbNodeId, { maxLength: 6 })
})

const arbOperation = fc.oneof(
  { weight: 4, arbitrary: arbSetWidget },
  { weight: 3, arbitrary: arbAddNode },
  { weight: 2, arbitrary: arbConnect },
  { weight: 2, arbitrary: arbDeleteNode },
  { weight: 1, arbitrary: arbClear }
)

const arbOperations = fc.array(arbOperation, { maxLength: 40 })

const arbContext = fc.record({
  actor: arbActor,
  baseVersion: fc.nat({ max: 1_000_000 })
})

function isBatchable(op: Op): boolean {
  return (BATCHABLE_OPS as readonly string[]).includes(op.op)
}

function stripEnvelope(op: Op): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...op }
  for (const key of ENVELOPE_KEYS) delete rest[key]
  return rest
}

describe('opEnvelope mint properties', () => {
  it('mints a complete, well-formed envelope onto every operation', () => {
    fc.assert(
      fc.property(arbOperations, arbContext, (operations, context) => {
        const minted = mintWireOps(operations, context)

        expect(minted).toHaveLength(operations.length)
        for (const op of minted) {
          // uuid4 hex, vocabulary §8.2.
          expect(op.op_id).toMatch(/^[0-9a-f]{32}$/)
          expect(op.actor).toBe(context.actor)
          expect(op.base_version).toBe(context.baseVersion)
          expect(op.stamp).toEqual([context.baseVersion, context.actor])
        }
      })
    )
  })

  it('carries the semantic payload through byte-for-byte', () => {
    fc.assert(
      fc.property(arbOperations, arbContext, (operations, context) => {
        const minted = mintWireOps(operations, context)

        // The envelope is additive: strip it and the semantic op the port
        // enqueued must come back unchanged. A mint that rewrote a payload
        // would be a write the user never asked for.
        expect(minted.map(stripEnvelope)).toEqual(operations)
      })
    )
  })

  it('never mutates the operations the mint port enqueued', () => {
    fc.assert(
      fc.property(arbOperations, arbContext, (operations, context) => {
        const before = structuredClone(operations)
        mintWireOps(operations, context)

        expect(operations).toEqual(before)
      })
    )
  })

  it('mints a distinct op_id for every operation in a batch', () => {
    fc.assert(
      fc.property(arbOperations, arbContext, (operations, context) => {
        const ids = mintWireOps(operations, context).map((op) => op.op_id)

        // Op identity is the applier's idempotency key: two ops sharing an
        // op_id means the second is skipped and its write is lost.
        expect(new Set(ids).size).toBe(ids.length)
      })
    )
  })

  it('mints distinct op_ids across independent mint calls', () => {
    fc.assert(
      fc.property(
        arbOperations,
        arbOperations,
        arbContext,
        (first, second, context) => {
          const ids = [
            ...mintWireOps(first, context),
            ...mintWireOps(second, context)
          ].map((op) => op.op_id)

          expect(new Set(ids).size).toBe(ids.length)
        }
      )
    )
  })

  it('mints op_ids that are unique across many standalone calls', () => {
    const ids = Array.from({ length: 2000 }, () => mintOpId())

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('stamps non-decreasing base_versions from a non-decreasing source', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(arbOperations, fc.nat({ max: 5000 })), {
          minLength: 1,
          maxLength: 20
        }),
        arbActor,
        (rounds, actor) => {
          // The composition root's contract: `baseVersion()` is the follower's
          // last observed doc sequence, which only ever advances within one
          // document lineage. Given that, minted stamps never regress — the
          // mint seam itself introduces no reordering.
          let baseVersion = 0
          const stamped: number[] = []
          for (const [operations, delta] of rounds) {
            baseVersion += delta
            for (const op of mintWireOps(operations, { actor, baseVersion })) {
              stamped.push(op.base_version)
            }
          }

          for (let index = 1; index < stamped.length; index++) {
            expect(stamped[index]).toBeGreaterThanOrEqual(stamped[index - 1])
          }
        }
      )
    )
  })
})

describe('chunkWireOps properties', () => {
  it('conserves every op exactly once, in order', () => {
    fc.assert(
      fc.property(arbOperations, arbContext, (operations, context) => {
        const minted = mintWireOps(operations, context)
        const batches = chunkWireOps(minted)

        // No silent drop and no duplication at the chunk seam: flattening the
        // batches must reproduce the minted sequence identically.
        expect(batches.flat()).toEqual(minted)
      })
    )
  })

  it('never emits an empty batch', () => {
    fc.assert(
      fc.property(arbOperations, arbContext, (operations, context) => {
        const batches = chunkWireOps(mintWireOps(operations, context))

        for (const batch of batches) expect(batch.length).toBeGreaterThan(0)
      })
    )
  })

  it('holds the per-batch op cap', () => {
    fc.assert(
      fc.property(
        fc.array(arbOperation, { minLength: 1, maxLength: 600 }),
        arbContext,
        (operations, context) => {
          const batches = chunkWireOps(mintWireOps(operations, context))

          for (const batch of batches) {
            expect(batch.length).toBeLessThanOrEqual(WIRE_MAX_OPS_PER_BATCH)
          }
        }
      )
    )
  })

  it('holds the per-batch byte cap for every multi-op batch', () => {
    fc.assert(
      fc.property(arbOperations, arbContext, (operations, context) => {
        const batches = chunkWireOps(mintWireOps(operations, context))

        for (const batch of batches) {
          if (batch.length < 2) continue
          const bytes = batch.reduce(
            (total, op) =>
              total + new TextEncoder().encode(JSON.stringify(op)).length,
            0
          )
          expect(bytes).toBeLessThanOrEqual(WIRE_MAX_BATCH_BYTES)
        }
      })
    )
  })

  it('ships every non-batchable op alone (plan D4)', () => {
    fc.assert(
      fc.property(arbOperations, arbContext, (operations, context) => {
        const batches = chunkWireOps(mintWireOps(operations, context))

        for (const batch of batches) {
          const nonBatchable = batch.filter((op) => !isBatchable(op))
          if (nonBatchable.length === 0) continue
          // `clear` is catastrophic-by-nature: it never rides with anything.
          expect(batch).toHaveLength(1)
        }
      })
    )
  })

  it('is greedy: consecutive batchable ops never split without a reason', () => {
    fc.assert(
      fc.property(
        fc.array(arbSetWidget, { minLength: 1, maxLength: 200 }),
        arbContext,
        (operations, context) => {
          const batches = chunkWireOps(mintWireOps(operations, context))

          // Small batchable ops only, well under both caps: one batch. A
          // chunker that split here would serialize the sender needlessly and
          // multiply round-trips per user edit.
          expect(batches).toHaveLength(1)
        }
      )
    )
  })
})
