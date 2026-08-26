import { toGroupId } from '@/types/groupId'
import { graphScopeOf } from '@/types/graphScopeId'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { NodeLifecycleEvent } from '@/lib/litegraph/src/infrastructure/LGraphEventMap'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import {
  LGraph,
  LGraphGroup,
  LGraphNode,
  LiteGraph,
  LLink,
  Reroute,
  Subgraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import { serialiseMutableGraphParts } from '@/lib/litegraph/src/LGraph'
import type {
  ExportedSubgraph,
  SerialisableGraph,
  SerialisableLLink,
  SerialisableReroute
} from '@/lib/litegraph/src/types/serialisation'
import type { UUID } from '@/utils/uuid'
import { createUuidv4, zeroUuid } from '@/utils/uuid'
import { useEntityIdStore } from '@/stores/entityIdStore'
import { useLinkStore } from '@/stores/linkStore'
import { useExecutionOrderStore } from '@/stores/executionOrderStore'
import { useGraphMetadataStore } from '@/stores/graphMetadataStore'
import { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { useRerouteStore } from '@/stores/rerouteStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { slotFloatingLinks } from '@/lib/litegraph/src/LLink'
import { toLinkId } from '@/types/linkId'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { toRerouteId } from '@/types/rerouteId'
import { UNASSIGNED_NODE_ID, toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import {
  createNestedSubgraphs,
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

beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

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
  it('batches version updates while keeping distinct mutations distinct', () => {
    const graph = new LGraph()
    const version = graph._version

    graph.batchVersionUpdates(() => {
      graph.add(new DummyNode())
      graph.add(new DummyNode())
    })
    expect(graph._version).toBe(version + 1)

    graph.add(new DummyNode())
    graph.add(new DummyNode())
    expect(graph._version).toBe(version + 3)
  })

  it('invalidates once when removing a node disconnects multiple links', () => {
    const graph = new LGraph()
    const source = new DummyNode()
    const firstTarget = new DummyNode()
    const secondTarget = new DummyNode()
    source.addOutput('value', 'number')
    firstTarget.addInput('value', 'number')
    secondTarget.addInput('value', 'number')
    graph.add(source)
    graph.add(firstTarget)
    graph.add(secondTarget)
    source.connect(0, firstTarget, 0)
    source.connect(0, secondTarget, 0)
    const version = graph._version

    graph.remove(source)

    expect(graph._version).toBe(version + 1)
  })

  it('allows an empty graph to adopt a new ID', () => {
    const graph = new LGraph()
    const nextId = createUuidv4()

    graph.id = nextId

    expect(graph.id).toBe(nextId)
  })

  it('keeps its ID when another live graph already owns the requested ID', () => {
    const source = new LGraph()
    const destination = new LGraph()
    const metadata = useGraphMetadataStore()
    const entityIds = useEntityIdStore()
    const destinationMetadata = metadata.get(destination.id)
    const destinationEntityIds = entityIds.get(destination.id)
    const sourceId = source.id

    expect(() => {
      source.id = destination.id
    }).not.toThrow()
    expect(source.id).toBe(sourceId)
    expect(metadata.get(destination.id)).toBe(destinationMetadata)
    expect(entityIds.get(destination.id)).toBe(destinationEntityIds)
  })

  it('remints a configured graph when another live graph owns its ID', () => {
    const incumbent = new LGraph()
    incumbent.extra = { marker: 'incumbent' }
    const serialized = structuredClone(incumbent.asSerialisable())

    const configured = new LGraph(serialized)

    expect(configured.id).not.toBe(incumbent.id)
    expect(configured.extra).toEqual({ marker: 'incumbent' })
    expect(incumbent.extra).toEqual({ marker: 'incumbent' })
  })

  it('remints a subgraph instead of replacing a live definition', () => {
    const root = new LGraph()
    const incumbent = createTestSubgraph({ rootGraph: root })
    incumbent.addInput('value', 'number')

    const configured = new Subgraph(
      root,
      structuredClone(incumbent.asSerialisable())
    )

    expect(configured.id).not.toBe(incumbent.id)
    expect(configured.inputs[0]?.name).toBe('value')
    expect(incumbent.inputs[0]?.name).toBe('value')
  })

  it('does not rekey an empty subgraph to its root graph ID', () => {
    const root = new LGraph()
    const subgraph = createTestSubgraph({ rootGraph: root })
    const originalId = subgraph.id

    subgraph.id = root.id

    expect(subgraph.id).toBe(originalId)
  })

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

  it('sorts numeric and non-numeric node IDs deterministically', () => {
    const graph = new LGraph()
    for (const id of ['beta', '10', 'alpha', '2']) {
      const node = new DummyNode()
      node.id = toNodeId(id)
      graph.add(node)
    }

    expect(
      graph.serialize({ sortNodes: true }).nodes.map((node) => String(node.id))
    ).toEqual(['2', '10', 'alpha', 'beta'])
  })

  it('projects graph-scoped derived execution order to extensions and wire data', () => {
    const root = new LGraph()
    const rootNode = new DummyNode()
    root.add(rootNode)
    const subgraph = createTestSubgraph({ rootGraph: root })
    const subgraphNode = new DummyNode()
    subgraph.add(subgraphNode)
    const store = useExecutionOrderStore()

    store.set(graphScopeOf(root), rootNode.id, 7)
    store.set(graphScopeOf(subgraph), subgraphNode.id, 9)

    expect(rootNode.order).toBe(7)
    expect(subgraphNode.order).toBe(9)
    expect(rootNode.serialize().order).toBe(7)
    expect(subgraphNode.serialize().order).toBe(9)

    root.updateExecutionOrder()
    expect(rootNode.order).toBe(0)
    expect(subgraphNode.order).toBe(9)
  })

  it('cleans derived order on removal while preserving the detached projection', () => {
    const graph = new LGraph()
    const first = new DummyNode()
    const removed = new DummyNode()
    graph.add(first)
    graph.add(removed)
    const scope = graphScopeOf(graph)
    const store = useExecutionOrderStore()

    expect(removed.order).toBe(1)
    graph.remove(removed)

    expect(store.get(scope, removed.id)).toBeUndefined()
    expect(removed.order).toBe(1)
    expect(first.order).toBe(0)
  })

  it('hydrates wire order before topology recomputation replaces it', () => {
    const node = new DummyNode()
    const data = node.serialize()
    data.order = 12

    node.configure(data)
    expect(node.order).toBe(12)
    expect(node.serialize().order).toBe(12)

    const graph = new LGraph()
    graph.add(node)
    expect(node.order).toBe(0)
    expect(node.serialize().order).toBe(0)
  })

  it('should handle adding null node gracefully', () => {
    const graph = new LGraph()
    const initialNodeCount = graph.nodes.length

    const result = graph.add(null)

    expect(result).toBeUndefined()
    expect(graph.nodes.length).toBe(initialNodeCount)
  })

  it('configures and serializes graph metadata through the store', () => {
    const graph = new LGraph()
    const id = createUuidv4()
    graph.configure({
      id,
      version: 1,
      revision: 4,
      state: {
        lastGroupId: 0,
        lastNodeId: 0,
        lastLinkId: 0,
        lastRerouteId: 0
      },
      config: { links_ontop: true },
      extra: { workflowRendererVersion: 'Vue' }
    })

    const metadata = useGraphMetadataStore().get(id)
    expect(metadata).toMatchObject({
      revision: 4,
      config: { links_ontop: true },
      extra: { workflowRendererVersion: 'Vue' }
    })

    graph.config.links_ontop = false
    expect(graph.asSerialisable()).toMatchObject({
      revision: 4,
      config: { links_ontop: false },
      extra: { workflowRendererVersion: 'Vue' }
    })
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
  test('re-adding the same floating link is idempotent', () => {
    const graph = new LGraph()
    const link = new LLink(
      toLinkId(7),
      '*',
      UNASSIGNED_NODE_ID,
      -1,
      UNASSIGNED_NODE_ID,
      -1
    )

    const firstResult = graph.addFloatingLink(link)
    const secondResult = graph.addFloatingLink(link)

    expect(firstResult).toBe(link)
    expect(secondResult).toBe(link)
    expect(link.id).toBe(toLinkId(7))
    expect(graph.floatingLinks.size).toBe(1)
    expect(graph.floatingLinks.get(toLinkId(7))).toBe(link)
    expect(graph.links.has(toLinkId(7))).toBe(false)
  })

  test('rejects a runtime floating link id collision without mutation', () => {
    const graph = new LGraph()
    const incumbent = new LLink(
      toLinkId(7),
      '*',
      UNASSIGNED_NODE_ID,
      -1,
      UNASSIGNED_NODE_ID,
      -1
    )
    const collision = LLink.create(incumbent)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    graph.addFloatingLink(incumbent)

    const result = graph.addFloatingLink(collision)

    expect(result).toBeUndefined()
    expect(collision.id).toBe(toLinkId(7))
    expect(graph.floatingLinks.size).toBe(1)
    expect(graph.floatingLinks.get(toLinkId(7))).toBe(incumbent)
    expect(consoleError).toHaveBeenCalledOnce()
  })

  test('removing a rejected floating link preserves the incumbent', () => {
    const graph = new LGraph()
    const incumbent = new LLink(
      toLinkId(7),
      '*',
      UNASSIGNED_NODE_ID,
      -1,
      UNASSIGNED_NODE_ID,
      -1
    )
    const collision = LLink.create(incumbent)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    graph.addFloatingLink(incumbent)
    graph.addFloatingLink(collision)

    graph.removeFloatingLink(collision)

    expect(graph.floatingLinks.get(toLinkId(7))).toBe(incumbent)
  })

  test('remints persisted floating link id collisions during configure', ({
    linkedNodesGraph
  }) => {
    const data = structuredClone(linkedNodesGraph)
    data.floatingLinks = [
      {
        id: 2,
        origin_id: 2,
        origin_slot: 0,
        target_id: -1,
        target_slot: -1,
        type: 'IMAGE'
      }
    ]

    const graph = new LGraph(data)

    const floatingLink = [...graph.floatingLinks.values()][0]
    expect(graph.links.get(toLinkId(2))?.id).toBe(toLinkId(2))
    expect(floatingLink?.id).not.toBe(toLinkId(2))
    expect(floatingLink?.origin_id).toBe(toNodeId(2))
    expect(graph.floatingLinks.size).toBe(1)
  })

  test('mints floating link ids across a root and its subgraphs', () => {
    const graph = new LGraph()
    const subgraph = graph.createSubgraph(createTestSubgraphData())
    const rootLink = new LLink(
      toLinkId(-1),
      '*',
      UNASSIGNED_NODE_ID,
      -1,
      UNASSIGNED_NODE_ID,
      -1
    )
    const subgraphLink = LLink.create(rootLink)

    expect(graph.addFloatingLink(rootLink)).toBe(rootLink)
    expect(subgraph.addFloatingLink(subgraphLink)).toBe(subgraphLink)
    expect(subgraphLink.id).not.toBe(rootLink.id)
    expect(graph.floatingLinks.get(rootLink.id)).toBe(rootLink)
    expect(subgraph.floatingLinks.get(subgraphLink.id)).toBe(subgraphLink)
  })

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
    const graph = new LGraph(linkedNodesGraph)
    const first = graph.asSerialisable()
    graph.clear()
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

describe('Store-driven serialization parity', () => {
  test('matches normalized mutable serialization across topology variants', ({
    expect,
    linkedNodesGraph,
    reroutesComplexGraph,
    floatingLinkGraph
  }) => {
    for (const graph of [
      new LGraph(linkedNodesGraph),
      reroutesComplexGraph,
      new LGraph(floatingLinkGraph)
    ]) {
      const stored = graph.asSerialisable({ sortNodes: true })
      const mutable = serialiseMutableGraphParts(graph, true)
      const normalizedStored = {
        nodes: stored.nodes,
        groups: stored.groups,
        links: stored.links,
        floatingLinks: stored.floatingLinks,
        reroutes: stored.reroutes
      }
      expect(JSON.parse(JSON.stringify(normalizedStored))).toEqual(
        JSON.parse(JSON.stringify(mutable))
      )
    }
  })

  test('falls back safely when a stored node has no live adapter', ({
    expect
  }) => {
    const graph = createGraph(new DummyNode())
    graph._nodes = []
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(graph.asSerialisable().nodes).toEqual([])
    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(
        /Cannot serialize graph .* from store: node .* has no live adapter; using live graph nodes/
      )
    )
  })

  test('rejects additive configuration before mutating a populated graph', ({
    expect
  }) => {
    const graph = createGraph(new DummyNode())
    const before = graph.asSerialisable()

    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(graph.configure(before, true)).toBe(false)
    expect(error).toHaveBeenCalledWith(
      'Cannot additively configure a populated graph'
    )
    expect(graph.asSerialisable()).toEqual(before)
  })

  test('serializes a reroute from its detached position', ({
    expect,
    linkedNodesGraph
  }) => {
    const graph = new LGraph(linkedNodesGraph)
    const link = graph.links.values().next().value!
    const reroute = graph.createReroute([10, 20], link)!
    layoutStore.applyOperation({
      type: 'deleteReroute',
      graphId: graph.id,
      rerouteId: reroute.id,
      source: LayoutSource.Canvas,
      timestamp: Date.now()
    })

    expect(graph.asSerialisable().reroutes).toContainEqual(
      expect.objectContaining({ id: reroute.id, pos: [10, 20] })
    )
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
    const beforeRemovedNodes: LGraphNode[] = []

    graph.events.addEventListener('node:before-removed', (event) => {
      expect(event.detail.node.graph).toBe(graph)
      beforeRemovedNodes.push(event.detail.node)
    })

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
    expect(beforeRemovedNodes).toHaveLength(2)
    expect(new Set(beforeRemovedNodes)).toEqual(new Set([node1, node2]))

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

  test('configure clears state already stored under the incoming graph id', () => {
    const incoming = new LGraph()
    const incomingId = 'graph-configure-cleanup' as UUID
    incoming.id = incomingId
    const data = incoming.asSerialisable()
    const staleNodeId = toNodeId(77)
    const staleWidgetId = widgetId(incomingId, staleNodeId, 'seed')
    useWidgetValueStore().registerWidget(staleWidgetId, {
      type: 'number',
      value: 1,
      options: {}
    })
    usePreviewExposureStore().addExposure(incomingId, String(staleNodeId), {
      sourceNodeId: '10',
      sourcePreviewName: '$$canvas-image-preview'
    })
    layoutStore.applyOperation({
      type: 'createNode',
      graphId: incomingId,
      nodeId: staleNodeId,
      layout: {
        id: staleNodeId,
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        zIndex: 1,
        visible: true,
        bounds: { x: 0, y: 0, width: 100, height: 100 }
      },
      timestamp: Date.now(),
      source: LayoutSource.Canvas
    })

    incoming.configure(data)

    expect(useWidgetValueStore().getWidget(staleWidgetId)).toBeUndefined()
    expect(
      usePreviewExposureStore().getExposures(incomingId, String(staleNodeId))
    ).toEqual([])
    expect(layoutStore.getNodeLayout(incomingId, staleNodeId)).toBeNull()
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
      'onNodeRemoved(graph=null)'
    ])
  })

  it('fires node:added once the node is attached and registered', () => {
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

  it('keeps floating links available during clear removal callbacks', () => {
    const graph = new LGraph()
    const node = new LGraphNode('node')
    node.addOutput('output', '*')
    graph.add(node)
    const link = new LLink(toLinkId(1), '*', node.id, 0, UNASSIGNED_NODE_ID, -1)
    graph.addFloatingLink(link)
    node.onRemoved = vi.fn(() => {
      expect(graph.floatingLinks.get(link.id)).toBe(link)
    })

    graph.clear()

    expect(node.onRemoved).toHaveBeenCalledOnce()
    expect(graph.floatingLinks.size).toBe(0)
  })

  it('keeps clear lifecycle stable when callbacks recursively remove nodes', () => {
    const graph = new LGraph()
    const source = new LGraphNode('source')
    const target = new LGraphNode('target')
    source.addOutput('out', '*')
    target.addInput('in', '*')
    graph.add(source)
    graph.add(target)
    const link = source.connect(0, target, 0)!
    const callbacks = [vi.fn(), vi.fn()]

    source.onRemoved = () => {
      callbacks[0]()
      expect(graph.links.get(link.id)).toBe(link)
      expect(source.graph).toBe(graph)
      expect(target.graph).toBe(graph)
      graph.remove(target)
    }
    target.onRemoved = () => {
      callbacks[1]()
      expect(graph.links.get(link.id)).toBe(link)
      expect(source.graph).toBe(graph)
      expect(target.graph).toBe(graph)
      graph.remove(target)
    }

    graph.clear()

    callbacks.forEach((callback) => expect(callback).toHaveBeenCalledOnce())
    expect(source.graph).toBeNull()
    expect(target.graph).toBeNull()
  })

  it('detaches nodes added during clear lifecycle callbacks', () => {
    const graph = new LGraph()
    const existing = new LGraphNode('existing')
    const added = new LGraphNode('added')
    graph.add(existing)
    existing.onRemoved = () => graph.add(added)

    graph.clear()

    expect(existing.graph).toBeNull()
    expect(added.graph).toBeNull()
    expect(added._graphScope).toBeUndefined()
  })

  it('runs nested node removal lifecycle exactly once', () => {
    const { rootGraph, subgraphs } = createNestedSubgraphs({
      depth: 2,
      nodesPerLevel: 1
    })
    for (const subgraph of subgraphs) {
      rootGraph.subgraphs.set(subgraph.id, subgraph)
    }
    const nodes = [
      ...rootGraph.nodes,
      ...subgraphs.flatMap((subgraph) => subgraph.nodes)
    ]
    const callbacks = nodes.map(() => vi.fn())
    nodes.forEach((node, index) => (node.onRemoved = callbacks[index]))

    rootGraph.clear()

    callbacks.forEach((callback) => expect(callback).toHaveBeenCalledOnce())
  })

  it('detaches retained entities and remains idempotent after root clear', () => {
    const graph = new LGraph()
    const source = new LGraphNode('source')
    const target = new LGraphNode('target')
    source.addOutput('out', '*')
    target.addInput('in', '*')
    graph.add(source)
    graph.add(target)
    const link = source.connect(0, target, 0)!
    const reroute = graph.createReroute([10, 10], link)!
    const removed = vi.fn()
    source.onRemoved = removed

    graph.clear()
    graph.clear()

    expect(source._graphScope).toBeUndefined()
    expect(link._graphScope).toBeUndefined()
    expect(reroute._graphScope).toBeUndefined()
    expect(removed).toHaveBeenCalledOnce()
  })

  it('finishes clear before propagating a lifecycle callback failure', () => {
    const graph = new LGraph()
    const source = new LGraphNode('source')
    const target = new LGraphNode('target')
    source.addOutput('out', '*')
    target.addInput('in', '*')
    graph.add(source)
    graph.add(target)
    const link = source.connect(0, target, 0)!
    const reroute = graph.createReroute([10, 10], link)!
    const subgraph = createTestSubgraph({ rootGraph: graph, nodeCount: 1 })
    graph.subgraphs.set(subgraph.id, subgraph)
    const subgraphNode = subgraph.nodes[0]
    const failure = Symbol('lifecycle failure')
    const laterCallback = vi.fn()
    const canvasClear = vi.fn()
    graph.list_of_graphcanvas = [
      { clear: canvasClear, setDirty: vi.fn() } as unknown as LGraphCanvas
    ]
    source.onRemoved = () => {
      throw failure
    }
    target.onRemoved = laterCallback
    subgraphNode.onRemoved = laterCallback

    expect(() => graph.clear()).toThrow(failure)

    expect(laterCallback).not.toHaveBeenCalled()
    expect(canvasClear).toHaveBeenCalledOnce()
    expect([source.graph, subgraphNode.graph]).toEqual([null, null])
    expect([
      source._graphScope,
      subgraphNode._graphScope,
      link._graphScope,
      reroute._graphScope
    ]).toEqual([undefined, undefined, undefined, undefined])
    expect(graph.nodes).toEqual([])
    expect(graph.links.size).toBe(0)
    expect(graph.reroutes.size).toBe(0)
    expect(graph.subgraphs.size).toBe(0)

    const reusableNode = new LGraphNode('reusable')
    graph.add(reusableNode)
    expect(reusableNode.graph).toBe(graph)
  })

  it('clears only the selected subgraph owner', () => {
    const rootGraph = new LGraph()
    rootGraph.id = createUuidv4()
    const rootNode = new LGraphNode('root')
    rootGraph.add(rootNode)
    const cleared = createTestSubgraph({ rootGraph, nodeCount: 1 })
    const sibling = createTestSubgraph({ rootGraph, nodeCount: 1 })
    rootGraph.subgraphs.set(cleared.id, cleared)
    rootGraph.subgraphs.set(sibling.id, sibling)
    const clearedNode = cleared.nodes[0]
    const siblingNode = sibling.nodes[0]

    cleared.clear()

    expect(clearedNode._graphScope).toBeUndefined()
    expect(rootNode._graphScope).toBeDefined()
    expect(siblingNode._graphScope).toBeDefined()
    expect(rootGraph.nodes).toContain(rootNode)
    expect(sibling.nodes).toContain(siblingNode)
    expect(rootGraph.subgraphs.get(sibling.id)).toBe(sibling)
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

  it('removing a node clears its widget and preview exposure records', () => {
    const rootGraph = new LGraph()
    const node = new LGraphNode('owned state')
    rootGraph.add(node)
    const id = widgetId(rootGraph.id, node.id, 'value')
    useWidgetValueStore().registerWidget(id, {
      type: 'number',
      value: 1,
      options: {}
    })
    usePreviewExposureStore().addExposure(rootGraph.id, String(node.id), {
      sourceNodeId: node.id,
      sourcePreviewName: 'preview'
    })

    rootGraph.remove(node)

    expect(useWidgetValueStore().getWidget(id)).toBeUndefined()
    expect(
      usePreviewExposureStore().getExposures(rootGraph.id, String(node.id))
    ).toEqual([])
  })

  it('released subgraphs clear inner node-owned records', () => {
    const rootGraph = new LGraph()
    const { subgraph, innerNodes } = createSubgraphWithNodes(rootGraph, 1)
    const innerNode = innerNodes[0]
    const id = widgetId(rootGraph.id, innerNode.id, 'value')
    const locator = createNodeLocatorId(subgraph.id, innerNode.id)
    useWidgetValueStore().registerWidget(id, {
      type: 'number',
      value: 1,
      options: {}
    })
    usePreviewExposureStore().addExposure(rootGraph.id, locator, {
      sourceNodeId: innerNode.id,
      sourcePreviewName: 'preview'
    })
    const host = createTestSubgraphNode(subgraph)
    rootGraph.add(host)

    rootGraph.remove(host)

    expect(useWidgetValueStore().getWidget(id)).toBeUndefined()
    expect(
      usePreviewExposureStore().getExposures(rootGraph.id, locator)
    ).toEqual([])
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
    rootGraph.createSubgraph(data)

    expect(rootGraph.state.lastNodeId).toBe(10)
    expect(rootGraph.state.lastLinkId).toBe(20)
  })
})

describe('persisted duplicate links', () => {
  const onConnectionsChange =
    vi.fn<NonNullable<LGraphNode['onConnectionsChange']>>()

  class TestNode extends LGraphNode {
    override onConnectionsChange = onConnectionsChange

    constructor(title?: string) {
      super(title ?? 'TestNode')
      this.addInput('input_0', 'number')
      this.addOutput('output_0', 'number')
    }
  }

  function registerTestNodes() {
    LiteGraph.registerNodeType('test/DupTestNode', TestNode)
  }

  it('rejects persisted duplicate links via root graph configure()', () => {
    registerTestNodes()
    const graph = new LGraph()
    graph.configure(duplicateLinksRoot)

    expect(graph.links.size).toBe(1)
    const survivingLink = graph.links.values().next().value!
    const targetNode = graph.getNodeById(survivingLink.target_id)!
    expect(targetNode.inputs[0].link).toBe(survivingLink.id)
    const sourceNode = graph.getNodeById(survivingLink.origin_id)!
    expect(sourceNode.outputs[0].links).toEqual([survivingLink.id])
  })

  it('normalizes duplicate aliases before callbacks without mutating input', () => {
    registerTestNodes()
    const graph = new LGraph()
    const data = structuredClone(duplicateLinksRoot)
    data.nodes![0].outputs![0].links = [2]
    data.nodes![1].inputs![0].link = 2
    const original = structuredClone(data)

    graph.configure(data)

    const survivingLink = graph.links.values().next().value!
    const configuredLinks = onConnectionsChange.mock.calls
      .map(([, , , link]) => link)
      .filter((link) => link != null)

    expect(configuredLinks).toEqual([survivingLink, survivingLink])
    expect(data).toEqual(original)
  })

  it('preserves link integrity after configure() with slot-shifted duplicates', () => {
    registerTestNodes()
    const graph = new LGraph()
    graph.configure(duplicateLinksSlotShift)

    expect(graph.links.size).toBe(1)

    const link = graph.links.values().next().value!
    const target = graph.getNodeById(link.target_id)!
    const linkedInput = target.inputs.find((inp) => inp.link === link.id)
    expect(linkedInput).toBeDefined()

    const source = graph.getNodeById(link.origin_id)!
    expect(source.outputs[link.origin_slot].links).toContain(link.id)
  })

  it('rejects persisted duplicate links inside subgraph definitions', () => {
    const graph = new LGraph()
    graph.configure(duplicateLinksSubgraph)

    const subgraph = graph.subgraphs.values().next().value!
    expect(subgraph.links.size).toBe(1)

    const link = subgraph.links.values().next().value!
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

  function registerTestNodes() {
    LiteGraph.registerNodeType('test/TestNode', TestNode)
  }

  function createSubgraphOnGraph(rootGraph: LGraph) {
    return rootGraph.createSubgraph(createTestSubgraphData())
  }

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

  it('keeps runtime entity IDs unique across a root and its subgraphs', () => {
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)
    const rootNode = new LGraphNode('root')
    const subgraphNode = new LGraphNode('subgraph')
    rootNode.id = toNodeId(42)
    subgraphNode.id = toNodeId(42)
    const rootGroup = new LGraphGroup('root', toGroupId(42))
    const subgraphGroup = new LGraphGroup('subgraph', toGroupId(42))

    rootGraph.add(rootNode)
    subgraph.add(subgraphNode)
    rootGraph.add(rootGroup)
    subgraph.add(subgraphGroup)

    expect(subgraphNode.id).not.toBe(rootNode.id)
    expect(subgraphGroup.id).not.toBe(rootGroup.id)
  })

  it('offsets unpacked group geometry in the layout store too', () => {
    registerTestNodes()
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)

    const group = new LGraphGroup('inner', toGroupId(909))
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

  it('keeps subgraph definition when unpacking one instance while another remains', () => {
    const rootGraph = new LGraph()
    const subgraph = createSubgraphOnGraph(rootGraph)

    const retainedGroup = new LGraphGroup('shared', toGroupId(909))
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

  it('does not mutate workflow input while normalizing definitions', () => {
    const graphData = loadFixture()
    const original = structuredClone(graphData)

    new LGraph().configure(graphData)

    expect(graphData).toEqual(original)
  })

  it('normalizes direct creation collisions and patches references', () => {
    const graph = new LGraph()
    let normalized: ExportedSubgraph | undefined
    graph.events.addEventListener('subgraph-created', (event) => {
      normalized = event.detail.data
    })
    const firstRootNode = new DummyNode()
    firstRootNode.id = toNodeId('1')
    graph.add(firstRootNode)
    const secondRootNode = new DummyNode()
    secondRootNode.id = toNodeId('custom-id')
    graph.add(secondRootNode)
    graph.addFloatingLink(
      new LLink(
        toLinkId(1),
        'INT',
        UNASSIGNED_NODE_ID,
        -1,
        UNASSIGNED_NODE_ID,
        -1
      )
    )
    graph.setReroute({ id: 1, pos: [0, 0], linkIds: [] })
    const definition = createTestSubgraphData({
      nodes: [
        {
          id: 1,
          type: 'dummy',
          pos: [0, 0],
          size: [100, 100],
          flags: {},
          order: 0,
          mode: 0,
          inputs: [],
          outputs: [{ name: 'out', type: 'INT', links: [1] }],
          properties: {}
        },
        {
          id: 'custom-id',
          type: 'dummy',
          pos: [200, 0],
          size: [100, 100],
          flags: {},
          order: 1,
          mode: 0,
          inputs: [{ name: 'in', type: 'INT', link: 1 }],
          outputs: [],
          properties: {}
        }
      ],
      links: [
        {
          id: toLinkId(1),
          origin_id: 1,
          origin_slot: 0,
          target_id: 'custom-id',
          target_slot: 0,
          type: 'INT',
          parentId: toRerouteId(1)
        }
      ],
      reroutes: [{ id: 1, pos: [100, 0], linkIds: [1] }]
    })

    const created = graph.createSubgraph({
      ...definition,
      id: createUuidv4()
    })
    expect(normalized).toBeDefined()
    if (!normalized) return
    const link = normalized.links![0]
    const reroute = normalized.reroutes![0]

    expect(normalized.nodes!.map((node) => node.id)).not.toContain(toNodeId(1))
    expect(normalized.nodes!.map((node) => node.id)).not.toContain('custom-id')
    expect(link.id).not.toBe(toLinkId(1))
    expect(reroute.id).not.toBe(toRerouteId(1))
    expect(link.origin_id).toBe(normalized.nodes![0].id)
    expect(link.target_id).toBe(normalized.nodes![1].id)
    expect(link.parentId).toBe(reroute.id)
    expect(reroute.linkIds).toContain(link.id)
    expect(created.nodes.map((node) => node.id)).toEqual(
      normalized.nodes!.map((node) => toNodeId(node.id))
    )
    expect(created.links.get(toLinkId(link.id))?.origin_id).toBe(
      toNodeId(link.origin_id)
    )
    expect(created.links.get(toLinkId(link.id))?.target_id).toBe(
      toNodeId(link.target_id)
    )
    expect(created.reroutes.get(toRerouteId(reroute.id))?.linkIds).toContain(
      toLinkId(link.id)
    )
  })

  it('keeps the first duplicate subgraph definition during creation', () => {
    const graph = new LGraph()
    const id = createUuidv4()
    const definitions = [
      createTestSubgraphData({ id, name: 'first' }),
      createTestSubgraphData({ id, name: 'second' })
    ]
    const original = structuredClone(definitions)
    const createdEvents = vi.fn()
    graph.events.addEventListener('subgraph-created', createdEvents)

    const created = graph.createSubgraphs(definitions)

    expect(created).toHaveLength(1)
    expect(created[0].name).toBe('first')
    expect(graph.subgraphs.get(id)).toBe(created[0])
    expect(createdEvents).toHaveBeenCalledOnce()
    expect(definitions).toEqual(original)
  })

  it('remaps duplicate link IDs across subgraph definitions', () => {
    const { graph } = configureFromFixture()
    const ids = [...graph.subgraphs.values()].flatMap((subgraph) => [
      ...subgraph.links.keys(),
      ...subgraph.floatingLinks.keys()
    ])

    expect(new Set(ids).size).toBe(ids.length)
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
      serialized.id = graph.id
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
    expect(subgraph.id).toBe(zeroUuid)
  })
})

describe('node layout registration', () => {
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

  it('adopts existing store geometry when added', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.id = toNodeId(42)
    node.pos = [10, 20]
    node.size = [100, 80]
    layoutStore.applyOperation({
      type: 'createNode',
      graphId: graph.rootGraph.id,
      nodeId: node.id,
      layout: {
        id: node.id,
        position: { x: 300, y: 400 },
        size: { width: 220, height: 160 },
        zIndex: 1,
        visible: true,
        bounds: { x: 300, y: 400, width: 220, height: 160 }
      },
      timestamp: Date.now(),
      source: LayoutSource.Canvas
    })

    graph.add(node)

    expect([...node.pos]).toEqual([300, 400])
    expect([...node.size]).toEqual([220, 160])
  })

  it('does not consume a z-index when adopting existing geometry', () => {
    const graph = new LGraph()
    const adopted = new LGraphNode('adopted')
    adopted.id = toNodeId(42)
    layoutStore.applyOperation({
      type: 'createNode',
      graphId: graph.id,
      nodeId: adopted.id,
      layout: {
        id: adopted.id,
        position: { x: 0, y: 0 },
        size: { width: 100, height: 80 },
        zIndex: 1,
        visible: true,
        bounds: { x: 0, y: 0, width: 100, height: 80 }
      },
      timestamp: Date.now(),
      source: LayoutSource.Canvas
    })

    graph.add(adopted)
    const next = new LGraphNode('next')
    graph.add(next)

    expect(zIndexOf(graph, next)).toBe(zIndexOf(graph, adopted) + 1)
  })

  it('keeps canonical group geometry after removal', () => {
    const graph = new LGraph()
    const group = new LGraphGroup('group')
    graph.add(group)
    layoutStore.applyOperation({
      type: 'setGroupBounds',
      graphId: graph.id,
      groupId: group.id,
      position: { x: 300, y: 400 },
      size: { width: 220, height: 160 },
      timestamp: Date.now(),
      source: LayoutSource.Canvas
    })

    graph.remove(group)

    expect([...group.boundingRect]).toEqual([300, 400, 220, 160])
  })

  function zIndexOf(graph: LGraph, node: LGraphNode): number {
    const zIndex = layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id)
      .value?.zIndex
    if (zIndex === undefined) throw new Error(`Node ${node.id} has no layout`)
    return zIndex
  }

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

  it('registers after node:added so deferred listener work is queued first', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')

    graph.events.addEventListener('node:added', () => {
      expect(
        layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value
      ).toBeNull()
    })

    graph.add(node)

    expect.assertions(2)
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value
    ).not.toBeNull()
  })

  it('clears ownership despite a mutating listener that throws', async () => {
    const graph = new LGraph()
    const graphId = graph.id
    const node = new LGraphNode('test')
    graph.add(node)
    await Promise.resolve()

    vi.spyOn(console, 'error').mockImplementation(() => {})
    const stop = layoutStore.onGeometryChange(() => {
      node.pos = [500, 600]
      throw new Error('listener failure')
    })

    expect(() => graph.clear()).not.toThrow()
    await vi.waitFor(() => expect([...node.pos]).toEqual([500, 600]))
    stop()

    node.pos = [700, 800]
    expect(layoutStore.getNodeLayout(graphId, node.id)).toBeNull()
  })
})

describe('graph teardown drops layout entries', () => {
  const REROUTE = toRerouteId(1)

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

  function survivingEntries(
    rootGraphId: UUID,
    {
      root,
      group,
      interior
    }: ReturnType<typeof createGraphWithEveryLayoutEntryType>
  ) {
    return [
      layoutStore.getNodeLayoutRef(rootGraphId, root.id).value,
      layoutStore.getNodeLayoutRef(rootGraphId, interior.id).value,
      layoutStore.getGroupLayout(rootGraphId, group.id),
      layoutStore.getRerouteLayout(rootGraphId, REROUTE)
    ].filter((entry) => entry !== null).length
  }

  it.for([
    ['clear', (graph: LGraph) => graph.clear()],
    [
      'reconfigure',
      (graph: LGraph) => {
        const replacement = new LGraph()
        const data = replacement.serialize()
        replacement.clear()
        graph.configure(data)
      }
    ]
  ] as const)('drops every entry on %s', ([, teardown]) => {
    const populated = createGraphWithEveryLayoutEntryType()
    const rootGraphId = populated.graph.rootGraph.id
    expect(survivingEntries(rootGraphId, populated)).toBe(4)

    teardown(populated.graph)

    expect(survivingEntries(rootGraphId, populated)).toBe(0)
  })

  it('drops nested definition entries during individual teardown', () => {
    const graph = new LGraph()
    const rootGraphId = graph.id
    const parent = graph.createSubgraph(createTestSubgraphData())
    const nested = graph.createSubgraph(createTestSubgraphData())
    parent.add(createTestSubgraphNode(nested, { parentGraph: parent }))

    const node = new LGraphNode('nested')
    const group = new LGraphGroup('nested')
    const rerouteId = toRerouteId(2)
    nested.add(node)
    nested.add(group)
    nested._addReroute(new Reroute(rerouteId, nested, [10, 10]))

    expect(
      layoutStore.getNodeLayoutRef(rootGraphId, node.id).value
    ).not.toBeNull()
    expect(layoutStore.getGroupLayout(rootGraphId, group.id)).not.toBeNull()
    expect(layoutStore.getRerouteLayout(rootGraphId, rerouteId)).not.toBeNull()

    graph.clear()

    expect(layoutStore.getNodeLayoutRef(rootGraphId, node.id).value).toBeNull()
    expect(layoutStore.getGroupLayout(rootGraphId, group.id)).toBeNull()
    expect(layoutStore.getRerouteLayout(rootGraphId, rerouteId)).toBeNull()
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
})
