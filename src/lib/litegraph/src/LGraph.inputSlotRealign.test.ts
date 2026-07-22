import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

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
import { useLinkStore } from '@/stores/linkStore'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

const DEFINITION_ORDER = ['in_a', 'in_b', 'in_c']

/**
 * Mimics ComfyNode.configure (src/services/litegraphService.ts): reorders the
 * serialized inputs array in place on `data` to match the current node
 * definition order before delegating to LGraphNode.configure. This is the
 * issue #3348 scenario: a workflow saved before the node definition's input
 * order changed (e.g. a forceInput migration in a node pack update).
 */
class ReorderTargetNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'ReorderTarget')
    for (const name of DEFINITION_ORDER) this.addInput(name, 'number')
  }

  override configure(data: ISerialisedNode): void {
    data.inputs = [...(data.inputs ?? [])].sort(
      (a, b) =>
        DEFINITION_ORDER.indexOf(a.name) - DEFINITION_ORDER.indexOf(b.name)
    )
    super.configure(data)
  }
}

class SourceNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'Source')
    this.addOutput('out', 'number')
  }
}

const SUBGRAPH_ID = 'ab111111-1111-4111-8111-111111111111'

/**
 * Source and reorder-target nodes connected by three links whose saved
 * `target_slot` matches the saved input order [in_b, in_c, in_a], which is
 * stale relative to the current definition order [in_a, in_b, in_c].
 */
function shiftedNodesAndLinks(sourceId: number, targetId: number) {
  return {
    nodes: [
      {
        id: sourceId,
        type: 'test/RealignSource',
        pos: [0, 0] as [number, number],
        size: [140, 60] as [number, number],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [{ name: 'out', type: 'number', links: [1, 2, 3] }],
        properties: {}
      },
      {
        id: targetId,
        type: 'test/RealignTarget',
        pos: [300, 0] as [number, number],
        size: [140, 80] as [number, number],
        flags: {},
        order: 1,
        mode: 0,
        inputs: [
          { name: 'in_b', type: 'number', link: 1 },
          { name: 'in_c', type: 'number', link: 2 },
          { name: 'in_a', type: 'number', link: 3 }
        ],
        outputs: [],
        properties: {}
      }
    ],
    links: [
      {
        id: 1,
        origin_id: sourceId,
        origin_slot: 0,
        target_id: targetId,
        target_slot: 0,
        type: 'number'
      },
      {
        id: 2,
        origin_id: sourceId,
        origin_slot: 0,
        target_id: targetId,
        target_slot: 1,
        type: 'number'
      },
      {
        id: 3,
        origin_id: sourceId,
        origin_slot: 0,
        target_id: targetId,
        target_slot: 2,
        type: 'number'
      }
    ]
  }
}

/**
 * As {@link shiftedNodesAndLinks}, but `in_a` carries a duplicate link: the
 * survivor registered first (id 3) is not the id the serialized input
 * references (id 4). Dedup keeps 3 and purges 4, so realignment must follow
 * the purged reference through to the survivor to correct its slot.
 */
function duplicateDriftedNodesAndLinks(sourceId: number, targetId: number) {
  const base = shiftedNodesAndLinks(sourceId, targetId)
  const target = base.nodes[1]
  target.inputs = [
    { name: 'in_b', type: 'number', link: 1 },
    { name: 'in_c', type: 'number', link: 2 },
    { name: 'in_a', type: 'number', link: 4 }
  ]
  base.nodes[0].outputs = [{ name: 'out', type: 'number', links: [1, 2, 3, 4] }]
  base.links.push({
    id: 4,
    origin_id: sourceId,
    origin_slot: 0,
    target_id: targetId,
    target_slot: 2,
    type: 'number'
  })
  return base
}

function repeatedReferenceWorkflow(
  targetSlot: number,
  referenceSlots: readonly number[]
): SerialisableGraph {
  const workflow = savedWorkflow()
  const source = workflow.nodes![0]
  const target = workflow.nodes![1]
  source.outputs = [{ name: 'out', type: 'number', links: [1] }]
  target.inputs = DEFINITION_ORDER.map((name, slot) => ({
    name,
    type: 'number',
    link: referenceSlots.includes(slot) ? 1 : null
  }))
  workflow.links = [
    {
      id: 1,
      origin_id: 1,
      origin_slot: 0,
      target_id: 2,
      target_slot: targetSlot,
      type: 'number'
    }
  ]
  return workflow
}

function emptySubgraphDefinition(): ExportedSubgraph {
  return {
    id: SUBGRAPH_ID,
    version: 1,
    revision: 0,
    state: { lastNodeId: 0, lastLinkId: 0, lastGroupId: 0, lastRerouteId: 0 },
    name: 'Empty Subgraph',
    config: {},
    inputNode: { id: SUBGRAPH_INPUT_ID, bounding: [0, 0, 120, 60] },
    outputNode: { id: SUBGRAPH_OUTPUT_ID, bounding: [300, 0, 120, 60] },
    inputs: [],
    outputs: [],
    widgets: [],
    nodes: [],
    links: []
  }
}

interface WorkflowOptions {
  duplicate?: boolean
  insideSubgraph?: boolean
  withSubgraphDefinition?: boolean
}

function savedWorkflow({
  duplicate = false,
  insideSubgraph = false,
  withSubgraphDefinition = false
}: WorkflowOptions = {}): SerialisableGraph {
  const id = insideSubgraph
    ? 'ab000000-0000-4000-8000-000000000002'
    : duplicate
      ? 'ab000000-0000-4000-8000-000000000003'
      : 'ab000000-0000-4000-8000-000000000001'
  const contents = duplicate
    ? duplicateDriftedNodesAndLinks(1, 2)
    : shiftedNodesAndLinks(1, 2)
  const definitions = insideSubgraph
    ? {
        subgraphs: [
          {
            ...emptySubgraphDefinition(),
            name: 'Subgraph With Shifted Inputs',
            state: {
              lastNodeId: 20,
              lastLinkId: 3,
              lastGroupId: 0,
              lastRerouteId: 0
            },
            ...shiftedNodesAndLinks(10, 20)
          }
        ]
      }
    : withSubgraphDefinition
      ? { subgraphs: [emptySubgraphDefinition()] }
      : undefined

  return {
    id,
    version: 1,
    revision: 0,
    state: {
      lastNodeId: insideSubgraph ? 0 : 2,
      lastLinkId: duplicate ? 4 : insideSubgraph ? 0 : 3,
      lastGroupId: 0,
      lastRerouteId: 0
    },
    ...(insideSubgraph ? { nodes: [], links: [] } : contents),
    ...(definitions ? { definitions } : {})
  }
}

const LINK_BY_INPUT_NAME: Record<string, number> = {
  in_a: 3,
  in_b: 1,
  in_c: 2
}

function assertLinksRealigned(graph: LGraph, targetNodeId: NodeId) {
  const target = graph.getNodeById(targetNodeId)!
  const linkStore = useLinkStore()

  for (const [slot, input] of target.inputs.entries()) {
    const expectedLinkId = toLinkId(LINK_BY_INPUT_NAME[input.name])
    const link = graph.links.get(expectedLinkId)!

    expect(link.target_slot, `link.target_slot for input ${input.name}`).toBe(
      slot
    )
    expect(
      linkStore.getInputSlotLink(graph.rootGraph.id, target.id, slot)?.id,
      `store registration for input ${input.name} at slot ${slot}`
    ).toBe(expectedLinkId)
  }
}

describe('LGraph.configure input slot realignment (#3348)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    LiteGraph.registerNodeType('test/RealignSource', SourceNode)
    LiteGraph.registerNodeType('test/RealignTarget', ReorderTargetNode)
  })

  it.for([
    ['root workflow', {}, toNodeId(2)],
    [
      'root workflow cloned for definitions',
      { withSubgraphDefinition: true },
      toNodeId(2)
    ],
    ['subgraph definition', { insideSubgraph: true }, toNodeId(20)]
  ] satisfies [string, WorkflowOptions, NodeId][])(
    're-keys links in %s',
    ([_name, options, targetNodeId]) => {
      const graph = new LGraph()
      graph.configure(savedWorkflow(options))
      const configuredGraph =
        'insideSubgraph' in options && options.insideSubgraph
          ? graph.subgraphs.get(SUBGRAPH_ID)!
          : graph

      assertLinksRealigned(configuredGraph, targetNodeId)
    }
  )

  it('realigns the survivor when a drifted input referenced a deduplicated link', () => {
    const graph = new LGraph()
    graph.configure(savedWorkflow({ duplicate: true }))

    expect(graph.links.has(toLinkId(4))).toBe(false)
    assertLinksRealigned(graph, toNodeId(2))
  })

  it('uses the first slot when one link is referenced by multiple inputs', () => {
    const graph = new LGraph()
    graph.configure(repeatedReferenceWorkflow(2, [0, 1]))

    expect(graph.getLink(toLinkId(1))?.target_slot).toBe(0)
    expect(graph.getNodeById(toNodeId(2))?.getInputLink(0)?.id).toBe(
      toLinkId(1)
    )
  })

  it('preserves the current slot when it is one of multiple references', () => {
    const graph = new LGraph()
    graph.configure(repeatedReferenceWorkflow(2, [0, 2]))

    expect(graph.getLink(toLinkId(1))?.target_slot).toBe(2)
    expect(graph.getNodeById(toNodeId(2))?.getInputLink(2)?.id).toBe(
      toLinkId(1)
    )
  })
})
