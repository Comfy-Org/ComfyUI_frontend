import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { computed } from 'vue'

import { SUBGRAPH_OUTPUT_ID } from '@/lib/litegraph/src/constants'
import { toLinkId } from '@/types/linkId'
import type { LinkTopology } from '@/types/linkTopology'
import { toNodeId, UNASSIGNED_NODE_ID } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

import { useLinkStore } from './linkStore'

const graphA: UUID = 'graph-a'
const graphB: UUID = 'graph-b'

function link(
  id: number,
  originNode: number,
  originSlot: number,
  targetNode: number,
  targetSlot: number
): LinkTopology {
  return {
    id: toLinkId(id),
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

  it('answers input-slot connectedness with one lookup', () => {
    const store = useLinkStore()
    expect(store.registerLink(graphA, link(1, 5, 0, 9, 2))).toBeDefined()
    expect(store.isInputSlotConnected(graphA, toNodeId(9), 2)).toBe(true)
    expect(store.isInputSlotConnected(graphA, toNodeId(9), 3)).toBe(false)
    expect(store.getInputSlotLink(graphA, toNodeId(9), 2)?.id).toBe(toLinkId(1))
  })

  it('re-keys the link when its target moves', () => {
    const store = useLinkStore()
    const topology = link(1, 5, 0, 9, 2)
    store.registerLink(graphA, topology)

    expect(
      store.updateEndpoint(graphA, topology, { targetSlot: 4 })
    ).toBeDefined()

    expect(store.isInputSlotConnected(graphA, toNodeId(9), 2)).toBe(false)
    expect(store.getInputSlotLink(graphA, toNodeId(9), 4)?.id).toBe(toLinkId(1))
  })

  it('keeps the first registration for a contested target slot', () => {
    const store = useLinkStore()
    store.registerLink(graphA, link(1, 5, 0, 9, 2))

    expect(store.registerLink(graphA, link(2, 5, 0, 9, 2))).toBeUndefined()

    expect(store.getInputSlotLink(graphA, toNodeId(9), 2)?.id).toBe(toLinkId(1))
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

  it('reports a lost placement when a target moves onto an occupied slot', () => {
    const store = useLinkStore()
    store.registerLink(graphA, link(1, 5, 0, 9, 2))
    const mover = link(2, 5, 1, 9, 3)
    store.registerLink(graphA, mover)

    expect(
      store.updateEndpoint(graphA, mover, { targetSlot: 2 })
    ).toBeUndefined()

    expect(store.getInputSlotLink(graphA, toNodeId(9), 2)?.id).toBe(toLinkId(1))
    expect(store.isInputSlotConnected(graphA, toNodeId(9), 3)).toBe(false)
    expect(mover.targetSlot).toBe(2)
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

    expect(store.getInputSlotLink(graphA, toNodeId(9), 2)?.id).toBe(toLinkId(1))
  })

  it('lets sibling subgraphs register output-node links without clobbering', () => {
    const store = useLinkStore()
    const first = link(1, 5, 0, Number(SUBGRAPH_OUTPUT_ID), 0)
    const second = link(1, 7, 0, Number(SUBGRAPH_OUTPUT_ID), 0)

    expect(store.registerLink(graphA, first)).toBeDefined()
    expect(store.registerLink(graphA, second)).toBeDefined()

    expect(store.deleteLink(graphA, first)).toBe(true)
    expect(store.deleteLink(graphA, second)).toBe(true)
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

    store.clearGraph(graphB)

    expect(store.isInputSlotConnected(graphA, toNodeId(9), 2)).toBe(true)
    expect(store.isInputSlotConnected(graphB, toNodeId(9), 2)).toBe(false)
  })

  it('reports an output slot connected only where a link leaves it', () => {
    const store = useLinkStore()
    store.registerLink(graphA, link(1, 5, 0, 9, 2))

    expect(store.isOutputSlotConnected(graphA, toNodeId(5), 0)).toBe(true)
    expect(store.isOutputSlotConnected(graphA, toNodeId(5), 1)).toBe(false)
  })

  it('returns every link fanning out of an output slot', () => {
    const store = useLinkStore()
    store.registerLink(graphA, link(1, 5, 0, 9, 2))
    store.registerLink(graphA, link(2, 5, 0, 8, 1))
    store.registerLink(graphA, link(3, 5, 0, 7, 0))

    const links = store.getOutputSlotLinks(graphA, toNodeId(5), 0)

    expect([...links].sort((a, b) => a - b)).toEqual([
      toLinkId(1),
      toLinkId(2),
      toLinkId(3)
    ])
  })

  it('returns an empty set, never undefined, for an unconnected output', () => {
    const store = useLinkStore()

    const links = store.getOutputSlotLinks(graphA, toNodeId(5), 0)

    expect(links).toBeInstanceOf(Set)
    expect(links.size).toBe(0)
  })

  it('reports an output connected when its target endpoint is floating', () => {
    const store = useLinkStore()
    const outputFloating: LinkTopology = {
      ...link(1, 5, 0, 9, 2),
      targetNodeId: UNASSIGNED_NODE_ID,
      targetSlot: -1
    }
    expect(store.registerLink(graphA, outputFloating)).toBeDefined()

    expect(store.isOutputSlotConnected(graphA, toNodeId(5), 0)).toBe(true)
    expect(store.getOutputSlotLinks(graphA, toNodeId(5), 0)).toContain(
      toLinkId(1)
    )
  })

  it('scopes output queries by graph', () => {
    const store = useLinkStore()
    store.registerLink(graphA, link(1, 5, 0, 9, 2))

    expect(store.isOutputSlotConnected(graphA, toNodeId(5), 0)).toBe(true)
    expect(store.isOutputSlotConnected(graphB, toNodeId(5), 0)).toBe(false)
  })

  it('re-derives the output index across register and delete', () => {
    const store = useLinkStore()
    const topology = link(1, 5, 0, 9, 2)

    expect(store.isOutputSlotConnected(graphA, toNodeId(5), 0)).toBe(false)

    store.registerLink(graphA, topology)
    expect(store.isOutputSlotConnected(graphA, toNodeId(5), 0)).toBe(true)

    store.deleteLink(graphA, topology)
    expect(store.isOutputSlotConnected(graphA, toNodeId(5), 0)).toBe(false)
  })
})
