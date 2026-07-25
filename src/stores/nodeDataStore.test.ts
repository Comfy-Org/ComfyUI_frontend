import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { computed, shallowReactive } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { toNodeId } from '@/types/nodeId'
import type { NodeSlotArrays, NodeState } from '@/types/nodeState'
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

function inputSlot(name: string): INodeInputSlot {
  return { name, type: 'MODEL' } as INodeInputSlot
}

function emptySlots(): NodeSlotArrays {
  return {
    inputs: shallowReactive<INodeInputSlot[]>([]),
    outputs: shallowReactive<INodeOutputSlot[]>([])
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
    const registered = store.registerNode(rootA, node(2))!

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

    expect(result).toBeUndefined() // refused
    expect(store.getNode(rootA, toNodeId(3))).toBe(first)
  })

  it('re-registering the same state is idempotent', () => {
    const store = useNodeDataStore()
    const registered = store.registerNode(rootA, node(4))!

    expect(store.registerNode(rootA, registered)).toBe(registered)
  })

  it('only lets the registered state vacate its key', () => {
    const store = useNodeDataStore()
    const registered = store.registerNode(rootA, node(5))!

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

  describe('slot arrays', () => {
    it('holds the arrays by reference, so later mutations are visible', () => {
      const store = useNodeDataStore()
      const slots = emptySlots()
      store.registerNodeSlots(rootA, toNodeId(1), slots)

      const inputs = computed(
        () => store.getNodeSlots(rootA, toNodeId(1))?.inputs.length
      )
      expect(inputs.value).toBe(0)

      slots.inputs.push(inputSlot('model'))

      expect(inputs.value).toBe(1)
      expect(store.getNodeSlots(rootA, toNodeId(1))?.inputs).toBe(slots.inputs)
    })

    it('keeps buckets separate per root graph', () => {
      const store = useNodeDataStore()
      store.registerNodeSlots(rootA, toNodeId(1), emptySlots())
      store.registerNodeSlots(rootB, toNodeId(1), emptySlots())

      store.deleteNodeSlots(rootA, toNodeId(1))

      expect(store.getNodeSlots(rootA, toNodeId(1))).toBeUndefined()
      expect(store.getNodeSlots(rootB, toNodeId(1))).toBeDefined()
    })

    it('drops slot arrays when the graph bucket is cleared', () => {
      const store = useNodeDataStore()
      store.registerNodeSlots(rootA, toNodeId(1), emptySlots())

      store.clearGraph(rootA)

      expect(store.getNodeSlots(rootA, toNodeId(1))).toBeUndefined()
    })
  })
})

describe('nodeDataStore slot registration via LGraph', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('exposes a node’s slots without resolving the node', () => {
    const graph = new LGraph()
    const lgraphNode = new LGraphNode('test')
    lgraphNode.addInput('model', 'MODEL')
    lgraphNode.addOutput('latent', 'LATENT')
    graph.add(lgraphNode)

    const slots = useNodeDataStore().getNodeSlots(graph.id, lgraphNode.id)

    expect(slots?.inputs.map((i) => i.name)).toEqual(['model'])
    expect(slots?.outputs.map((o) => o.name)).toEqual(['latent'])
  })

  it('reflects adds, reorders and removes without re-registration', () => {
    const graph = new LGraph()
    const lgraphNode = new LGraphNode('test')
    lgraphNode.addInput('first', 'INT')
    graph.add(lgraphNode)
    const slots = useNodeDataStore().getNodeSlots(graph.id, lgraphNode.id)

    lgraphNode.addInput('second', 'INT')
    lgraphNode.addInput('third', 'INT')
    expect(slots?.inputs.map((i) => i.name)).toEqual([
      'first',
      'second',
      'third'
    ])

    // A pure permutation — the case that rules out index-based keying.
    lgraphNode.inputs = [...lgraphNode.inputs].reverse()
    expect(slots?.inputs.map((i) => i.name)).toEqual([
      'third',
      'second',
      'first'
    ])

    lgraphNode.removeInput(1)
    expect(slots?.inputs.map((i) => i.name)).toEqual(['third', 'first'])
    expect(slots?.inputs).toBe(lgraphNode.inputs)
  })

  it('drops the slots when the node is removed', () => {
    const graph = new LGraph()
    const lgraphNode = new LGraphNode('test')
    graph.add(lgraphNode)

    graph.remove(lgraphNode)

    expect(
      useNodeDataStore().getNodeSlots(graph.id, lgraphNode.id)
    ).toBeUndefined()
  })
})
