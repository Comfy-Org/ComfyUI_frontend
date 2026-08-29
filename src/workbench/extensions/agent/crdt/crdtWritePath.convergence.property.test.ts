/**
 * Property tests for what the FE's minted ops actually DO to a document.
 *
 * The other property suites stop at the transport boundary: they prove the
 * envelope is well-formed and the sender loses nothing. That is not the same
 * as proving the write path is correct, because the envelope the FE mints is
 * exactly what decides conflict resolution at the doc host. So these tests
 * drive `mintWireOps` output through the real shared applier
 * (`@comfyorg/comfy-multi-player`'s `applyOps`, the same implementation the
 * host runs) and assert idempotence, convergence under reordering, and
 * reject-safety over generated op sets.
 *
 * `applyOps` is the host's write surface, never the follower's (KA-1/KA-6):
 * it appears here as the oracle a test drives, not as a path the FE takes at
 * runtime.
 */
import {
  applyOps,
  appliedOpIds,
  mint,
  readGraph,
  readStamps
} from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type * as Y from 'yjs'

import type { GraphOperation } from './graphOperations'
import { mintWireOps } from './opEnvelope'

const ACTOR = 'human:test-user:tab-1'
const NODE_IDS = [1, 2, 3, 4] as const
const WIDGET_NAMES = ['seed', 'steps', 'cfg'] as const

const catalog: WidgetCatalog = {
  types: {
    Source: { widget_order: [...WIDGET_NAMES] },
    Sink: { widget_order: [] }
  }
}

function baseWorkflow(): WorkflowJSON {
  return {
    nodes: NODE_IDS.map((id) => ({
      id,
      type: 'Source',
      pos: [id * 100, 0],
      widgets_values: { seed: 0, steps: 0, cfg: 0 }
    })),
    links: []
  }
}

function seedDoc(): Y.Doc {
  return mint(baseWorkflow(), catalog)
}

/** Everything about a document that a converged replica must agree on. */
function fingerprint(doc: Y.Doc): unknown {
  return {
    graph: readGraph(doc),
    stamps: readStamps(doc),
    applied: [...appliedOpIds(doc)].sort()
  }
}

const arbValue = fc.oneof(
  fc.integer({ min: -1000, max: 1000 }),
  fc.stringMatching(/^[a-z]{1,8}$/),
  fc.boolean()
)

/** A `set_widget` addressed to one of the seeded nodes and catalogued widgets. */
const arbTargetedSet = fc
  .record({
    node_id: fc.constantFrom(...NODE_IDS),
    widget: fc.constantFrom(...WIDGET_NAMES),
    value: arbValue
  })
  .map(
    ({ node_id, widget, value }): GraphOperation => ({
      op: 'set_widget',
      node_id,
      widget,
      value,
      old: 0
    })
  )

/** Sets whose targets are pairwise distinct — no two ops contend for a value. */
const arbDisjointSets = fc
  .uniqueArray(
    fc.tuple(fc.constantFrom(...NODE_IDS), fc.constantFrom(...WIDGET_NAMES)),
    {
      minLength: 1,
      maxLength: NODE_IDS.length * WIDGET_NAMES.length,
      selector: ([node, widget]) => `${node}:${widget}`
    }
  )
  .chain((targets) =>
    fc.tuple(
      fc.constant(targets),
      fc.array(arbValue, {
        minLength: targets.length,
        maxLength: targets.length
      })
    )
  )
  .map(([targets, values]): GraphOperation[] =>
    targets.map(([node_id, widget], index) => ({
      op: 'set_widget',
      node_id,
      widget,
      value: values[index],
      old: 0
    }))
  )

function permutations<T>(items: T[]): fc.Arbitrary<T[]> {
  return fc.shuffledSubarray(items, {
    minLength: items.length,
    maxLength: items.length
  })
}

describe('minted ops are idempotent at the applier', () => {
  it('re-applying the same minted batch is a no-op on doc state', () => {
    fc.assert(
      fc.property(
        fc.array(arbTargetedSet, { minLength: 1, maxLength: 12 }),
        fc.nat({ max: 500 }),
        (operations, baseVersion) => {
          const doc = seedDoc()
          try {
            const ops = mintWireOps(operations, { actor: ACTOR, baseVersion })

            applyOps(doc, ops, catalog)
            const afterFirst = fingerprint(doc)

            const second = applyOps(doc, ops, catalog)

            // The op_id gate makes a resend a byte-level no-op. This is what
            // licenses the sender's silence-resend (opSender.ts:128-131): it
            // is only safe because minting happens once and the identity
            // survives the retry.
            expect(fingerprint(doc)).toEqual(afterFirst)
            for (const outcome of second.outcomes) {
              expect(outcome.outcome).toBe('no-op')
            }
          } finally {
            doc.destroy()
          }
        }
      )
    )
  })

  it('an arbitrary number of redeliveries converges to one delivery', () => {
    fc.assert(
      fc.property(
        fc.array(arbTargetedSet, { minLength: 1, maxLength: 8 }),
        fc.integer({ min: 2, max: 5 }),
        (operations, redeliveries) => {
          const once = seedDoc()
          const many = seedDoc()
          try {
            const ops = mintWireOps(operations, {
              actor: ACTOR,
              baseVersion: 12
            })

            applyOps(once, ops, catalog)
            for (let index = 0; index < redeliveries; index++) {
              applyOps(many, ops, catalog)
            }

            expect(fingerprint(many)).toEqual(fingerprint(once))
          } finally {
            once.destroy()
            many.destroy()
          }
        }
      )
    )
  })

  it('a batch split across wire batches applies as one logical batch', () => {
    fc.assert(
      fc.property(
        fc.array(arbTargetedSet, { minLength: 2, maxLength: 12 }),
        fc.integer({ min: 1, max: 6 }),
        (operations, splitAt) => {
          const whole = seedDoc()
          const split = seedDoc()
          try {
            const ops = mintWireOps(operations, {
              actor: ACTOR,
              baseVersion: 5
            })

            applyOps(whole, ops, catalog)
            applyOps(split, ops.slice(0, splitAt), catalog)
            applyOps(split, ops.slice(splitAt), catalog)

            // The chunker's cap-driven split is invisible to the document: a
            // 300-op edit that becomes two wire batches must land identically.
            expect(fingerprint(split)).toEqual(fingerprint(whole))
          } finally {
            whole.destroy()
            split.destroy()
          }
        }
      )
    )
  })
})

describe('minted ops on unrelated targets commute', () => {
  it('disjoint widget writes converge under any delivery order', () => {
    fc.assert(
      fc.property(
        arbDisjointSets,
        fc.nat({ max: 500 }),
        (operations, baseVersion) => {
          const ops = mintWireOps(operations, { actor: ACTOR, baseVersion })
          return fc.assert(
            fc.property(permutations(ops), (reordered: Op[]) => {
              const inOrder = seedDoc()
              const shuffled = seedDoc()
              try {
                applyOps(inOrder, ops, catalog)
                applyOps(shuffled, reordered, catalog)

                // Ops touching different (node, widget) targets never contend,
                // so two replicas that saw them in different orders must be
                // indistinguishable afterwards.
                expect(fingerprint(shuffled)).toEqual(fingerprint(inOrder))
              } finally {
                inOrder.destroy()
                shuffled.destroy()
              }
            }),
            { numRuns: 5 }
          )
        }
      ),
      { numRuns: 25 }
    )
  })

  it('disjoint writes from two actors converge under interleaving', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...NODE_IDS),
        fc.constantFrom(...NODE_IDS),
        arbValue,
        arbValue,
        fc.boolean(),
        (nodeA, nodeB, valueA, valueB, aFirst) => {
          // Two actors, two different widgets — disjoint targets even when the
          // node happens to be the same one.
          const opsA = mintWireOps(
            [
              {
                op: 'set_widget',
                node_id: nodeA,
                widget: 'seed',
                value: valueA,
                old: 0
              }
            ],
            { actor: 'human:alice:tab-1', baseVersion: 3 }
          )
          const opsB = mintWireOps(
            [
              {
                op: 'set_widget',
                node_id: nodeB,
                widget: 'steps',
                value: valueB,
                old: 0
              }
            ],
            { actor: 'human:bob:tab-2', baseVersion: 3 }
          )

          const first = seedDoc()
          const second = seedDoc()
          try {
            applyOps(
              first,
              aFirst ? [...opsA, ...opsB] : [...opsB, ...opsA],
              catalog
            )
            applyOps(
              second,
              aFirst ? [...opsB, ...opsA] : [...opsA, ...opsB],
              catalog
            )

            expect(fingerprint(second)).toEqual(fingerprint(first))
          } finally {
            first.destroy()
            second.destroy()
          }
        }
      )
    )
  })
})

describe('contending writes converge, but not on mint order', () => {
  it('same-target writes converge under any delivery order', () => {
    fc.assert(
      fc.property(
        fc.array(arbValue, { minLength: 2, maxLength: 6 }),
        fc.nat({ max: 500 }),
        (values, baseVersion) => {
          const ops = mintWireOps(
            values.map((value) => ({
              op: 'set_widget' as const,
              node_id: 1,
              widget: 'seed',
              value,
              old: 0
            })),
            { actor: ACTOR, baseVersion }
          )
          return fc.assert(
            fc.property(permutations(ops), (reordered: Op[]) => {
              const inOrder = seedDoc()
              const shuffled = seedDoc()
              try {
                applyOps(inOrder, ops, catalog)
                applyOps(shuffled, reordered, catalog)

                // Convergence itself holds: the LWW gate is a total order, so
                // every replica picks the same winner regardless of arrival
                // order. WHICH write wins is the next test.
                expect(fingerprint(shuffled)).toEqual(fingerprint(inOrder))
              } finally {
                inOrder.destroy()
                shuffled.destroy()
              }
            }),
            { numRuns: 5 }
          )
        }
      ),
      { numRuns: 25 }
    )
  })

  it('the surviving value is the one with the greatest op_id, NOT the newest write', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 10_000 }), {
          minLength: 2,
          maxLength: 6
        }),
        fc.nat({ max: 500 }),
        (values, baseVersion) => {
          const operations = values.map((value) => ({
            op: 'set_widget' as const,
            node_id: 1,
            widget: 'seed',
            value,
            old: 0
          }))
          // One user, one burst: `baseVersion()` is the follower's last
          // observed doc sequence, and it cannot advance between two local
          // edits made before the host round-trips. So every op in a burst
          // carries the SAME `[base_version, actor]` stamp
          // (opEnvelope.ts:37) and the applier's only remaining tiebreak is
          // `op_id` — a uuid4 (opEnvelope.ts:24-26). Mint order is nowhere in
          // the key.
          const ops = mintWireOps(operations, { actor: ACTOR, baseVersion })
          const doc = seedDoc()
          try {
            applyOps(doc, ops, catalog)

            const winner = [...ops].sort((a, b) =>
              a.op_id < b.op_id ? -1 : a.op_id > b.op_id ? 1 : 0
            )[ops.length - 1]
            const node = readGraph(doc).nodes['1']
            const widgets = node.widgets as Record<string, unknown>

            // This pins CURRENT behaviour, and it is a defect, not a design:
            // the value the user typed LAST survives only when its random
            // op_id happens to sort highest. See
            // reports/qa/feh5-crdt-prop-tests.md, VIOLATION V-1.
            expect(widgets.seed).toBe((winner as { value: unknown }).value)
          } finally {
            doc.destroy()
          }
        }
      )
    )
  })

  it('every op in a burst consumes its identity, so a dropped write reads as applied', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 10_000 }), {
          minLength: 2,
          maxLength: 6
        }),
        (values) => {
          const ops = mintWireOps(
            values.map((value) => ({
              op: 'set_widget' as const,
              node_id: 2,
              widget: 'cfg',
              value,
              old: 0
            })),
            { actor: ACTOR, baseVersion: 9 }
          )
          const doc = seedDoc()
          try {
            const result = applyOps(doc, ops, catalog)
            const widgets = readGraph(doc).nodes['2'].widgets as Record<
              string,
              unknown
            >

            // Exactly one of the burst's values survives on the target; the
            // rest are discarded by the LWW gate.
            expect(values).toContain(widgets.cfg)

            // Every op in the burst — winner and losers alike — consumed its
            // op_id and is now in the document's applied set. That set is
            // exactly what the host echoes as `doc_ops_result.applied`, and
            // the FE's view of that frame carries only `applied`/`skipped`
            // (`OpsResultView`, opSender.ts:27-33; the parser,
            // docFrameClient.ts:168-191). The applier does distinguish a
            // dropped write internally (`ApplyOutcome`'s `lww-dropped` arm),
            // but no channel reaching the FE preserves it: a write the user
            // made is discarded and reported as success. See VIOLATION V-2.
            const consumed = new Set(appliedOpIds(doc))
            for (const op of ops) expect(consumed.has(op.op_id)).toBe(true)
            expect(result.outcomes).toHaveLength(ops.length)
            for (const outcome of result.outcomes) {
              expect(outcome.outcome).not.toBe('rejected')
            }
          } finally {
            doc.destroy()
          }
        }
      )
    )
  })
})

describe('a rejected op leaves the document consistent', () => {
  it('an uncatalogued widget name is rejected without touching doc state', () => {
    fc.assert(
      fc.property(
        fc
          .stringMatching(/^[a-z]{1,8}$/)
          .filter(
            (name) => !(WIDGET_NAMES as readonly string[]).includes(name)
          ),
        arbValue,
        (widget, value) => {
          const doc = seedDoc()
          try {
            const before = fingerprint(doc)
            const ops = mintWireOps(
              [{ op: 'set_widget', node_id: 1, widget, value, old: 0 }],
              { actor: ACTOR, baseVersion: 4 }
            )

            const result = applyOps(doc, ops, catalog)

            expect(result.outcomes[0].outcome).toBe('rejected')
            // No half-applied stamp: a refused op writes neither the value nor
            // a `__stamps` row, so a later legitimate write to that target is
            // not gated out by a stamp its own rejection left behind.
            expect(fingerprint(doc)).toEqual(before)
          } finally {
            doc.destroy()
          }
        }
      )
    )
  })

  it('abort-remainder retains the applied prefix and nothing after the failure', () => {
    fc.assert(
      fc.property(
        fc.array(arbTargetedSet, { minLength: 1, maxLength: 4 }),
        fc.array(arbTargetedSet, { minLength: 1, maxLength: 4 }),
        (prefix, suffix) => {
          const doc = seedDoc()
          const reference = seedDoc()
          try {
            const ops = mintWireOps(
              [
                ...prefix,
                {
                  op: 'set_widget',
                  node_id: 1,
                  widget: 'not_in_catalog',
                  value: 1,
                  old: 0
                },
                ...suffix
              ],
              { actor: ACTOR, baseVersion: 6 }
            )
            const prefixOps = ops.slice(0, prefix.length)

            const result = applyOps(doc, ops, catalog)
            applyOps(reference, prefixOps, catalog)

            expect(result.outcomes[prefix.length].outcome).toBe('rejected')
            // Ops after the failing index are not applied (vocabulary §4) —
            // the document equals the one that only ever saw the prefix.
            expect(readGraph(doc)).toEqual(readGraph(reference))
          } finally {
            doc.destroy()
            reference.destroy()
          }
        }
      )
    )
  })

  it('a rejected op does not consume its identity, so a repaired resend still lands', () => {
    fc.assert(
      fc.property(arbValue, (value) => {
        const doc = seedDoc()
        try {
          const rejected = mintWireOps(
            [
              {
                op: 'set_widget',
                node_id: 3,
                widget: 'not_in_catalog',
                value,
                old: 0
              }
            ],
            { actor: ACTOR, baseVersion: 2 }
          )
          applyOps(doc, rejected, catalog)

          // Same identity, repaired payload is NOT the contract (changed
          // payload under a reused op_id rejects host-side). What matters here
          // is the inverse: the rejected op_id must not be recorded as applied,
          // or a corrected retry under a fresh id could not be distinguished
          // from a duplicate.
          expect(appliedOpIds(doc)).not.toContain(rejected[0].op_id)

          const repaired = mintWireOps(
            [{ op: 'set_widget', node_id: 3, widget: 'seed', value, old: 0 }],
            { actor: ACTOR, baseVersion: 2 }
          )
          const result = applyOps(doc, repaired, catalog)

          expect(result.outcomes[0].outcome).toBe('applied')
          const widgets = readGraph(doc).nodes['3'].widgets as Record<
            string,
            unknown
          >
          expect(widgets.seed).toBe(value)
        } finally {
          doc.destroy()
        }
      })
    )
  })
})
