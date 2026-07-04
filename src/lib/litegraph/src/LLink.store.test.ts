import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'
import { toLinkId } from '@/types/linkId'
import { UNASSIGNED_NODE_ID } from '@/types/nodeId'

import { registerLinkTopology } from './LLink'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from './subgraph/__fixtures__/subgraphHelpers'

describe('LLink ↔ linkStore integration', () => {
  beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

  it('connect registers, disconnect removes', () => {
    const graph = new LGraph()
    const a = new LGraphNode('A')
    const b = new LGraphNode('B')
    a.addOutput('out', 'INT')
    b.addInput('in', 'INT')
    graph.add(a)
    graph.add(b)

    const link = a.connect(0, b, 0)!
    const store = useLinkStore()
    expect(store.isInputSlotConnected(graph.rootGraph.id, b.id, 0)).toBe(true)

    graph.removeLink(link.id)
    expect(store.isInputSlotConnected(graph.rootGraph.id, b.id, 0)).toBe(false)
  })

  it('keeps writing to a disconnected link after it leaves the store', () => {
    const graph = new LGraph()
    const a = new LGraphNode('A')
    const b = new LGraphNode('B')
    a.addOutput('out', 'INT')
    b.addInput('in0', 'INT')
    b.addInput('in1', 'INT')
    graph.add(a)
    graph.add(b)

    const link = a.connect(0, b, 0)!
    graph.removeLink(link.id)

    expect(() => {
      link.target_slot = 3
    }).not.toThrow()
    expect(link.target_slot).toBe(3)
  })

  it('keeps the winner registered when a colliding loser link disconnects', () => {
    const graph = new LGraph()
    const a = new LGraphNode('A')
    const b = new LGraphNode('B')
    a.addOutput('out', 'INT')
    b.addInput('in', 'INT')
    graph.add(a)
    graph.add(b)

    const winner = a.connect(0, b, 0)!
    const loser = new LLink(winner.id, 'INT', a.id, 0, b.id, 0)
    registerLinkTopology(graph, loser)

    loser.disconnect(graph)

    const store = useLinkStore()
    const graphId = graph.rootGraph.id
    expect(store.getLink(graphId, winner.id)).toBeDefined()
    expect(store.isInputSlotConnected(graphId, b.id, 0)).toBe(true)
  })

  it('unregisters a subgraph definition’s links when its last instance is removed', () => {
    const subgraph = createTestSubgraph({ nodeCount: 2 })
    const [first, second] = subgraph.nodes
    const innerLink = first.connect(0, second, 0)!
    const rootGraph = subgraph.rootGraph
    const subgraphNode = createTestSubgraphNode(subgraph)
    rootGraph.add(subgraphNode)

    const store = useLinkStore()
    expect(store.getLink(rootGraph.id, innerLink.id)).toBeDefined()

    rootGraph.remove(subgraphNode)

    expect(store.getLink(rootGraph.id, innerLink.id)).toBeUndefined()
  })

  it('keeps a subgraph definition’s links registered while other instances remain', () => {
    const subgraph = createTestSubgraph({ nodeCount: 2 })
    const [first, second] = subgraph.nodes
    const innerLink = first.connect(0, second, 0)!
    const rootGraph = subgraph.rootGraph
    const keptInstance = createTestSubgraphNode(subgraph)
    const removedInstance = createTestSubgraphNode(subgraph, { id: 99 })
    rootGraph.add(keptInstance)
    rootGraph.add(removedInstance)

    rootGraph.remove(removedInstance)

    const store = useLinkStore()
    expect(store.getLink(rootGraph.id, innerLink.id)).toBeDefined()
  })

  it('clearing a subgraph unregisters its links but keeps root links', () => {
    const subgraph = createTestSubgraph({ nodeCount: 2 })
    const rootGraph = subgraph.rootGraph
    const [first, second] = subgraph.nodes
    const innerLink = first.connect(0, second, 0)!

    const a = new LGraphNode('A')
    const b = new LGraphNode('B')
    a.addOutput('out', '*')
    b.addInput('in', '*')
    rootGraph.add(a)
    rootGraph.add(b)
    const rootLink = a.connect(0, b, 0)!

    subgraph.clear()

    const store = useLinkStore()
    expect(store.getLink(rootGraph.id, innerLink.id)).toBeUndefined()
    expect(store.getLink(rootGraph.id, rootLink.id)).toBeDefined()
  })

  it('clear() unregisters an unconfigured graph’s links from the store', () => {
    const graph = new LGraph()
    const a = new LGraphNode('A')
    const b = new LGraphNode('B')
    a.addOutput('out', 'INT')
    b.addInput('in', 'INT')
    graph.add(a)
    graph.add(b)
    const link = a.connect(0, b, 0)!
    const graphId = graph.rootGraph.id

    graph.clear()

    const store = useLinkStore()
    expect(store.getLink(graphId, link.id)).toBeUndefined()
  })

  it('detaches a floating link from the store when it is removed', () => {
    const graph = new LGraph()
    const a = new LGraphNode('A')
    a.addOutput('out', '*')
    graph.add(a)

    const floating = new LLink(
      toLinkId(7),
      '*',
      a.id,
      0,
      UNASSIGNED_NODE_ID,
      -1
    )
    graph.addFloatingLink(floating)
    const graphId = graph.rootGraph.id
    const store = useLinkStore()
    expect(store.getLink(graphId, floating.id)).toBeDefined()

    graph.removeFloatingLink(floating)

    expect(store.getLink(graphId, floating.id)).toBeUndefined()
    floating.origin_slot = 5
    expect(floating.origin_slot).toBe(5)
  })

  it('moving a link via target_slot reindexes the store', () => {
    const graph = new LGraph()
    const a = new LGraphNode('A')
    const b = new LGraphNode('B')
    a.addOutput('out', 'INT')
    b.addInput('in0', 'INT')
    b.addInput('in1', 'INT')
    graph.add(a)
    graph.add(b)

    const link = a.connect(0, b, 0)!
    const store = useLinkStore()
    const nodeId = b.id
    expect(store.isInputSlotConnected(graph.rootGraph.id, nodeId, 0)).toBe(true)

    link.target_slot = 1

    expect(store.isInputSlotConnected(graph.rootGraph.id, nodeId, 0)).toBe(
      false
    )
    expect(store.isInputSlotConnected(graph.rootGraph.id, nodeId, 1)).toBe(true)
  })
})
