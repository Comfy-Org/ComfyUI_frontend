import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toRaw } from 'vue'

import { setAssertReporter } from '@/base/assert'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import { NodeInputSlot } from '@/lib/litegraph/src/node/NodeInputSlot'
import { createInputSlotView } from '@/lib/litegraph/src/node/slotDescriptorView'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import { createUuidv4, zeroUuid } from '@/utils/uuid'

import {
  adoptRegisteredNodeState,
  createNodeShellState,
  unregisterNodeState
} from './nodeShellState'

describe('node shell state', () => {
  function addNodeToSubgraph() {
    const subgraph = createTestSubgraph()
    const node = new LGraphNode('Node')
    subgraph.add(node)
    return { subgraph, node }
  }

  /** The states the store holds for a subgraph, within its root graph's bucket. */
  function statesIn(subgraph: Subgraph): NodeState[] {
    return useNodeDataStore().getGraphNodesFor(
      subgraph.rootGraph.id,
      subgraph.id
    )
  }

  it('starts unregistered and unowned', () => {
    const node = new LGraphNode('Node')
    const state = createNodeShellState(
      node,
      createInputSlotView,
      'Node',
      'some/type',
      undefined
    )

    expect(state.id).toBe(UNASSIGNED_NODE_ID)
    expect(state.graphId).toBe(zeroUuid)
    expect(state.title).toBe('Node')
  })

  it('falls back to a placeholder title and an empty type', () => {
    const node = new LGraphNode('Node')
    const state = createNodeShellState(
      node,
      createInputSlotView,
      '',
      undefined,
      undefined
    )

    expect(state.title).toBe('Unnamed')
    expect(state.type).toBe('')
  })

  it('rehydrates plain input-slot writes for any NodeState producer, not just the LGraphNode constructor', () => {
    const node = new LGraphNode('Node')
    const state = createNodeShellState(
      node,
      createInputSlotView,
      'Node',
      'some/type',
      undefined
    )

    state.inputs.push({
      name: 'in',
      type: 'INT',
      link: null,
      boundingRect: new Float64Array(4)
    })

    expect(state.inputs[0]).toBeInstanceOf(NodeInputSlot)
  })

  it('buckets by root graph and partitions by owning graph', () => {
    const { subgraph, node } = addNodeToSubgraph()
    const rootId = subgraph.rootGraph.id

    expect(rootId).not.toBe(subgraph.id)
    expect(node._graphScope).toEqual(graphScopeOf(subgraph))
    expect(node._state.graphId).toBe(subgraph.id)

    const [registered] = statesIn(subgraph)
    expect(toRaw(node._state)).toBe(toRaw(registered))
    expect(useNodeDataStore().getGraphNodesFor(rootId, rootId)).toEqual([])
  })

  it('vacates its store entry on remove', () => {
    const { subgraph, node } = addNodeToSubgraph()

    subgraph.remove(node)

    expect(statesIn(subgraph)).toEqual([])
    expect(node._graphScope).toBeUndefined()
  })

  it('adopts a registered successor without replacing its canonical state', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Node')
    graph.add(node)
    const scope = graphScopeOf(graph)
    const store = useNodeDataStore()
    const previous = node._state
    const successor = { ...previous, title: 'Successor' }
    expect(store.deleteNode(scope, previous)).toBe(true)
    const registered = store.registerNode(scope, successor)
    if (!registered) throw new Error('successor registration failed')

    expect(adoptRegisteredNodeState(graph, node, registered)).toBe(true)
    expect(node._state).toBe(registered)
    expect(node.title).toBe('Successor')
    expect(store.ownsNode(scope, node._state)).toBe(true)
  })

  it('refuses a successor registered under a different id', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Node')
    graph.add(node)
    const other = new LGraphNode('Other')
    graph.add(other)
    const scope = graphScopeOf(graph)
    const priorState = node._state
    const priorScope = node._graphScope

    expect(other._state.id).not.toBe(node._state.id)
    expect(adoptRegisteredNodeState(graph, node, other._state)).toBe(false)
    expect(node._state).toBe(priorState)
    expect(node._graphScope).toBe(priorScope)
    expect(useNodeDataStore().ownsNode(scope, node._state)).toBe(true)
  })

  it('refuses a successor the store does not own', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Node')
    graph.add(node)
    const scope = graphScopeOf(graph)
    const priorState = node._state
    const priorScope = node._graphScope
    const unregistered = { ...priorState, title: 'Successor' }

    expect(useNodeDataStore().ownsNode(scope, unregistered)).toBe(false)
    expect(adoptRegisteredNodeState(graph, node, unregistered)).toBe(false)
    expect(node._state).toBe(priorState)
    expect(node._graphScope).toBe(priorScope)
  })
})

describe('node registration invariants', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', true)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('refuses to register a node under a second root graph', () => {
    const first = new LGraph()
    const second = new LGraph()
    second.id = createUuidv4()
    const node = new LGraphNode('Node')
    first.add(node)

    expect(() => second.add(node)).toThrow(/different root graph/)
    expect(node._graphScope).toBeUndefined()
    expect(useNodeDataStore().getGraphNodesFor(first.id, first.id)).toEqual([])
  })

  it('drops the previous root entry rather than stranding it', () => {
    vi.stubEnv('DEV', false)
    const reporter = vi.fn()
    setAssertReporter(reporter)
    const first = new LGraph()
    first.id = createUuidv4()
    const second = new LGraph()
    second.id = createUuidv4()
    const node = new LGraphNode('Node')
    first.add(node)

    second.add(node)

    const store = useNodeDataStore()
    const owningGraphId = node._state.graphId
    expect(store.getGraphNodesFor(first.id, owningGraphId)).toEqual([])
    expect(store.getGraphNodesFor(second.id, owningGraphId)).toHaveLength(1)
    expect(reporter).toHaveBeenCalledWith(
      expect.stringContaining('different root graph'),
      {
        nodeId: node.id,
        previousRootGraphId: first.id,
        nextRootGraphId: second.id
      }
    )
    setAssertReporter(null)
  })

  it('reports a state that drifted out of its bucket before unregistering', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Node')
    graph.add(node)
    node._state = createNodeShellState(
      node,
      createInputSlotView,
      'Node',
      'test',
      undefined
    )

    expect(() => unregisterNodeState(node)).toThrow(/identity drift/)
    expect(node._graphScope).toBeUndefined()
  })

  it('reports the drifted node and graph as structured context', () => {
    vi.stubEnv('DEV', false)
    const reporter = vi.fn()
    setAssertReporter(reporter)
    const graph = new LGraph()
    const node = new LGraphNode('Node')
    graph.add(node)
    node._state = createNodeShellState(
      node,
      createInputSlotView,
      'Node',
      'test',
      undefined
    )

    unregisterNodeState(node)

    expect(reporter).toHaveBeenCalledWith(
      expect.stringContaining('identity drift'),
      { nodeId: node.id, rootGraphId: graph.id }
    )
    setAssertReporter(null)
  })
})
