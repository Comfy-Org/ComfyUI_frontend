import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { computed } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type { GraphScope } from '@/types/graphScopeId'
import type { NodeState } from '@/types/nodeState'
import { toNodeId } from '@/types/nodeId'
import { createNodeState } from '@/utils/__tests__/litegraphTestUtils'
import type { UUID } from '@/utils/uuid'

import { useNodeDataStore } from './nodeDataStore'

const rootA: UUID = 'root-a'

function node(id: number, graphId: UUID = rootA): NodeState {
  return createNodeState({ id: toNodeId(id), graphId, title: `Node ${id}` })
}

function graphScope(rootGraphId: UUID, owningGraphId: UUID): GraphScope {
  return {
    rootGraphId: toRootGraphId(rootGraphId),
    owningGraphId: toOwningGraphId(owningGraphId)
  }
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
    store.registerNode(graphScope(rootA, rootA), first)
    store.registerNode(graphScope(rootA, rootA), node(2))
    expect(ids.value).toEqual(['1', '2'])

    store.deleteNode(graphScope(rootA, rootA), first)
    expect(ids.value).toEqual(['2'])
  })

  it('isolates nodes by owning graph id', () => {
    const store = useNodeDataStore()
    const sub: UUID = 'sub-1'
    store.registerNode(graphScope(rootA, rootA), node(1, rootA))
    store.registerNode(graphScope(rootA, sub), node(2, sub))
    store.registerNode(graphScope(rootA, rootA), node(3, rootA))

    expect(store.getGraphNodesFor(rootA, rootA).map((n) => n.id)).toEqual([
      '1',
      '3'
    ])
    expect(store.getGraphNodesFor(rootA, sub).map((n) => n.id)).toEqual(['2'])
  })

  it('prunes an owner bucket after its last node is deleted', () => {
    const store = useNodeDataStore()
    const sub: UUID = 'sub-1'
    const rootNode = node(1, rootA)
    const subNode = node(2, sub)
    store.registerNode(graphScope(rootA, rootA), rootNode)
    store.registerNode(graphScope(rootA, sub), subNode)

    store.deleteNode(graphScope(rootA, sub), subNode)

    expect(store.getGraphNodesFor(rootA, sub)).toEqual([])
    expect(store.getGraphNodesFor(rootA, rootA)).toEqual([rootNode])
  })

  it('rejects a duplicate id without changing either registration', () => {
    const store = useNodeDataStore()
    const first = node(1)
    const duplicate = node(1, 'sub-1')

    const registered = store.registerNode(graphScope(rootA, rootA), first)
    const rejected = store.registerNode(graphScope(rootA, 'sub-1'), duplicate)

    expect(registered?.id).toBe(first.id)
    expect(rejected).toBeUndefined()
    expect(duplicate.graphId).toBe('sub-1')
    expect(store.getGraphNodesFor(rootA, rootA)).toEqual([registered])
    expect(store.getGraphNodesFor(rootA, 'sub-1')).toEqual([])
  })

  it('only deletes the registered identity from its owning graph', () => {
    const store = useNodeDataStore()
    const registered = node(1)
    const impostor = node(1)
    store.registerNode(graphScope(rootA, rootA), registered)

    expect(store.deleteNode(graphScope(rootA, 'sub-1'), registered)).toBe(false)
    expect(store.deleteNode(graphScope(rootA, rootA), impostor)).toBe(false)
    expect(store.getGraphNodesFor(rootA, rootA)).toEqual([registered])
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
