import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useNodeDataStore } from '@/stores/nodeDataStore'
import { toNodeId } from '@/types/nodeId'

import type { NodeState } from '@/types/nodeState'

import { LGraphNode } from './litegraph'
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

  it('writes shell fields through to the store, reactively', () => {
    const { subgraph, node } = addNodeToSubgraph()

    const title = computed(() => statesIn(subgraph)[0]?.title)

    node.title = 'Renamed'
    expect(title.value).toBe('Renamed')
    expect(node.title).toBe('Renamed')

    node.flags.collapsed = true
    expect(statesIn(subgraph)[0]?.flags.collapsed).toBe(true)
  })

  it('keeps registered identity when configure carries stale values', () => {
    const { subgraph, node } = addNodeToSubgraph()
    const assignedId = node.id
    const assignedType = node.type

    node.configure({
      ...node.serialize(),
      id: 9999,
      type: 'replacement'
    })

    expect(node.id).toBe(assignedId)
    expect(node.type).toBe(assignedType)
    expect(statesIn(subgraph).map((s) => s.id)).toEqual([assignedId])
  })

  it('keeps registered identity assignments in store state', () => {
    const { node } = addNodeToSubgraph()
    const registeredState = node._state
    const registeredId = node.id
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    node.id = node.id
    node.id = toNodeId(9999)
    node.type = 'replacement'

    expect(node._state).toBe(registeredState)
    expect(node.id).toBe(registeredId)
    expect(node.type).toBe('replacement')
    expect(registeredState.type).toBe('replacement')
    expect(warn).toHaveBeenCalledWith(
      'LiteGraph: changing a node type after construction is deprecated'
    )
    expect(warn).toHaveBeenCalledTimes(2)
  })
})
