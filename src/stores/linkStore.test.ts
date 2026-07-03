import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { toLinkId } from '@/types/linkId'
import type { LinkTopology } from '@/types/linkTopology'
import { toNodeId, UNASSIGNED_NODE_ID } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

import { useLinkStore } from './linkStore'

const graphA = 'graph-a' as UUID
const graphB = 'graph-b' as UUID

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

  it('registers and reads a link', () => {
    const store = useLinkStore()
    store.registerLink(graphA, link(1, 5, 0, 9, 2))
    expect(store.getLink(graphA, toLinkId(1))?.originNodeId).toBe(toNodeId(5))
  })

  it('answers input-slot connectedness in O(1)', () => {
    const store = useLinkStore()
    store.registerLink(graphA, link(1, 5, 0, 9, 2))
    expect(store.isInputSlotConnected(graphA, toNodeId(9), 2)).toBe(true)
    expect(store.isInputSlotConnected(graphA, toNodeId(9), 3)).toBe(false)
    expect(store.getInputSlotLink(graphA, toNodeId(9), 2)?.id).toBe(toLinkId(1))
  })

  it('tracks output-slot fan-out', () => {
    const store = useLinkStore()
    store.registerLink(graphA, link(1, 5, 0, 9, 0))
    store.registerLink(graphA, link(2, 5, 0, 10, 0))
    expect(
      store.getOutputSlotLinks(graphA, toNodeId(5), 0).map((l) => l.id)
    ).toEqual([toLinkId(1), toLinkId(2)])
  })

  it('returns all links touching a node from both ends', () => {
    const store = useLinkStore()
    store.registerLink(graphA, link(1, 5, 0, 9, 0)) // 9 as target
    store.registerLink(graphA, link(2, 9, 1, 10, 0)) // 9 as origin
    expect(
      store
        .getNodeLinks(graphA, toNodeId(9))
        .map((l) => l.id)
        .sort((a, b) => a - b)
    ).toEqual([toLinkId(1), toLinkId(2)])
  })

  it('reindexes on endpoint move', () => {
    const store = useLinkStore()
    store.registerLink(graphA, link(1, 5, 0, 9, 2))
    store.updateEndpoint(graphA, toLinkId(1), { targetSlot: 4 })
    expect(store.isInputSlotConnected(graphA, toNodeId(9), 2)).toBe(false)
    expect(store.isInputSlotConnected(graphA, toNodeId(9), 4)).toBe(true)
  })

  it('deletes a link from data and both indices', () => {
    const store = useLinkStore()
    store.registerLink(graphA, link(1, 5, 0, 9, 2))
    expect(store.deleteLink(graphA, toLinkId(1))).toBe(true)
    expect(store.getLink(graphA, toLinkId(1))).toBeUndefined()
    expect(store.isInputSlotConnected(graphA, toNodeId(9), 2)).toBe(false)
    expect(store.getOutputSlotLinks(graphA, toNodeId(5), 0)).toEqual([])
  })

  it('scopes by graph and does not clear on tab switch', () => {
    const store = useLinkStore()
    store.registerLink(graphA, link(1, 5, 0, 9, 2))
    store.registerLink(graphB, link(1, 5, 0, 9, 2))
    expect(store.getLink(graphA, toLinkId(1))).toBeDefined()
    expect(store.getLink(graphB, toLinkId(1))).toBeDefined()
    store.clearGraph(graphB)
    expect(store.getLink(graphA, toLinkId(1))).toBeDefined() // A survives
    expect(store.getLink(graphB, toLinkId(1))).toBeUndefined()
  })

  it('stores a floating link with UNASSIGNED_NODE_ID', () => {
    const store = useLinkStore()
    store.registerLink(graphA, {
      id: toLinkId(1),
      originNodeId: UNASSIGNED_NODE_ID,
      originSlot: -1,
      targetNodeId: toNodeId(9),
      targetSlot: 2,
      type: 'INT'
    })
    expect(store.isInputSlotConnected(graphA, toNodeId(9), 2)).toBe(true)
  })
})
