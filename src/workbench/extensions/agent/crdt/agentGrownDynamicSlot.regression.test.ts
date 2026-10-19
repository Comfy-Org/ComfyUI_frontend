import { applyOps } from '@comfyorg/comfy-multi-player'
import type {
  Op,
  WidgetCatalog,
  WorkflowJSON
} from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import { useLitegraphService } from '@/services/litegraphService'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import { followedDoc } from './__fixtures__/followedDoc'
import { LiveGraphApplier } from './liveGraphApplier'

vi.mock(import('@/platform/telemetry/reportError'))

const AUTOGROW_GROUP = 'images'
const LIST_NODE = 136
const SOURCE_NODE = 1185414266635890
const LINK = 294

/**
 * An image list whose `images` group grows one slot at a time, the shape behind
 * the high target slot indices in the dropped-link reports.
 */
class TestImageList extends LGraphNode {
  constructor() {
    super('Test Image List')
    this.widgets = []
    useLitegraphService().addNodeInput(
      this,
      transformInputSpecV1ToV2(
        [
          'COMFY_AUTOGROW_V3',
          {
            template: {
              input: { required: { image: ['IMAGE', {}] } },
              prefix: 'image',
              min: 1
            }
          }
        ],
        { name: AUTOGROW_GROUP, isOptional: false }
      )
    )
  }
}

class TestImageSource extends LGraphNode {
  constructor() {
    super('Test Image Source')
    this.addOutput('IMAGE', 'IMAGE')
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    TestImageList: { widget_order: [] },
    TestImageSource: { widget_order: [] }
  }
}
const CONTEXT = { actor: 'agent:test', opIds: ['op-1'] }

function sourceNode(id: number) {
  return {
    id,
    type: 'TestImageSource',
    pos: [0, 0],
    size: [200, 100],
    outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }]
  }
}

/** The list node as the user's saved workflow holds it: the group's live slots. */
function listNode(id: number) {
  const live = new TestImageList()
  return {
    id,
    type: 'TestImageList',
    pos: [400, 0],
    size: [240, 200],
    inputs: live.inputs.map((input) => ({
      name: input.name,
      type: String(input.type),
      link: null
    }))
  }
}

function growConnect(name: string, fromNode: number, linkId: number): Op {
  return {
    op_id: `grow-${linkId}`.padEnd(32, '0'),
    actor: 'agent:test',
    base_version: 1,
    stamp: [linkId, 'agent:test'],
    op: 'connect',
    from_node: fromNode,
    from_slot: 0,
    to_node: LIST_NODE,
    to_slot: null,
    link_id: linkId,
    link_type: 'IMAGE',
    grow: { name, type: 'IMAGE' }
  } as unknown as Op
}

function setup(workflow: WorkflowJSON) {
  const graph = new LGraph()
  const { doc, collector } = followedDoc(workflow, CATALOG)
  const applier = new LiveGraphApplier({ getGraph: () => graph })
  const apply = (mode: 'merge' | 'replace' = 'merge') =>
    applier.applyChanges(doc, collector.take(), CONTEXT, mode)
  const applyOperations = (ops: Op[]) => {
    applyOps(doc, ops, CATALOG)
    return apply()
  }
  return { graph, apply, applyOperations }
}

beforeEach(() => {
  LiteGraph.registerNodeType('TestImageList', TestImageList)
  LiteGraph.registerNodeType('TestImageSource', TestImageSource)
})

describe('projecting a link onto a dynamic input slot the host grew', () => {
  it('grows the live group so the connection appears on the graph', () => {
    const { graph, apply, applyOperations } = setup({
      nodes: [sourceNode(SOURCE_NODE), listNode(LIST_NODE)],
      links: []
    })
    apply('replace')
    const list = graph.getNodeById(toNodeId(LIST_NODE))
    const grownName = `${AUTOGROW_GROUP}.image${list?.inputs.length ?? 0}`

    applyOperations([growConnect(grownName, SOURCE_NODE, LINK)])

    const grownSlot = list?.inputs.findIndex(
      (input) => input.name === grownName
    )
    expect(grownSlot).toBeGreaterThanOrEqual(0)
    expect(graph.links.get(toLinkId(LINK))).toMatchObject({
      origin_id: toNodeId(SOURCE_NODE),
      target_id: toNodeId(LIST_NODE),
      target_slot: grownSlot
    })
  })

  it('leaves the group alone for an input name it does not own, and still projects the rest of the frame', () => {
    const { graph, apply, applyOperations } = setup({
      nodes: [sourceNode(SOURCE_NODE), sourceNode(137), listNode(LIST_NODE)],
      links: []
    })
    apply('replace')
    const list = graph.getNodeById(toNodeId(LIST_NODE))
    const slotsBefore = list?.inputs.length ?? 0

    applyOperations([
      growConnect('not_a_group.image9', SOURCE_NODE, LINK),
      growConnect(`${AUTOGROW_GROUP}.image${slotsBefore}`, 137, LINK + 1)
    ])

    expect(graph.links.has(toLinkId(LINK))).toBe(false)
    expect(
      list?.inputs.some((input) => input.name === 'not_a_group.image9')
    ).toBe(false)
    expect(graph.links.get(toLinkId(LINK + 1))).toMatchObject({
      origin_id: toNodeId(137),
      target_id: toNodeId(LIST_NODE)
    })
  })
})
