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
import { readDocSlotNames } from './liveGraphApplier'
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

const HUMAN_LINKS = [
  { linkId: 501, target: LOAD_VIDEO },
  { linkId: 502, target: CSV_COLUMN }
] as const

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
const rootGraph: LGraph = fromPartial<LGraph>({
  id: ROOT_GRAPH_ID,
  isRootGraph: true,
  getNodeById: (id: unknown) => liveNodes.get(String(id)) ?? null
})
Object.assign(rootGraph, { rootGraph })

function liveSlot(nodeId: number, name: string): number {
  const index =
    liveNodes.get(String(nodeId))?.inputs.findIndex((i) => i.name === name) ??
    -1
  if (index < 0) throw new Error(`live node ${nodeId} has no input ${name}`)
  return index
}

interface ProjectedInput {
  name: string
  link: unknown
  widget?: { name: string }
}

describe('a human link into a widget input the agent-built document lacks', () => {
  it('reaches the document the agent reads, so frame_load_cap shows as linked', async () => {
    const doc = mint(agentBuiltWorkflow(), CATALOG)
    const minted: GraphOperation[] = []
    const port = attachDocOpMinter({
      isEnabled: () => true,
      isDocBound: () => true,
      enqueue: (ops) => minted.push(...ops),
      getGraph: () => rootGraph,
      boundRootGraphId: () => ROOT_GRAPH_ID,
      docInputNames: (id) => readDocSlotNames(doc, String(id), 'inputs'),
      docPromotedWidgets: (id) => readDocPromotedWidgets(doc, String(id)),
      mayWritePromotedHost: () => true,
      onWidgetWriteRefused: () => {}
    })
    onTestFinished(() => port.detach())

    for (const { linkId, target } of HUMAN_LINKS) {
      emitGraphIntent({
        type: 'connect',
        graph: rootGraph,
        link: fromPartial<LLink>({
          id: linkId,
          origin_id: toNodeId(PRIMITIVE_INT),
          origin_slot: 0,
          target_id: toNodeId(target),
          target_slot: liveSlot(target, 'frame_load_cap'),
          type: 'INT'
        })
      })
    }
    await new Promise<void>((resolve) => queueMicrotask(resolve))

    expect(minted.map((op) => op.op)).toEqual(['connect', 'connect'])

    const wireOps = mintWireOps(minted, {
      actor: 'human:u1:tab',
      baseVersion: 1
    })
    expect(applyOps(doc, wireOps, CATALOG).outcomes).toEqual(
      wireOps.map((op) => ({ op_id: op.op_id, outcome: 'applied' }))
    )

    const agentView = project(doc, CATALOG)
    for (const { linkId, target } of HUMAN_LINKS) {
      const node = agentView.nodes.find((n) => String(n.id) === String(target))
      const inputs = (node?.inputs ?? []) as ProjectedInput[]
      expect(
        inputs.find((input) => input.name === 'frame_load_cap')
      ).toMatchObject({ link: linkId, widget: { name: 'frame_load_cap' } })
      expect(agentView.links).toContainEqual([
        linkId,
        String(PRIMITIVE_INT),
        0,
        String(target),
        inputs.findIndex((input) => input.name === 'frame_load_cap'),
        'INT'
      ])
    }
  })
})
