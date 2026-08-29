/**
 * Property coverage for the follower read leg (QA-8 / QA-12).
 *
 * `docSchema.test.ts` pins the schema v1 SHAPE with hand-built fixtures. What it
 * cannot pin is the two things the follower is actually load-bearing for:
 *
 *   1. ARRIVAL-ORDER INDEPENDENCE. Yjs converges the doc; that is the package's
 *      property, already covered package-side. The FE claim is narrower and
 *      untested: `readDocSnapshot` is a pure function of the CONVERGED state, so
 *      two followers fed the same update set in different orders project
 *      identical snapshots. A reader that folded arrival order into its output
 *      (an accumulator, a first-write-wins cache, an iteration-order dependency)
 *      would still pass every example test in this directory.
 *
 *   2. FAIL-SOFT INGESTION. `readDocSnapshot` is the boundary where untrusted
 *      host bytes become FE domain objects. It has no schema validator in front
 *      of it — `assertReadableSchema` gates the schema VERSION, not entry
 *      shapes. Every reachable value must therefore be survivable: a raw
 *      TypeError escaping here kills the follower's observer callback, not just
 *      one node.
 *
 * Ops are minted through the shared package's own applier so the corpus is what
 * a real host would emit, not a mirror of the reader's expectations.
 */
import { applyOps, mint, nodesMap } from '@comfyorg/comfy-multi-player'
import type { Actor, Op } from '@comfyorg/comfy-multi-player'
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import type { DocSnapshot } from './docSchema'
import { LINKS_KEY, NODES_KEY, WIDGETS_KEY, readDocSnapshot } from './docSchema'

const FC_OPTIONS = { seed: 0x7b2c0de1, numRuns: 100 } as const

const CATALOG = {
  types: {
    LoadImage: { widget_order: ['image'] },
    KSampler: { widget_order: ['seed', 'steps'] },
    SaveImage: { widget_order: ['filename_prefix'] }
  }
}
const CLASS_TYPES = ['LoadImage', 'KSampler', 'SaveImage'] as const
const WIDGET_NAMES = ['image', 'seed', 'steps', 'filename_prefix'] as const

interface Scenario {
  nodeCount: number
  actors: number
  kinds: number[]
  nodeRefs: number[]
  slots: number[]
  values: (number | string)[]
  widgets: number[]
  baseVersions: number[]
  /** Sort keys used to permute the delivered update stream. */
  arrivalA: number[]
  arrivalB: number[]
}

const scenarioArb: fc.Arbitrary<Scenario> = fc.record({
  nodeCount: fc.integer({ min: 1, max: 6 }),
  actors: fc.integer({ min: 1, max: 3 }),
  kinds: fc.array(fc.integer({ min: 0, max: 3 }), {
    minLength: 24,
    maxLength: 24
  }),
  nodeRefs: fc.array(fc.integer({ min: 0, max: 15 }), {
    minLength: 48,
    maxLength: 48
  }),
  slots: fc.array(fc.integer({ min: 0, max: 3 }), {
    minLength: 48,
    maxLength: 48
  }),
  values: fc.array(fc.oneof(fc.integer(), fc.string()), {
    minLength: 24,
    maxLength: 24
  }),
  widgets: fc.array(fc.integer({ min: 0, max: 3 }), {
    minLength: 24,
    maxLength: 24
  }),
  baseVersions: fc.array(fc.integer({ min: 0, max: 12 }), {
    minLength: 24,
    maxLength: 24
  }),
  arrivalA: fc.array(fc.integer(), { minLength: 64, maxLength: 64 }),
  arrivalB: fc.array(fc.integer(), { minLength: 64, maxLength: 64 })
})

function at<T>(values: readonly T[], index: number): T {
  return values[index % values.length]!
}

function envelope(index: number, scenario: Scenario) {
  const actor: Actor = `human:pbt-${index % scenario.actors}:tab-0`
  const baseVersion = at(scenario.baseVersions, index)
  return {
    op_id: index.toString(16).padStart(32, '0'),
    actor,
    base_version: baseVersion,
    stamp: [baseVersion, actor] as [number, Actor]
  }
}

/** A corpus of real wire ops over `nodeCount` nodes: seed adds, then edits. */
function buildOps(scenario: Scenario): Op[] {
  const ids = Array.from({ length: scenario.nodeCount }, (_, i) => i + 1)
  const ops: Op[] = ids.map((id, i) => ({
    ...envelope(i, scenario),
    op: 'add_node',
    node_id: id,
    class_type: at(CLASS_TYPES, i),
    pos: [i * 40, i * 25],
    node: {
      id,
      type: at(CLASS_TYPES, i),
      pos: [i * 40, i * 25],
      inputs: [{ name: 'in', type: 'IMAGE', link: null }],
      outputs: [{ name: 'out', type: 'IMAGE', links: [] }],
      widgets_values: []
    }
  }))

  let linkId = 1000
  // `removed_links` is mint-time-recorded, not re-derived by the applier, so the
  // corpus has to track incident links the way a real minter would.
  const liveLinks: { id: number; from: number; to: number }[] = []
  for (let i = 0; i < scenario.kinds.length; i++) {
    const index = ids.length + i
    const from = at(ids, at(scenario.nodeRefs, i * 2))
    const to = at(ids, at(scenario.nodeRefs, i * 2 + 1))
    switch (at(scenario.kinds, i)) {
      case 0:
        ops.push({
          ...envelope(index, scenario),
          op: 'set_widget',
          node_id: to,
          widget: at(WIDGET_NAMES, at(scenario.widgets, i)),
          value: at(scenario.values, i)
        })
        break
      case 1: {
        const id = linkId++
        liveLinks.push({ id, from, to })
        ops.push({
          ...envelope(index, scenario),
          op: 'connect',
          link_id: id,
          from_node: from,
          from_slot: at(scenario.slots, i * 2),
          to_node: to,
          to_slot: at(scenario.slots, i * 2 + 1),
          link_type: 'IMAGE'
        })
        break
      }
      case 2: {
        const severed = liveLinks.filter(
          (link) => link.from === to || link.to === to
        )
        for (const link of severed) {
          liveLinks.splice(liveLinks.indexOf(link), 1)
        }
        ops.push({
          ...envelope(index, scenario),
          op: 'delete_node',
          node_id: to,
          removed_links: severed.map((link) => link.id)
        })
        break
      }
      default:
        // Re-add a deleted id: exercises resurrect-after-delete ordering.
        ops.push({
          ...envelope(index, scenario),
          op: 'add_node',
          node_id: to,
          class_type: at(CLASS_TYPES, i),
          pos: [i, i],
          node: {
            id: to,
            type: at(CLASS_TYPES, i),
            pos: [i, i],
            inputs: [{ name: 'in', type: 'IMAGE', link: null }],
            outputs: [{ name: 'out', type: 'IMAGE', links: [] }],
            widgets_values: []
          }
        })
    }
  }
  return ops
}

/**
 * Apply the corpus host-side one op at a time and capture the incremental Yjs
 * update each produced. The seed state (what `mint` wrote before any op) is
 * update 0 and is permuted with the rest — Yjs buffers structs whose causal
 * dependencies have not arrived, which is exactly the reconnect/replay
 * condition the follower must survive.
 */
function hostUpdates(ops: Op[]): { host: Y.Doc; updates: Uint8Array[] } {
  const host = mint({ nodes: [], links: [] }, CATALOG)
  const updates: Uint8Array[] = [Y.encodeStateAsUpdate(host)]
  host.on('update', (update: Uint8Array) => updates.push(update))
  for (const op of ops) applyOps(host, [op])
  return { host, updates }
}

function permute<T>(items: readonly T[], keys: readonly number[]): T[] {
  return items
    .map((value, index) => ({ value, key: at(keys, index), index }))
    .sort((a, b) => a.key - b.key || a.index - b.index)
    .map((entry) => entry.value)
}

function follower(updates: readonly Uint8Array[]): Y.Doc {
  const doc = new Y.Doc()
  for (const update of updates) Y.applyUpdate(doc, update)
  return doc
}

/** Order-independent, readable projection of a snapshot for comparison. */
function normalize(snapshot: DocSnapshot) {
  const nodes = [...snapshot.nodes.entries()]
    .map(([id, spec]) => ({
      id,
      type: spec.type,
      pos: [...spec.pos],
      widgets: Object.fromEntries(
        Object.entries(spec.widgets).sort(([a], [b]) => (a < b ? -1 : 1))
      )
    }))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
  const links = [...snapshot.links.entries()]
    .map(([id, spec]) => ({ ...spec, id }))
    .sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1))
  return { nodes, links }
}

describe('readDocSnapshot (property) — arrival-order independence', () => {
  it('projects identically for any two delivery orders of the same updates', () => {
    // Vacuity guard: an all-rejected corpus would make every assertion below
    // trivially true (empty === empty). Assert the corpus actually populated
    // both root maps at least once across the run.
    let maxNodes = 0
    let maxLinks = 0
    let reordered = 0

    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const { host, updates } = hostUpdates(buildOps(scenario))

        const orderA = permute(updates, scenario.arrivalA)
        const orderB = permute(updates, scenario.arrivalB)
        if (orderA.some((update, i) => update !== orderB[i])) reordered++

        const a = follower(orderA)
        const b = follower(orderB)

        const projected = normalize(readDocSnapshot(a))
        maxNodes = Math.max(maxNodes, projected.nodes.length)
        maxLinks = Math.max(maxLinks, projected.links.length)

        expect(projected).toEqual(normalize(readDocSnapshot(b)))
        // …and matches what the writer itself reads: the follower's reader is
        // not merely self-consistent, it agrees with the host projection.
        expect(projected).toEqual(normalize(readDocSnapshot(host)))
      }),
      FC_OPTIONS
    )

    expect(maxNodes).toBeGreaterThan(0)
    expect(maxLinks).toBeGreaterThan(0)
    expect(reordered).toBeGreaterThan(0)
  })

  it('projects identically whether updates arrive one-by-one or as one merged state', () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const { updates } = hostUpdates(buildOps(scenario))

        const incremental = follower(permute(updates, scenario.arrivalA))
        const merged = follower([Y.mergeUpdates([...updates])])

        expect(normalize(readDocSnapshot(incremental))).toEqual(
          normalize(readDocSnapshot(merged))
        )
      }),
      FC_OPTIONS
    )
  })
})

describe('readDocSnapshot (property) — read purity (KA-6 / invariant #6)', () => {
  it('never writes the doc and is idempotent across repeated reads', () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const { updates } = hostUpdates(buildOps(scenario))
        const doc = follower(updates)

        let wrote = 0
        doc.on('update', () => {
          wrote++
        })
        const first = normalize(readDocSnapshot(doc))
        const second = normalize(readDocSnapshot(doc))

        expect(wrote).toBe(0)
        expect(second).toEqual(first)
      }),
      FC_OPTIONS
    )
  })
})

/**
 * QA-12: the ingestion boundary. Values here are what a compromised, buggy, or
 * merely NEWER host could put in the root maps. None of them may produce a raw
 * throw, and nothing that survives may violate the `NodeSpec`/`LinkSpec`
 * contract the canvas layer downstream assumes.
 */
const hostileValueArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.jsonValue(),
  fc.constantFrom(
    null,
    0,
    -0,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.MAX_SAFE_INTEGER,
    '',
    'not-a-node'
  ),
  fc.array(fc.oneof(fc.integer(), fc.string(), fc.constant(null)), {
    maxLength: 8
  })
)

function hostileNode(fields: [string, unknown][]): Y.Map<unknown> {
  const map = new Y.Map<unknown>()
  for (const [key, value] of fields) map.set(key, value)
  return map
}

describe('readDocSnapshot (property) — hostile ingestion never throws', () => {
  it('survives arbitrary values in the nodes and links root maps', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 6 }),
            fc.array(
              fc.tuple(
                fc.constantFrom('type', 'pos', WIDGETS_KEY, 'flags', 'mode'),
                hostileValueArb
              ),
              { maxLength: 5 }
            )
          ),
          { maxLength: 8 }
        ),
        fc.array(
          fc.tuple(fc.string({ minLength: 1, maxLength: 6 }), hostileValueArb),
          { maxLength: 8 }
        ),
        (nodeEntries, linkEntries) => {
          const doc = new Y.Doc()
          const nodes = doc.getMap<unknown>(NODES_KEY)
          for (const [id, fields] of nodeEntries) {
            nodes.set(id, hostileNode(fields))
          }
          const links = doc.getMap<unknown>(LINKS_KEY)
          for (const [id, raw] of linkEntries) links.set(id, raw)

          const snapshot = readDocSnapshot(doc)

          for (const [id, spec] of snapshot.nodes) {
            expect(typeof spec.type).toBe('string')
            expect(spec.type.length).toBeGreaterThan(0)
            expect(String(spec.id)).toBe(id)
            expect(spec.pos).toHaveLength(2)
            expect(Number.isFinite(spec.pos[0])).toBe(true)
            expect(Number.isFinite(spec.pos[1])).toBe(true)
          }
          for (const [id, spec] of snapshot.links) {
            expect(spec.id).toBe(id)
            expect(Number.isFinite(spec.originSlot)).toBe(true)
            expect(Number.isFinite(spec.targetSlot)).toBe(true)
            expect(spec.originId).not.toBeNull()
            expect(spec.targetId).not.toBeNull()
          }
        }
      ),
      FC_OPTIONS
    )
  })

  it('survives a hostile overlay applied on top of a real minted doc', () => {
    fc.assert(
      fc.property(scenarioArb, hostileValueArb, (scenario, hostile) => {
        const { host, updates } = hostUpdates(buildOps(scenario))
        const doc = follower(updates)
        const realIds = [...nodesMap(host).keys()]

        // A newer/buggier writer overwrites a live entry with junk. The reader
        // must drop exactly that entry and keep projecting the rest.
        doc.getMap<unknown>(NODES_KEY).set(at(realIds, 0) ?? 'x', hostile)

        const snapshot = readDocSnapshot(doc)
        expect(snapshot.nodes.size).toBeLessThanOrEqual(realIds.length)
        for (const spec of snapshot.nodes.values()) {
          expect(typeof spec.type).toBe('string')
        }
      }),
      FC_OPTIONS
    )
  })
})
