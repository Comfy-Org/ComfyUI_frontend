import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { computed } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeState } from '@/types/nodeState'
import { toNodeId } from '@/types/nodeId'
import { createNodeState } from '@/utils/__tests__/litegraphTestUtils'
import type { UUID } from '@/utils/uuid'

import { useNodeDataStore } from './nodeDataStore'

const rootA: UUID = 'root-a'

function node(id: number, graphId: UUID = rootA): NodeState {
  return createNodeState({ id: toNodeId(id), graphId, title: `Node ${id}` })
}

describe('useNodeDataStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('re-runs consumers when membership changes', () => {
    const store = useNodeDataStore()
    const ids = computed(() =>
      store.getGraphNodesFor(rootA, rootA).map((n) => n.id)
    )
    expect(ids.value).toEqual([])

    const first = node(1)
    store.registerNode(rootA, first)
    store.registerNode(rootA, node(2))
    expect(ids.value).toEqual(['1', '2'])

    store.deleteNode(rootA, first)
    expect(ids.value).toEqual(['2'])
  })

  it('filters a root bucket by owning graph id', () => {
    const store = useNodeDataStore()
    const sub: UUID = 'sub-1'
    store.registerNode(rootA, node(1, rootA))
    store.registerNode(rootA, node(2, sub))
    store.registerNode(rootA, node(3, rootA))

    expect(store.getGraphNodesFor(rootA, rootA).map((n) => n.id)).toEqual([
      '1',
      '3'
    ])
    expect(store.getGraphNodesFor(rootA, sub).map((n) => n.id)).toEqual(['2'])
  })
})

describe('nodeDataStore registration via LGraph', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function registeredState(graph: LGraph, node: LGraphNode) {
    return useNodeDataStore()
      .getGraphNodesFor(graph.id, graph.id)
      .find((state) => state.id === node.id)
  }

  it('exposes a node’s slots without resolving the node', () => {
    const graph = new LGraph()
    const lgraphNode = new LGraphNode('test')
    lgraphNode.addInput('model', 'MODEL')
    lgraphNode.addOutput('latent', 'LATENT')
    graph.add(lgraphNode)

    const state = registeredState(graph, lgraphNode)

    expect(state?.inputs.map((i) => i.name)).toEqual(['model'])
    expect(state?.outputs.map((o) => o.name)).toEqual(['latent'])
  })

  it('reflects adds, reorders and removes without re-registration', () => {
    const graph = new LGraph()
    const lgraphNode = new LGraphNode('test')
    lgraphNode.addInput('first', 'INT')
    graph.add(lgraphNode)
    const state = registeredState(graph, lgraphNode)

    lgraphNode.addInput('second', 'INT')
    lgraphNode.addInput('third', 'INT')
    expect(state?.inputs.map((i) => i.name)).toEqual([
      'first',
      'second',
      'third'
    ])

    // A pure permutation — the case that rules out index-based keying.
    lgraphNode.inputs = [...lgraphNode.inputs].reverse()
    expect(state?.inputs.map((i) => i.name)).toEqual([
      'third',
      'second',
      'first'
    ])

    lgraphNode.removeInput(1)
    expect(state?.inputs.map((i) => i.name)).toEqual(['third', 'first'])
    expect(state?.inputs).toBe(lgraphNode.inputs)
  })

  it('drops the registration when the node is removed', () => {
    const graph = new LGraph()
    const lgraphNode = new LGraphNode('test')
    graph.add(lgraphNode)

    graph.remove(lgraphNode)

    expect(registeredState(graph, lgraphNode)).toBeUndefined()
  })
})
