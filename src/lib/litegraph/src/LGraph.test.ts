import { toGroupId } from '@/types/groupId'
import { fromAny } from '@total-typescript/shoehorn'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { nextTick, watch } from 'vue'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import type * as Y from 'yjs'

import type { NodeLifecycleEvent } from '@/lib/litegraph/src/infrastructure/LGraphEventMap'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { getLayoutStoreYDoc } from '@/renderer/core/layout/store/layoutStoreTestUtils'
import { transferLayoutAttachment } from '@/renderer/core/layout/operations/graphLayoutAttachment'
import {
  adoptNodeReplacement,
  LGraph,
  LGraphGroup,
  LGraphNode,
  LiteGraph,
  LLink,
  Reroute,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import type {
  SerialisableGraph,
  SerialisableLLink,
  SerialisableReroute
} from '@/lib/litegraph/src/types/serialisation'
import type { UUID } from '@/utils/uuid'
import { createUuidv4, zeroUuid } from '@/utils/uuid'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useRerouteStore } from '@/stores/rerouteStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { slotFloatingLinks } from '@/lib/litegraph/src/LLink'
import { toLinkId } from '@/types/linkId'
import { toRerouteId } from '@/types/rerouteId'
import { UNASSIGNED_NODE_ID, toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import {
  createTestSubgraph,
  createTestSubgraphData,
  createTestSubgraphNode
} from './subgraph/__fixtures__/subgraphHelpers'
import { subgraphTest } from './subgraph/__fixtures__/subgraphFixtures'

import {
  duplicateLinksRoot,
  duplicateLinksSlotShift,
  duplicateLinksSubgraph
} from './__fixtures__/duplicateLinks'
import { duplicateSubgraphNodeIds } from './__fixtures__/duplicateSubgraphNodeIds'
import { nestedSubgraphProxyWidgets } from './__fixtures__/nestedSubgraphProxyWidgets'
import { nodeIdSpaceExhausted } from './__fixtures__/nodeIdSpaceExhausted'
import { uniqueSubgraphNodeIds } from './__fixtures__/uniqueSubgraphNodeIds'
import { test } from './__fixtures__/testExtensions'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  layoutStore.resetForTests()
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
  it('normalizes legacy numeric node ids when adding nodes', () => {
    const graph = new LGraph()
    const unassignedNode = new LGraphNode('legacy-unassigned')
    Reflect.set(unassignedNode, 'id', -1)

    graph.add(unassignedNode)

    expect(unassignedNode.id).toBe(toNodeId(1))
    expect(graph.getNodeById(toNodeId(1))).toBe(unassignedNode)

    const preassignedNode = new LGraphNode('legacy-preassigned')
    Reflect.set(preassignedNode, 'id', 7)

    graph.add(preassignedNode)

    expect(preassignedNode.id).toBe(toNodeId(7))
    expect(graph.getNodeById(toNodeId(7))).toBe(preassignedNode)
    expect(graph.last_node_id).toBe(7)
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
  subgraphTest('should snap slots to same y-level', ({ emptySubgraph }) => {
    const node = new LGraphNode('testname')
    node.addInput('test', 'IMAGE')
    emptySubgraph.add(node)

    emptySubgraph.inputNode.pos = [0, 0]
    // Reroute needs offset of ~20y to align with first slot
    const reroute = new Reroute(toRerouteId(1), emptySubgraph, [0, 20])

    node.snapToGrid(10)
    reroute.snapToGrid(10)
    emptySubgraph.inputNode.snapToGrid(10)

    node.arrange()
    emptySubgraph.inputNode.arrange()

    const yPos = node.getInputPos(0)[1]
    expect(reroute.pos[1]).toBe(yPos)
    expect(emptySubgraph.inputNode.emptySlot.pos[1]).toBe(yPos)

    // Assign non-equal positions and repeat
    emptySubgraph.inputNode.pos = [0, 43]
    node.pos = [0, 50]
    reroute.pos = [0, 63]

    node.snapToGrid(10)
    reroute.snapToGrid(10)
    emptySubgraph.inputNode.snapToGrid(10)

    node.arrange()
    emptySubgraph.inputNode.arrange()

    const yPos2 = node.getInputPos(0)[1]
    expect(reroute.pos[1]).toBe(yPos2)
    expect(emptySubgraph.inputNode.emptySlot.pos[1]).toBe(yPos2)
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

  test('slot floating links are derived from link endpoints', ({
    expect,
    linkedNodesGraph
  }) => {
    const graph = new LGraph(linkedNodesGraph)
    graph.createReroute([0, 0], graph.links.values().next().value!)
    const [origin, target] = graph.nodes

    origin.disconnectOutput(0)

    expect(slotFloatingLinks(graph, 'input', target.id, 0)).toHaveLength(1)
    expect(slotFloatingLinks(graph, 'output', origin.id, 0)).toHaveLength(0)

    const [floatingLink] = slotFloatingLinks(graph, 'input', target.id, 0)
    graph.removeFloatingLink(floatingLink)

    expect(slotFloatingLinks(graph, 'input', target.id, 0)).toHaveLength(0)
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

describe('Link serialization goldens (ADR-0008 topology-store migration)', () => {
  const LINK_KEYS = [
    'id',
    'origin_id',
    'origin_slot',
    'target_id',
    'target_slot',
    'type'
  ]

  function expectContractKeyOrder(link: SerialisableLLink) {
    const expectedKeys =
      link.parentId === undefined ? LINK_KEYS : [...LINK_KEYS, 'parentId']
    expect(Object.keys(link)).toEqual(expectedKeys)
  }

  test('plain links keep contract key order and round-trip byte-identically', ({
    expect,
    linkedNodesGraph
  }) => {
    const first = new LGraph(linkedNodesGraph).asSerialisable()
    const second = new LGraph(first).asSerialisable()

    expect(first.links?.length).toBeGreaterThan(0)
    for (const link of first.links ?? []) expectContractKeyOrder(link)
    expect(JSON.stringify(second.links)).toBe(JSON.stringify(first.links))
  })

  test('reroute-chain links keep contract key order and round-trip byte-identically', ({
    expect,
    reroutesComplexGraph
  }) => {
    const first = reroutesComplexGraph.asSerialisable()
    reroutesComplexGraph.clear()
    const second = new LGraph(first).asSerialisable()

    const chainedLinks = (first.links ?? []).filter(
      (link) => link.parentId !== undefined
    )
    expect(chainedLinks.length).toBeGreaterThan(0)
    for (const link of first.links ?? []) expectContractKeyOrder(link)
    expect(JSON.stringify(second.links)).toBe(JSON.stringify(first.links))
  })

  test('floating links keep contract key order and round-trip byte-identically', ({
    expect,
    floatingLinkGraph
  }) => {
    const graph = new LGraph(floatingLinkGraph)
    const first = graph.asSerialisable()
    graph.clear()
    const second = new LGraph(first).asSerialisable()

    expect(first.floatingLinks?.length).toBeGreaterThan(0)
    for (const link of first.floatingLinks ?? []) expectContractKeyOrder(link)
    expect(JSON.stringify(second.floatingLinks)).toBe(
      JSON.stringify(first.floatingLinks)
    )
  })

  const REROUTE_KEYS = ['id', 'parentId', 'pos', 'linkIds', 'floating'] as const

  function expectRerouteContractKeyOrder(reroute: SerialisableReroute) {
    const serialized: Record<string, unknown> = JSON.parse(
      JSON.stringify(reroute)
    )
    const expectedKeys = REROUTE_KEYS.filter(
      (key) => reroute[key] !== undefined
    )
    expect(Object.keys(serialized)).toEqual(expectedKeys)
  }

  test('reroutes keep contract key order and round-trip byte-identically', ({
    expect,
    reroutesComplexGraph
  }) => {
    const first = reroutesComplexGraph.asSerialisable()
    reroutesComplexGraph.clear()
    const second = new LGraph(first).asSerialisable()

    const reroutes = first.reroutes ?? []
    expect(reroutes.length).toBeGreaterThan(0)
    expect(reroutes.some((r) => r.floating !== undefined)).toBe(true)
    expect(reroutes.some((r) => r.parentId === undefined)).toBe(true)
    for (const reroute of reroutes) expectRerouteContractKeyOrder(reroute)
    expect(JSON.stringify(second.reroutes)).toBe(JSON.stringify(first.reroutes))
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

  test('clear() removes graph-scoped preview and widget-value state', () => {
    const graph = new LGraph()
    const graphId = 'graph-clear-cleanup' as UUID
    graph.id = graphId

    const previewExposureStore = usePreviewExposureStore()
    previewExposureStore.addExposure(graphId, `${graphId}:1`, {
      sourceNodeId: '10',
      sourcePreviewName: '$$canvas-image-preview'
    })

    const widgetValueStore = useWidgetValueStore()
    const seedWidgetId = widgetId(graphId, toNodeId('10'), 'seed')
    widgetValueStore.registerWidget(seedWidgetId, {
      type: 'number',
      value: 1,
      options: {},
      label: undefined,
      serialize: undefined,
      disabled: undefined
    })

    expect(widgetValueStore.getWidget(seedWidgetId)).toEqual(
      expect.objectContaining({ value: 1 })
    )
    expect(
      previewExposureStore.getExposures(graphId, `${graphId}:1`)
    ).toHaveLength(1)

    graph.clear()

    expect(widgetValueStore.getWidget(seedWidgetId)).toBeUndefined()
    expect(previewExposureStore.getExposures(graphId, `${graphId}:1`)).toEqual(
      []
    )
  })
})

describe('node:before-removed event', () => {
  it('fires node:before-removed for a successful node removal', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)

    const events: { node: LGraphNode; graphAtDispatch: unknown }[] = []
    graph.events.addEventListener('node:before-removed', (e) => {
      events.push({
        node: e.detail.node,
        graphAtDispatch: e.detail.node.graph
      })
    })

    graph.remove(node)

    expect(events).toHaveLength(1)
    expect(events[0].node).toBe(node)
    expect(events[0].graphAtDispatch).toBe(graph)
    expect(node.graph).toBeNull()
  })

  it('does not fire node:before-removed for a node not in the graph', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')

    const fired = vi.fn()
    graph.events.addEventListener('node:before-removed', fired)

    graph.remove(node)

    expect(fired).not.toHaveBeenCalled()
  })

  it('does not fire node:before-removed when removing an LGraphGroup', () => {
    const graph = new LGraph()
    const group = new LGraphGroup('test-group')
    graph.add(group)

    const fired = vi.fn()
    graph.events.addEventListener('node:before-removed', fired)

    graph.remove(group)

    expect(fired).not.toHaveBeenCalled()
  })

  it('does not fire node:before-removed when ignore_remove is set', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    node.ignore_remove = true

    const fired = vi.fn()
    graph.events.addEventListener('node:before-removed', fired)

    graph.remove(node)

    expect(fired).not.toHaveBeenCalled()
    expect(graph.nodes).toContain(node)
  })

  it('fires node:before-removed before node.onRemoved and detach', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)

    const order: string[] = []
    graph.events.addEventListener('node:before-removed', () => {
      order.push(
        `before-removed(graph=${node.graph === graph ? 'set' : 'null'})`
      )
    })
    node.onRemoved = () => {
      order.push(`onRemoved(graph=${node.graph === graph ? 'set' : 'null'})`)
    }
    graph.onNodeRemoved = (n) => {
      order.push(`onNodeRemoved(graph=${n.graph === null ? 'null' : 'set'})`)
    }

    graph.remove(node)

    expect(order).toEqual([
      'before-removed(graph=set)',
      'onRemoved(graph=set)',
      'onNodeRemoved(graph=set)'
    ])
  })

  it('fires node:added once the node has a layout attachment', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')

    const added = vi.fn((e: NodeLifecycleEvent) => ({
      graph: e.detail.node.graph,
      byId: graph.getNodeById(e.detail.node.id)
    }))
    graph.events.addEventListener('node:added', added)

    graph.add(node)

    expect(added).toHaveBeenCalledOnce()
    expect(added).toHaveReturnedWith({ graph, byId: node })
  })

  it('fires node:removed after the node is detached', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)

    const removed = vi.fn((e: NodeLifecycleEvent) => ({
      graph: e.detail.node.graph,
      byId: graph.getNodeById(node.id) ?? null
    }))
    graph.events.addEventListener('node:removed', removed)

    graph.remove(node)

    expect(removed).toHaveBeenCalledOnce()
    expect(removed).toHaveReturnedWith({ graph: null, byId: null })
  })

  it('fires node:before-removed for every node cleared by clear()', () => {
    const graph = new LGraph()
    graph.add(new LGraphNode('a'))
    graph.add(new LGraphNode('b'))

    const fired = vi.fn()
    graph.events.addEventListener('node:before-removed', fired)

    graph.clear()

    expect(
      fired,
      'clear() must dispatch node:before-removed so subscribers can drop refs before nodes detach'
    ).toHaveBeenCalledTimes(2)
  })
})

describe('Subgraph Definition Garbage Collection', () => {
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

  it('subgraph-definition GC dispatches node:before-removed on the inner subgraph for each inner node', () => {
    const rootGraph = new LGraph()
    const { subgraph, innerNodes } = createSubgraphWithNodes(rootGraph, 2)

    const dispatched: { node: LGraphNode; graphAtDispatch: unknown }[] = []
    subgraph.events.addEventListener('node:before-removed', (e) => {
      dispatched.push({
        node: e.detail.node,
        graphAtDispatch: e.detail.node.graph
      })
    })

    const subgraphNode = createTestSubgraphNode(subgraph, { pos: [100, 100] })
    rootGraph.add(subgraphNode)

    rootGraph.remove(subgraphNode)

    expect(dispatched.map((e) => e.node)).toEqual(innerNodes)
    for (const entry of dispatched) {
      expect(entry.graphAtDispatch).toBe(subgraph)
    }
  })

  it('subgraph-definition GC dispatches node:before-removed before each inner node onRemoved', () => {
    const rootGraph = new LGraph()
    const { subgraph, innerNodes } = createSubgraphWithNodes(rootGraph, 1)
    const innerNode = innerNodes[0]

    const order: string[] = []
    subgraph.events.addEventListener('node:before-removed', () => {
      order.push('before-removed')
    })
    innerNode.onRemoved = () => {
      order.push('onRemoved')
    }
    subgraph.onNodeRemoved = () => {
      order.push('onNodeRemoved')
    }

    const subgraphNode = createTestSubgraphNode(subgraph, { pos: [100, 100] })
    rootGraph.add(subgraphNode)

    rootGraph.remove(subgraphNode)

    expect(order).toEqual(['before-removed', 'onRemoved', 'onNodeRemoved'])
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

  function createNestedDefinitionFixture() {
    const rootGraph = new LGraph()

    const nestedDef = rootGraph.createSubgraph(createTestSubgraphData())
    const producer = new LGraphNode('producer')
    producer.addOutput('out', '*')
    const consumer = new LGraphNode('consumer')
    consumer.addInput('in', '*')
    nestedDef.add(producer)
    nestedDef.add(consumer)
    const innerLink = producer.connect(0, consumer, 0)!
    const innerReroute = nestedDef.createReroute([10, 10], innerLink)!

    const parentDef = rootGraph.createSubgraph(createTestSubgraphData())
    parentDef.add(
      createTestSubgraphNode(nestedDef, { parentGraph: parentDef, id: 30 })
    )

    const parentInstance = createTestSubgraphNode(parentDef, { id: 10 })
    rootGraph.add(parentInstance)

    return {
      rootGraph,
      nestedDef,
      parentDef,
      producer,
      consumer,
      innerReroute,
      parentInstance
    }
  }

  it('keeps a nested definition intact when it is still instanced outside the removed parent', () => {
    const {
      rootGraph,
      nestedDef,
      producer,
      consumer,
      innerReroute,
      parentInstance
    } = createNestedDefinitionFixture()
    const rootNestedInstance = createTestSubgraphNode(nestedDef, { id: 20 })
    rootGraph.add(rootNestedInstance)
    const removalSpies = [producer, consumer].map(
      (node) => (node.onRemoved = vi.fn())
    )

    rootGraph.remove(parentInstance)

    expect(
      useLinkStore().isInputSlotConnected(
        graphScopeOf(nestedDef),
        consumer.id,
        0
      )
    ).toBe(true)
    expect(
      useRerouteStore().getReroute(graphScopeOf(nestedDef), innerReroute.id)?.id
    ).toBe(innerReroute.id)
    expect(rootGraph.subgraphs.has(nestedDef.id)).toBe(true)
    for (const spy of removalSpies) expect(spy).not.toHaveBeenCalled()
  })

  it('releases a nested definition instanced only inside the removed parent', () => {
    const { rootGraph, nestedDef, consumer, innerReroute, parentInstance } =
      createNestedDefinitionFixture()

    rootGraph.remove(parentInstance)

    expect(
      useLinkStore().isInputSlotConnected(
        graphScopeOf(nestedDef),
        consumer.id,
        0
      )
    ).toBe(false)
    expect(
      useRerouteStore().getReroute(graphScopeOf(nestedDef), innerReroute.id)
    ).toBeUndefined()
    expect(rootGraph.subgraphs.has(nestedDef.id)).toBe(false)
  })
})

describe('beforeChange deprecated onBeforeChange shim', () => {
  beforeEach(() => {
    LiteGraph.onDeprecationWarning = []
    LiteGraph.alwaysRepeatWarnings = true
  })

  afterEach(() => {
    LiteGraph.alwaysRepeatWarnings = false
  })

  it('still invokes a listener assigned to onBeforeChange', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    const onBeforeChange = vi.fn()
    graph.onBeforeChange = onBeforeChange

    graph.beforeChange(node)

    expect(onBeforeChange).toHaveBeenCalledWith(graph, node)
  })

  it('warns that onBeforeChange is deprecated when used', () => {
    const graph = new LGraph()
    const deprecationCallback = vi.fn()
    LiteGraph.onDeprecationWarning = [deprecationCallback]
    graph.onBeforeChange = vi.fn()

    graph.beforeChange()

    expect(deprecationCallback).toHaveBeenCalledWith(
      expect.stringContaining('LGraph.onBeforeChange is deprecated'),
      undefined
    )
  })

  it('does not warn when no listener is assigned', () => {
    const graph = new LGraph()
    const deprecationCallback = vi.fn()
    LiteGraph.onDeprecationWarning = [deprecationCallback]

    graph.beforeChange()

    expect(deprecationCallback).not.toHaveBeenCalled()
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

describe('_removeDuplicateLinks', () => {
  class TestNode extends LGraphNode {
    constructor(title?: string) {
      super(title ?? 'TestNode')
      this.addInput('input_0', 'number')
      this.addOutput('output_0', 'number')
    }
  }

  function registerTestNodes() {
    LiteGraph.registerNodeType('test/DupTestNode', TestNode)
  }

  function createConnectedGraph() {
    registerTestNodes()
    const graph = new LGraph()
    const source = LiteGraph.createNode('test/DupTestNode', 'Source')!
    const target = LiteGraph.createNode('test/DupTestNode', 'Target')!
    graph.add(source)
    graph.add(target)
    source.connect(0, target, 0)
    return { graph, source, target }
  }

  function injectDuplicateLink(
    graph: LGraph,
    source: LGraphNode,
    target: LGraphNode
  ) {
    const linkId = toLinkId(Number(graph.state.lastLinkId) + 1)
    graph.state.lastLinkId = linkId
    const dup = new LLink(linkId, 'number', source.id, 0, target.id, 0)
    graph._addLink(dup)
    return dup
  }

  it('removes orphaned duplicate links from _links and output.links', () => {
    const { graph, source, target } = createConnectedGraph()
    const store = useLinkStore()

    for (let i = 0; i < 3; i++) injectDuplicateLink(graph, source, target)

    expect(graph._links.size).toBe(4)
    // The derived output.links view never contained the contested duplicates.
    expect(source.outputs[0].links).toHaveLength(1)

    graph._removeDuplicateLinks()

    expect(graph._links.size).toBe(1)
    expect(source.outputs[0].links).toHaveLength(1)
    expect(store.getInputSlotLink(graphScopeOf(graph), target.id, 0)?.id).toBe(
      source.outputs[0].links![0]
    )
  })

  it('keeps the link registered to the target input', () => {
    const { graph, source, target } = createConnectedGraph()
    const store = useLinkStore()
    const graphId = graphScopeOf(graph)
    const keptLinkId = store.getInputSlotLink(graphId, target.id, 0)!.id

    const dupLink = injectDuplicateLink(graph, source, target)

    graph._removeDuplicateLinks()

    expect(graph._links.size).toBe(1)
    expect(store.getInputSlotLink(graphId, target.id, 0)?.id).toBe(keptLinkId)
    expect(graph._links.has(keptLinkId)).toBe(true)
    expect(graph._links.has(dupLink.id)).toBe(false)
  })

  it('drops purged duplicates from the link store and keeps the survivor indexed', () => {
    const { graph, source, target } = createConnectedGraph()
    const store = useLinkStore()
    const graphId = graphScopeOf(graph)
    const keptLinkId = store.getInputSlotLink(graphId, target.id, 0)!.id

    const dup = injectDuplicateLink(graph, source, target)

    graph._removeDuplicateLinks()

    expect(dup._graphScope).toBeUndefined()
    expect(store.getInputSlotLink(graphId, target.id, 0)?.id).toBe(keptLinkId)
  })

  it('keeps the valid link when the input is at a shifted slot index', () => {
    const { graph, source, target } = createConnectedGraph()
    const store = useLinkStore()
    const validLinkId = store.getInputSlotLink(
      graphScopeOf(graph),
      target.id,
      0
    )!.id

    // Simulate widget-to-input conversion shifting the slot: insert a new
    // input BEFORE the connected one, moving it from index 0 to index 1.
    target.addInput('extra_widget', 'number')
    const connectedInput = target.inputs[0]
    target.inputs[0] = target.inputs[1]
    target.inputs[1] = connectedInput

    const dupLink = injectDuplicateLink(graph, source, target)

    expect(graph._links.size).toBe(2)

    graph._removeDuplicateLinks()

    expect(graph._links.size).toBe(1)
    expect(graph._links.has(validLinkId)).toBe(true)
    expect(graph._links.has(dupLink.id)).toBe(false)
    expect(store.getInputSlotLink(graphScopeOf(graph), target.id, 0)?.id).toBe(
      validLinkId
    )
  })

  it('keeps the surviving link registered after dedup', () => {
    const { graph, source, target } = createConnectedGraph()

    const store = useLinkStore()
    const dupLink = injectDuplicateLink(graph, source, target)

    graph._removeDuplicateLinks()

    expect(graph._links.size).toBe(1)
    expect(graph._links.has(dupLink.id)).toBe(false)
    const survivingId = graph._links.keys().next().value!
    const registeredLink = store.getInputSlotLink(
      graphScopeOf(graph),
      target.id,
      0
    )
    expect(registeredLink?.id).toBe(survivingId)
    expect(graph._links.has(registeredLink!.id)).toBe(true)
  })

  it('is a no-op when no duplicates exist', () => {
    const { graph } = createConnectedGraph()
    const linksBefore = graph._links.size

    graph._removeDuplicateLinks()

    expect(graph._links.size).toBe(linksBefore)
  })

  it('cleans up duplicate links in subgraph during configure', () => {
    const subgraphData = createTestSubgraphData()
    const rootGraph = new LGraph()
    const subgraph = rootGraph.createSubgraph(subgraphData)

    const source = new LGraphNode('Source')
    source.addOutput('out', 'number')
    const target = new LGraphNode('Target')
    target.addInput('in', 'number')
    subgraph.add(source)
    subgraph.add(target)

    source.connect(0, target, 0)

    for (let i = 0; i < 3; i++) injectDuplicateLink(subgraph, source, target)
    expect(subgraph._links.size).toBe(4)

    const serialized = subgraph.asSerialisable()
    subgraph.configure(serialized as never)

    expect(subgraph._links.size).toBe(1)
  })

  it('removes duplicate links via root graph configure()', () => {
    registerTestNodes()
    const graph = new LGraph()
    graph.configure(duplicateLinksRoot)

    expect(graph._links.size).toBe(1)
    const survivingLink = graph._links.values().next().value!
    const targetNode = graph.getNodeById(survivingLink.target_id)!
    expect(targetNode.inputs[0].link).toBe(survivingLink.id)
    const sourceNode = graph.getNodeById(survivingLink.origin_id)!
    expect(sourceNode.outputs[0].links).toEqual([survivingLink.id])
  })

  it('preserves link integrity after configure() with slot-shifted duplicates', () => {
    registerTestNodes()
    const graph = new LGraph()
    graph.configure(duplicateLinksSlotShift)

    expect(graph._links.size).toBe(1)

    const link = graph._links.values().next().value!
    const target = graph.getNodeById(link.target_id)!
    const linkedInput = target.inputs.find((inp) => inp.link === link.id)
    expect(linkedInput).toBeDefined()

    const source = graph.getNodeById(link.origin_id)!
    expect(source.outputs[link.origin_slot].links).toContain(link.id)
  })

  it('deduplicates links inside subgraph definitions during root configure()', () => {
    const graph = new LGraph()
    graph.configure(duplicateLinksSubgraph)

    const subgraph = graph.subgraphs.values().next().value!
    expect(subgraph._links.size).toBe(1)

    const link = subgraph._links.values().next().value!
    const target = subgraph.getNodeById(link.target_id)!
    expect(target.inputs[0].link).toBe(link.id)
  })
})

describe('Subgraph Unpacking', () => {
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

  function duplicateExistingLink(graph: LGraph) {
    const existingLink = graph._links.values().next().value!
    const linkId = toLinkId(Number(graph.state.lastLinkId) + 1)
    graph.state.lastLinkId = linkId
    const dup = new LLink(
      linkId,
      existingLink.type,
      existingLink.origin_id,
      existingLink.origin_slot,
      existingLink.target_id,
      existingLink.target_slot
    )
    graph._links.set(dup.id, dup)
    return dup
  }

  it('deduplicates links when unpacking subgraph with duplicate links', () => {
    registerTestNodes()
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)

    const sourceNode = LiteGraph.createNode('test/TestNode', 'Source')!
    const targetNode = LiteGraph.createNode('test/TestNode', 'Target')!
    subgraph.add(sourceNode)
    subgraph.add(targetNode)

    sourceNode.connect(0, targetNode, 0)

    for (let i = 0; i < 3; i++) duplicateExistingLink(subgraph)
    expect(subgraph._links.size).toBe(4)

    const subgraphNode = createTestSubgraphNode(subgraph, { pos: [100, 100] })
    rootGraph.add(subgraphNode)

    rootGraph.unpackSubgraph(subgraphNode)

    // After unpacking, there should be exactly 1 link (not 4)
    expect(rootGraph.links.size).toBe(1)
  })

  it('clears subgraph geometry only for the owning root graph', () => {
    registerTestNodes()
    const firstRoot = new LGraph()
    const secondRoot = new LGraph()
    firstRoot.id = createUuidv4()
    secondRoot.id = createUuidv4()
    const firstRootId = firstRoot.id
    const subgraph = createSubgraphOnGraph(firstRoot)
    const SHARED_GROUP = toGroupId(909)
    const subgraphGroup = new LGraphGroup('subgraph group', SHARED_GROUP)
    const secondGroup = new LGraphGroup('second root group', SHARED_GROUP)

    subgraph.add(subgraphGroup)
    secondRoot.add(secondGroup)
    expect(
      layoutStore.getGroupLayout(firstRoot.id, SHARED_GROUP)
    ).not.toBeNull()
    expect(
      layoutStore.getGroupLayout(secondRoot.id, SHARED_GROUP)
    ).not.toBeNull()

    firstRoot.clear()

    expect(layoutStore.getGroupLayout(firstRootId, SHARED_GROUP)).toBeNull()
    expect(
      layoutStore.getGroupLayout(secondRoot.id, SHARED_GROUP)
    ).not.toBeNull()
  })

  it('offsets unpacked group geometry in the layout store too', () => {
    registerTestNodes()
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)

    const group = new LGraphGroup('inner', 909)
    group.pos = [10, 20]
    group.size = [200, 150]
    subgraph.add(group)

    const subgraphNode = createTestSubgraphNode(subgraph, { pos: [100, 100] })
    rootGraph.add(subgraphNode)

    rootGraph.unpackSubgraph(subgraphNode)

    // Unpacking centres the subgraph contents on the wrapper node, moving the
    // group from [10, 20] to [100, 75].
    const unpacked = rootGraph.groups.find((g) => g.title === 'inner')!
    expect(
      layoutStore.getGroupLayout(rootGraph.id, unpacked.id)?.position
    ).toEqual({
      x: 100,
      y: 75
    })
  })

  it('preserves correct link connections when unpacking with duplicate links', () => {
    registerTestNodes()
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)

    const sourceNode = LiteGraph.createNode('test/MultiInputNode', 'Source')!
    const targetNode = LiteGraph.createNode('test/MultiInputNode', 'Target')!
    subgraph.add(sourceNode)
    subgraph.add(targetNode)

    sourceNode.connect(0, targetNode, 0)
    duplicateExistingLink(subgraph)

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

  it('keeps subgraph definition when unpacking one instance while another remains', () => {
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)

    const retainedGroup = new LGraphGroup('shared', 909)
    retainedGroup.pos = [10, 20]
    retainedGroup.size = [200, 150]
    subgraph.add(retainedGroup)

    const firstInstance = createTestSubgraphNode(subgraph, { pos: [100, 100] })
    const secondInstance = createTestSubgraphNode(subgraph, { pos: [300, 100] })
    secondInstance.id = toNodeId(2)
    rootGraph.add(firstInstance)
    rootGraph.add(secondInstance)

    rootGraph.unpackSubgraph(firstInstance)

    expect(rootGraph.subgraphs.has(subgraph.id)).toBe(true)

    // The unpacked copy must not share the retained definition's layout entry.
    const unpackedGroup = rootGraph.groups.find((g) => g.title === 'shared')!
    unpackedGroup.move(50, 50)
    expect([...retainedGroup.pos]).toEqual([10, 20])

    const serialized = rootGraph.serialize()
    const definitionIds =
      serialized.definitions?.subgraphs?.map((definition) => definition.id) ??
      []
    expect(definitionIds).toContain(subgraph.id)
  })
})

describe('deduplicateSubgraphNodeIds (via configure)', () => {
  const SUBGRAPH_A = '11111111-1111-4111-8111-111111111111' as UUID
  const SUBGRAPH_B = '22222222-2222-4222-8222-222222222222' as UUID
  const SHARED_NODE_IDS = [3, 8, 37]

  beforeEach(() => {
    LiteGraph.registerNodeType('dummy', DummyNode)
  })

  function loadFixture(): SerialisableGraph {
    return structuredClone(duplicateSubgraphNodeIds)
  }

  function configureFromFixture() {
    const graphData = loadFixture()
    const graph = new LGraph()
    graph.configure(graphData)
    return { graph, graphData }
  }

  function nodeIdSet(graph: LGraph, subgraphId: UUID) {
    return new Set(graph.subgraphs.get(subgraphId)!.nodes.map((n) => n.id))
  }

  it('remaps duplicate node IDs so subgraphs have no overlap', () => {
    const { graph } = configureFromFixture()

    const idsA = nodeIdSet(graph, SUBGRAPH_A)
    const idsB = nodeIdSet(graph, SUBGRAPH_B)

    for (const id of SHARED_NODE_IDS) {
      expect(idsA.has(toNodeId(id))).toBe(true)
    }
    for (const id of idsA) {
      expect(idsB.has(id)).toBe(false)
    }
  })

  it('patches link references in remapped subgraph', () => {
    const { graph } = configureFromFixture()
    const idsB = nodeIdSet(graph, SUBGRAPH_B)

    for (const link of graph.subgraphs.get(SUBGRAPH_B)!.links.values()) {
      if (link.origin_id !== UNASSIGNED_NODE_ID)
        expect(idsB.has(link.origin_id)).toBe(true)
      if (link.target_id !== UNASSIGNED_NODE_ID)
        expect(idsB.has(link.target_id)).toBe(true)
    }
  })

  it('patches promoted widget references in remapped subgraph', () => {
    const { graph } = configureFromFixture()
    const idsB = nodeIdSet(graph, SUBGRAPH_B)

    for (const widget of graph.subgraphs.get(SUBGRAPH_B)!.widgets) {
      expect(idsB.has(toNodeId(widget.id))).toBe(true)
    }
  })

  it('patches proxyWidgets in root-level nodes referencing remapped IDs', () => {
    const { graph } = configureFromFixture()

    const idsA = new Set(
      graph.subgraphs.get(SUBGRAPH_A)!.nodes.map((n) => String(n.id))
    )
    const idsB = new Set(
      graph.subgraphs.get(SUBGRAPH_B)!.nodes.map((n) => String(n.id))
    )

    const pw102 = graph.getNodeById(toNodeId(102))?.properties?.proxyWidgets
    expect(Array.isArray(pw102)).toBe(true)
    for (const entry of pw102 as unknown[][]) {
      expect(Array.isArray(entry)).toBe(true)
      expect(idsA.has(String(entry[0]))).toBe(true)
    }

    const pw103 = graph.getNodeById(toNodeId(103))?.properties?.proxyWidgets
    expect(Array.isArray(pw103)).toBe(true)
    for (const entry of pw103 as unknown[][]) {
      expect(Array.isArray(entry)).toBe(true)
      expect(idsB.has(String(entry[0]))).toBe(true)
    }
  })

  it('patches proxyWidgets inside nested subgraph nodes', () => {
    const graph = new LGraph()
    graph.configure(structuredClone(nestedSubgraphProxyWidgets))

    const idsB = new Set(
      graph.subgraphs.get(SUBGRAPH_B)!.nodes.map((n) => String(n.id))
    )

    const innerNode = graph.subgraphs
      .get(SUBGRAPH_A)!
      .nodes.find((n) => n.id === toNodeId(50))
    const pw = innerNode?.properties?.proxyWidgets
    expect(Array.isArray(pw)).toBe(true)
    for (const entry of pw as unknown[][]) {
      expect(Array.isArray(entry)).toBe(true)
      expect(idsB.has(String(entry[0]))).toBe(true)
    }
  })

  it('warns when configuring a host with legacy proxyWidgets and no migration hook is wired', () => {
    const subgraph = createTestSubgraph()
    const sourceHost = createTestSubgraphNode(subgraph)
    sourceHost.graph!.add(sourceHost)
    sourceHost.properties.proxyWidgets = [['9999', 'seed']]
    const serialized = sourceHost.rootGraph.serialize()
    const instanceData = sourceHost.serialize()
    sourceHost.rootGraph.clear()

    const previous = LGraph.proxyWidgetMigrationFlush
    LGraph.proxyWidgetMigrationFlush = undefined
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    LiteGraph.registerNodeType(
      subgraph.id,
      class TestSubgraphNode extends SubgraphNode {
        constructor() {
          super(new LGraph(), subgraph, instanceData)
        }
      }
    )
    try {
      const graph = new LGraph()
      graph.configure(serialized)

      const migrationCall = warn.mock.calls.find(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('Legacy proxyWidgets were not migrated')
      )
      expect(migrationCall).toBeDefined()
      expect(migrationCall![1]).toEqual(
        expect.objectContaining({
          hostNodeId: expect.any(String),
          proxyWidgets: expect.anything()
        })
      )
    } finally {
      LGraph.proxyWidgetMigrationFlush = previous
      LiteGraph.unregisterNodeType(subgraph.id)
      warn.mockRestore()
    }
  })

  it('throws when node ID space is exhausted', () => {
    expect(() => {
      const graph = new LGraph()
      graph.configure(structuredClone(nodeIdSpaceExhausted))
    }).toThrow('Node ID space exhausted')
  })

  it('is a no-op when subgraph node IDs are already unique', () => {
    const graph = new LGraph()
    graph.configure(structuredClone(uniqueSubgraphNodeIds))

    expect(nodeIdSet(graph, SUBGRAPH_A)).toEqual(
      new Set([toNodeId(10), toNodeId(11), toNodeId(12)])
    )
    expect(nodeIdSet(graph, SUBGRAPH_B)).toEqual(
      new Set([toNodeId(20), toNodeId(21), toNodeId(22)])
    )
  })
})

describe('Zero UUID handling in configure', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('rejects zeroUuid for root graphs and assigns a new ID', () => {
    const graph = new LGraph()
    const data = graph.serialize()
    data.id = zeroUuid
    graph.configure(data)
    expect(graph.id).not.toBe(zeroUuid)
  })

  it('preserves zeroUuid for subgraphs', () => {
    const graph = new LGraph()
    const subgraphData = { ...createTestSubgraphData(), id: zeroUuid }
    const subgraph = graph.createSubgraph(subgraphData)
    subgraph.configure(subgraphData)
    expect(subgraph.id).toBe(zeroUuid)
  })
})

describe('keep-old root identity', () => {
  it('retains the live identity when only floating links are populated', () => {
    const graph = new LGraph()
    const originalId = graph.id
    const replacementId = createUuidv4()
    graph.addFloatingLink(
      new LLink(
        toLinkId(7),
        '*',
        UNASSIGNED_NODE_ID,
        -1,
        UNASSIGNED_NODE_ID,
        -1
      )
    )
    const data = { ...graph.asSerialisable(), id: replacementId }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    onTestFinished(() => warn.mockRestore())

    graph.configure(data, true)

    expect(graph.id).toBe(originalId)
    expect(warn).toHaveBeenCalledWith(
      '[LGraph] Keeping current root identity during configuration',
      {
        currentGraphId: originalId,
        mode: 'keep-old',
        requestedGraphId: replacementId
      }
    )
  })

  it('remaps incoming reroutes that collide with retained definitions', () => {
    const graph = new LGraph()
    const incoming = graph.createSubgraph(createTestSubgraphData())
    const retained = graph.createSubgraph(createTestSubgraphData())
    incoming._addReroute(new Reroute(toRerouteId(1), incoming, [10, 20]))
    const retainedReroute = new Reroute(toRerouteId(2), retained, [30, 40])
    retained._addReroute(retainedReroute)
    const data = graph.asSerialisable()
    const definitions = [incoming.asSerialisable(), retained.asSerialisable()]
    data.definitions = {
      subgraphs: definitions.filter(({ id }) => id !== retained.id)
    }
    const incomingData = data.definitions.subgraphs?.find(
      ({ id }) => id === incoming.id
    )
    if (!incomingData?.reroutes) {
      throw new Error('Expected serialized incoming reroute')
    }
    incomingData.reroutes[0].id = retainedReroute.id

    expect(() => graph.configure(data, true)).not.toThrow()

    expect(retained.reroutes.get(retainedReroute.id)).toBe(retainedReroute)
    expect(
      graph.subgraphs.get(incoming.id)?.reroutes.has(retainedReroute.id)
    ).toBe(false)
  })
})

describe('configure link identity', () => {
  it('keeps the first serialized link when IDs are duplicated', () => {
    const source = new LGraphNode('source')
    source.addOutput('out', 'number')
    const target = new LGraphNode('target')
    target.addInput('in', 'number')
    const graph = createGraph(source, target)
    source.connect(0, target, 0)
    const data = graph.asSerialisable()
    const links = data.links
    if (!links) throw new Error('Expected serialized link')
    const first = links[0]
    links.push({ ...first, type: 'duplicate' })

    graph.configure(data)

    const configured = graph._links.get(toLinkId(first.id))
    expect(configured?.type).toBe(first.type)
    expect(
      useLinkStore().getLink(graphScopeOf(graph), toLinkId(first.id))
    ).toBe(configured?._state)
  })
})

describe('floating link ID allocation', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function createConnectedPair(graph: LGraph) {
    const source = new LGraphNode('source')
    source.addOutput('out', 'number')
    const target = new LGraphNode('target')
    target.addInput('in', 'number')
    graph.add(source)
    graph.add(target)
    return source.connect(0, target, 0)!
  }

  it('advances shared link ID state when minting floating link IDs', () => {
    const graph = new LGraph()
    const liveLink = createConnectedPair(graph)

    const floatingLink = graph.addFloatingLink(
      new LLink(
        toLinkId(-1),
        '*',
        UNASSIGNED_NODE_ID,
        -1,
        UNASSIGNED_NODE_ID,
        -1
      )
    )
    const secondLiveLink = createConnectedPair(graph)

    const allIds = new Set([liveLink.id, floatingLink.id, secondLiveLink.id])
    expect(allIds.size).toBe(3)
    expect(graph.links.get(liveLink.id)).toBe(liveLink)
    expect(graph.links.get(secondLiveLink.id)).toBe(secondLiveLink)
    expect(graph.floatingLinks.get(floatingLink.id)).toBe(floatingLink)
  })

  it('advances shared link ID state past explicit floating link IDs', () => {
    const graph = new LGraph()
    const floatingLink = graph.addFloatingLink(
      new LLink(
        toLinkId(7),
        '*',
        UNASSIGNED_NODE_ID,
        -1,
        UNASSIGNED_NODE_ID,
        -1
      )
    )

    const liveLink = createConnectedPair(graph)

    expect(liveLink.id).toBeGreaterThan(floatingLink.id)
    expect(graph.floatingLinks.get(floatingLink.id)).toBe(floatingLink)
    expect(graph.links.get(liveLink.id)).toBe(liveLink)
  })

  it('remints an explicit floating link ID that collides with a live link', () => {
    const graph = new LGraph()
    const liveLink = createConnectedPair(graph)
    const floatingLink = graph.addFloatingLink(
      new LLink(
        liveLink.id,
        '*',
        UNASSIGNED_NODE_ID,
        -1,
        UNASSIGNED_NODE_ID,
        -1
      )
    )

    expect(floatingLink.id).not.toBe(liveLink.id)
    expect(graph.links.get(liveLink.id)).toBe(liveLink)
    expect(graph.floatingLinks.get(floatingLink.id)).toBe(floatingLink)
  })

  it('remints colliding floating link IDs while configuring reroutes', () => {
    const source = new DummyNode()
    source.addOutput('out', 'number')
    const target = new DummyNode()
    target.addInput('in', 'number')
    LiteGraph.registerNodeType('dummy', DummyNode)
    onTestFinished(() => LiteGraph.unregisterNodeType('dummy'))

    const original = createGraph(source, target)
    const liveLink = source.connect(0, target, 0)!
    const reroute = original.createReroute([10, 10], liveLink)!
    const data = original.asSerialisable()
    data.floatingLinks = [
      new LLink(
        liveLink.id,
        '*',
        UNASSIGNED_NODE_ID,
        -1,
        UNASSIGNED_NODE_ID,
        -1,
        reroute.id
      ).asSerialisable()
    ]
    original.clear()

    const graph = new LGraph()
    graph.configure(data)

    const configuredLiveLink = graph.links.get(liveLink.id)
    const [floatingLink] = graph.floatingLinks.values()
    expect(configuredLiveLink?.parentId).toBe(reroute.id)
    expect(floatingLink.id).not.toBe(liveLink.id)
    expect(graph.floatingLinks.get(floatingLink.id)).toBe(floatingLink)
    expect(graph.reroutes.get(reroute.id)?.totalLinks).toBe(2)
  })
})

describe('Subgraph configure events', () => {
  it('does not apply subgraph data when configuration is canceled', () => {
    const root = new LGraph()
    const subgraph = root.createSubgraph(createTestSubgraphData())
    const originalName = subgraph.name
    const data = { ...subgraph.asSerialisable(), name: 'Canceled' }
    subgraph.events.addEventListener('configuring', (event) =>
      event.preventDefault()
    )

    subgraph.configure(data)

    expect(subgraph.name).toBe(originalName)
  })

  it('applies replacement data supplied by configuring listeners', () => {
    const root = new LGraph()
    const subgraph = root.createSubgraph(createTestSubgraphData())
    const replacement = { ...subgraph.asSerialisable(), name: 'Replacement' }
    subgraph.events.addEventListener('configuring', (event) => {
      event.detail.data = replacement
    })

    subgraph.configure({ ...subgraph.asSerialisable(), name: 'Original' })

    expect(subgraph.name).toBe('Replacement')
  })

  it('keeps reentrant replacement and cancellation data invocation-local', () => {
    const root = new LGraph()
    const subgraph = root.createSubgraph(createTestSubgraphData())
    const appliedDuringOuter: string[] = []
    subgraph.events.addEventListener('configuring', (event) => {
      const name =
        'name' in event.detail.data ? event.detail.data.name : undefined
      if (name === 'Outer original') {
        event.detail.data = createTestSubgraphData({
          ...subgraph.asSerialisable(),
          name: 'Outer replacement'
        })
      } else if (name === 'Inner original') {
        event.detail.data = createTestSubgraphData({
          ...subgraph.asSerialisable(),
          name: 'Inner replacement'
        })
      } else if (name === 'Canceled original') {
        event.preventDefault()
      }
    })
    let reentered = false
    subgraph.events.addEventListener('configured', () => {
      if (reentered) return
      reentered = true
      subgraph.configure({
        ...subgraph.asSerialisable(),
        name: 'Inner original'
      })
      appliedDuringOuter.push(subgraph.name)
      subgraph.configure({
        ...subgraph.asSerialisable(),
        name: 'Canceled original'
      })
      appliedDuringOuter.push(subgraph.name)
    })

    subgraph.configure({
      ...subgraph.asSerialisable(),
      name: 'Outer original'
    })

    expect(appliedDuringOuter).toEqual([
      'Inner replacement',
      'Inner replacement'
    ])
    expect(subgraph.name).toBe('Outer replacement')
  })
})

describe('node layout attachment', () => {
  beforeEach(() => {
    layoutStore.resetForTests()
  })

  it('creates a layout entry on add and drops it on remove', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.pos = [120, 340]
    graph.add(node)

    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value?.position
    ).toEqual({
      x: 120,
      y: 340
    })

    graph.remove(node)

    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value
    ).toBeNull()
  })

  it('queues deferred node:added work before the layout-driven Vue flush', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    const order: string[] = []
    const stop = watch(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, toNodeId(1)),
      () => order.push('layout')
    )
    onTestFinished(stop)

    graph.events.addEventListener('node:added', () => {
      queueMicrotask(() => order.push('listener'))
    })

    graph.add(node)
    await nextTick()

    expect(order).toEqual(['listener', 'layout'])
  })

  it('drains layout writes triggered while deferred notifications flush', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    const operationTypes: string[] = []
    const stopChanges = layoutStore.onChange((change) => {
      operationTypes.push(change.operation.type)
    })
    onTestFinished(stopChanges)
    let moved = false
    const stopWatch = watch(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, toNodeId(1)),
      () => {
        if (moved) return
        moved = true
        node.pos = [20, 30]
      },
      { flush: 'sync' }
    )
    onTestFinished(stopWatch)

    graph.add(node)
    await nextTick()

    expect(operationTypes).toEqual(['createNode', 'moveNode'])
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value?.position
    ).toEqual({ x: 20, y: 30 })
  })

  it('does not publish a node when layout attachment is rejected', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    const added = vi.fn()
    graph.events.addEventListener('node:added', added)
    const applyOperation = vi
      .spyOn(layoutStore, 'applyOperation')
      .mockReturnValueOnce('rejected')
    onTestFinished(() => applyOperation.mockRestore())
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    onTestFinished(() => warn.mockRestore())

    graph.add(node)

    expect(graph.nodes).not.toContain(node)
    expect(graph.getNodeById(node.id)).toBeNull()
    expect(node.graph).toBeNull()
    expect(added).not.toHaveBeenCalled()
    expect(
      useNodeDataStore().getGraphNodesFor(graph.id, graph.id)
    ).not.toContain(node._state)
  })

  it('finishes layout publication when an add callback throws', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.onAdded = () => {
      throw new Error('add failed')
    }

    expect(() => graph.add(node)).toThrow('add failed')

    expect(graph.nodes).toContain(node)
    expect(node.graph).toBe(graph)
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value
    ).not.toBeNull()
  })

  it('transfers layout attachment to a replacement node', () => {
    const graph = new LGraph()
    const node = new LGraphNode('old')
    node.pos = [120, 340]
    graph.add(node)
    const replacement = new LGraphNode('replacement')
    replacement.id = node.id
    replacement.graph = graph

    expect(transferLayoutAttachment(node, replacement)).toBe('applied')

    replacement.pos = [220, 440]
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value?.position
    ).toEqual({ x: 220, y: 440 })

    node.pos = [320, 540]
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value?.position
    ).toEqual({ x: 220, y: 440 })
  })

  it('rejects transfer when the backing layout is missing', () => {
    const graph = new LGraph()
    const node = new LGraphNode('old')
    node.pos = [120, 340]
    graph.add(node)
    const replacement = new LGraphNode('replacement')
    replacement.id = node.id
    replacement.graph = graph
    const nodes = getLayoutStoreYDoc().getMap<Y.Map<unknown>>('nodes')
    nodes.delete(`${graph.rootGraph.id}:${node.id}`)

    expect(transferLayoutAttachment(node, replacement)).toBe('rejected')
    expect(() => adoptNodeReplacement(graph, node, replacement, 0)).toThrow(
      'Node layout attachment transfer rejected'
    )
    expect(graph.nodes).toEqual([node])
    expect(graph.getNodeById(node.id)).toBe(node)

    replacement.pos = [220, 440]
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value
    ).toBeNull()
  })

  it('restores layout attachment when replacement removal lifecycle throws', () => {
    const graph = new LGraph()
    const node = new LGraphNode('old')
    graph.add(node)
    const replacement = new LGraphNode('replacement')
    replacement.id = node.id
    const lifecycleError = new Error('removal failed')
    node.onRemoved = () => {
      throw lifecycleError
    }

    expect(() => adoptNodeReplacement(graph, node, replacement, 0)).toThrow(
      lifecycleError
    )
    expect(graph.nodes).toEqual([node])
    expect(graph.getNodeById(node.id)).toBe(node)

    node.pos = [220, 440]
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value?.position
    ).toEqual({ x: 220, y: 440 })
  })

  function zIndexOf(graph: LGraph, node: LGraphNode): number {
    const zIndex = layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id)
      .value?.zIndex
    if (zIndex === undefined) throw new Error(`Node ${node.id} has no layout`)
    return zIndex
  }

  it('restores an attached node layout when onBeforeChange throws', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.pos = [120, 340]
    graph.add(node)
    graph.onBeforeChange = () => {
      throw new Error('before change failed')
    }

    expect(() => graph.remove(node)).toThrow('before change failed')
    expect(graph.nodes).toContain(node)
    expect(node.graph).toBe(graph)
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value?.position
    ).toEqual({
      x: 120,
      y: 340
    })

    node.pos = [220, 440]
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value?.position
    ).toEqual({
      x: 220,
      y: 440
    })

    graph.onBeforeChange = undefined
    graph.remove(node)
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value
    ).toBeNull()
  })

  it('restores node layout when canvas deselect throws after detachment', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.pos = [120, 340]
    graph.add(node)
    const canvas = fromAny<LGraphCanvas, unknown>({
      checkPanels: vi.fn(),
      selected_nodes: { [node.id]: node },
      setDirty: vi.fn(),
      deselect: vi.fn().mockImplementationOnce(() => {
        expect(node.graph).toBeNull()
        throw new Error('node deselect failed')
      })
    })
    graph.list_of_graphcanvas = [canvas]

    expect(() => graph.remove(node)).toThrow('node deselect failed')
    expect(graph.nodes).toContain(node)
    expect(graph.getNodeById(node.id)).toBe(node)
    expect(node.graph).toBe(graph)
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value?.position
    ).toEqual({
      x: 120,
      y: 340
    })

    node.pos = [220, 440]
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value?.position
    ).toEqual({
      x: 220,
      y: 440
    })
    graph.remove(node)
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value
    ).toBeNull()
  })

  it('preserves subgraph graph and layout state when removal aborts', () => {
    const graph = new LGraph()
    const source = new LGraphNode('source')
    source.addOutput('out', '*')
    const target = new LGraphNode('target')
    target.addInput('in', '*')
    graph.add(source)
    graph.add(target)
    const subgraph = graph.createSubgraph(createTestSubgraphData())
    const interior = new LGraphNode('interior')
    interior.pos = [10, 20]
    interior.addOutput('out', '*')
    const peer = new LGraphNode('peer')
    peer.addInput('in', '*')
    subgraph.add(interior)
    subgraph.add(peer)
    const link = interior.connect(0, peer, 0)!
    const group = new LGraphGroup('interior group')
    group.pos = [5, 6]
    subgraph.add(group)
    const reroute = subgraph.createReroute([15, 16], link)!
    const nested = graph.createSubgraph(createTestSubgraphData())
    const nestedInterior = new LGraphNode('nested interior')
    nestedInterior.pos = [50, 60]
    nested.add(nestedInterior)
    const nestedNode = createTestSubgraphNode(nested, { parentGraph: subgraph })
    subgraph.add(nestedNode)
    const subgraphNode = createTestSubgraphNode(subgraph)
    subgraphNode.addInput('in', '*')
    subgraphNode.addOutput('out', '*')
    graph.add(subgraphNode)
    const inputLink = source.connect(0, subgraphNode, 0)!
    const outputLink = subgraphNode.connect(0, target, 0)!
    const onConnectionChange = vi.fn()
    graph.onConnectionChange = onConnectionChange
    const onNodeRemoved = vi.fn()
    graph.onNodeRemoved = onNodeRemoved
    subgraphNode.onRemoved = () => {
      throw new Error('outer removal failed')
    }

    expect(() => graph.remove(subgraphNode)).toThrow('outer removal failed')
    expect(graph.nodes).toContain(subgraphNode)
    expect(subgraphNode.graph).toBe(graph)
    expect(graph.links.get(inputLink.id)).toBe(inputLink)
    expect(graph.links.get(outputLink.id)).toBe(outputLink)
    expect(source.isOutputConnected(0)).toBe(true)
    expect(subgraphNode.isInputConnected(0)).toBe(true)
    expect(subgraphNode.isOutputConnected(0)).toBe(true)
    expect(target.isInputConnected(0)).toBe(true)
    expect(subgraph.nodes).toContain(nestedNode)
    expect(nestedNode.subgraph).toBe(nested)
    expect(subgraph._links.get(link.id)).toBe(link)
    expect(subgraph.reroutes.get(reroute.id)).toBe(reroute)
    expect(link.parentId).toBe(reroute.id)
    expect(
      useLinkStore().getLink(graphScopeOf(graph), inputLink.id)
    ).toBeDefined()
    expect(
      useLinkStore().getLink(graphScopeOf(graph), outputLink.id)
    ).toBeDefined()
    expect(
      useLinkStore().getLink(graphScopeOf(subgraph), link.id)
    ).toBeDefined()
    expect(
      useRerouteStore().getReroute(graphScopeOf(subgraph), reroute.id)
    ).toBeDefined()
    expect(
      useNodeDataStore().getGraphNodesFor(graph.id, subgraph.id)
    ).not.toHaveLength(0)
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, interior.id).value
        ?.position
    ).toEqual({
      x: 10,
      y: 20
    })

    interior.pos = [30, 40]
    group.pos = [25, 26]
    reroute.pos = [35, 36]
    nestedInterior.pos = [70, 80]
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, interior.id).value
        ?.position
    ).toEqual({
      x: 30,
      y: 40
    })
    expect(layoutStore.getGroupLayout(graph.id, group.id)?.position).toEqual({
      x: 25,
      y: 26
    })
    expect(
      layoutStore.getRerouteLayout(graph.id, reroute.id)?.position
    ).toEqual({ x: 35, y: 36 })
    expect(
      layoutStore.getNodeLayoutRef(graph.id, nestedInterior.id).value?.position
    ).toEqual({ x: 70, y: 80 })

    onConnectionChange.mockClear()
    onNodeRemoved.mockClear()
    subgraphNode.onRemoved = () => {}
    const applyOperation = vi
      .spyOn(layoutStore, 'applyOperation')
      .mockReturnValueOnce('rejected')
    onTestFinished(() => applyOperation.mockRestore())
    expect(() => graph.remove(subgraphNode)).not.toThrow()

    expect(graph.nodes).toContain(subgraphNode)
    expect(graph.links.get(inputLink.id)).toBe(inputLink)
    expect(graph.links.get(outputLink.id)).toBe(outputLink)
    expect(onConnectionChange).not.toHaveBeenCalled()
    expect(onNodeRemoved).toHaveBeenCalledOnce()
    expect(subgraphNode.graph).toBe(graph)
    expect(graph.subgraphs.get(subgraph.id)).toBe(subgraph)
    expect(
      useLinkStore().getLink(graphScopeOf(graph), inputLink.id)
    ).toBeDefined()
    expect(
      useLinkStore().getLink(graphScopeOf(graph), outputLink.id)
    ).toBeDefined()
    expect(
      useLinkStore().getLink(graphScopeOf(subgraph), link.id)
    ).toBeDefined()
    expect(
      useRerouteStore().getReroute(graphScopeOf(subgraph), reroute.id)
    ).toBeDefined()
    expect(
      useNodeDataStore().getGraphNodesFor(graph.id, subgraph.id)
    ).not.toHaveLength(0)

    graph.remove(subgraphNode)

    expect(graph.nodes).not.toContain(subgraphNode)
    expect(graph.subgraphs.has(subgraph.id)).toBe(false)
    expect(graph.subgraphs.has(nested.id)).toBe(false)
    expect([
      ...useLinkStore().graphTopologies(graphScopeOf(graph))
    ]).toHaveLength(0)
    expect([
      ...useLinkStore().graphTopologies(graphScopeOf(subgraph))
    ]).toHaveLength(0)
    expect(
      useRerouteStore().getReroute(graphScopeOf(subgraph), reroute.id)
    ).toBeUndefined()
    expect(
      useNodeDataStore().getGraphNodesFor(graph.id, subgraph.id)
    ).toHaveLength(0)
    expect(layoutStore.getNodeLayoutRef(graph.id, interior.id).value).toBeNull()
    expect(layoutStore.getGroupLayout(graph.id, group.id)).toBeNull()
    expect(layoutStore.getRerouteLayout(graph.id, reroute.id)).toBeNull()
    expect(
      layoutStore.getNodeLayoutRef(graph.id, nestedInterior.id).value
    ).toBeNull()
  })

  it('stacks later nodes above earlier ones', () => {
    const graph = new LGraph()
    const first = new LGraphNode('first')
    const second = new LGraphNode('second')
    graph.add(first)
    graph.add(second)

    expect(zIndexOf(graph, second)).toBeGreaterThan(zIndexOf(graph, first))
  })

  it('does not reuse z-indexes after removing an earlier node', () => {
    const graph = new LGraph()
    const first = new LGraphNode('first')
    const second = new LGraphNode('second')
    graph.add(first)
    graph.add(second)
    graph.remove(first)

    const third = new LGraphNode('third')
    graph.add(third)

    expect(zIndexOf(graph, third)).toBeGreaterThan(zIndexOf(graph, second))
  })
})

describe('graph teardown drops layout entries', () => {
  const REROUTE = toRerouteId(1)

  function layoutEntryCount(graph: LGraph) {
    const rootGraphId = graph.rootGraph.id
    const nodeKeys = [
      ...getLayoutStoreYDoc().getMap<Y.Map<unknown>>('nodes').keys()
    ].filter((key) => key.startsWith(`${rootGraphId}:`))
    return (
      nodeKeys.length +
      layoutStore.getAllGroups(rootGraphId).value.size +
      (layoutStore.getRerouteLayout(rootGraphId, REROUTE) ? 1 : 0)
    )
  }

  class ClearOverrideGraph extends LGraph {
    override clear(): void {
      super.clear()
    }
  }

  beforeEach(() => {
    layoutStore.resetForTests()
  })

  function createGraphWithEveryLayoutEntryType() {
    const graph = new LGraph()
    graph.id = createUuidv4()

    const root = new LGraphNode('root')
    const group = new LGraphGroup('group')
    graph.add(root)
    graph.add(group)
    graph._addReroute(new Reroute(REROUTE, graph, [10, 10]))

    const subgraph = graph.createSubgraph(createTestSubgraphData())
    const interior = new LGraphNode('interior')
    subgraph.add(interior)

    return { graph, subgraph, root, group, interior }
  }

  function survivingEntries({
    graph,
    root,
    group,
    interior
  }: ReturnType<typeof createGraphWithEveryLayoutEntryType>) {
    const rootGraphId = graph.rootGraph.id
    return [
      layoutStore.getNodeLayoutRef(rootGraphId, root.id).value,
      layoutStore.getNodeLayoutRef(rootGraphId, interior.id).value,
      layoutStore.getGroupLayout(rootGraphId, group.id),
      layoutStore.getRerouteLayout(rootGraphId, REROUTE)
    ].filter((entry) => entry !== null).length
  }

  it('keeps clear void and override-compatible', () => {
    const graph = new LGraph()
    graph.add(new LGraphNode('node'))

    expect(graph.clear()).toBeUndefined()
    expect(graph.nodes).toHaveLength(0)
    expect(new ClearOverrideGraph()).toBeInstanceOf(LGraph)
  })

  it.for([
    ['clear', (graph: LGraph) => graph.clear()],
    [
      'reconfigure',
      (graph: LGraph) => graph.configure(new LGraph().serialize())
    ]
  ] as const)('drops every entry on %s', ([, teardown]) => {
    const populated = createGraphWithEveryLayoutEntryType()
    expect(survivingEntries(populated)).toBe(4)

    teardown(populated.graph)

    expect(survivingEntries(populated)).toBe(0)
  })

  it('preserves graph state when a clear removal callback fails', () => {
    const populated = createGraphWithEveryLayoutEntryType()
    const { graph, subgraph, root } = populated
    const graphId = graph.id
    root.onRemoved = () => {
      throw new Error('removal failed')
    }

    expect(() => graph.clear()).toThrow('removal failed')

    expect(graph.id).toBe(graphId)
    expect(graph.nodes).toContain(root)
    expect(root.graph).toBe(graph)
    expect(graph.subgraphs.get(subgraph.id)).toBe(subgraph)
    expect(survivingEntries(populated)).toBe(4)
    expect(
      useRerouteStore().getReroute(graphScopeOf(graph), REROUTE)
    ).toBeDefined()
    expect(
      useNodeDataStore().getGraphNodesFor(graphId, subgraph.id)
    ).not.toHaveLength(0)
  })

  it('does not fire removal lifecycle when clear cannot start', () => {
    const { graph, root } = createGraphWithEveryLayoutEntryType()
    const onRemoved = vi.fn()
    root.onRemoved = onRemoved
    const acceptsOperations = vi
      .spyOn(layoutStore, 'acceptsOperations', 'get')
      .mockReturnValue(false)
    onTestFinished(() => acceptsOperations.mockRestore())

    graph.clear()

    expect(onRemoved).not.toHaveBeenCalled()
    expect(graph.nodes).toContain(root)
  })

  it('drops nested definition entries during individual teardown', () => {
    const graph = new LGraph()
    const parent = graph.createSubgraph(createTestSubgraphData())
    const nested = graph.createSubgraph(createTestSubgraphData())
    parent.add(createTestSubgraphNode(nested, { parentGraph: parent }))

    const node = new LGraphNode('nested')
    const group = new LGraphGroup('nested')
    const rerouteId = toRerouteId(2)
    nested.add(node)
    nested.add(group)
    nested._addReroute(new Reroute(rerouteId, nested, [10, 10]))

    expect(layoutStore.getNodeLayoutRef(graph.id, node.id).value).not.toBeNull()
    expect(layoutStore.getGroupLayout(graph.id, group.id)).not.toBeNull()
    expect(layoutStore.getRerouteLayout(graph.id, rerouteId)).not.toBeNull()

    graph.clear()

    expect(layoutStore.getNodeLayoutRef(zeroUuid, node.id).value).toBeNull()
    expect(layoutStore.getGroupLayout(zeroUuid, group.id)).toBeNull()
    expect(layoutStore.getRerouteLayout(zeroUuid, rerouteId)).toBeNull()
  })

  it('drops interior entries when the last SubgraphNode is removed', () => {
    const { graph, subgraph, interior } = createGraphWithEveryLayoutEntryType()
    const subgraphNode = createTestSubgraphNode(subgraph)
    graph.add(subgraphNode)

    graph.remove(subgraphNode)

    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, interior.id).value
    ).toBeNull()
  })

  it('preserves existing entities when configure teardown is rejected', () => {
    const { graph } = createGraphWithEveryLayoutEntryType()
    const originalId = graph.id
    const originalNodes = [...graph.nodes]
    const originalExtra = graph.extra
    const replacement = {
      ...new LGraph().serialize(),
      id: createUuidv4(),
      extra: { replacement: true }
    }
    const applyOperation = vi
      .spyOn(layoutStore, 'applyOperation')
      .mockReturnValueOnce('rejected')
    onTestFinished(() => applyOperation.mockRestore())
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    onTestFinished(() => warn.mockRestore())

    graph.configure(replacement)

    expect(graph.id).toBe(originalId)
    expect(graph.nodes).toEqual(originalNodes)
    expect(graph.extra).toBe(originalExtra)
    expect(layoutEntryCount(graph)).toBe(4)
    expect(warn).toHaveBeenCalledWith(
      '[LGraph] Configuration teardown rejected',
      {
        graphId: originalId,
        mode: 'clear',
        result: 'rejected'
      }
    )
  })
})
