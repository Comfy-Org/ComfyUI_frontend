import { describe, expect, it, onTestFinished, vi } from 'vitest'

import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import {
  LGraphCanvas,
  LGraphNode,
  LiteGraph,
  createUuidv4
} from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  enableSubgraphNodeCreation
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type {
  ExportedSubgraph,
  ISerialisedNode
} from '@/lib/litegraph/src/types/serialisation'
import {
  createMockCanvasRenderingContext2D,
  reloadSerializedGraph
} from '@/utils/__tests__/litegraphTestUtils'

const INTERIOR_TYPE = 'Fixture/BlueprintInterior'

function createCanvas(graph: LGraph): LGraphCanvas {
  const el = document.createElement('canvas')
  el.width = 800
  el.height = 600
  el.getContext = vi.fn().mockReturnValue(createMockCanvasRenderingContext2D())
  el.getBoundingClientRect = vi
    .fn()
    .mockReturnValue({ left: 0, top: 0, width: 800, height: 600 })
  return new LGraphCanvas(el, graph, { skip_render: true, skip_events: true })
}

// The shape `useSubgraphStore().getBlueprint()` hands `addNodeOnGraph`: one
// host node typed by a definition, and that definition, pasted together.
function blueprintItems() {
  const definitionId = createUuidv4()
  const definition: ExportedSubgraph = {
    id: definitionId,
    version: 1,
    revision: 0,
    state: { lastNodeId: 1, lastLinkId: 2, lastGroupId: 0, lastRerouteId: 0 },
    config: {},
    name: 'test blueprint',
    inputNode: { id: SUBGRAPH_INPUT_ID, bounding: [0, 0, 10, 10] },
    outputNode: { id: SUBGRAPH_OUTPUT_ID, bounding: [0, 0, 10, 10] },
    inputs: [
      { id: createUuidv4(), name: 'image', type: 'IMAGE', linkIds: [1] }
    ],
    outputs: [
      { id: createUuidv4(), name: 'IMAGE', type: 'IMAGE', linkIds: [2] }
    ],
    widgets: [],
    nodes: [
      {
        id: 1,
        type: INTERIOR_TYPE,
        pos: [100, 100],
        size: [200, 80],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [{ name: 'image', type: 'IMAGE', link: 1 }],
        outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [2] }],
        properties: {}
      }
    ],
    links: [
      {
        id: 1,
        origin_id: SUBGRAPH_INPUT_ID,
        origin_slot: 0,
        target_id: 1,
        target_slot: 0,
        type: 'IMAGE'
      },
      {
        id: 2,
        origin_id: 1,
        origin_slot: 0,
        target_id: SUBGRAPH_OUTPUT_ID,
        target_slot: 0,
        type: 'IMAGE'
      }
    ],
    groups: []
  }
  const host: ISerialisedNode = {
    id: 2,
    type: definitionId,
    title: 'test blueprint',
    pos: [0, 0],
    size: [225, 100],
    flags: {},
    order: 0,
    mode: 0,
    inputs: [{ name: 'image', type: 'IMAGE', link: null }],
    outputs: [{ name: 'IMAGE', type: 'IMAGE', links: null }],
    properties: { proxyWidgets: [] },
    widgets_values: []
  }
  return { nodes: [host], subgraphs: [definition] }
}

class BlueprintInteriorNode extends LGraphNode {
  constructor() {
    super('Interior')
    this.addInput('image', 'IMAGE')
    this.addOutput('IMAGE', 'IMAGE')
  }
}

describe('LGraph serialize as the workflow tab-switch snapshot', () => {
  it('carries a just-pasted blueprint definition so the host node reloads as a subgraph node', () => {
    LiteGraph.registerNodeType(INTERIOR_TYPE, BlueprintInteriorNode)
    const rootGraph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))
    const canvas = createCanvas(rootGraph)

    const results = canvas._deserializeItems(blueprintItems(), {
      position: [300, 300]
    })
    const pasted = results?.nodes.values().next().value
    if (!pasted) throw new Error('the blueprint paste produced no node')
    const snapshot = rootGraph.serialize()

    expect(snapshot.definitions?.subgraphs?.map(({ id }) => id)).toEqual([
      pasted.type
    ])
    expect(snapshot.nodes.map(({ type }) => type)).toEqual([pasted.type])

    const reloaded = reloadSerializedGraph(snapshot, () => {
      const graph = createTestRootGraph()
      onTestFinished(enableSubgraphNodeCreation(graph))
      return graph
    })
    expect(
      reloaded.nodes.map((node) => [node.type, node.isSubgraphNode()])
    ).toEqual([[pasted.type, true]])
  })
})
