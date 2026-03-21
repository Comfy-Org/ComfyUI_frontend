import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { NodeId, Subgraph } from '@/lib/litegraph/src/litegraph'
import {
  LGraph,
  LGraphNode,
  LiteGraph,
  LLink
} from '@/lib/litegraph/src/litegraph'
import type { SerialisableGraph } from '@/lib/litegraph/src/types/serialisation'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import { usePromotionStore } from '@/stores/promotionStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import {
  createTestSubgraphData,
  createTestSubgraphNode
} from './subgraph/__fixtures__/subgraphHelpers'

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
    promotionStore.promote(graphId, 1 as NodeId, {
      sourceNodeId: '10',
      sourceWidgetName: 'seed'
    })

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

    expect(
      promotionStore.isPromotedByAny(graphId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
    ).toBe(true)
    expect(widgetValueStore.getWidget(graphId, '10' as NodeId, 'seed')).toEqual(
      expect.objectContaining({ value: 1 })
    )

    graph.clear()

    expect(
      promotionStore.isPromotedByAny(graphId, {
        sourceNodeId: '10',
        sourceWidgetName: 'seed'
      })
    ).toBe(false)
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
    const dup = new LLink(
      ++graph.state.lastLinkId,
      'number',
      source.id,
      0,
      target.id,
      0
    )
    graph._links.set(dup.id, dup)
    source.outputs[0].links!.push(dup.id)
    return dup
  }

  it('removes orphaned duplicate links from _links and output.links', () => {
    const { graph, source, target } = createConnectedGraph()

    for (let i = 0; i < 3; i++) injectDuplicateLink(graph, source, target)

    expect(graph._links.size).toBe(4)
    expect(source.outputs[0].links).toHaveLength(4)

    graph._removeDuplicateLinks()

    expect(graph._links.size).toBe(1)
    expect(source.outputs[0].links).toHaveLength(1)
    expect(target.inputs[0].link).toBe(source.outputs[0].links![0])
  })

  it('keeps the link referenced by input.link', () => {
    const { graph, source, target } = createConnectedGraph()
    const keptLinkId = target.inputs[0].link!

    const dupLink = injectDuplicateLink(graph, source, target)

    graph._removeDuplicateLinks()

    expect(graph._links.size).toBe(1)
    expect(target.inputs[0].link).toBe(keptLinkId)
    expect(graph._links.has(keptLinkId)).toBe(true)
    expect(graph._links.has(dupLink.id)).toBe(false)
  })

  it('keeps the valid link when input.link is at a shifted slot index', () => {
    const { graph, source, target } = createConnectedGraph()
    const validLinkId = target.inputs[0].link!

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
    expect(target.inputs[1].link).toBe(validLinkId)
  })

  it('repairs input.link when it points to a removed duplicate', () => {
    const { graph, source, target } = createConnectedGraph()

    const dupLink = injectDuplicateLink(graph, source, target)
    // Point input.link to the duplicate (simulating corrupted state)
    target.inputs[0].link = dupLink.id

    graph._removeDuplicateLinks()

    expect(graph._links.size).toBe(1)
    const survivingId = graph._links.keys().next().value!
    expect(target.inputs[0].link).toBe(survivingId)
    expect(graph._links.has(target.inputs[0].link!)).toBe(true)
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

  function duplicateExistingLink(graph: LGraph, source: LGraphNode) {
    const existingLink = graph._links.values().next().value!
    const dup = new LLink(
      ++graph.state.lastLinkId,
      existingLink.type,
      existingLink.origin_id,
      existingLink.origin_slot,
      existingLink.target_id,
      existingLink.target_slot
    )
    graph._links.set(dup.id, dup)
    source.outputs[0].links!.push(dup.id)
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

    for (let i = 0; i < 3; i++) duplicateExistingLink(subgraph, sourceNode)
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

    sourceNode.connect(0, targetNode, 0)
    duplicateExistingLink(subgraph, sourceNode)

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

describe('deduplicateSubgraphNodeIds (via configure)', () => {
  const SUBGRAPH_A = '11111111-1111-4111-8111-111111111111' as UUID
  const SUBGRAPH_B = '22222222-2222-4222-8222-222222222222' as UUID
  const SHARED_NODE_IDS = [3, 8, 37]

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
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
      expect(idsA.has(id as NodeId)).toBe(true)
    }
    for (const id of idsA) {
      expect(idsB.has(id)).toBe(false)
    }
  })

  it('patches link references in remapped subgraph', () => {
    const { graph } = configureFromFixture()
    const idsB = nodeIdSet(graph, SUBGRAPH_B)

    for (const link of graph.subgraphs.get(SUBGRAPH_B)!.links.values()) {
      expect(idsB.has(link.origin_id)).toBe(true)
      expect(idsB.has(link.target_id)).toBe(true)
    }
  })

  it('patches promoted widget references in remapped subgraph', () => {
    const { graph } = configureFromFixture()
    const idsB = nodeIdSet(graph, SUBGRAPH_B)

    for (const widget of graph.subgraphs.get(SUBGRAPH_B)!.widgets) {
      expect(idsB.has(widget.id)).toBe(true)
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

    const pw102 = graph.getNodeById(102 as NodeId)?.properties?.proxyWidgets
    expect(Array.isArray(pw102)).toBe(true)
    for (const entry of pw102 as unknown[][]) {
      expect(Array.isArray(entry)).toBe(true)
      expect(idsA.has(String(entry[0]))).toBe(true)
    }

    const pw103 = graph.getNodeById(103 as NodeId)?.properties?.proxyWidgets
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
      .nodes.find((n) => n.id === (50 as NodeId))
    const pw = innerNode?.properties?.proxyWidgets
    expect(Array.isArray(pw)).toBe(true)
    for (const entry of pw as unknown[][]) {
      expect(Array.isArray(entry)).toBe(true)
      expect(idsB.has(String(entry[0]))).toBe(true)
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

    expect(nodeIdSet(graph, SUBGRAPH_A)).toEqual(new Set([10, 11, 12]))
    expect(nodeIdSet(graph, SUBGRAPH_B)).toEqual(new Set([20, 21, 22]))
  })
})
