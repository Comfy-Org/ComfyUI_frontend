import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { SUBGRAPH_OUTPUT_ID } from '@/lib/litegraph/src/constants'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import type { LinkTopology } from '@/types/linkTopology'
import { toNodeId, UNASSIGNED_NODE_ID } from '@/types/nodeId'

import { useLinkStore } from './linkStore'

const graphA = {
  rootGraphId: toRootGraphId('graph-a'),
  owningGraphId: toOwningGraphId('graph-a')
}
const graphB = {
  rootGraphId: toRootGraphId('graph-b'),
  owningGraphId: toOwningGraphId('graph-b')
}
const graphASibling = {
  rootGraphId: graphA.rootGraphId,
  owningGraphId: toOwningGraphId('graph-a-sibling')
}

function link(
  id: number,
  originNode: number,
  originSlot: number,
  targetNode: number,
  targetSlot: number
): LinkTopology {
  return {
    id: toLinkId(id),
    graphId: graphA.owningGraphId,
    originNodeId: toNodeId(originNode),
    originSlot,
    targetNodeId: toNodeId(targetNode),
    targetSlot,
    type: 'INT'
  }
}

describe('useLinkStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('keeps the first registration for a contested target slot', () => {
    const store = useLinkStore()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    store.registerLink(graphA, link(1, 5, 0, 9, 2))
    const rejected = { ...link(2, 5, 0, 9, 2), graphId: graphB.owningGraphId }

    expect(store.registerLink(graphA, rejected)).toBeUndefined()

    expect(store.getInputSlotLink(graphA, toNodeId(9), 2)?.id).toBe(toLinkId(1))
    expect(rejected.graphId).toBe(graphB.owningGraphId)
    expect(consoleError).toHaveBeenCalledOnce()
  })

  it('queries and protects a subgraph-output target slot', () => {
    const store = useLinkStore()
    const first = link(1, 5, 0, Number(SUBGRAPH_OUTPUT_ID), 0)
    const second = link(2, 7, 0, Number(SUBGRAPH_OUTPUT_ID), 0)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(store.registerLink(graphA, first)).toBeDefined()
    expect(store.registerLink(graphA, second)).toBeUndefined()
    expect(store.getInputSlotLink(graphA, SUBGRAPH_OUTPUT_ID, 0)?.id).toBe(
      toLinkId(1)
    )
  })

  it('only the registered link can vacate its slot', () => {
    const store = useLinkStore()
    const registered = link(1, 5, 0, 9, 2)
    const loser = link(2, 5, 0, 9, 2)
    store.registerLink(graphA, registered)
    store.registerLink(graphA, loser)

    expect(store.deleteLink(graphA, loser)).toBe(false)
    expect(store.isInputSlotConnected(graphA, toNodeId(9), 2)).toBe(true)

    expect(store.deleteLink(graphA, registered)).toBe(true)
    expect(store.isInputSlotConnected(graphA, toNodeId(9), 2)).toBe(false)
  })

  it('does not delete a link through a sibling owner scope', () => {
    const store = useLinkStore()
    const topology = link(1, 5, 0, 9, 2)
    const registered = store.registerLink(graphA, topology)

    expect(store.deleteLink(graphASibling, topology)).toBe(false)
    expect(store.getInputSlotLink(graphA, toNodeId(9), 2)).toBe(registered)
    expect([...store.getOutputSlotLinks(graphA, toNodeId(5), 0)]).toEqual([
      topology
    ])
  })

  it('rejects the registered link identity from a sibling owner', () => {
    const store = useLinkStore()
    const topology = link(1, 5, 0, 9, 2)
    const registered = store.registerLink(graphA, topology)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(store.registerLink(graphASibling, topology)).toBeUndefined()
    expect(topology.graphId).toBe(graphA.owningGraphId)
    expect([...store.graphTopologies(graphASibling)]).toEqual([])
    expect(store.getInputSlotLink(graphA, toNodeId(9), 2)).toBe(registered)
  })

  it('reuses a deleted link id for a replacement link', () => {
    const store = useLinkStore()
    const topology = link(1, 5, 0, 9, 2)
    const current = computed(() => [...store.graphTopologies(graphA)][0])
    store.registerLink(graphA, topology)
    expect(current.value).toBeDefined()

    store.deleteLink(graphA, topology)
    expect(current.value).toBeUndefined()

    const replacement = link(1, 7, 0, 8, 1)
    const registered = store.registerLink(graphA, replacement)
    expect(registered).toBeDefined()
    expect(current.value).toBe(registered)
  })

  it('atomically replaces the expected target occupant', () => {
    const store = useLinkStore()
    const incumbent = link(1, 5, 0, 9, 2)
    const registeredIncumbent = store.registerLink(graphA, incumbent)
    const replacement = link(2, 7, 0, 9, 2)

    const registered = store.replaceLink(
      graphA,
      registeredIncumbent,
      replacement
    )

    expect(registered?.id).toBe(toLinkId(2))
    expect(store.getTopology(graphA.rootGraphId, toLinkId(1))).toBeUndefined()
    expect(store.getInputSlotLink(graphA, toNodeId(9), 2)).toBe(registered)
    expect([...store.getOutputSlotLinks(graphA, toNodeId(5), 0)]).toEqual([])
    expect([...store.getOutputSlotLinks(graphA, toNodeId(7), 0)]).toEqual([
      replacement
    ])
  })

  it('does not replace a target through a stale incumbent', () => {
    const store = useLinkStore()
    const incumbent = link(1, 5, 0, 9, 2)
    const registeredIncumbent = store.registerLink(graphA, incumbent)
    const stale = link(1, 5, 0, 9, 2)
    const replacement = link(2, 7, 0, 9, 2)

    expect(store.replaceLink(graphA, stale, replacement)).toBeUndefined()
    expect(store.getInputSlotLink(graphA, toNodeId(9), 2)).toBe(
      registeredIncumbent
    )
    expect(store.getTopology(graphA.rootGraphId, toLinkId(2))).toBeUndefined()
  })

  it('does not displace a target when the replacement id is taken', () => {
    const store = useLinkStore()
    const incumbent = link(1, 5, 0, 9, 2)
    const registeredIncumbent = store.registerLink(graphA, incumbent)
    const idIncumbent = link(2, 7, 0, 8, 1)
    store.registerLink(graphA, idIncumbent)
    const replacement = link(2, 7, 1, 9, 2)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(
      store.replaceLink(graphA, registeredIncumbent, replacement)
    ).toBeUndefined()
    expect(store.getInputSlotLink(graphA, toNodeId(9), 2)).toBe(
      registeredIncumbent
    )
    expect(store.getInputSlotLink(graphA, toNodeId(8), 1)?.id).toBe(toLinkId(2))
  })

  it('never answers target queries from floating links', () => {
    const store = useLinkStore()
    const inputFloating: LinkTopology = {
      ...link(1, 5, 0, 9, 2),
      originNodeId: UNASSIGNED_NODE_ID,
      originSlot: -1
    }
    expect(store.registerLink(graphA, inputFloating)).toBeDefined()

    expect(store.isInputSlotConnected(graphA, toNodeId(9), 2)).toBe(false)

    const real = link(2, 5, 0, 9, 2)
    expect(store.registerLink(graphA, real)).toBeDefined()
    expect(store.getInputSlotLink(graphA, toNodeId(9), 2)?.id).toBe(toLinkId(2))

    expect(store.deleteLink(graphA, inputFloating)).toBe(true)
    expect(store.isInputSlotConnected(graphA, toNodeId(9), 2)).toBe(true)
  })

  it('rejects duplicate link IDs across sibling subgraphs', () => {
    const store = useLinkStore()
    const first = link(1, 5, 0, Number(SUBGRAPH_OUTPUT_ID), 0)
    const second = link(1, 7, 0, Number(SUBGRAPH_OUTPUT_ID), 0)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(store.registerLink(graphA, first)).toBeDefined()
    expect(store.registerLink(graphASibling, second)).toBeUndefined()

    expect(store.deleteLink(graphA, first)).toBe(true)
    expect(store.deleteLink(graphASibling, second)).toBe(false)
  })

  it('re-evaluates connectedness when a graph gains its first link', () => {
    const store = useLinkStore()
    const connected = computed(() =>
      store.isInputSlotConnected(graphA, toNodeId(9), 2)
    )
    expect(connected.value).toBe(false)

    const topology = link(1, 5, 0, 9, 2)
    store.registerLink(graphA, topology)
    expect(connected.value).toBe(true)
    expect(store.getInputSlotLink(graphA, toNodeId(9), 2)?.id).toBe(topology.id)

    store.deleteLink(graphA, topology)
    expect(connected.value).toBe(false)
  })

  it('re-evaluates connectedness when an existing bucket gains a new target key', () => {
    const store = useLinkStore()
    store.registerLink(graphA, link(1, 5, 0, 9, 2))
    const connected = computed(() =>
      store.isInputSlotConnected(graphA, toNodeId(9), 3)
    )
    expect(connected.value).toBe(false)

    store.registerLink(graphA, link(2, 5, 1, 9, 3))
    expect(connected.value).toBe(true)
  })

  it('scopes by graph and does not clear on tab switch', () => {
    const store = useLinkStore()
    store.registerLink(graphA, link(1, 5, 0, 9, 2))
    store.registerLink(graphB, link(1, 5, 0, 9, 2))

    store.clearGraph(graphB.rootGraphId)

    expect(store.isInputSlotConnected(graphA, toNodeId(9), 2)).toBe(true)
    expect(store.isInputSlotConnected(graphB, toNodeId(9), 2)).toBe(false)
    expect(store.isOutputSlotConnected(graphA, toNodeId(5), 0)).toBe(true)
    expect(store.isOutputSlotConnected(graphB, toNodeId(5), 0)).toBe(false)
  })

  it('isolates links and slot indexes by owner', () => {
    const store = useLinkStore()
    const first = link(1, 5, 0, 9, 2)
    const sibling = link(2, 5, 0, 9, 2)

    const registeredFirst = store.registerLink(graphA, first)
    const registeredSibling = store.registerLink(graphASibling, sibling)
    expect(registeredFirst).toBeDefined()
    expect(registeredSibling).toBeDefined()
    expect([...store.graphTopologies(graphA)]).toEqual([first])
    expect([...store.graphTopologies(graphASibling)]).toEqual([sibling])

    store.clearOwner(graphA)

    expect([...store.graphTopologies(graphA)]).toEqual([])
    expect(store.isInputSlotConnected(graphA, toNodeId(9), 2)).toBe(false)
    expect(store.isOutputSlotConnected(graphA, toNodeId(5), 0)).toBe(false)
    expect([...store.graphTopologies(graphASibling)]).toEqual([
      registeredSibling
    ])

    store.clearGraph(graphA.rootGraphId)

    expect([...store.graphTopologies(graphASibling)]).toEqual([])
  })

  it('re-evaluates owner queries when the owner is cleared', () => {
    const store = useLinkStore()
    const registered = store.registerLink(graphA, link(1, 5, 0, 9, 2))
    const sibling = store.registerLink(graphASibling, link(2, 5, 0, 9, 2))
    const current = computed(() => [...store.graphTopologies(graphA)][0])
    const siblingCurrent = computed(
      () => [...store.graphTopologies(graphASibling)][0]
    )
    expect(current.value).toBe(registered)
    expect(siblingCurrent.value).toBe(sibling)

    store.clearOwner(graphA)

    expect(current.value).toBeUndefined()
    expect(siblingCurrent.value).toBe(sibling)
  })

  it('re-evaluates owner queries when the root graph is cleared', () => {
    const store = useLinkStore()
    const registered = store.registerLink(graphA, link(1, 5, 0, 9, 2))
    const current = computed(() => [...store.graphTopologies(graphA)][0])
    expect(current.value).toBe(registered)

    store.clearGraph(graphA.rootGraphId)

    expect(current.value).toBeUndefined()
  })

  it('returns every link fanning out of an output slot', () => {
    const store = useLinkStore()
    store.registerLink(graphA, link(1, 5, 0, 9, 2))
    store.registerLink(graphA, link(2, 5, 0, 8, 1))
    store.registerLink(graphA, link(3, 5, 0, 7, 0))

    const links = store.getOutputSlotLinks(graphA, toNodeId(5), 0)

    expect([...links].map((l) => l.id).sort((a, b) => a - b)).toEqual([
      toLinkId(1),
      toLinkId(2),
      toLinkId(3)
    ])
    expect(store.isOutputSlotConnected(graphA, toNodeId(5), 0)).toBe(true)
    expect(store.isOutputSlotConnected(graphA, toNodeId(5), 1)).toBe(false)
  })

  it('returns an empty set, never undefined, for an unconnected output', () => {
    const store = useLinkStore()

    const links = store.getOutputSlotLinks(graphA, toNodeId(5), 0)

    expect(links).toBeInstanceOf(Set)
    expect(links.size).toBe(0)
  })

  it('never returns floating links from output queries', () => {
    const store = useLinkStore()
    const outputFloating: LinkTopology = {
      ...link(1, 5, 0, 9, 2),
      targetNodeId: UNASSIGNED_NODE_ID,
      targetSlot: -1
    }
    expect(store.registerLink(graphA, outputFloating)).toBeDefined()

    expect(store.isOutputSlotConnected(graphA, toNodeId(5), 0)).toBe(false)
    expect(store.getOutputSlotLinks(graphA, toNodeId(5), 0).size).toBe(0)
  })

  it('leaves an unrelated output slot untouched when another slot changes', () => {
    const store = useLinkStore()
    store.registerLink(graphA, link(1, 5, 0, 9, 2))
    let evaluations = 0
    const connected = computed(() => {
      evaluations++
      return store.isOutputSlotConnected(graphA, toNodeId(5), 0)
    })
    expect(connected.value).toBe(true)
    expect(evaluations).toBe(1)

    store.registerLink(graphA, link(2, 7, 0, 8, 1))

    expect(connected.value).toBe(true)
    expect(evaluations).toBe(1)
  })

  it('re-keys the link when its endpoints move', () => {
    const store = useLinkStore()
    const topology = link(1, 5, 0, 9, 2)
    store.registerLink(graphA, topology)

    expect(
      store.updateEndpoint(graphA, topology, {
        originSlot: 3,
        targetSlot: 4
      })
    ).toBeDefined()

    expect(store.isInputSlotConnected(graphA, toNodeId(9), 2)).toBe(false)
    expect(store.getInputSlotLink(graphA, toNodeId(9), 4)?.id).toBe(toLinkId(1))
    expect(store.isOutputSlotConnected(graphA, toNodeId(5), 0)).toBe(false)
    expect([...store.getOutputSlotLinks(graphA, toNodeId(5), 3)]).toEqual([
      topology
    ])
  })

  it('ignores undefined endpoint patch values', () => {
    const store = useLinkStore()
    const topology = link(1, 5, 0, 9, 2)
    store.registerLink(graphA, topology)

    store.updateEndpoint(graphA, topology, {
      originNodeId: undefined,
      originSlot: undefined,
      targetNodeId: undefined,
      targetSlot: undefined
    })

    expect(topology).toMatchObject({
      originNodeId: toNodeId(5),
      originSlot: 0,
      targetNodeId: toNodeId(9),
      targetSlot: 2
    })
    expect(store.getInputSlotLink(graphA, toNodeId(9), 2)?.id).toBe(toLinkId(1))
  })

  it('rejects an occupied target without changing either link', () => {
    const store = useLinkStore()
    const incumbent = link(1, 5, 0, 9, 2)
    const mover = link(2, 5, 1, 9, 3)
    store.registerLink(graphA, incumbent)
    store.registerLink(graphA, mover)

    expect(store.updateEndpoint(graphA, mover, { targetSlot: 2 })).toEqual({
      ok: false,
      error: {
        code: 'occupied-target',
        message: 'Link target slot 9:2 is already occupied'
      }
    })

    expect(store.getInputSlotLink(graphA, toNodeId(9), 2)?.id).toBe(toLinkId(1))
    expect(store.getInputSlotLink(graphA, toNodeId(9), 3)?.id).toBe(toLinkId(2))
    expect(mover.targetSlot).toBe(3)
  })

  it('rejects an endpoint update through a sibling owner scope', () => {
    const store = useLinkStore()
    const topology = link(1, 5, 0, 9, 2)
    const registered = store.registerLink(graphA, topology)

    expect(
      store.updateEndpoint(graphASibling, topology, { targetSlot: 3 })
    ).toEqual({
      ok: false,
      error: {
        code: 'unowned-topology',
        message: 'Link 1 does not own its current placement'
      }
    })
    expect(topology.targetSlot).toBe(2)
    expect(store.getInputSlotLink(graphA, toNodeId(9), 2)).toBe(registered)
    expect(store.getInputSlotLink(graphA, toNodeId(9), 3)).toBeUndefined()
  })

  it.for([
    { name: 'pairwise swap', targets: [1, 0] },
    { name: 'three-slot rotation', targets: [1, 2, 0] }
  ])('keeps every link registered across a $name', ({ targets }) => {
    const store = useLinkStore()
    const topologies = targets.map((_, slot) =>
      link(slot + 1, 5, slot, 9, slot)
    )
    for (const topology of topologies) {
      store.registerLink(graphA, topology)
    }

    store.updateEndpoints(
      graphA,
      topologies.map((topology, slot) => ({
        topology,
        patch: { targetSlot: targets[slot] }
      }))
    )

    for (const targetSlot of targets) {
      const sourceSlot = targets.indexOf(targetSlot)
      expect(store.getInputSlotLink(graphA, toNodeId(9), targetSlot)?.id).toBe(
        toLinkId(sourceSlot + 1)
      )
    }
  })

  it('moves into a removed link target in one transaction', () => {
    const store = useLinkStore()
    const mover = link(1, 5, 0, 9, 0)
    const removed = link(2, 5, 1, 9, 1)
    store.registerLink(graphA, mover)
    store.registerLink(graphA, removed)

    expect(
      store.updateEndpoints(
        graphA,
        [{ topology: mover, patch: { targetSlot: 1 } }],
        [removed]
      )
    ).toEqual({ ok: true, value: [mover] })

    expect(store.getInputSlotLink(graphA, toNodeId(9), 0)).toBeUndefined()
    expect(store.getInputSlotLink(graphA, toNodeId(9), 1)?.id).toBe(toLinkId(1))
    expect([...store.graphTopologies(graphA)]).toEqual([mover])
  })

  it('rejects duplicate final targets without partial mutation', () => {
    const store = useLinkStore()
    const first = link(1, 5, 0, 9, 0)
    const second = link(2, 5, 1, 9, 1)
    store.registerLink(graphA, first)
    store.registerLink(graphA, second)

    expect(
      store.updateEndpoints(graphA, [
        { topology: first, patch: { targetSlot: 2 } },
        { topology: second, patch: { targetSlot: 2 } }
      ])
    ).toEqual({
      ok: false,
      error: {
        code: 'duplicate-target',
        message: 'Multiple links target input slot 9:2'
      }
    })

    expect(first.targetSlot).toBe(0)
    expect(second.targetSlot).toBe(1)
    expect(store.getInputSlotLink(graphA, toNodeId(9), 0)?.id).toBe(toLinkId(1))
    expect(store.getInputSlotLink(graphA, toNodeId(9), 1)?.id).toBe(toLinkId(2))
  })

  it('re-keys a floating link that gains a real origin', () => {
    const store = useLinkStore()
    const floating: LinkTopology = {
      ...link(1, 5, 0, 9, 2),
      originNodeId: UNASSIGNED_NODE_ID,
      originSlot: -1
    }
    store.registerLink(graphA, floating)

    expect(
      store.updateEndpoint(graphA, floating, {
        originNodeId: toNodeId(5),
        originSlot: 0
      })
    ).toBeDefined()

    expect([...store.getOutputSlotLinks(graphA, toNodeId(5), 0)]).toEqual([
      floating
    ])
  })
})
