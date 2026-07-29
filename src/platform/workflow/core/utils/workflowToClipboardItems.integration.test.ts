import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type {
  ISerialisedNode,
  SerialisableGraph
} from '@/lib/litegraph/src/types/serialisation'
import { toRerouteId } from '@/types/rerouteId'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'
import { createUuidv4 } from '@/utils/uuid'

import { workflowToClipboardItems } from './workflowToClipboardItems'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))

vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

describe('workflow clipboard insertion', () => {
  it('pastes reroutes at their source-relative position', () => {
    const nodeType = 'test/workflow-clipboard'

    class WorkflowClipboardNode extends LGraphNode {
      constructor() {
        super('Workflow Clipboard')
        this.addInput('input', '*')
        this.addOutput('output', '*')
      }
    }

    LiteGraph.registerNodeType(nodeType, WorkflowClipboardNode)
    onTestFinished(() => LiteGraph.unregisterNodeType(nodeType))

    const graph = new LGraph()
    const canvas = createCanvas(graph)
    const result = canvas._deserializeItems(
      workflowToClipboardItems(workflow(nodeType)),
      { position: [100, 100] }
    )

    expect(result?.reroutes.get(toRerouteId(1))?.pos).toEqual([200, 140])
  })
})

function workflow(nodeType: string): SerialisableGraph {
  return {
    id: createUuidv4(),
    revision: 0,
    version: 1,
    state: {
      lastGroupId: 0,
      lastNodeId: 2,
      lastLinkId: 1,
      lastRerouteId: 1
    },
    nodes: [
      serialisedNode(1, nodeType, [10, 10]),
      serialisedNode(2, nodeType, [210, 10])
    ],
    links: [
      {
        id: 1,
        origin_id: 1,
        origin_slot: 0,
        target_id: 2,
        target_slot: 0,
        type: '*',
        parentId: 1
      }
    ],
    reroutes: [{ id: 1, pos: [110, 50], linkIds: [1] }]
  }
}

function serialisedNode(
  id: number,
  type: string,
  pos: [number, number]
): ISerialisedNode {
  return {
    id,
    type,
    pos,
    size: [140, 80],
    flags: {},
    order: id,
    mode: 0,
    inputs: [{ name: 'input', type: '*', link: id === 2 ? 1 : null }],
    outputs: [{ name: 'output', type: '*', links: id === 1 ? [1] : [] }],
    properties: {}
  }
}

function createCanvas(graph: LGraph): LGraphCanvas {
  const element = document.createElement('canvas')
  element.width = 800
  element.height = 600
  element.getContext = vi
    .fn()
    .mockReturnValue(createMockCanvasRenderingContext2D())
  element.getBoundingClientRect = vi
    .fn()
    .mockReturnValue({ left: 0, top: 0, width: 800, height: 600 })
  return new LGraphCanvas(element, graph, { skip_render: true })
}
