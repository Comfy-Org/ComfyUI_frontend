import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { LGraph, LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf, toOwningGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { UNASSIGNED_NODE_ID, toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'
import { NodeSlotType } from './types/globalEnums'

import { registerLinkTopology, resolveLinkTopology } from './LLink'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from './subgraph/__fixtures__/subgraphHelpers'

describe('LLink ↔ linkStore integration', () => {
  beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

  it('preserves the id and reactive state of a registered link', () => {
    const graph = new LGraph()
    const link = new LLink(
      toLinkId(1),
      '*',
      UNASSIGNED_NODE_ID,
      -1,
      UNASSIGNED_NODE_ID,
      -1
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    graph.addFloatingLink(link)
    const registeredState = link._state

    link.id = link.id
    link.id = toLinkId(2)

    expect(link.id).toBe(toLinkId(1))
    expect(link._state).toBe(registeredState)
    expect(graph.floatingLinks.get(toLinkId(1))).toBe(link)
  })

  it('reports a LinkMap key that does not match the link id', () => {
    const graph = new LGraph()
    const link = new LLink(
      toLinkId(1),
      '*',
      UNASSIGNED_NODE_ID,
      -1,
      UNASSIGNED_NODE_ID,
      -1
    )
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    graph.links.set(toLinkId(2), link)

    expect(error).toHaveBeenCalledWith(
      'LiteGraph: refusing to register link 1 under mismatched id 2'
    )
    expect(graph.links.size).toBe(0)
  })

  it('requires Pinia when constructing a root graph', () => {
    setActivePinia(undefined)

    expect(() => new LGraph()).toThrow()
  })

  it('does not add a link when topology registration is rejected', () => {
    const graph = new LGraph()
    const incumbent = new LLink(
      toLinkId(1),
      '*',
      toNodeId(1),
      0,
      toNodeId(2),
      0
    )
    const collision = new LLink(
      toLinkId(2),
      '*',
      toNodeId(3),
      0,
      toNodeId(2),
      0
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    useLinkStore().registerLink(graphScopeOf(graph), incumbent._state)

    graph._addLink(collision)

    expect(graph.links.has(collision.id)).toBe(false)
    expect(collision._graphScope).toBeUndefined()
  })

  it('does not finish connecting when topology registration is rejected', () => {
    const graph = new LGraph()
    const outputNode = new LGraphNode('output')
    const inputNode = new LGraphNode('input')
    outputNode.addOutput('out', '*')
    inputNode.addInput('in', '*')
    graph.add(outputNode)
    graph.add(inputNode)
    outputNode.onConnectionsChange = vi.fn()
    inputNode.onConnectionsChange = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    useLinkStore().registerLink(
      {
        ...graphScopeOf(graph),
        owningGraphId: toOwningGraphId('sibling')
      },
      new LLink(toLinkId(1), '*', toNodeId(10), 0, toNodeId(11), 0)._state
    )

    expect(outputNode.connect(0, inputNode, 0)).toBeNull()
    expect(outputNode.onConnectionsChange).not.toHaveBeenCalled()
    expect(inputNode.onConnectionsChange).not.toHaveBeenCalled()
  })

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
    expect(store.isInputSlotConnected(graphScopeOf(graph), b.id, 0)).toBe(true)

    graph.removeLink(link.id)
    expect(store.isInputSlotConnected(graphScopeOf(graph), b.id, 0)).toBe(false)
  })

  it('preserves extension-visible link fields on the link', () => {
    vi.stubGlobal('Path2D', class {})
    const graph = new LGraph()
    const link = new LLink(
      toLinkId(1),
      '*',
      UNASSIGNED_NODE_ID,
      -1,
      UNASSIGNED_NODE_ID,
      -1
    )
    graph.addFloatingLink(link)
    const path = new Path2D()

    link.data = 42
    link._data = { output: true }
    link._pos = [10, 20]
    link._last_time = 30
    link.path = path
    link._centreAngle = 0.5
    link._dragging = true
    link.color = ''

    expect(link).toMatchObject({
      data: 42,
      _data: { output: true },
      _pos: [10, 20],
      _last_time: 30,
      path,
      _centreAngle: 0.5,
      _dragging: true
    })
    expect(link.color).toBeNull()
  })

  it('commits a replacement before disconnect callbacks run', () => {
    const graph = new LGraph()
    const first = new LGraphNode('first')
    const replacement = new LGraphNode('replacement')
    const target = new LGraphNode('target')
    first.addOutput('out', 'INT')
    replacement.addOutput('out', 'INT')
    target.addInput('in', 'INT')
    graph.add(first)
    graph.add(replacement)
    graph.add(target)
    first.connect(0, target, 0)
    const observedOrigins: string[] = []
    target.onConnectionsChange = (side, _slot, connected) => {
      if (side !== NodeSlotType.INPUT || connected) return
      const topology = useLinkStore().getInputSlotLink(
        graphScopeOf(graph),
        target.id,
        0
      )
      if (topology) observedOrigins.push(String(topology.originNodeId))
    }

    const link = replacement.connect(0, target, 0)

    expect(link?.origin_id).toBe(replacement.id)
    expect(observedOrigins).toEqual([String(replacement.id)])
  })

  it('does not notify for a replacement displaced by a callback', () => {
    const graph = new LGraph()
    const first = new LGraphNode('first')
    const outer = new LGraphNode('outer')
    const nested = new LGraphNode('nested')
    const target = new LGraphNode('target')
    for (const node of [first, outer, nested]) node.addOutput('out', 'INT')
    target.addInput('in', 'INT')
    for (const node of [first, outer, nested, target]) graph.add(node)
    first.connect(0, target, 0)
    const outerConnectionChange = vi.fn()
    outer.onConnectionsChange = outerConnectionChange
    let replaced = false
    target.onConnectionsChange = (side, _slot, connected) => {
      if (side !== NodeSlotType.INPUT || connected || replaced) return
      replaced = true
      nested.connect(0, target, 0)
    }

    expect(outer.connect(0, target, 0)).toBeNull()

    expect(
      useLinkStore().getInputSlotLink(graphScopeOf(graph), target.id, 0)
        ?.originNodeId
    ).toBe(nested.id)
    expect(outerConnectionChange).not.toHaveBeenCalledWith(
      NodeSlotType.OUTPUT,
      0,
      true,
      expect.anything(),
      expect.anything()
    )
  })

  it('allocates after an explicitly registered link id', () => {
    const graph = new LGraph()
    const explicit = new LLink(
      toLinkId(100),
      '*',
      toNodeId(100),
      0,
      toNodeId(101),
      0
    )
    expect(graph._addLink(explicit)).toBe(true)

    const a = new LGraphNode('A')
    const b = new LGraphNode('B')
    a.addOutput('out', '*')
    b.addInput('in', '*')
    graph.add(a)
    graph.add(b)

    expect(a.connect(0, b, 0)?.id).toBe(toLinkId(101))
  })

  it('link.parentId writes are observable through the store query', () => {
    const graph = new LGraph()
    const a = new LGraphNode('A')
    const b = new LGraphNode('B')
    a.addOutput('out', 'INT')
    b.addInput('in', 'INT')
    graph.add(a)
    graph.add(b)

    const link = a.connect(0, b, 0)!
    const store = useLinkStore()
    const parentId = computed(
      () => store.getInputSlotLink(graphScopeOf(graph), b.id, 0)?.parentId
    )
    expect(parentId.value).toBeUndefined()

    link.parentId = toRerouteId(7)

    expect(parentId.value).toBe(7)
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
    const graphId = graphScopeOf(graph)
    expect(store.getInputSlotLink(graphId, b.id, 0)?.id).toBe(winner.id)
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
    expect(
      store.getInputSlotLink(graphScopeOf(subgraph), second.id, 0)?.id
    ).toBe(innerLink.id)

    rootGraph.remove(subgraphNode)

    expect(
      store.isInputSlotConnected(graphScopeOf(subgraph), second.id, 0)
    ).toBe(false)
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
    expect(
      store.getInputSlotLink(graphScopeOf(subgraph), second.id, 0)?.id
    ).toBe(innerLink.id)
  })

  it('clearing a subgraph unregisters its links but keeps root links', () => {
    const subgraph = createTestSubgraph({ nodeCount: 2 })
    const rootGraph = subgraph.rootGraph
    const [first, second] = subgraph.nodes
    first.connect(0, second, 0)

    const a = new LGraphNode('A')
    const b = new LGraphNode('B')
    a.addOutput('out', '*')
    b.addInput('in', '*')
    rootGraph.add(a)
    rootGraph.add(b)
    const rootLink = a.connect(0, b, 0)!

    subgraph.clear()

    const store = useLinkStore()
    expect(
      store.isInputSlotConnected(graphScopeOf(subgraph), second.id, 0)
    ).toBe(false)
    expect(store.getInputSlotLink(graphScopeOf(rootGraph), b.id, 0)?.id).toBe(
      rootLink.id
    )
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
    const graphId = graphScopeOf(graph)
    const store = useLinkStore()
    expect(store.getInputSlotLink(graphId, b.id, 0)?.id).toBe(link.id)

    graph.clear()

    expect(store.isInputSlotConnected(graphId, b.id, 0)).toBe(false)
  })

  it('detaches root links when the graph is cleared', () => {
    const graph = new LGraph()
    const a = new LGraphNode('A')
    const b = new LGraphNode('B')
    a.addOutput('out', 'INT')
    b.addInput('in', 'INT')
    graph.add(a)
    graph.add(b)
    const link = a.connect(0, b, 0)!
    const floating = new LLink(
      toLinkId(7),
      '*',
      a.id,
      0,
      UNASSIGNED_NODE_ID,
      -1
    )
    graph.addFloatingLink(floating)
    const linkState = link._state
    const floatingState = floating._state

    graph.clear()

    expect(link._graphScope).toBeUndefined()
    expect(floating._graphScope).toBeUndefined()
    expect(resolveLinkTopology(linkState)).toBeUndefined()
    expect(resolveLinkTopology(floatingState)).toBeUndefined()
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
    const graphId = graphScopeOf(graph)
    expect(floating._graphScope).toEqual(graphId)

    graph.removeFloatingLink(floating)

    expect(floating._graphScope).toBeUndefined()
    floating.origin_slot = 5
    expect(floating.origin_slot).toBe(5)
  })

  it('keeps both links registered when two target slots are swapped', () => {
    const graph = new LGraph()
    const a = new LGraphNode('A')
    const b = new LGraphNode('B')
    a.addOutput('out', 'INT')
    b.addInput('in0', 'INT')
    b.addInput('in1', 'INT')
    graph.add(a)
    graph.add(b)

    const first = a.connect(0, b, 0)!
    const second = a.connect(0, b, 1)!

    const store = useLinkStore()
    store.updateEndpoints(graphScopeOf(graph), [
      { topology: first._state, patch: { targetSlot: 1 } },
      { topology: second._state, patch: { targetSlot: 0 } }
    ])

    const graphId = graphScopeOf(graph)
    expect(b.isInputConnected(0)).toBe(true)
    expect(b.isInputConnected(1)).toBe(true)
    expect(store.getInputSlotLink(graphId, b.id, 0)?.id).toBe(second.id)
    expect(store.getInputSlotLink(graphId, b.id, 1)?.id).toBe(first.id)
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
    const topology = link._state
    expect(store.isInputSlotConnected(graphScopeOf(graph), nodeId, 0)).toBe(
      true
    )

    link.target_slot = 1

    expect(link._state).toBe(topology)
    expect(store.isInputSlotConnected(graphScopeOf(graph), nodeId, 0)).toBe(
      false
    )
    expect(store.isInputSlotConnected(graphScopeOf(graph), nodeId, 1)).toBe(
      true
    )
  })

  it('reports a rejected legacy endpoint mutation without throwing', () => {
    const graph = new LGraph()
    const firstSource = new LGraphNode('First source')
    const secondSource = new LGraphNode('Second source')
    const target = new LGraphNode('Target')
    firstSource.addOutput('out', 'INT')
    secondSource.addOutput('out', 'INT')
    target.addInput('first', 'INT')
    target.addInput('second', 'INT')
    graph.add(firstSource)
    graph.add(secondSource)
    graph.add(target)
    const first = firstSource.connect(0, target, 0)!
    secondSource.connect(0, target, 1)

    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      first.target_slot = 1
    }).not.toThrow()
    expect(error).toHaveBeenCalledWith(
      'Failed to update link endpoints',
      expect.objectContaining({ code: 'occupied-target' })
    )
    expect(first.target_slot).toBe(0)
  })

  it('updates regular and floating views after endpoint changes', () => {
    const graph = new LGraph()
    const a = new LGraphNode('A')
    const b = new LGraphNode('B')
    a.addOutput('out', 'INT')
    b.addInput('in0', 'INT')
    b.addInput('in1', 'INT')
    graph.add(a)
    graph.add(b)
    const linkCount = computed(() => graph.links.size)

    expect(linkCount.value).toBe(0)

    const link = a.connect(0, b, 0)!

    expect(linkCount.value).toBe(1)
    expect(graph.links.get(link.id)).toBe(link)
    expect(graph.floatingLinks.has(link.id)).toBe(false)

    link.target_slot = 1

    expect(linkCount.value).toBe(1)
    expect(graph.links.get(link.id)).toBe(link)

    link.target_id = UNASSIGNED_NODE_ID

    expect(linkCount.value).toBe(0)
    expect(graph.links.has(link.id)).toBe(false)
    expect(graph.floatingLinks.get(link.id)).toBe(link)
  })
})
