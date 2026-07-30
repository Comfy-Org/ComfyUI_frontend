import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { computed } from 'vue'

import { useNodeDataStore } from '@/stores/nodeDataStore'

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

  it('keeps the registration when configure carries a stale id', () => {
    const { subgraph, node } = addNodeToSubgraph()
    const assignedId = node.id

    node.configure({ ...node.serialize(), id: 9999 })

    expect(node.id).toBe(assignedId)
    expect(statesIn(subgraph).map((s) => s.id)).toEqual([assignedId])
  })
})
