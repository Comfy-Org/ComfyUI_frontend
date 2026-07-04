import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

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
    expect(store.registerLink(graphA, link(1, 5, 0, 9, 2))).toBe(true)
    expect(store.isInputSlotConnected(graphA, toNodeId(9), 2)).toBe(true)
    expect(store.isInputSlotConnected(graphA, toNodeId(9), 3)).toBe(false)
    expect(store.getInputSlotLink(graphA, toNodeId(9), 2)?.id).toBe(toLinkId(1))
  })

  it('re-keys the link when its target moves', () => {
    const store = useLinkStore()
    const topology = link(1, 5, 0, 9, 2)
    store.registerLink(graphA, topology)

    expect(store.updateEndpoint(graphA, topology, { targetSlot: 4 })).toBe(true)

    expect(store.isInputSlotConnected(graphA, toNodeId(9), 2)).toBe(false)
    expect(store.getInputSlotLink(graphA, toNodeId(9), 4)?.id).toBe(toLinkId(1))
  })

  it('keeps the first registration for a contested target slot', () => {
    const store = useLinkStore()
    store.registerLink(graphA, link(1, 5, 0, 9, 2))

    expect(store.registerLink(graphA, link(2, 5, 0, 9, 2))).toBe(false)

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

    expect(store.updateEndpoint(graphA, mover, { targetSlot: 2 })).toBe(false)

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
    expect(store.registerLink(graphA, inputFloating)).toBe(true)

    expect(store.isInputSlotConnected(graphA, toNodeId(9), 2)).toBe(false)

    const real = link(2, 5, 0, 9, 2)
    expect(store.registerLink(graphA, real)).toBe(true)
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
    ).toBe(true)

    expect(store.getInputSlotLink(graphA, toNodeId(9), 2)?.id).toBe(toLinkId(1))
  })

  it('lets sibling subgraphs register output-node links without clobbering', () => {
    const store = useLinkStore()
    const first = link(1, 5, 0, Number(SUBGRAPH_OUTPUT_ID), 0)
    const second = link(1, 7, 0, Number(SUBGRAPH_OUTPUT_ID), 0)

    expect(store.registerLink(graphA, first)).toBe(true)
    expect(store.registerLink(graphA, second)).toBe(true)

    expect(store.deleteLink(graphA, first)).toBe(true)
    expect(store.deleteLink(graphA, second)).toBe(true)
  })

  it('scopes by graph and does not clear on tab switch', () => {
    const store = useLinkStore()
    store.registerLink(graphA, link(1, 5, 0, 9, 2))
    store.registerLink(graphB, link(1, 5, 0, 9, 2))

    store.clearGraph(graphB)

    expect(store.isInputSlotConnected(graphA, toNodeId(9), 2)).toBe(true)
    expect(store.isInputSlotConnected(graphB, toNodeId(9), 2)).toBe(false)
  })
})
