import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  ExportedSubgraph,
  ISerialisedNode,
  SerialisableGraph
} from '@/lib/litegraph/src/types/serialisation'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useRerouteStore } from '@/stores/rerouteStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'
import type { UUID } from '@/utils/uuid'

/**
 * Gate 1 P0 #2 of `docs/architecture/ecs/ecs-verification-audit.md`:
 * "failed or interrupted workflow load. Force a configure callback to throw
 * after some nested definitions register, then load another workflow. Assert
 * no node/link/reroute/layout/widget ownership leaks from the failed graph."
 *
 * `LGraph.configure` is not transactional: its `try`/`finally` restores the
 * shadow-diff flag and dispatches `configured`, but it does not roll back the
 * entities already registered when a node's `onConfigure` throws. What keeps a
 * later load clean is `resetAfterClear()`, which clears every graph-scoped
 * store under `this.id` before the id is reassigned. These tests pin that
 * recovery so a refactor that moves the clearing into the success path of
 * `configure` fails here rather than silently leaking a half-loaded workflow
 * into the next one the user opens (invariant I3).
 */

const SUB_A = '11111111-1111-4111-8111-111111111111'
const SUB_B = '22222222-2222-4222-8222-222222222222'
const FAILED_GRAPH_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const NEXT_GRAPH_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const FAILED_NODE_IDS = [101, 102, 103, 104]
const NEXT_NODE_IDS = [1, 2]

let throwOnConfigure = false

class PlainNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'plain', 'plain')
    this.addInput('in', 'number')
    this.addOutput('out', 'number')
    this.addWidget('number', 'seed', 1, () => {})
  }
}

class ThrowingNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'throwing', 'throwing')
    this.addInput('in', 'number')
    this.addOutput('out', 'number')
    this.addWidget('number', 'seed', 1, () => {})
  }

  override onConfigure() {
    if (throwOnConfigure) throw new Error('configure callback exploded')
  }
}

function interiorNode(id: number, order: number): ISerialisedNode {
  return {
    id,
    type: 'plain',
    pos: [0, 0],
    size: [100, 50],
    flags: {},
    order,
    mode: 0
  }
}

function subgraphDefinition(id: string, name: string): ExportedSubgraph {
  return {
    id,
    version: 1,
    revision: 0,
    state: { lastNodeId: 8, lastLinkId: 1, lastGroupId: 0, lastRerouteId: 0 },
    name,
    config: {},
    inputNode: { id: SUBGRAPH_INPUT_ID, bounding: [10, 100, 150, 126] },
    outputNode: { id: SUBGRAPH_OUTPUT_ID, bounding: [400, 100, 140, 126] },
    inputs: [],
    outputs: [],
    widgets: [],
    nodes: [interiorNode(3, 0), interiorNode(8, 1)],
    links: [
      {
        id: 1,
        origin_id: 3,
        origin_slot: 0,
        target_id: 8,
        target_slot: 0,
        type: 'number'
      }
    ],
    groups: []
  }
}

function rootNode(id: number, type: string, order: number): ISerialisedNode {
  return {
    id,
    type,
    pos: [order * 300, 0],
    size: [180, 80],
    flags: {},
    order,
    mode: 0
  }
}

/**
 * Two nested subgraph definitions, four root nodes, a link, a reroute and a
 * group. Root node 104 throws from `onConfigure`, so the load dies after both
 * definitions and the three earlier nodes have already registered.
 */
const interruptedWorkflow = {
  id: FAILED_GRAPH_ID,
  version: 1,
  revision: 0,
  state: { lastNodeId: 200, lastLinkId: 20, lastGroupId: 1, lastRerouteId: 1 },
  nodes: [
    rootNode(101, SUB_A, 0),
    rootNode(102, SUB_B, 1),
    rootNode(103, 'plain', 2),
    rootNode(104, 'throwing', 3)
  ],
  links: [
    {
      id: 11,
      origin_id: 103,
      origin_slot: 0,
      target_id: 104,
      target_slot: 0,
      type: 'number'
    }
  ],
  reroutes: [{ id: 1, pos: [750, 30], linkIds: [11] }],
  groups: [
    {
      id: 1,
      title: 'A group',
      bounding: [0, 0, 400, 200],
      color: '#333',
      font_size: 24,
      flags: {}
    }
  ],
  definitions: {
    subgraphs: [
      subgraphDefinition(SUB_A, 'SubA'),
      subgraphDefinition(SUB_B, 'SubB')
    ]
  }
} satisfies SerialisableGraph

/** The innocent workflow the user opens after the failed load. */
const nextWorkflow = {
  id: NEXT_GRAPH_ID,
  version: 1,
  revision: 0,
  state: { lastNodeId: 2, lastLinkId: 1, lastGroupId: 0, lastRerouteId: 0 },
  nodes: [rootNode(1, 'plain', 0), rootNode(2, 'plain', 1)],
  links: [
    {
      id: 1,
      origin_id: 1,
      origin_slot: 0,
      target_id: 2,
      target_slot: 0,
      type: 'number'
    }
  ],
  groups: []
} satisfies SerialisableGraph

function scopeOf(graphId: UUID) {
  return {
    rootGraphId: toRootGraphId(graphId),
    owningGraphId: toOwningGraphId(graphId)
  }
}

/** Everything a graph id still owns across the ECS stores. */
function ownershipUnder(graphId: UUID, nodeIds: number[]) {
  const scope = scopeOf(graphId)
  return {
    links: [...useLinkStore().graphTopologies(scope)].map((t) => t.id),
    nodes: useNodeDataStore()
      .getGraphNodesFor(graphId, graphId)
      .map((state) => state.id),
    reroutes: [1, 2, 3]
      .filter((id) => useRerouteStore().getReroute(scope, toRerouteId(id)))
      .map((id) => id),
    layouts: nodeIds.filter(
      (id) => layoutStore.getNodeLayout(graphId, toNodeId(id)) != null
    ),
    widgets: nodeIds.flatMap((id) =>
      useWidgetValueStore().getNodeWidgetIds(graphId, toNodeId(id))
    )
  }
}

function loadInterrupted(graph: LGraph) {
  throwOnConfigure = true
  try {
    expect(() => graph.configure(structuredClone(interruptedWorkflow))).toThrow(
      'configure callback exploded'
    )
  } finally {
    throwOnConfigure = false
  }
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  throwOnConfigure = false
  LiteGraph.registerNodeType('plain', PlainNode)
  LiteGraph.registerNodeType('throwing', ThrowingNode)
})

describe('LGraph.configure interrupted by a throwing node callback', () => {
  it('leaves the failed graph populated, so the recovery assertions are not vacuous', () => {
    const graph = new LGraph()
    loadInterrupted(graph)

    // Control arm. If configure ever starts rolling back on failure, or the
    // throw stops firing, these go to zero and the tests below would pass for
    // the wrong reason.
    expect(graph.id).toBe(FAILED_GRAPH_ID)
    expect(graph.subgraphs.size).toBe(2)
    const owned = ownershipUnder(FAILED_GRAPH_ID, FAILED_NODE_IDS)
    expect(owned.nodes).toHaveLength(4)
    expect(owned.links).toEqual([11])
    expect(owned.reroutes).toEqual([1])
    expect(owned.layouts).toEqual(FAILED_NODE_IDS)
    expect(owned.widgets.length).toBeGreaterThan(0)
  })

  it('leaves nothing owned by the failed graph once the next workflow is loaded', () => {
    const graph = new LGraph()
    loadInterrupted(graph)

    graph.configure(structuredClone(nextWorkflow))

    expect(ownershipUnder(FAILED_GRAPH_ID, FAILED_NODE_IDS)).toEqual({
      links: [],
      nodes: [],
      reroutes: [],
      layouts: [],
      widgets: []
    })
    expect(graph.subgraphs.size).toBe(0)
  })

  it('gives the next workflow the same state as if the failed load never happened', () => {
    const reference = new LGraph()
    reference.configure(structuredClone(nextWorkflow))
    const referenceOwnership = ownershipUnder(NEXT_GRAPH_ID, NEXT_NODE_IDS)
    const referenceShape = {
      nodes: reference.nodes.length,
      links: reference.links.size,
      reroutes: reference.reroutes.size,
      groups: reference._groups.length,
      subgraphs: reference.subgraphs.size
    }

    setActivePinia(createTestingPinia({ stubActions: false }))
    const graph = new LGraph()
    loadInterrupted(graph)
    graph.configure(structuredClone(nextWorkflow))

    expect({
      nodes: graph.nodes.length,
      links: graph.links.size,
      reroutes: graph.reroutes.size,
      groups: graph._groups.length,
      subgraphs: graph.subgraphs.size
    }).toEqual(referenceShape)
    expect(ownershipUnder(NEXT_GRAPH_ID, NEXT_NODE_IDS)).toEqual(
      referenceOwnership
    )
  })

  it('dispatches `configured` for a load that threw, exactly as for one that succeeded', () => {
    // Characterisation, not an endorsement: a listener cannot tell a failed
    // load from a successful one. Tracked as a follow-up rather than fixed
    // here, because `configuring`/`configured` are extension-facing events.
    const graph = new LGraph()
    const onConfigured = vi.fn()
    graph.events.addEventListener('configured', onConfigured)

    loadInterrupted(graph)

    expect(onConfigured).toHaveBeenCalledTimes(1)
  })
})
