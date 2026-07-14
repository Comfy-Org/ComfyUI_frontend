import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeBadgeStore } from '@/stores/nodeBadgeStore'

import {
  createTestSubgraphData,
  createTestSubgraphNode
} from './subgraph/__fixtures__/subgraphHelpers'

beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

describe('LGraph node badge registration', () => {
  it('registers a node in the root bucket on add, unregisters on remove', () => {
    const graph = new LGraph()
    const node = new LGraphNode('n')

    graph.add(node)
    expect(useNodeBadgeStore().registeredNodeIds(graph.rootGraph.id)).toEqual([
      node.id
    ])

    graph.remove(node)
    expect(useNodeBadgeStore().registeredNodeIds(graph.rootGraph.id)).toEqual(
      []
    )
  })

  it('clears the root bucket when the root graph is cleared', () => {
    const graph = new LGraph()
    graph.add(new LGraphNode('a'))
    graph.add(new LGraphNode('b'))
    const graphId = graph.rootGraph.id

    graph.clear()

    expect(useNodeBadgeStore().registeredNodeIds(graphId)).toEqual([])
  })

  it('registers subgraph nodes in the root bucket', () => {
    const rootGraph = new LGraph()
    const subgraph = rootGraph.createSubgraph(createTestSubgraphData())
    const inner = new LGraphNode('inner')

    subgraph.add(inner)

    expect(
      useNodeBadgeStore().registeredNodeIds(rootGraph.rootGraph.id)
    ).toContainEqual(inner.id)
  })

  it('unregisters nodes at every nesting depth when a subgraph is cleared', () => {
    const rootGraph = new LGraph()
    const keeper = new LGraphNode('keeper')
    rootGraph.add(keeper)

    const outer = rootGraph.createSubgraph(createTestSubgraphData())
    outer.add(new LGraphNode('direct'))
    const nested = rootGraph.createSubgraph(createTestSubgraphData())
    nested.add(new LGraphNode('deep'))
    outer.add(createTestSubgraphNode(nested, { parentGraph: outer }))

    outer.clear()

    expect(
      useNodeBadgeStore().registeredNodeIds(rootGraph.rootGraph.id)
    ).toEqual([keeper.id])
  })

  it('unregisters inner nodes when the subgraph definition is collected', () => {
    const rootGraph = new LGraph()
    const subgraph = rootGraph.createSubgraph(createTestSubgraphData())
    const inner = new LGraphNode('inner')
    subgraph.add(inner)
    const subgraphNode = createTestSubgraphNode(subgraph, { pos: [100, 100] })
    rootGraph.add(subgraphNode)

    rootGraph.remove(subgraphNode)

    expect(
      useNodeBadgeStore().registeredNodeIds(rootGraph.rootGraph.id)
    ).toEqual([])
  })
})
