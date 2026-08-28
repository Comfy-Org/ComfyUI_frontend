import * as fc from 'fast-check'
import { afterAll, describe, expect, it } from 'vitest'

import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'

import {
  MINT_ID_CEILING,
  MINT_ID_MIN,
  createLGraphState,
  mintCoordinationFreeId,
  mintGroupId,
  mintLinkId,
  mintNodeId,
  mintRerouteId,
  observeGroupId,
  observeLinkId,
  observeNodeId,
  observeRerouteId,
  setCoordinationFreeIds
} from '@/lib/litegraph/src/idAllocation'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { toGroupId } from '@/types/groupId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'

describe('idAllocation', () => {
  it('mints increasing ids for each entity kind', () => {
    const state = createLGraphState()

    expect([mintNodeId(state), mintNodeId(state)]).toEqual(['1', '2'])
    expect([mintGroupId(state), mintGroupId(state)]).toEqual([1, 2])
    expect([mintLinkId(state), mintLinkId(state)]).toEqual([1, 2])
    expect([mintRerouteId(state), mintRerouteId(state)]).toEqual([1, 2])
  })

  it('observes higher ids and ignores lower ids', () => {
    const state = createLGraphState()

    observeNodeId(state, toNodeId(4))
    observeNodeId(state, toNodeId(2))
    observeGroupId(state, toGroupId(5))
    observeGroupId(state, toGroupId(3))
    observeLinkId(state, toLinkId(6))
    observeLinkId(state, toLinkId(4))
    observeRerouteId(state, toRerouteId(7))
    observeRerouteId(state, toRerouteId(5))

    expect(state).toEqual({
      lastGroupId: 5,
      lastNodeId: 4,
      lastLinkId: 6,
      lastRerouteId: 7
    })
  })

  it('observes numeric-string node ids', () => {
    const state = createLGraphState()

    observeNodeId(state, toNodeId('12'))
    observeNodeId(state, toNodeId('named'))

    expect(state.lastNodeId).toBe(12)
  })

  it('never seeds a counter from a mint-range id', () => {
    const state = createLGraphState()
    state.lastNodeId = 7
    state.lastLinkId = toLinkId(9)

    observeNodeId(state, toNodeId(MINT_ID_MIN))
    observeNodeId(state, toNodeId(String(MINT_ID_MIN + 5)))
    observeLinkId(state, toLinkId(MINT_ID_MIN))

    // Absorbing a minted id would advance the counter into the mint range,
    // so a later counter allocation could alias a minted entry.
    expect(state.lastNodeId).toBe(7)
    expect(Number(state.lastLinkId)).toBe(9)

    observeNodeId(state, toNodeId(MINT_ID_MIN - 1))
    observeLinkId(state, toLinkId(MINT_ID_MIN - 1))
    expect(state.lastNodeId).toBe(MINT_ID_MIN - 1)
    expect(Number(state.lastLinkId)).toBe(MINT_ID_MIN - 1)
  })
})

describe('coordination-free (doc-bound) allocation', () => {
  // Branded-id construction makes the 100-run sweep slow under a loaded
  // parallel suite; the work is constant per run, so only the budget moves.
  // The printed seed replays the counts, not the draws (real entropy).
  it(
    'two replicas seeded from one snapshot allocate disjoint node and link ids',
    { timeout: 5_000 },
    () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 200 }), (count) => {
          // Both replicas resume from the SAME snapshot counters - the exact
          // aliasing setup from the review finding. Disjointness is statistical
          // (independent draws from a 2^53-wide range), so the draws stay on
          // the real entropy source.
          const replicaA = createLGraphState()
          const replicaB = createLGraphState()
          for (const state of [replicaA, replicaB]) {
            state.lastNodeId = 7
            state.lastLinkId = toLinkId(9)
            setCoordinationFreeIds(state, true)
          }

          const minted = [
            ...Array.from({ length: count }, () =>
              String(mintNodeId(replicaA))
            ),
            ...Array.from({ length: count }, () =>
              String(mintNodeId(replicaB))
            ),
            ...Array.from({ length: count }, () =>
              String(mintLinkId(replicaA))
            ),
            ...Array.from({ length: count }, () => String(mintLinkId(replicaB)))
          ]

          expect(new Set(minted).size).toBe(minted.length)
          for (const id of minted) {
            const numeric = Number(id)
            expect(Number.isSafeInteger(numeric)).toBe(true)
            expect(numeric).toBeGreaterThanOrEqual(MINT_ID_MIN)
          }
        })
      )
    }
  )

  it('maps the whole random domain into [2^40, 2^53) integers', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }),
        (draw) => {
          const minted = mintCoordinationFreeId(() => draw)

          expect(Number.isSafeInteger(minted)).toBe(true)
          expect(minted).toBeGreaterThanOrEqual(MINT_ID_MIN)
          expect(minted).toBeLessThan(MINT_ID_CEILING)
        }
      )
    )
  })

  it('arming scopes to the given state: other states keep counters', () => {
    const armed = createLGraphState()
    const unbound = createLGraphState()
    setCoordinationFreeIds(armed, true)

    expect(Number(mintNodeId(armed))).toBeGreaterThanOrEqual(MINT_ID_MIN)
    expect([mintNodeId(unbound), mintLinkId(unbound)]).toEqual(['1', 1])
  })

  it('armed mints leave the counters untouched; disarming restores the sequential run', () => {
    const state = createLGraphState()

    setCoordinationFreeIds(state, true)
    mintNodeId(state)
    mintLinkId(state)
    // Armed mints never advance the counters.
    expect(state.lastNodeId).toBe(0)
    expect(Number(state.lastLinkId)).toBe(0)

    setCoordinationFreeIds(state, false)
    // Exactly the unbound sequence - the same values the unarmed pin above
    // produces from a fresh state.
    expect([mintNodeId(state), mintNodeId(state)]).toEqual(['1', '2'])
    expect([mintLinkId(state), mintLinkId(state)]).toEqual([1, 2])
  })

  it('groups and reroutes stay on counters while armed', () => {
    const state = createLGraphState()
    setCoordinationFreeIds(state, true)

    expect([mintGroupId(state), mintGroupId(state)]).toEqual([1, 2])
    expect([mintRerouteId(state), mintRerouteId(state)]).toEqual([1, 2])
  })
})

describe('coordination-free ids across a serialize/configure round-trip', () => {
  class WiredNode extends LGraphNode {
    constructor(title?: string) {
      super(title ?? 'WiredNode')
      this.addInput('in', 'number')
      this.addOutput('out', 'number')
    }
  }
  LiteGraph.registerNodeType('test/wired', WiredNode)

  afterAll(() => {
    LiteGraph.unregisterNodeType('test/wired')
  })

  it('minted node and link ids survive the round-trip without seeding the counters', () => {
    const graph = new LGraph()
    setCoordinationFreeIds(graph.state, true)
    const source = LiteGraph.createNode('test/wired')!
    const target = LiteGraph.createNode('test/wired')!
    graph.add(source)
    graph.add(target)
    const link = source.connect(0, target, 0)
    if (!link) throw new Error('connect failed')

    const mintedNode = String(source.id)
    const mintedLink = Number(link.id)
    expect(Number(mintedNode)).toBeGreaterThanOrEqual(MINT_ID_MIN)
    expect(mintedLink).toBeGreaterThanOrEqual(MINT_ID_MIN)

    const reloaded = new LGraph()
    reloaded.configure(graph.serialize())

    // NodeId is a string brand: pin the serialized form.
    expect(reloaded._nodes.map((candidate) => String(candidate.id))).toContain(
      mintedNode
    )
    // LinkId is a raw number brand on its own serialize path.
    expect(reloaded.links.get(toLinkId(mintedLink))).toBeTruthy()
    // The observers refuse mint-range ids, so the reloaded counters stay
    // pristine instead of being dragged into the mint range.
    expect(reloaded.state.lastNodeId).toBe(0)
    expect(Number(reloaded.state.lastLinkId)).toBe(0)
  })
})

describe('counter restores clamp below the mint floor', () => {
  const POISONED = MINT_ID_MIN + 5

  it('a poisoned root state restore cannot seed the counters', () => {
    const graph = new LGraph()

    // asSerialisable is the new-schema payload; the legacy 0.4 branch
    // ignores `state` entirely, so only this shape reaches the restore.
    graph.configure({
      ...new LGraph().asSerialisable(),
      state: {
        lastGroupId: 0,
        lastLinkId: toLinkId(POISONED),
        lastNodeId: POISONED,
        lastRerouteId: toRerouteId(0)
      }
    })

    // A pre-guard client whose counter absorbed a minted id saved that
    // counter; the restore IGNORES it, so the next ALLOCATION stays out of
    // the mint range (a clamp to the floor would not - 2^40 - 1 + 1 = 2^40).
    expect(graph.state.lastNodeId).toBe(0)
    expect(Number(graph.state.lastLinkId)).toBe(0)
    expect(Number(mintNodeId(graph.state))).toBeLessThan(MINT_ID_MIN)
    expect(Number(mintLinkId(graph.state))).toBeLessThan(MINT_ID_MIN)
  })

  it('a poisoned subgraph definition cannot seed any counter', () => {
    const graph = new LGraph()

    graph.configure({
      ...new LGraph().asSerialisable(),
      definitions: {
        subgraphs: [
          {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            name: 'poisoned',
            version: 1,
            revision: 0,
            state: {
              lastGroupId: 0,
              lastLinkId: toLinkId(POISONED),
              lastNodeId: POISONED,
              lastRerouteId: toRerouteId(0)
            },
            nodes: [],
            links: [],
            groups: [],
            inputNode: { id: SUBGRAPH_INPUT_ID, bounding: [0, 0, 100, 100] },
            outputNode: { id: SUBGRAPH_OUTPUT_ID, bounding: [0, 0, 100, 100] },
            inputs: [],
            outputs: [],
            widgets: []
          }
        ]
      }
    })

    expect(Number(mintNodeId(graph.state))).toBeLessThan(MINT_ID_MIN)
    expect(Number(mintLinkId(graph.state))).toBeLessThan(MINT_ID_MIN)
    // Subgraph.state aliases the root state (the getter returns
    // _rootGraph.state), so these run the same guard through the
    // subgraph-definition restore path.
    for (const subgraph of graph.subgraphs.values()) {
      expect(Number(mintNodeId(subgraph.state))).toBeLessThan(MINT_ID_MIN)
      expect(Number(mintLinkId(subgraph.state))).toBeLessThan(MINT_ID_MIN)
    }
  })

  it('the deprecated counter setters ignore mint-range writes but still lower', () => {
    const graph = new LGraph()
    graph.last_node_id = 10
    graph.last_link_id = toLinkId(10)

    graph.last_node_id = POISONED
    graph.last_link_id = toLinkId(POISONED)

    // The poisoned write is dropped outright; the next allocation stays
    // out of the mint range.
    expect(Number(mintNodeId(graph.state))).toBeLessThan(MINT_ID_MIN)
    expect(Number(mintLinkId(graph.state))).toBeLessThan(MINT_ID_MIN)

    // Lowering is an assignment, not an observation - it must still work.
    graph.last_node_id = 5
    graph.last_link_id = toLinkId(5)
    expect(graph.state.lastNodeId).toBe(5)
    expect(Number(graph.state.lastLinkId)).toBe(5)
  })
})
