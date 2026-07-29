import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { computed, toRaw } from 'vue'

import { useNodeDataStore } from '@/stores/nodeDataStore'
import { toNodeId } from '@/types/nodeId'

import type { NodeState } from '@/types/nodeState'

import { LGraphNode, registerNodeState, unregisterNodeState } from './litegraph'
import type { Subgraph } from './litegraph'
import { createTestSubgraph } from './subgraph/__fixtures__/subgraphHelpers'

describe('LGraphNode node-data adoption', () => {
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

  it('writes shell fields through to the store, reactively', () => {
    const { subgraph, node } = addNodeToSubgraph()

    const title = computed(() => statesIn(subgraph)[0]?.title)

    node.title = 'Renamed'
    expect(title.value).toBe('Renamed')
    expect(node.title).toBe('Renamed')

    node.flags.collapsed = true
    expect(statesIn(subgraph)[0]?.flags.collapsed).toBe(true)
  })

  it('vacates its store entry on remove', () => {
    const { subgraph, node } = addNodeToSubgraph()

    subgraph.remove(node)

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
  })

  it('vacates its store entry after the node is renumbered', () => {
    const { subgraph, node } = addNodeToSubgraph()

    node.id = toNodeId(4242)
    unregisterNodeState(node)

    expect(statesIn(subgraph)).toEqual([])
  })

  it('keeps the registration when configure carries a stale id', () => {
    const { subgraph, node } = addNodeToSubgraph()
    const assignedId = node.id

    node.configure({ ...node.serialize(), id: 9999 })

    expect(node.id).toBe(assignedId)
    expect(statesIn(subgraph).map((s) => s.id)).toEqual([assignedId])
  })
})
