import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { computed } from 'vue'

import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { toNodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import type { UUID } from '@/utils/uuid'

import { useNodeDataStore } from './nodeDataStore'

const rootA: UUID = 'root-a'
const rootB: UUID = 'root-b'

function node(id: number, graphId: UUID = rootA): NodeState {
  return {
    id: toNodeId(id),
    graphId,
    type: 'TestNode',
    title: `Node ${id}`,
    mode: LGraphEventMode.ALWAYS,
    flags: {}
  }
}

describe('useNodeDataStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('registers a node and answers queries for it', () => {
    const store = useNodeDataStore()
    store.registerNode(rootA, node(1))

    expect(store.getNode(rootA, toNodeId(1))?.title).toBe('Node 1')
    expect(store.getNode(rootA, toNodeId(2))).toBeUndefined()
  })

  it('returns tracked state whose writes are observable', () => {
    const store = useNodeDataStore()
    const registered = store.registerNode(rootA, node(2))

    const title = computed(() => store.getNode(rootA, toNodeId(2))?.title)
    expect(title.value).toBe('Node 2')

    registered.title = 'Renamed'
    expect(title.value).toBe('Renamed')
  })

  it('refuses to overwrite a live registration held by another state', () => {
    const store = useNodeDataStore()
    const first = store.registerNode(rootA, node(3))

    const usurper = node(3)
    const result = store.registerNode(rootA, usurper)

    expect(result).toBe(usurper) // refused: caller keeps its own state
    expect(store.getNode(rootA, toNodeId(3))).toBe(first)
  })

  it('re-registering the same state is idempotent', () => {
    const store = useNodeDataStore()
    const registered = store.registerNode(rootA, node(4))

    expect(store.registerNode(rootA, registered)).toBe(registered)
  })

  it('only lets the registered state vacate its key', () => {
    const store = useNodeDataStore()
    const registered = store.registerNode(rootA, node(5))

    expect(store.deleteNode(rootA, node(5))).toBe(false) // foreign state
    expect(store.getNode(rootA, toNodeId(5))).toBe(registered)

    expect(store.deleteNode(rootA, registered)).toBe(true)
    expect(store.getNode(rootA, toNodeId(5))).toBeUndefined()
  })

  it('filters a root bucket by owning graph id', () => {
    const store = useNodeDataStore()
    const sub: UUID = 'sub-1'
    store.registerNode(rootA, node(1, rootA))
    store.registerNode(rootA, node(2, sub))
    store.registerNode(rootA, node(3, rootA))

    const rootNodes = store.getGraphNodesFor(rootA, rootA)
    expect(rootNodes.map((n) => n.id).sort()).toEqual(['1', '3'])
    expect(store.getGraphNodesFor(rootA, sub).map((n) => n.id)).toEqual(['2'])
  })

  it('clears a graph bucket', () => {
    const store = useNodeDataStore()
    store.registerNode(rootA, node(1))
    store.registerNode(rootB, node(1))

    store.clearGraph(rootA)

    expect(store.getNode(rootA, toNodeId(1))).toBeUndefined()
    expect(store.getNode(rootB, toNodeId(1))?.title).toBe('Node 1')
  })
})
