import * as fc from 'fast-check'
import { afterEach, describe, expect, it } from 'vitest'

import {
  createLGraphState,
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
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
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
})

describe('coordination-free (doc-bound) allocation', () => {
  afterEach(() => {
    setCoordinationFreeIds(false)
  })

  const MINT_ID_MIN = 2 ** 40

  it('two replicas seeded from one snapshot allocate disjoint node and link ids', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), (count) => {
        // Both replicas resume from the SAME snapshot counters - the exact
        // aliasing setup from the review finding.
        const replicaA = createLGraphState()
        const replicaB = createLGraphState()
        for (const state of [replicaA, replicaB]) {
          state.lastNodeId = 7
          state.lastLinkId = toLinkId(9)
        }
        setCoordinationFreeIds(true)

        const minted = [
          ...Array.from({ length: count }, () => String(mintNodeId(replicaA))),
          ...Array.from({ length: count }, () => String(mintNodeId(replicaB))),
          ...Array.from({ length: count }, () => String(mintLinkId(replicaA))),
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
  })

  it('unbound allocation stays byte-identical: counters untouched while armed, sequential after', () => {
    const state = createLGraphState()

    setCoordinationFreeIds(true)
    mintNodeId(state)
    mintLinkId(state)
    // Armed mints never advance the counters.
    expect(state.lastNodeId).toBe(0)
    expect(Number(state.lastLinkId)).toBe(0)

    setCoordinationFreeIds(false)
    // Exactly the unbound sequence - the same values the unarmed pin above
    // produces from a fresh state.
    expect([mintNodeId(state), mintNodeId(state)]).toEqual(['1', '2'])
    expect([mintLinkId(state), mintLinkId(state)]).toEqual([1, 2])
  })

  it('a minted id survives a serialize/configure round-trip', () => {
    setCoordinationFreeIds(true)
    const graph = new LGraph()
    const node = new LGraphNode('Test Node')
    graph.add(node)
    const minted = String(node.id)
    expect(Number(minted)).toBeGreaterThanOrEqual(MINT_ID_MIN)

    setCoordinationFreeIds(false)
    const reloaded = new LGraph()
    reloaded.configure(graph.serialize())

    expect(reloaded._nodes.map((candidate) => String(candidate.id))).toContain(
      minted
    )
  })
})
