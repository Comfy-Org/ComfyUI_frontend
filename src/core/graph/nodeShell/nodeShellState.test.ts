import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toRaw } from 'vue'

import { setAssertReporter } from '@/base/assert'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import { createUuidv4, zeroUuid } from '@/utils/uuid'

import { createNodeShellState, unregisterNodeState } from './nodeShellState'

describe('node shell state', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

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
    const state = createNodeShellState('Node', 'some/type', undefined)

    expect(state.id).toBe(UNASSIGNED_NODE_ID)
    expect(state.graphId).toBe(zeroUuid)
    expect(state.title).toBe('Node')
  })

  it('falls back to a placeholder title and an empty type', () => {
    const state = createNodeShellState('', undefined, undefined)

    expect(state.title).toBe('Unnamed')
    expect(state.type).toBe('')
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
})

describe('node registration invariants', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
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
    node._state = createNodeShellState('Node', 'test', undefined)

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
    node._state = createNodeShellState('Node', 'test', undefined)

    unregisterNodeState(node)

    expect(reporter).toHaveBeenCalledWith(
      expect.stringContaining('identity drift'),
      { nodeId: node.id, rootGraphId: graph.id }
    )
    setAssertReporter(null)
  })
})
