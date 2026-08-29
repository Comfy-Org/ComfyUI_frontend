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
 * Four properties hold for EVERY input:
 *
 *   TOTALITY   — `chunkWireOps(ops).flat()` is `ops`: same ops, same order,
 *                nothing dropped, nothing duplicated. This is the one that
 *                matters, because a dropped op is a silently lost human edit.
 *   CAPS       — no batch exceeds the op cap or (above one op) the byte cap.
 *   ISOLATION  — `clear` is catastrophic-by-nature and always ships alone.
 *   MAXIMALITY — a batch is only ended early when a cap forces it. Without this
 *                a chunker that emits one op per batch passes all three above.
 *
 * Plus the envelope itself (`mintWireOps`) and the convergence claim it exists
 * to support: ops minted here resolve last-writer-wins identically no matter
 * what order the host applies them in.
 */
import {
  applyOps,
  compareStampKeys,
  mint,
  nodesMap,
  stampKey,
  SCHEMA_VERSION
} from '@comfyorg/comfy-multi-player'
import type { Op } from '@comfyorg/comfy-multi-player'
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import type { GraphOperation } from './graphOperations'
import {
  WIRE_MAX_BATCH_BYTES,
  WIRE_MAX_OPS_PER_BATCH,
  chunkWireOps,
  mintOpId,
  mintWireOps
} from './opEnvelope'

const FC_OPTIONS = { seed: 0x02b0f00d, numRuns: 100 } as const

const MINT = { actor: 'human:pbt-user:tab-1', baseVersion: 7 }
const CATALOG = { types: { TestNode: { widget_order: ['text'] } } }

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

/**
 * Operations spanning every kind and a payload-size range that straddles the
 * byte cap: tiny, ~1/3 cap (so three fit but four do not), and over-cap alone.
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
  },
  {
    // Large but batchable: three of these fit under the byte cap, four do not.
    arbitrary: fc
      .integer({ min: 0, max: 40 })
      .map((id) =>
        setWidget(id, 'x'.repeat(Math.ceil(WIRE_MAX_BATCH_BYTES / 3)))
      ),
    weight: 1
  },
  {
    // Single-op oversize: must ship alone rather than be dropped.
    arbitrary: fc
      .integer({ min: 0, max: 40 })
      .map((id) => setWidget(id, 'x'.repeat(WIRE_MAX_BATCH_BYTES + 16))),
    weight: 1
  }
)

const operationsArb = fc.array(operationArb, { maxLength: 40 })

function wireBytes(op: Op): number {
  return new TextEncoder().encode(JSON.stringify(op)).length
}

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
    let isolated = 0

    fc.assert(
      fc.property(operationsArb, (operations) => {
        for (const batch of chunkWireOps(mintWireOps(operations, MINT))) {
          if (batch.some((op) => op.op === 'clear')) {
            expect(batch).toHaveLength(1)
            isolated++
          }
        }
      }),
      FC_OPTIONS
    )

    // Vacuity guard: a corpus with no `clear` would assert nothing at all.
    expect(isolated).toBeGreaterThan(0)
  })

  it('keeps multi-op batches under the byte cap, and ships an oversize op alone', () => {
    let multiOp = 0
    let oversizeAlone = 0

    fc.assert(
      fc.property(operationsArb, (operations) => {
        for (const batch of chunkWireOps(mintWireOps(operations, MINT))) {
          const bytes = batch.reduce((sum, op) => sum + wireBytes(op), 0)
          if (batch.length > 1) {
            multiOp++
            expect(bytes).toBeLessThanOrEqual(WIRE_MAX_BATCH_BYTES)
          } else if (bytes > WIRE_MAX_BATCH_BYTES) {
            oversizeAlone++
          }
        }
      }),
      FC_OPTIONS
    )

    // Vacuity guards: both sides of the cap must actually have been reached.
    expect(multiOp).toBeGreaterThan(0)
    expect(oversizeAlone).toBeGreaterThan(0)
  })

  it('is maximal: a batch only ends early when a cap or a clear forces it', () => {
    let boundariesChecked = 0

    fc.assert(
      fc.property(operationsArb, (operations) => {
        const ops = mintWireOps(operations, MINT)
        const batches = chunkWireOps(ops)

        for (let i = 0; i < batches.length - 1; i++) {
          const batch = batches[i]!
          const next = batches[i + 1]!
          const head = next[0]!
          // A clear on either side legitimately forces the boundary.
          if (batch.some((op) => op.op === 'clear') || head.op === 'clear') {
            continue
          }
          boundariesChecked++
          const overOps = batch.length + 1 > WIRE_MAX_OPS_PER_BATCH
          const overBytes =
            batch.reduce((sum, op) => sum + wireBytes(op), 0) +
              wireBytes(head) >
            WIRE_MAX_BATCH_BYTES
          expect(overOps || overBytes).toBe(true)
        }
      }),
      FC_OPTIONS
    )

    // Vacuity guard: with no cap-forced boundary in the corpus this test would
    // pass on a chunker that never split at all.
    expect(boundariesChecked).toBeGreaterThan(0)
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
            const original = operations[index]!
            expect(op.actor).toBe(actor)
            expect(op.base_version).toBe(baseVersion)
            expect(op.stamp).toEqual([baseVersion, actor])
            // Every field of the semantic op survives verbatim; minting is
            // additive only.
            for (const [key, value] of Object.entries(original)) {
              expect(op[key as keyof Op]).toEqual(value)
            }
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

/**
 * The reason the envelope exists: ops minted here must resolve last-writer-wins
 * to the same value on every replica, whatever order the host applies them in.
 * This exercises FE-minted stamps against the real applier, not a model of it.
 */
describe('minted stamps (property) — order-independent LWW', () => {
  const writerArb = fc.record({
    actor: fc.string({ minLength: 1, maxLength: 8 }).map((s) => `human:${s}:t`),
    baseVersion: fc.integer({ min: 0, max: 20 }),
    value: fc.string({ maxLength: 12 })
  })

  function applyIn(order: readonly Op[], seed: Op[]): Y.Doc {
    const doc = mint({ nodes: [], links: [] }, CATALOG)
    applyOps(doc, seed)
    for (const op of order) applyOps(doc, [op])
    return doc
  }

  function readWidget(doc: Y.Doc): unknown {
    const node = nodesMap(doc).get('1')
    if (!(node instanceof Y.Map)) return undefined
    const widgets = node.get('widgets')
    return widgets instanceof Y.Map ? widgets.get('text') : undefined
  }

  it('converges to the max-stamp winner regardless of arrival order', () => {
    let contended = 0

    fc.assert(
      fc.property(
        fc.array(writerArb, { minLength: 2, maxLength: 5 }),
        fc.array(fc.integer(), { minLength: 8, maxLength: 8 }),
        (writers, permutationKeys) => {
          const seed = mintWireOps([addNode(1)], {
            actor: 'system:mint',
            baseVersion: 0
          })
          // Every writer targets the SAME register, concurrently.
          const concurrent = writers.map((writer) =>
            mintWireOps([setWidget(1, writer.value)], {
              actor: writer.actor,
              baseVersion: writer.baseVersion
            })
          )
          const ops = concurrent.map((minted) => minted[0]!)
          if (new Set(ops.map((op) => op.actor)).size > 1) contended++

          const reversed = [...ops].reverse()
          const shuffled = ops
            .map((op, index) => ({
              op,
              key: permutationKeys[index % permutationKeys.length]!,
              index
            }))
            .sort((a, b) => a.key - b.key || a.index - b.index)
            .map((entry) => entry.op)

          const forward = readWidget(applyIn(ops, seed))
          expect(readWidget(applyIn(reversed, seed))).toEqual(forward)
          expect(readWidget(applyIn(shuffled, seed))).toEqual(forward)

          // …and the surviving value is the one the total stamp order picks,
          // not merely whatever both orders happened to agree on.
          const winner = [...ops].sort((a, b) =>
            compareStampKeys(stampKey(a), stampKey(b))
          )[ops.length - 1]!
          expect(forward).toEqual(
            (winner as Extract<Op, { op: 'set_widget' }>).value
          )
        }
      ),
      FC_OPTIONS
    )

    // Vacuity guard: single-actor runs would make the convergence claim trivial.
    expect(contended).toBeGreaterThan(0)
  })
})

/**
 * DQ-11 boundary, RECORDED not fixed.
 *
 * DQ-11 resolved to incarnation-namespaced stamps: a stale stamp minted before
 * a reconnect (life 1) must never defeat a live write from the same client
 * after it (life 2). This branch pins `@comfyorg/comfy-multi-player` at a
 * revision that PREDATES that change — `Stamp` here is the 2-tuple
 * `[base_version, actor]` with no incarnation component and `SCHEMA_VERSION`
 * is 1 — and `opEnvelope.ts` mints exactly that shape. So the guarantee is not
 * merely untested at this head, it is unrepresentable: a life-1 op that
 * happened to carry a higher `base_version` wins, permanently.
 *
 * The test below asserts TODAY's behaviour on purpose. It is a tripwire: when
 * the pin advances to the incarnation-namespaced stamps, it goes red and this
 * is where the write leg gets updated. Nothing here is a claim that the current
 * outcome is correct.
 */
describe('minted stamps — DQ-11 incarnation gap at this pin', () => {
  it('pins the pre-DQ-11 stamp shape the write leg mints', () => {
    expect(SCHEMA_VERSION).toBe(1)

    const [op] = mintWireOps([setWidget(1, 'v')], MINT)

    expect(op!.stamp).toEqual([MINT.baseVersion, MINT.actor])
    expect(op!.stamp).toHaveLength(2)
    // No incarnation / life component exists to namespace the stamp with.
    expect(Object.keys(op!)).not.toContain('incarnation')
  })

  it('documents that a stale life-1 write still defeats a live life-2 write', () => {
    const doc = mint({ nodes: [], links: [] }, CATALOG)
    const actor = 'human:reconnecting-client:tab-1'

    applyOps(
      doc,
      mintWireOps([addNode(1)], { actor: 'system:mint', baseVersion: 0 })
    )

    // Life 1: minted against a high base_version, then delayed in flight.
    const stale = mintWireOps([setWidget(1, 'life-1-stale')], {
      actor,
      baseVersion: 9
    })
    // Life 2: same client after a reconnect, minted against the fresh (lower)
    // version the host handed back. Applied FIRST; the delayed op lands after.
    const live = mintWireOps([setWidget(1, 'life-2-live')], {
      actor,
      baseVersion: 3
    })

    applyOps(doc, live)
    applyOps(doc, stale)

    const node = nodesMap(doc).get('1') as Y.Map<unknown>
    const widgets = node.get('widgets') as Y.Map<unknown>

    // DQ-11 says this SHOULD be 'life-2-live'. At this pin it is not, because
    // the stamp carries no incarnation to order the two lives by.
    expect(widgets.get('text')).toBe('life-1-stale')
  })
})
