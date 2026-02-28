import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NodeId, Subgraph } from '@/lib/litegraph/src/litegraph'
import {
  LGraph,
  LGraphNode,
  LiteGraph,
  LLink,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import { useLinkStore } from '@/stores/linkStore'
import { usePromotionStore } from '@/stores/promotionStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import {
  createTestSubgraphData,
  createTestSubgraphNode
} from './subgraph/__fixtures__/subgraphHelpers'

import { test } from './__fixtures__/testExtensions'

vi.mock('@/renderer/core/layout/operations/layoutMutations', () => {
  const createLink = vi.fn()
  const deleteLink = vi.fn()
  const createNode = vi.fn()
  const deleteNode = vi.fn()
  const moveNode = vi.fn()
  const resizeNode = vi.fn()
  const setNodeZIndex = vi.fn()
  const createReroute = vi.fn()
  const deleteReroute = vi.fn()
  const moveReroute = vi.fn()
  const bringNodeToFront = vi.fn()
  const setSource = vi.fn()
  const setActor = vi.fn()
  return {
    useLayoutMutations: () => ({
      createLink,
      deleteLink,
      createNode,
      deleteNode,
      moveNode,
      resizeNode,
      setNodeZIndex,
      createReroute,
      deleteReroute,
      moveReroute,
      bringNodeToFront,
      setSource,
      setActor
    })
  }
})

function swapNodes(nodes: LGraphNode[]) {
  const firstNode = nodes[0]
  const lastNode = nodes[nodes.length - 1]
  nodes[0] = lastNode
  nodes[nodes.length - 1] = firstNode
  return nodes
}

function createGraph(...nodes: LGraphNode[]) {
  const graph = new LGraph()
  nodes.forEach((node) => graph.add(node))
  return graph
}

class DummyNode extends LGraphNode {
  constructor() {
    super('dummy')
  }
}

function createNumberNode(title: string): LGraphNode {
  const node = new LGraphNode(title)
  node.addOutput('out', 'number')
  node.addInput('in', 'number')
  return node
}

function buildLinkTopology(graph: LGraph): {
  disconnectedLinkId: number
  floatingLinkId: number
  linkedNodeId: NodeId
  rerouteId: number
} {
  const source = createNumberNode('source')
  const floatingTarget = createNumberNode('floating-target')
  const linkedTarget = createNumberNode('linked-target')
  graph.add(source)
  graph.add(floatingTarget)
  graph.add(linkedTarget)

  source.connect(0, floatingTarget, 0)
  source.connect(0, linkedTarget, 0)

  const linkToDisconnect = graph.getLink(floatingTarget.inputs[0].link)
  if (!linkToDisconnect) throw new Error('Expected link to disconnect')

  const reroute = graph.createReroute([120, 80], linkToDisconnect)
  graph.addFloatingLink(linkToDisconnect.toFloating('output', reroute.id))

  const floatingLinkId = [...graph.floatingLinks.keys()][0]
  if (floatingLinkId == null) throw new Error('Expected floating link')

  return {
    disconnectedLinkId: linkToDisconnect.id,
    floatingLinkId,
    linkedNodeId: linkedTarget.id,
    rerouteId: reroute.id
  }
}

describe('LGraph', () => {
  it('should serialize deterministic node order', async () => {
    LiteGraph.registerNodeType('dummy', DummyNode)
    const node1 = new DummyNode()
    const node2 = new DummyNode()
    const graph = createGraph(node1, node2)

    const result1 = graph.serialize({ sortNodes: true })
    expect(result1.nodes).not.toHaveLength(0)
    graph._nodes = swapNodes(graph.nodes)
    const result2 = graph.serialize({ sortNodes: true })

    expect(result1).toEqual(result2)
  })

  it('should handle adding null node gracefully', () => {
    const graph = new LGraph()
    const initialNodeCount = graph.nodes.length

    const result = graph.add(null)

    expect(result).toBeUndefined()
    expect(graph.nodes.length).toBe(initialNodeCount)
  })

  test('can be instantiated', ({ expect }) => {
    // @ts-expect-error Intentional - extra holds any / all consumer data that should be serialised
    const graph = new LGraph({ extra: 'TestGraph' })
    expect(graph).toBeInstanceOf(LGraph)
    expect(graph.extra).toBe('TestGraph')
    expect(graph.extra).toBe('TestGraph')
  })

  test('is exactly the same type', ({ expect }) => {
    // LGraph from barrel export and LiteGraph.LGraph should be the same
    expect(LiteGraph.LGraph).toBe(LGraph)
  })

  test('populates optional values', ({ expect, minimalSerialisableGraph }) => {
    const dGraph = new LGraph(minimalSerialisableGraph)
    expect(dGraph.links).toBeInstanceOf(Map)
    expect(dGraph.nodes).toBeInstanceOf(Array)
    expect(dGraph.groups).toBeInstanceOf(Array)
  })

  test('supports schema v0.4 graphs', ({ expect, oldSchemaGraph }) => {
    const fromOldSchema = new LGraph(oldSchemaGraph)
    expect(fromOldSchema).toMatchSnapshot('oldSchemaGraph')
  })

  it('round-trips v0.4 link parent extensions and reroutes through configure', () => {
    const source = createNumberNode('source')
    const target = createNumberNode('target')
    const graph = createGraph(source, target)

    const link = source.connect(0, target, 0)
    if (!link) throw new Error('Expected link')
    const reroute = graph.createReroute([80, 40], link)

    const serialized04 = graph.serialize()
    const restored = new LGraph(serialized04)
    const restoredLink = restored.getLink(link.id)

    if (!restoredLink) throw new Error('Expected restored link')
    expect(restoredLink.parentId).toBe(reroute.id)
    expect(restored.reroutes.size).toBe(1)
    expect(restored.reroutes.get(reroute.id)?.linkIds.has(link.id)).toBe(true)
  })

  it('round-trips v1 serialisable links/floating/reroutes through configure', () => {
    const graph = new LGraph()
    const { floatingLinkId, rerouteId, linkedNodeId } = buildLinkTopology(graph)
    const serialisedV1 = graph.asSerialisable()

    const restored = new LGraph(serialisedV1)
    const linkedInputLinkId = restored.getNodeById(linkedNodeId)?.inputs[0].link

    expect(linkedInputLinkId).toBeDefined()
    expect(restored.getLink(linkedInputLinkId)).toBeDefined()
    expect(restored.getReroute(rerouteId)).toBeDefined()
    expect(restored.floatingLinks.get(floatingLinkId)).toBeDefined()
  })
})

describe('Floating Links / Reroutes', () => {
  test('Floating reroute should be removed when node and link are removed', ({
    expect,
    floatingLinkGraph
  }) => {
    const graph = new LGraph(floatingLinkGraph)
    expect(graph.nodes.length).toBe(1)
    graph.remove(graph.nodes[0])
    expect(graph.nodes.length).toBe(0)
    expect(graph.links.size).toBe(0)
    expect(graph.floatingLinks.size).toBe(0)
    expect(graph.reroutes.size).toBe(0)
  })

  test('Can add reroute to existing link', ({ expect, linkedNodesGraph }) => {
    const graph = new LGraph(linkedNodesGraph)
    expect(graph.nodes.length).toBe(2)
    expect(graph.links.size).toBe(1)
    expect(graph.reroutes.size).toBe(0)

    graph.createReroute([0, 0], graph.links.values().next().value!)
    expect(graph.links.size).toBe(1)
    expect(graph.reroutes.size).toBe(1)
  })

  test('Create floating reroute when one side of node is removed', ({
    expect,
    linkedNodesGraph
  }) => {
    const graph = new LGraph(linkedNodesGraph)
    graph.createReroute([0, 0], graph.links.values().next().value!)
    graph.remove(graph.nodes[0])

    expect(graph.links.size).toBe(0)
    expect(graph.floatingLinks.size).toBe(1)
    expect(graph.reroutes.size).toBe(1)
    expect(graph.reroutes.values().next().value!.floating).not.toBeUndefined()
  })

  test('Create floating reroute when one side of link is removed', ({
    expect,
    linkedNodesGraph
  }) => {
    const graph = new LGraph(linkedNodesGraph)
    graph.createReroute([0, 0], graph.links.values().next().value!)
    graph.nodes[0].disconnectOutput(0)

    expect(graph.links.size).toBe(0)
    expect(graph.floatingLinks.size).toBe(1)
    expect(graph.reroutes.size).toBe(1)
    expect(graph.reroutes.values().next().value!.floating).not.toBeUndefined()
  })

  test('Reroutes and branches should be retained when the input node is removed', ({
    expect,
    floatingBranchGraph: graph
  }) => {
    expect(graph.nodes.length).toBe(3)
    graph.remove(graph.nodes[2])
    expect(graph.nodes.length).toBe(2)
    expect(graph.links.size).toBe(1)
    expect(graph.floatingLinks.size).toBe(1)
    expect(graph.reroutes.size).toBe(4)
    graph.remove(graph.nodes[1])
    expect(graph.nodes.length).toBe(1)
    expect(graph.links.size).toBe(0)
    expect(graph.floatingLinks.size).toBe(2)
    expect(graph.reroutes.size).toBe(4)
  })

  test('Floating reroutes should be removed when neither input nor output is connected', ({
    expect,
    floatingBranchGraph: graph
  }) => {
    // Remove output node
    graph.remove(graph.nodes[0])
    expect(graph.nodes.length).toBe(2)
    expect(graph.links.size).toBe(0)
    expect(graph.floatingLinks.size).toBe(2)
    // The original floating reroute should be removed
    expect(graph.reroutes.size).toBe(3)
    graph.remove(graph.nodes[0])
    expect(graph.nodes.length).toBe(1)
    expect(graph.links.size).toBe(0)
    expect(graph.floatingLinks.size).toBe(1)
    expect(graph.reroutes.size).toBe(3)
    graph.remove(graph.nodes[0])
    expect(graph.nodes.length).toBe(0)
    expect(graph.links.size).toBe(0)
    expect(graph.floatingLinks.size).toBe(0)
    expect(graph.reroutes.size).toBe(0)
  })
})

describe('LinkStore Lifecycle Rehydration', () => {
  it('tracks links, floating links, and reroutes after configure', () => {
    const graph = new LGraph()
    const { floatingLinkId, linkedNodeId, rerouteId } = buildLinkTopology(graph)
    const serialised = graph.asSerialisable()

    const restored = new LGraph(serialised)
    const linkedInput = restored.getNodeById(linkedNodeId)?.inputs[0]
    const linkedInputLink = restored.getLink(linkedInput?.link)

    const linkStore = useLinkStore()
    const topology = linkStore.getTopology(restored.linkStoreKey)
    expect(topology.links.size).toBe(restored.links.size)
    expect(topology.floatingLinks.size).toBe(restored.floatingLinks.size)
    expect(topology.reroutes.size).toBe(restored.reroutes.size)
    expect(
      linkStore.getFloatingLink(restored.linkStoreKey, floatingLinkId)
    ).toBeDefined()
    expect(linkStore.getReroute(restored.linkStoreKey, rerouteId)).toBeDefined()
    expect(linkStore.getLink(restored.linkStoreKey, linkedInput?.link)).toBe(
      linkedInputLink
    )
  })

  it('clears and rehydrates the store on graph.clear()', () => {
    const graph = new LGraph()
    buildLinkTopology(graph)

    const linkStore = useLinkStore()
    const topologyBefore = linkStore.getTopology(graph.linkStoreKey)
    expect(topologyBefore.links.size).toBeGreaterThan(0)
    expect(topologyBefore.floatingLinks.size).toBeGreaterThan(0)
    expect(topologyBefore.reroutes.size).toBeGreaterThan(0)

    graph.clear()

    const topologyAfter = linkStore.getTopology(graph.linkStoreKey)
    expect(topologyAfter.links.size).toBe(0)
    expect(topologyAfter.floatingLinks.size).toBe(0)
    expect(topologyAfter.reroutes.size).toBe(0)
  })

  it('preserves root/subgraph store isolation after round-trip', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    const root = new LGraph()
    const rootTopology = buildLinkTopology(root)

    const subgraph = root.createSubgraph(createTestSubgraphData())
    const subgraphSource = createNumberNode('subgraph-source')
    const subgraphTarget = createNumberNode('subgraph-target')
    subgraph.add(subgraphSource)
    subgraph.add(subgraphTarget)
    subgraphSource.connect(0, subgraphTarget, 0)

    root.add(createTestSubgraphNode(subgraph, { pos: [500, 200] }))

    const serialised = root.asSerialisable()
    const restoredRoot = new LGraph(serialised)
    const restoredSubgraph = [...restoredRoot.subgraphs.values()][0]

    if (!restoredSubgraph) throw new Error('Expected restored subgraph')

    const subgraphLinkId = [...restoredSubgraph.links.keys()][0]

    const linkStore = useLinkStore()
    expect(
      linkStore.getFloatingLink(
        restoredRoot.linkStoreKey,
        rootTopology.floatingLinkId
      )
    ).toBeDefined()
    expect(
      linkStore.getReroute(restoredRoot.linkStoreKey, rootTopology.rerouteId)
    ).toBeDefined()
    expect(
      linkStore.getLink(restoredRoot.linkStoreKey, subgraphLinkId)
    ).toBeUndefined()
    expect(
      linkStore.getLink(restoredSubgraph.linkStoreKey, subgraphLinkId)
    ).toBeDefined()
    expect(
      linkStore.getTopology(restoredSubgraph.linkStoreKey).floatingLinks.size
    ).toBe(0)
  })
})

describe('LinkStore Read-Through Projection', () => {
  it('reads normal links from the projected store map', () => {
    const graph = new LGraph()
    const { linkedNodeId } = buildLinkTopology(graph)
    const linkId = graph.getNodeById(linkedNodeId)?.inputs[0].link
    if (linkId == null) throw new Error('Expected linked input link')

    const linkStore = useLinkStore()
    const projectedLinks = new Map(graph.links)
    linkStore.rehydrate(graph.linkStoreKey, {
      links: projectedLinks,
      floatingLinks: graph.floatingLinks,
      reroutes: graph.reroutes
    })
    graph.links.clear()

    expect(graph.getLink(linkId)).toBe(projectedLinks.get(linkId))
    expect(graph.links.get(linkId)).toBeUndefined()
  })

  it('reads reroutes from the projected store map', () => {
    const graph = new LGraph()
    const { rerouteId } = buildLinkTopology(graph)

    const linkStore = useLinkStore()
    const projectedReroutes = new Map(graph.reroutes)
    linkStore.rehydrate(graph.linkStoreKey, {
      links: graph.links,
      floatingLinks: graph.floatingLinks,
      reroutes: projectedReroutes
    })
    graph.reroutes.clear()

    expect(graph.getReroute(rerouteId)).toBe(projectedReroutes.get(rerouteId))
    expect(graph.reroutes.get(rerouteId)).toBeUndefined()
  })

  it('keeps floating-link reads explicit through floating projection', () => {
    const graph = new LGraph()
    const { floatingLinkId } = buildLinkTopology(graph)
    const linkStore = useLinkStore()
    const floatingLink = linkStore.getFloatingLink(
      graph.linkStoreKey,
      floatingLinkId
    )
    if (!floatingLink) throw new Error('Expected floating link projection')

    expect(graph.getLink(floatingLinkId)).not.toBe(floatingLink)
    expect(linkStore.getFloatingLink(graph.linkStoreKey, floatingLinkId)).toBe(
      floatingLink
    )
  })
})

describe('Disconnect/Remove Characterization', () => {
  it('graph.removeLink preserves disconnect callback ordering parity', () => {
    const graph = new LGraph()
    const sourceNode = createNumberNode('source')
    const targetNode = createNumberNode('target')

    graph.add(sourceNode)
    graph.add(targetNode)

    const link = sourceNode.connect(0, targetNode, 0)
    if (!link) throw new Error('Expected link')

    const callbackOrder: string[] = []

    targetNode.onConnectionsChange = (
      slotType,
      slotIndex,
      connected,
      linkInfo
    ) => {
      if (!linkInfo) throw new Error('Expected link info')
      callbackOrder.push(`target:${slotType}:${slotIndex}:${connected}`)
      expect(slotType).toBe(NodeSlotType.INPUT)
      expect(slotIndex).toBe(0)
      expect(connected).toBe(false)
      expect(linkInfo.id).toBe(link.id)
    }

    sourceNode.onConnectionsChange = (
      slotType,
      slotIndex,
      connected,
      linkInfo
    ) => {
      if (!linkInfo) throw new Error('Expected link info')
      callbackOrder.push(`source:${slotType}:${slotIndex}:${connected}`)
      expect(slotType).toBe(NodeSlotType.OUTPUT)
      expect(slotIndex).toBe(0)
      expect(connected).toBe(false)
      expect(linkInfo.id).toBe(link.id)
    }

    graph.removeLink(link.id)

    expect(callbackOrder).toEqual([
      `target:${NodeSlotType.INPUT}:0:false`,
      `source:${NodeSlotType.OUTPUT}:0:false`
    ])
    expect(graph.getLink(link.id)).toBeUndefined()
    expect(targetNode.inputs[0].link).toBeNull()
    expect(sourceNode.outputs[0].links).toEqual([])
  })

  it('removeLink retains floating/reroute cleanup invariants', () => {
    const graph = new LGraph()
    const { disconnectedLinkId, floatingLinkId, rerouteId } =
      buildLinkTopology(graph)

    graph.removeLink(disconnectedLinkId)

    const linkStore = useLinkStore()
    expect(graph.getLink(disconnectedLinkId)).toBeUndefined()
    expect(
      linkStore.getLink(graph.linkStoreKey, disconnectedLinkId)
    ).toBeUndefined()
    expect(graph.getReroute(rerouteId)).toBeDefined()
    expect(linkStore.getReroute(graph.linkStoreKey, rerouteId)).toBeDefined()
    expect(graph.floatingLinks.has(floatingLinkId)).toBe(true)
    expect(
      linkStore.getFloatingLink(graph.linkStoreKey, floatingLinkId)
    ).toBeDefined()
  })
})

describe('Connect Characterization', () => {
  it('connect with reroute keeps floating cleanup invariants', () => {
    const graph = new LGraph()
    const { floatingLinkId, rerouteId } = buildLinkTopology(graph)

    const sourceNode = createNumberNode('new-source')
    const targetNode = createNumberNode('new-target')
    graph.add(sourceNode)
    graph.add(targetNode)

    const rerouteBeforeConnect = graph.getReroute(rerouteId)
    if (!rerouteBeforeConnect) throw new Error('Expected reroute')
    expect(rerouteBeforeConnect.floatingLinkIds.has(floatingLinkId)).toBe(true)

    const link = sourceNode.connect(0, targetNode, 0, rerouteId)
    if (!link) throw new Error('Expected link')

    const rerouteAfterConnect = graph.getReroute(rerouteId)
    if (!rerouteAfterConnect) throw new Error('Expected reroute after connect')

    const linkStore = useLinkStore()
    expect(graph.getLink(link.id)).toBe(link)
    expect(linkStore.getLink(graph.linkStoreKey, link.id)).toBe(link)
    expect(rerouteAfterConnect.linkIds.has(link.id)).toBe(true)
    expect(rerouteAfterConnect.floating).toBeUndefined()
    expect(rerouteAfterConnect.floatingLinkIds.has(floatingLinkId)).toBe(false)
    expect(graph.floatingLinks.has(floatingLinkId)).toBe(false)
    expect(
      linkStore.getFloatingLink(graph.linkStoreKey, floatingLinkId)
    ).toBeUndefined()
  })
})

describe('Graph Clearing and Callbacks', () => {
  test('clear() calls both node.onRemoved() and graph.onNodeRemoved()', ({
    expect
  }) => {
    const graph = new LGraph()

    // Create test nodes with onRemoved callbacks
    const node1 = new LGraphNode('TestNode1')
    const node2 = new LGraphNode('TestNode2')

    // Add nodes to graph
    graph.add(node1)
    graph.add(node2)

    // Track callback invocations
    const nodeRemovedCallbacks = new Set<string>()
    const graphRemovedCallbacks = new Set<string>()

    // Set up node.onRemoved() callbacks
    node1.onRemoved = () => {
      nodeRemovedCallbacks.add(String(node1.id))
    }
    node2.onRemoved = () => {
      nodeRemovedCallbacks.add(String(node2.id))
    }

    // Set up graph.onNodeRemoved() callback
    graph.onNodeRemoved = (node) => {
      graphRemovedCallbacks.add(String(node.id))
    }

    // Verify nodes are in graph before clearing
    expect(graph.nodes.length).toBe(2)

    // Clear the graph
    graph.clear()

    // Verify both types of callbacks were called
    expect(nodeRemovedCallbacks).toContain(String(node1.id))
    expect(nodeRemovedCallbacks).toContain(String(node2.id))
    expect(graphRemovedCallbacks).toContain(String(node1.id))
    expect(graphRemovedCallbacks).toContain(String(node2.id))

    // Verify nodes were actually removed
    expect(graph.nodes.length).toBe(0)
  })

  test('clear() removes graph-scoped promotion and widget-value state', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))

    const graph = new LGraph()
    const graphId = 'graph-clear-cleanup' as UUID
    graph.id = graphId

    const promotionStore = usePromotionStore()
    promotionStore.promote(graphId, 1 as NodeId, '10', 'seed')

    const widgetValueStore = useWidgetValueStore()
    widgetValueStore.registerWidget(graphId, {
      nodeId: '10' as NodeId,
      name: 'seed',
      type: 'number',
      value: 1,
      options: {},
      label: undefined,
      serialize: undefined,
      disabled: undefined
    })

    expect(promotionStore.isPromotedByAny(graphId, '10', 'seed')).toBe(true)
    expect(widgetValueStore.getWidget(graphId, '10' as NodeId, 'seed')).toEqual(
      expect.objectContaining({ value: 1 })
    )

    graph.clear()

    expect(promotionStore.isPromotedByAny(graphId, '10', 'seed')).toBe(false)
    expect(
      widgetValueStore.getWidget(graphId, '10' as NodeId, 'seed')
    ).toBeUndefined()
  })
})

describe('Subgraph Definition Garbage Collection', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function createSubgraphWithNodes(rootGraph: LGraph, nodeCount: number) {
    const subgraph = rootGraph.createSubgraph(createTestSubgraphData())

    const innerNodes: LGraphNode[] = []
    for (let i = 0; i < nodeCount; i++) {
      const node = new LGraphNode(`Inner Node ${i}`)
      subgraph.add(node)
      innerNodes.push(node)
    }

    return { subgraph, innerNodes }
  }

  it('removing SubgraphNode fires onRemoved for inner nodes', () => {
    const rootGraph = new LGraph()
    const { subgraph, innerNodes } = createSubgraphWithNodes(rootGraph, 2)
    const removedNodeIds = new Set<string>()

    for (const node of innerNodes) {
      node.onRemoved = () => removedNodeIds.add(String(node.id))
    }

    const subgraphNode = createTestSubgraphNode(subgraph, { pos: [100, 100] })
    rootGraph.add(subgraphNode)

    expect(subgraph.nodes.length).toBe(2)

    rootGraph.remove(subgraphNode)

    expect(removedNodeIds.size).toBe(2)
  })

  it('removing SubgraphNode fires onNodeRemoved callback', () => {
    const rootGraph = new LGraph()
    const { subgraph } = createSubgraphWithNodes(rootGraph, 2)
    const graphRemovedNodeIds = new Set<string>()

    subgraph.onNodeRemoved = (node) => graphRemovedNodeIds.add(String(node.id))

    const subgraphNode = createTestSubgraphNode(subgraph, { pos: [100, 100] })
    rootGraph.add(subgraphNode)

    rootGraph.remove(subgraphNode)

    expect(graphRemovedNodeIds.size).toBe(2)
  })

  it('subgraph definition is removed when SubgraphNode is removed', () => {
    const rootGraph = new LGraph()
    const { subgraph } = createSubgraphWithNodes(rootGraph, 1)
    const subgraphId = subgraph.id

    const subgraphNode = createTestSubgraphNode(subgraph, { pos: [100, 100] })
    rootGraph.add(subgraphNode)

    expect(rootGraph.subgraphs.has(subgraphId)).toBe(true)

    rootGraph.remove(subgraphNode)

    expect(rootGraph.subgraphs.has(subgraphId)).toBe(false)
  })
})

describe('Legacy LGraph Compatibility Layer', () => {
  test('can be extended via prototype', ({ expect, minimalGraph }) => {
    // @ts-expect-error Should always be an error.
    LGraph.prototype.newMethod = function () {
      return 'New method added via prototype'
    }
    // @ts-expect-error Should always be an error.
    expect(minimalGraph.newMethod()).toBe('New method added via prototype')
  })

  test('is correctly assigned to LiteGraph', ({ expect }) => {
    expect(LiteGraph.LGraph).toBe(LGraph)
  })
})

describe('Shared LGraphState', () => {
  function createSubgraphOnGraph(rootGraph: LGraph): Subgraph {
    const data = createTestSubgraphData()
    return rootGraph.createSubgraph(data)
  }

  it('subgraph state is the same object as rootGraph state', () => {
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)
    expect(subgraph.state).toBe(rootGraph.state)
  })

  it('adding a node in a subgraph increments the root counter', () => {
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)

    rootGraph.add(new DummyNode())
    const rootNodeId = rootGraph.state.lastNodeId

    subgraph.add(new DummyNode())
    expect(rootGraph.state.lastNodeId).toBe(rootNodeId + 1)
  })

  it('node IDs never collide between root and subgraph', () => {
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)

    const rootNode = new DummyNode()
    rootGraph.add(rootNode)

    const subNode = new DummyNode()
    subgraph.add(subNode)

    expect(rootNode.id).not.toBe(subNode.id)
  })

  it('configure merges state using max', () => {
    const rootGraph = new LGraph()
    rootGraph.state.lastNodeId = 10

    const data = createTestSubgraphData()
    data.state = {
      lastNodeId: 5,
      lastLinkId: 20,
      lastGroupId: 0,
      lastRerouteId: 0
    }
    const subgraph = rootGraph.createSubgraph(data)
    subgraph.configure(data)

    expect(rootGraph.state.lastNodeId).toBe(10)
    expect(rootGraph.state.lastLinkId).toBe(20)
  })
})

describe('ensureGlobalIdUniqueness', () => {
  function createSubgraphOnGraph(rootGraph: LGraph): Subgraph {
    const data = createTestSubgraphData()
    return rootGraph.createSubgraph(data)
  }

  it('reassigns duplicate node IDs in subgraphs', () => {
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)

    const rootNode = new DummyNode()
    rootGraph.add(rootNode)

    const subNode = new DummyNode()
    subNode.id = rootNode.id
    subgraph._nodes.push(subNode)
    subgraph._nodes_by_id[subNode.id] = subNode

    rootGraph.ensureGlobalIdUniqueness()

    expect(subNode.id).not.toBe(rootNode.id)
    expect(subgraph._nodes_by_id[subNode.id]).toBe(subNode)
    expect(subgraph._nodes_by_id[rootNode.id as number]).toBeUndefined()
  })

  it('preserves root graph node IDs as canonical', () => {
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)

    const rootNode = new DummyNode()
    rootGraph.add(rootNode)
    const originalRootId = rootNode.id

    const subNode = new DummyNode()
    subNode.id = rootNode.id
    subgraph._nodes.push(subNode)
    subgraph._nodes_by_id[subNode.id] = subNode

    rootGraph.ensureGlobalIdUniqueness()

    expect(rootNode.id).toBe(originalRootId)
  })

  it('updates lastNodeId to reflect reassigned IDs', () => {
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)

    const rootNode = new DummyNode()
    rootGraph.add(rootNode)

    const subNode = new DummyNode()
    subNode.id = rootNode.id
    subgraph._nodes.push(subNode)
    subgraph._nodes_by_id[subNode.id] = subNode

    rootGraph.ensureGlobalIdUniqueness()

    expect(rootGraph.state.lastNodeId).toBeGreaterThanOrEqual(
      subNode.id as number
    )
  })

  it('patches link origin_id and target_id after reassignment', () => {
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)

    const rootNode = new DummyNode()
    rootGraph.add(rootNode)

    const subNodeA = new DummyNode()
    subNodeA.id = rootNode.id
    subgraph._nodes.push(subNodeA)
    subgraph._nodes_by_id[subNodeA.id] = subNodeA

    const subNodeB = new DummyNode()
    subNodeB.id = 999
    subgraph._nodes.push(subNodeB)
    subgraph._nodes_by_id[subNodeB.id] = subNodeB

    const link = new LLink(1, 'number', subNodeA.id, 0, subNodeB.id, 0)
    subgraph._links.set(link.id, link)

    rootGraph.ensureGlobalIdUniqueness()

    expect(link.origin_id).toBe(subNodeA.id)
    expect(link.target_id).toBe(subNodeB.id)
    expect(link.origin_id).not.toBe(rootNode.id)
  })

  it('patches floating link origin_id and target_id after reassignment', () => {
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)

    const rootNode = new DummyNode()
    rootGraph.add(rootNode)

    const subNodeA = new DummyNode()
    subNodeA.id = rootNode.id
    subgraph._nodes.push(subNodeA)
    subgraph._nodes_by_id[subNodeA.id] = subNodeA

    const subNodeB = new DummyNode()
    subNodeB.id = 777
    subgraph._nodes.push(subNodeB)
    subgraph._nodes_by_id[subNodeB.id] = subNodeB

    const floatingLink = new LLink(9, 'number', subNodeA.id, 0, subNodeB.id, 0)
    subgraph.addFloatingLink(floatingLink)

    rootGraph.ensureGlobalIdUniqueness()

    expect(floatingLink.origin_id).toBe(subNodeA.id)
    expect(floatingLink.target_id).toBe(subNodeB.id)
    expect(floatingLink.origin_id).not.toBe(rootNode.id)
  })

  it('detects collisions with reserved (not-yet-created) node IDs', () => {
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)

    const subNode = new DummyNode()
    subNode.id = 42
    subgraph._nodes.push(subNode)
    subgraph._nodes_by_id[subNode.id] = subNode

    rootGraph.ensureGlobalIdUniqueness([42])

    expect(subNode.id).not.toBe(42)
    expect(subgraph._nodes_by_id[subNode.id]).toBe(subNode)
  })

  it('is a no-op when there are no collisions', () => {
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)

    const rootNode = new DummyNode()
    rootGraph.add(rootNode)

    const subNode = new DummyNode()
    subgraph.add(subNode)

    const rootId = rootNode.id
    const subId = subNode.id

    rootGraph.ensureGlobalIdUniqueness()

    expect(rootNode.id).toBe(rootId)
    expect(subNode.id).toBe(subId)
  })
})

describe('Subgraph Unpacking', () => {
  function installSubgraphNodeRegistration(rootGraph: LGraph): () => void {
    const listener = (event: CustomEvent<{ subgraph: Subgraph }>): void => {
      const { subgraph } = event.detail

      class RuntimeSubgraphNode extends SubgraphNode {
        constructor(title?: string) {
          super(rootGraph, subgraph, {
            id: ++rootGraph.last_node_id,
            type: subgraph.id,
            title,
            pos: [0, 0],
            size: [140, 80],
            inputs: [],
            outputs: [],
            properties: {},
            flags: {},
            mode: 0,
            order: 0
          })
        }
      }

      LiteGraph.registerNodeType(subgraph.id, RuntimeSubgraphNode)
    }

    rootGraph.events.addEventListener('subgraph-created', listener)
    return () =>
      rootGraph.events.removeEventListener('subgraph-created', listener)
  }

  function getRequiredNodeByTitle(graph: LGraph, title: string): LGraphNode {
    const node = graph.nodes.find((candidate) => candidate.title === title)
    if (!node) throw new Error(`Expected node titled ${title}`)
    return node
  }

  class TestNode extends LGraphNode {
    constructor(title?: string) {
      super(title ?? 'TestNode')
      this.addInput('input_0', 'number')
      this.addOutput('output_0', 'number')
    }
  }

  class MultiInputNode extends LGraphNode {
    constructor(title?: string) {
      super(title ?? 'MultiInputNode')
      this.addInput('input_0', 'number')
      this.addInput('input_1', 'number')
      this.addOutput('output_0', 'number')
    }
  }

  function registerTestNodes() {
    LiteGraph.registerNodeType('test/TestNode', TestNode)
    LiteGraph.registerNodeType('test/MultiInputNode', MultiInputNode)
  }

  function createSubgraphOnGraph(rootGraph: LGraph) {
    return rootGraph.createSubgraph(createTestSubgraphData())
  }

  it('deduplicates links when unpacking subgraph with duplicate links', () => {
    registerTestNodes()
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)

    const sourceNode = LiteGraph.createNode('test/TestNode', 'Source')!
    const targetNode = LiteGraph.createNode('test/TestNode', 'Target')!
    subgraph.add(sourceNode)
    subgraph.add(targetNode)

    // Create a legitimate link
    sourceNode.connect(0, targetNode, 0)
    expect(subgraph._links.size).toBe(1)

    // Manually add duplicate links (simulating the bug)
    const existingLink = subgraph._links.values().next().value!
    for (let i = 0; i < 3; i++) {
      const dupLink = new LLink(
        ++subgraph.state.lastLinkId,
        existingLink.type,
        existingLink.origin_id,
        existingLink.origin_slot,
        existingLink.target_id,
        existingLink.target_slot
      )
      subgraph._links.set(dupLink.id, dupLink)
      sourceNode.outputs[0].links!.push(dupLink.id)
    }
    expect(subgraph._links.size).toBe(4)

    const subgraphNode = createTestSubgraphNode(subgraph, { pos: [100, 100] })
    rootGraph.add(subgraphNode)

    rootGraph.unpackSubgraph(subgraphNode)

    // After unpacking, there should be exactly 1 link (not 4)
    expect(rootGraph.links.size).toBe(1)
  })

  it('preserves correct link connections when unpacking with duplicate links', () => {
    registerTestNodes()
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)

    const sourceNode = LiteGraph.createNode('test/MultiInputNode', 'Source')!
    const targetNode = LiteGraph.createNode('test/MultiInputNode', 'Target')!
    subgraph.add(sourceNode)
    subgraph.add(targetNode)

    // Connect source output 0 → target input 0
    sourceNode.connect(0, targetNode, 0)

    // Add duplicate links to the same connection
    const existingLink = subgraph._links.values().next().value!
    const dupLink = new LLink(
      ++subgraph.state.lastLinkId,
      existingLink.type,
      existingLink.origin_id,
      existingLink.origin_slot,
      existingLink.target_id,
      existingLink.target_slot
    )
    subgraph._links.set(dupLink.id, dupLink)
    sourceNode.outputs[0].links!.push(dupLink.id)

    const subgraphNode = createTestSubgraphNode(subgraph, { pos: [100, 100] })
    rootGraph.add(subgraphNode)

    rootGraph.unpackSubgraph(subgraphNode)

    // Verify only 1 link exists
    expect(rootGraph.links.size).toBe(1)

    // Verify target input 1 does NOT have a link (no spurious connection)
    const unpackedTarget = rootGraph.nodes.find((n) => n.title === 'Target')!
    expect(unpackedTarget.inputs[0].link).not.toBeNull()
    expect(unpackedTarget.inputs[1].link).toBeNull()
  })

  it('preserves boundary input reroute parent remap across convert and unpack', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    registerTestNodes()
    const rootGraph = new LGraph()
    const cleanupRegistration = installSubgraphNodeRegistration(rootGraph)
    try {
      const externalSource = LiteGraph.createNode(
        'test/TestNode',
        'external-source'
      )
      const boundaryTarget = LiteGraph.createNode(
        'test/TestNode',
        'boundary-target'
      )
      if (!externalSource || !boundaryTarget)
        throw new Error('Expected test nodes')
      rootGraph.add(externalSource)
      rootGraph.add(boundaryTarget)

      const boundaryLink = externalSource.connect(0, boundaryTarget, 0)
      if (!boundaryLink) throw new Error('Expected boundary link')

      const reroute = rootGraph.createReroute([120, 40], boundaryLink)
      expect(boundaryLink.parentId).toBe(reroute.id)

      const { node: subgraphNode } = rootGraph.convertToSubgraph(
        new Set([boundaryTarget])
      )
      const convertedBoundaryLinkId = subgraphNode.inputs[0].link
      if (convertedBoundaryLinkId == null)
        throw new Error('Expected converted boundary input link')

      const convertedBoundaryLink = rootGraph.getLink(convertedBoundaryLinkId)
      if (!convertedBoundaryLink)
        throw new Error('Expected converted boundary input link instance')
      expect(convertedBoundaryLink.parentId).toBe(reroute.id)

      rootGraph.unpackSubgraph(subgraphNode)

      const unpackedTarget = getRequiredNodeByTitle(
        rootGraph,
        'boundary-target'
      )
      const unpackedLink = rootGraph.getLink(unpackedTarget.inputs[0].link)
      if (!unpackedLink)
        throw new Error('Expected unpacked boundary input link')

      expect(unpackedLink.origin_id).toBe(externalSource.id)
      expect(unpackedLink.target_id).toBe(unpackedTarget.id)
      expect(unpackedLink.parentId).toBe(reroute.id)
    } finally {
      cleanupRegistration()
    }
  })

  it('preserves boundary output reroute parent remap across convert and unpack', () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    registerTestNodes()
    const rootGraph = new LGraph()
    const cleanupRegistration = installSubgraphNodeRegistration(rootGraph)
    try {
      const boundarySource = LiteGraph.createNode(
        'test/TestNode',
        'boundary-source'
      )
      const externalTarget = LiteGraph.createNode(
        'test/TestNode',
        'external-target'
      )
      if (!boundarySource || !externalTarget)
        throw new Error('Expected test nodes')
      rootGraph.add(boundarySource)
      rootGraph.add(externalTarget)

      const boundaryLink = boundarySource.connect(0, externalTarget, 0)
      if (!boundaryLink) throw new Error('Expected boundary link')

      const reroute = rootGraph.createReroute([180, 80], boundaryLink)
      expect(boundaryLink.parentId).toBe(reroute.id)

      const { node: subgraphNode } = rootGraph.convertToSubgraph(
        new Set([boundarySource])
      )
      const convertedBoundaryLinkId = subgraphNode.outputs[0].links?.[0]
      if (convertedBoundaryLinkId == null)
        throw new Error('Expected converted boundary output link')

      const convertedBoundaryLink = rootGraph.getLink(convertedBoundaryLinkId)
      if (!convertedBoundaryLink)
        throw new Error('Expected converted boundary output link instance')
      expect(convertedBoundaryLink.parentId).toBe(reroute.id)

      rootGraph.unpackSubgraph(subgraphNode)

      const unpackedSource = getRequiredNodeByTitle(
        rootGraph,
        'boundary-source'
      )
      const unpackedLinkId = unpackedSource.outputs[0].links?.[0]
      const unpackedLink = rootGraph.getLink(unpackedLinkId)
      if (!unpackedLink)
        throw new Error('Expected unpacked boundary output link')

      expect(unpackedLink.origin_id).toBe(unpackedSource.id)
      expect(unpackedLink.target_id).toBe(externalTarget.id)
      expect(unpackedLink.parentId).toBe(reroute.id)
    } finally {
      cleanupRegistration()
    }
  })

  it('keeps subgraph definition when unpacking one instance while another remains', () => {
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)

    const firstInstance = createTestSubgraphNode(subgraph, { pos: [100, 100] })
    const secondInstance = createTestSubgraphNode(subgraph, { pos: [300, 100] })
    secondInstance.id = 2
    rootGraph.add(firstInstance)
    rootGraph.add(secondInstance)

    rootGraph.unpackSubgraph(firstInstance)

    expect(rootGraph.subgraphs.has(subgraph.id)).toBe(true)

    const serialized = rootGraph.serialize()
    const definitionIds =
      serialized.definitions?.subgraphs?.map((definition) => definition.id) ??
      []
    expect(definitionIds).toContain(subgraph.id)
  })
})

describe('Subgraph Layout Integration', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  function createSubgraphWithIO(rootGraph: LGraph) {
    const subgraph = rootGraph.createSubgraph(createTestSubgraphData())
    subgraph.addInput('in_0', 'number')
    subgraph.addOutput('out_0', 'number')

    const innerNode = new LGraphNode('InnerNode')
    innerNode.addInput('in', 'number')
    innerNode.addOutput('out', 'number')
    subgraph.add(innerNode)

    return { subgraph, innerNode }
  }

  it('calls layoutMutations.createLink when connectSubgraphInputSlot is called', () => {
    const rootGraph = new LGraph()
    const { subgraph, innerNode } = createSubgraphWithIO(rootGraph)

    const subgraphInput = subgraph.inputs[0]
    const link = subgraph.connectSubgraphInputSlot(subgraphInput, innerNode, 0)

    const mutations = useLayoutMutations()
    expect(mutations.createLink).toHaveBeenCalledWith(
      link.id,
      subgraphInput.parent.id,
      0,
      innerNode.id,
      0
    )
  })

  it('calls layoutMutations.createLink when connectSubgraphOutputSlot is called', () => {
    const rootGraph = new LGraph()
    const { subgraph, innerNode } = createSubgraphWithIO(rootGraph)

    const subgraphOutput = subgraph.outputs[0]
    const link = subgraph.connectSubgraphOutputSlot(
      innerNode,
      0,
      subgraphOutput
    )

    const mutations = useLayoutMutations()
    expect(mutations.createLink).toHaveBeenCalledWith(
      link.id,
      innerNode.id,
      0,
      subgraphOutput.parent.id,
      0
    )
  })
})
