import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { assert, beforeEach, describe, expect, it } from 'vitest'
import { computed } from 'vue'

import { transferReplacementOwnership } from '@/core/graph/nodeShell/nodeShellState'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
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

  it('rejects the registered node identity from a sibling owner', () => {
    const store = useNodeDataStore()
    const registered = node(1)
    store.registerNode(graphScope(rootA, rootA), registered)

    expect(
      store.registerNode(graphScope(rootA, 'sub-1'), registered)
    ).toBeUndefined()
    expect(registered.graphId).toBe(rootA)
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

  it('discards a deleted node when its id is reused', () => {
    const store = useNodeDataStore()
    const scope = graphScope(rootA, rootA)
    const original = node(42)
    store.registerNode(scope, original)
    store.deleteNode(scope, original)

    const replacement = node(42)
    const registered = store.registerNode(scope, replacement)

    expect(registered?.id).toBe(toNodeId(42))
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

  function unknownNodeSerialization(
    node: LGraphNode,
    type = 'missing/Node'
  ): ISerialisedNode {
    return {
      ...node.serialize(),
      type,
      properties: { preserved: true },
      widgets_values: [42]
    }
  }

  it('owns unknown-node fallback through load, compatibility access, and removal', () => {
    const graph = new LGraph()
    const source = new LGraphNode('Missing')
    const fallback = unknownNodeSerialization(source)

    graph.configure({ ...graph.asSerialisable(), nodes: [fallback] })
    const loaded = graph.nodes[0]
    assert(loaded)
    const state = registeredState(graph, loaded)

    expect(loaded.last_serialization).toBe(state?.lastSerialization)
    expect(loaded.last_serialization).toMatchObject({
      type: 'missing/Node',
      widgets_values: [42]
    })

    graph.remove(loaded)
    expect(registeredState(graph, loaded)).toBeUndefined()
  })

  it('round-trips fallback data while live store fields remain authoritative', () => {
    const graph = new LGraph()
    const source = new LGraphNode('Missing')
    const fallback = unknownNodeSerialization(source)
    graph.configure({ ...graph.asSerialisable(), nodes: [fallback] })
    const loaded = graph.nodes[0]
    assert(loaded)

    loaded.pos = [300, 400]
    loaded.mode = 2
    assert(loaded.last_serialization)
    loaded.last_serialization = {
      ...loaded.last_serialization,
      pos: [1, 2],
      mode: 1
    }

    expect(loaded.serialize()).toEqual({
      ...fallback,
      pos: [300, 400],
      mode: 2
    })
    const serialized = structuredClone(graph.asSerialisable())
    graph.clear()
    expect(new LGraph(serialized).nodes[0]?.serialize()).toEqual({
      ...fallback,
      pos: [300, 400],
      mode: 2
    })
  })

  it('leaves fallback discovery on the removed shell during replacement', () => {
    const graph = new LGraph()
    const original = new LGraphNode('Missing')
    graph.add(original)
    original.last_serialization = unknownNodeSerialization(original)
    const replacement = new LGraphNode('Replacement')
    replacement.id = original.id

    expect(transferReplacementOwnership(original, replacement)).toBe(true)
    expect(original.last_serialization?.type).toBe('missing/Node')
    expect(replacement.last_serialization).toBeUndefined()
    expect(
      registeredState(graph, replacement)?.lastSerialization
    ).toBeUndefined()
  })

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
  })

  it('moves registered state to a same-id replacement without changing store membership', () => {
    const graph = new LGraph()
    const original = new LGraphNode('original')
    original.color = '#123456'
    graph.add(original)
    const replacement = new LGraphNode('replacement')
    replacement.id = original.id
    const registered = registeredState(graph, original)
    assert(registered)

    expect(transferReplacementOwnership(original, replacement)).toBe(true)
    expect(replacement._state).toBe(registered)
    expect(replacement.title).toBe('replacement')
    expect(replacement.color).toBeUndefined()
    expect(registeredState(graph, replacement)).toBe(registered)
    expect(registered.graphId).toBe(graph.id)
    expect(original._graphScope).toBeUndefined()
    expect(original._state).not.toBe(registered)

    original.title = 'detached'
    expect(replacement.title).toBe('replacement')
  })

  it('transfers the latest store geometry to the replacement', () => {
    const graph = new LGraph()
    const original = new LGraphNode('original')
    graph.add(original)
    const replacement = new LGraphNode('replacement')
    replacement.id = original.id
    replacement.pos = [...original.pos]
    replacement.size = [...original.size]

    original.pos = [300, 400]
    original.size = [220, 160]

    expect(transferReplacementOwnership(original, replacement)).toBe(true)
    expect([...replacement.pos]).toEqual([300, 400])
    expect([...replacement.size]).toEqual([220, 160])
  })

  it('keeps ownership unchanged when replacement identity does not match', () => {
    const graph = new LGraph()
    const original = new LGraphNode('original')
    graph.add(original)
    const replacement = new LGraphNode('replacement')
    const registered = registeredState(graph, original)

    expect(transferReplacementOwnership(original, replacement)).toBe(false)
    expect(registeredState(graph, original)).toBe(registered)
    expect(original._graphScope).toBeDefined()
    expect(replacement._graphScope).toBeUndefined()
  })

  it('drops the registration when the node is removed', () => {
    const graph = new LGraph()
    const lgraphNode = new LGraphNode('test')
    graph.add(lgraphNode)

    graph.remove(lgraphNode)

    expect(registeredState(graph, lgraphNode)).toBeUndefined()
  })
})
