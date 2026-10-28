import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, onTestFinished } from 'vitest'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { applyOps, mint, project } from '@comfyorg/comfy-multi-player'

import { emitGraphIntent } from '@/lib/litegraph/src/graphIntents'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LLink } from '@/lib/litegraph/src/LLink'
import { toRootGraphId } from '@/types/graphScopeId'
import { toNodeId } from '@/types/nodeId'

import { readDocPromotedWidgets } from './agentSubgraphDefinitions'
import { attachDocOpMinter } from './docOpMinter'
import type { GraphOperation } from './graphOperations'
import { readDocSlotNames, readDocWidgetValue } from './liveGraphApplier'
import { mintWireOps } from './opEnvelope'

const ROOT_GRAPH_ID = toRootGraphId('root-uuid')
const PRIMITIVE_INT = 10
const LOAD_VIDEO = 1_000_000_371
const CSV_COLUMN = 1_000_000_538

const LOAD_VIDEO_WIDGETS = [
  'video',
  'force_rate',
  'custom_width',
  'custom_height',
  'frame_load_cap',
  'skip_first_frames',
  'select_every_nth'
]
const CSV_COLUMN_WIDGETS = ['csv_path', 'column', 'frame_load_cap']
const CATALOG: WidgetCatalog = {
  types: {
    PrimitiveInt: { widget_order: ['value', 'control_after_generate'] },
    VHS_LoadVideo: { widget_order: LOAD_VIDEO_WIDGETS },
    CSVCVColumn: { widget_order: CSV_COLUMN_WIDGETS }
  }
}

function agentBuiltWorkflow(): WorkflowJSON {
  return {
    nodes: [
      {
        id: PRIMITIVE_INT,
        type: 'PrimitiveInt',
        pos: [0, 0],
        inputs: [
          { name: 'value', type: 'INT', widget: { name: 'value' }, link: null }
        ],
        outputs: [{ name: 'INT', type: 'INT', links: [] }],
        widgets_values: [48, 'fixed']
      },
      {
        id: LOAD_VIDEO,
        type: 'VHS_LoadVideo',
        pos: [300, 0],
        inputs: [
          { name: 'meta_batch', type: 'VHS_BatchManager', link: null },
          { name: 'vae', type: 'VAE', link: null }
        ],
        outputs: [
          { name: 'IMAGE', type: 'IMAGE', links: [] },
          { name: 'frame_count', type: 'INT', links: [] }
        ],
        widgets_values: ['clip.mp4', 0, 0, 0, 1000, 0, 1]
      },
      {
        id: CSV_COLUMN,
        type: 'CSVCVColumn',
        pos: [300, 300],
        inputs: [],
        outputs: [{ name: 'FLOAT', type: 'FLOAT', links: [] }],
        widgets_values: ['cv.csv', 'cc1', 1000]
      }
    ],
    links: []
  }
}

function socketedAgentBuiltWorkflow(): WorkflowJSON {
  const workflow = agentBuiltWorkflow()
  const sockets = (names: string[]) =>
    names
      .filter((name) => name !== 'video' && name !== 'csv_path')
      .map((name) => ({
        name,
        type: 'INT',
        widget: { name },
        link: null
      }))
  workflow.nodes[1].inputs = [
    ...(workflow.nodes[1].inputs ?? []),
    ...sockets(LOAD_VIDEO_WIDGETS)
  ]
  workflow.nodes[2].inputs = sockets(CSV_COLUMN_WIDGETS)
  return workflow
}

function liveNode(
  type: string,
  id: number,
  linkInputs: string[],
  widgetInputs: string[]
): LGraphNode {
  const node = new LGraphNode(type)
  node.id = toNodeId(id)
  for (const name of linkInputs) node.addInput(name, '*')
  for (const name of widgetInputs)
    node.addInput(name, 'INT', { widget: { name } })
  return node
}

function liveGraph(): LGraph {
  const liveNodes = new Map<string, LGraphNode>([
    [
      String(LOAD_VIDEO),
      liveNode(
        'VHS_LoadVideo',
        LOAD_VIDEO,
        ['meta_batch', 'vae'],
        LOAD_VIDEO_WIDGETS
      )
    ],
    [
      String(CSV_COLUMN),
      liveNode('CSVCVColumn', CSV_COLUMN, [], CSV_COLUMN_WIDGETS)
    ]
  ])
  const graph = fromPartial<LGraph>({
    id: ROOT_GRAPH_ID,
    isRootGraph: true,
    getNodeById: (id: unknown) => liveNodes.get(String(id)) ?? null
  })
  return Object.assign(graph, { rootGraph: graph })
}

interface ProjectedInput {
  name: string
  link: unknown
  widget?: { name: string }
}

describe('a human link into a widget input the agent-built document lacks', () => {
  it.for([
    { node: 'VHS_LoadVideo', linkId: 501, target: LOAD_VIDEO },
    { node: 'CSVCVColumn', linkId: 502, target: CSV_COLUMN }
  ])(
    'reaches the document the agent reads, so $node frame_load_cap shows as linked',
    async ({ linkId, target }) => {
      const doc = mint(agentBuiltWorkflow(), CATALOG)
      const rootGraph = liveGraph()
      const minted: GraphOperation[] = []
      const port = attachDocOpMinter({
        isEnabled: () => true,
        isDocBound: () => true,
        enqueue: (ops) => minted.push(...ops),
        getGraph: () => rootGraph,
        boundRootGraphId: () => ROOT_GRAPH_ID,
        docInputNames: (id) => readDocSlotNames(doc, String(id), 'inputs'),
        docWidgetValue: (id, widgetName) =>
          readDocWidgetValue(doc, String(id), widgetName),
        docPromotedWidgets: (id) => readDocPromotedWidgets(doc, String(id)),
        mayWritePromotedHost: () => true,
        docHasSubgraphDefinition: () => true,
        onWidgetWriteRefused: () => {}
      })
      onTestFinished(() => port.detach())

      const liveTarget = rootGraph.getNodeById(toNodeId(target))
      emitGraphIntent({
        type: 'connect',
        graph: rootGraph,
        link: fromPartial<LLink>({
          id: linkId,
          origin_id: toNodeId(PRIMITIVE_INT),
          origin_slot: 0,
          target_id: toNodeId(target),
          target_slot: liveTarget?.findInputSlot('frame_load_cap'),
          type: 'INT'
        })
      })
      await new Promise<void>((resolve) => queueMicrotask(resolve))

      expect(minted.map((op) => op.op)).toEqual(['connect'])

      const wireOps = mintWireOps(minted, {
        actor: 'human:u1:tab',
        baseVersion: 1
      })
      expect(applyOps(doc, wireOps, CATALOG).outcomes).toEqual(
        wireOps.map((op) => ({ op_id: op.op_id, outcome: 'applied' }))
      )

      const agentView = project(doc, CATALOG)
      const projected = agentView.nodes.find(
        (n) => String(n.id) === String(target)
      )
      const inputs = (projected?.inputs ?? []) as ProjectedInput[]
      const capIndex = inputs.findIndex(
        (input) => input.name === 'frame_load_cap'
      )
      expect(inputs[capIndex]).toMatchObject({
        link: linkId,
        widget: { name: 'frame_load_cap' }
      })
      expect(agentView.links).toContainEqual([
        linkId,
        String(PRIMITIVE_INT),
        0,
        String(target),
        capIndex,
        'INT'
      ])
    }
  )

  it('mints an ordinary connect, not a grow, once the document carries the widget socket', async () => {
    const doc = mint(socketedAgentBuiltWorkflow(), CATALOG)
    const rootGraph = liveGraph()
    const minted: GraphOperation[] = []
    const port = attachDocOpMinter({
      isEnabled: () => true,
      isDocBound: () => true,
      enqueue: (ops) => minted.push(...ops),
      getGraph: () => rootGraph,
      boundRootGraphId: () => ROOT_GRAPH_ID,
      docInputNames: (id) => readDocSlotNames(doc, String(id), 'inputs'),
      docWidgetValue: (id, widgetName) =>
        readDocWidgetValue(doc, String(id), widgetName),
      docPromotedWidgets: (id) => readDocPromotedWidgets(doc, String(id)),
      mayWritePromotedHost: () => true,
      docHasSubgraphDefinition: () => true,
      onWidgetWriteRefused: () => {}
    })
    onTestFinished(() => port.detach())
    const docCapIndex = readDocSlotNames(
      doc,
      String(LOAD_VIDEO),
      'inputs'
    )?.indexOf('frame_load_cap')

    emitGraphIntent({
      type: 'connect',
      graph: rootGraph,
      link: fromPartial<LLink>({
        id: 503,
        origin_id: toNodeId(PRIMITIVE_INT),
        origin_slot: 0,
        target_id: toNodeId(LOAD_VIDEO),
        target_slot: rootGraph
          .getNodeById(toNodeId(LOAD_VIDEO))
          ?.findInputSlot('frame_load_cap'),
        type: 'INT'
      })
    })
    await new Promise<void>((resolve) => queueMicrotask(resolve))

    expect(minted).toEqual([
      expect.objectContaining({
        op: 'connect',
        link_id: 503,
        to_slot: docCapIndex
      })
    ])
    expect(minted[0]).not.toHaveProperty('grow')
  })
})
