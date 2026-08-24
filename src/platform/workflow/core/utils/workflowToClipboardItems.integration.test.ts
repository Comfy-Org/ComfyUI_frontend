import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import type { ISlotType } from '@/lib/litegraph/src/interfaces'
import {
  LGraph,
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type { LLink } from '@/lib/litegraph/src/LLink'
import type {
  ClipboardItems,
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

  it('does not resolve source link ids against the destination graph', () => {
    const nodeType = 'test/workflow-clipboard-existing-links'
    const resolvedLinks: (LLink | null | undefined)[] = []

    class WorkflowClipboardNode extends LGraphNode {
      constructor() {
        super('Workflow Clipboard')
        this.addInput('input', '*')
        this.addOutput('output', '*')
      }

      override onConnectionsChange(
        _type: ISlotType,
        _slot: number,
        _connected: boolean,
        link?: LLink | null
      ): void {
        resolvedLinks.push(link)
      }
    }

    LiteGraph.registerNodeType(nodeType, WorkflowClipboardNode)
    onTestFinished(() => LiteGraph.unregisterNodeType(nodeType))

    const graph = new LGraph()
    const origin = LiteGraph.createNode(nodeType)!
    const target = LiteGraph.createNode(nodeType)!
    graph.add(origin)
    graph.add(target)
    const existingLink = origin.connect(0, target, 0)!
    resolvedLinks.length = 0

    createCanvas(graph)._deserializeItems(
      workflowToClipboardItems(workflow(nodeType)),
      { position: [100, 100] }
    )

    expect(resolvedLinks).not.toContain(existingLink)
  })

  it('re-points input links when configure reorders serialized inputs', () => {
    const nodeType = 'test/workflow-clipboard-reordered-inputs'

    class ReorderingNode extends LGraphNode {
      constructor() {
        super('Reordering')
        this.addInput('model', '*')
        this.addInput('clip', '*')
        this.addOutput('output', '*')
      }

      /** Mirrors ComfyUI nodes reordering serialized inputs to definition order. */
      override configure(info: ISerialisedNode): void {
        const byName = new Map(info.inputs?.map((input) => [input.name, input]))
        info.inputs = this.inputs.map(({ name }) => byName.get(name)!)
        super.configure(info)
      }
    }

    LiteGraph.registerNodeType(nodeType, ReorderingNode)
    onTestFinished(() => LiteGraph.unregisterNodeType(nodeType))

    const graph = new LGraph()
    createCanvas(graph)._deserializeItems(reorderedInputsWorkflow(nodeType), {
      position: [100, 100]
    })

    const target = graph.nodes.find((node) => node.title === 'Target')!
    expect(target.inputs.map(({ name }) => name)).toEqual(['model', 'clip'])
    expect(target.inputs[0].link).toBeNull()
    expect(target.inputs[1].link).not.toBeNull()
  })
})

function reorderedInputsWorkflow(nodeType: string): ClipboardItems {
  return workflowToClipboardItems({
    id: createUuidv4(),
    revision: 0,
    version: 1,
    state: {
      lastGroupId: 0,
      lastNodeId: 2,
      lastLinkId: 1,
      lastRerouteId: 0
    },
    nodes: [
      {
        ...serialisedNode(1, nodeType, [10, 10]),
        title: 'Source',
        inputs: [
          { name: 'clip', type: '*', link: null },
          { name: 'model', type: '*', link: null }
        ]
      },
      {
        ...serialisedNode(2, nodeType, [210, 10]),
        title: 'Target',
        inputs: [
          { name: 'clip', type: '*', link: 1 },
          { name: 'model', type: '*', link: null }
        ]
      }
    ],
    links: [
      {
        id: 1,
        origin_id: 1,
        origin_slot: 0,
        target_id: 2,
        target_slot: 0,
        type: '*'
      }
    ]
  })
}

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
