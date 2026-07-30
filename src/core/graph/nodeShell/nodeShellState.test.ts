import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { toRaw } from 'vue'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { UNASSIGNED_NODE_ID, toNodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import { zeroUuid } from '@/utils/uuid'

import {
  createNodeShellState,
  registerNodeState,
  unregisterNodeState
} from './nodeShellState'

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
    expect(node._graphId).toBe(rootId)
    expect(node._state.graphId).toBe(subgraph.id)

    const [registered] = statesIn(subgraph)
    expect(toRaw(node._state)).toBe(toRaw(registered))
    expect(useNodeDataStore().getGraphNodesFor(rootId, rootId)).toEqual([])
  })

  it('vacates its store entry on remove', () => {
    const { subgraph, node } = addNodeToSubgraph()

    subgraph.remove(node)

    expect(statesIn(subgraph)).toEqual([])
    expect(node._graphId).toBeUndefined()
  })

  it('vacates its store entry after the node is renumbered', () => {
    const { subgraph, node } = addNodeToSubgraph()

    node.id = toNodeId(4242)
    unregisterNodeState(node)

    expect(statesIn(subgraph)).toEqual([])
    expect(node._graphId).toBeUndefined()
  })

  it('refuses to re-register a node under a second root graph', () => {
    const { node } = addNodeToSubgraph()
    const other = createTestSubgraph()

    expect(() => registerNodeState(other, node)).toThrow(
      /already registered under a different root graph/
    )
  })

  it('tolerates re-registration under the same root graph', () => {
    const { subgraph, node } = addNodeToSubgraph()

    expect(() => registerNodeState(subgraph, node)).not.toThrow()
    expect(statesIn(subgraph)).toHaveLength(1)
  })

  it('reports a state swapped out from under the registration', () => {
    const { node } = addNodeToSubgraph()

    node._state = { ...toRaw(node._state) }

    expect(() => unregisterNodeState(node)).toThrow(/identity drift/)
    expect(node._graphId).toBeUndefined()
  })
})
