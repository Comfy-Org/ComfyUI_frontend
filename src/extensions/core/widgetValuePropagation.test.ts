import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { INodeInputSlot } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useLinkStore } from '@/stores/linkStore'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      graph_mouse: [0, 0]
    }
  }
}))

import { applyFirstWidgetValueToGraph } from './widgetValuePropagation'

type SourceNode = Pick<LGraphNode, 'id' | 'graph' | 'widgets'>
type TargetNode = Pick<LGraphNode, 'id' | 'inputs' | 'widgets'>

const GRAPH_ID: UUID = 'graph-test'
const SOURCE_NODE_ID = toNodeId(1)

function createWidget(
  name: string,
  value: IBaseWidget['value'],
  callback = vi.fn()
): IBaseWidget {
  return fromPartial<IBaseWidget>({
    name,
    value,
    callback
  })
}

function createTargetNode(widget: IBaseWidget, id = 7): TargetNode {
  return fromPartial<TargetNode>({
    id: toNodeId(id),
    inputs: [
      fromPartial<INodeInputSlot>({
        widget: { name: widget.name }
      })
    ],
    widgets: [widget]
  })
}

function createSourceNode(options: {
  targetNode: TargetNode
  widgets?: IBaseWidget[]
}): SourceNode {
  useLinkStore().registerLink(GRAPH_ID, {
    id: toLinkId(1),
    originNodeId: SOURCE_NODE_ID,
    originSlot: 0,
    targetNodeId: options.targetNode.id,
    targetSlot: 0,
    type: 'INT'
  })
  return {
    id: SOURCE_NODE_ID,
    graph: {
      rootGraph: { id: GRAPH_ID },
      getNodeById: vi.fn((id: TargetNode['id']) =>
        id === options.targetNode.id ? options.targetNode : null
      )
    } as unknown as NonNullable<LGraphNode['graph']>,
    widgets: options.widgets ?? []
  }
}

describe('applyFirstWidgetValueToGraph', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('returns early when the source widget is missing', () => {
    const targetCallback = vi.fn()
    const targetWidget = createWidget('value', 'unchanged', targetCallback)
    const targetNode = createTargetNode(targetWidget)
    const sourceNode = createSourceNode({ targetNode })

    expect(() => applyFirstWidgetValueToGraph(sourceNode)).not.toThrow()
    expect(targetWidget.value).toBe('unchanged')
    expect(targetCallback).not.toHaveBeenCalled()
  })

  it('propagates the first widget value to the linked widget', () => {
    const targetCallback = vi.fn()
    const targetWidget = createWidget('value', 'old', targetCallback)
    const targetNode = createTargetNode(targetWidget)
    const sourceNode = createSourceNode({
      targetNode,
      widgets: [createWidget('source', 'new value')]
    })

    applyFirstWidgetValueToGraph(sourceNode)

    expect(targetWidget.value).toBe('new value')
    expect(targetCallback).toHaveBeenCalledOnce()
    expect(targetCallback).toHaveBeenCalledWith(
      'new value',
      expect.anything(),
      targetNode,
      [0, 0],
      expect.anything()
    )
  })

  it('applies a transform before propagating the widget value', () => {
    const targetWidget = createWidget('value', 'old')
    const targetNode = createTargetNode(targetWidget)
    const sourceNode = createSourceNode({
      targetNode,
      widgets: [createWidget('source', 'draft')]
    })

    applyFirstWidgetValueToGraph(sourceNode, [], (value) => `${value}-saved`)

    expect(targetWidget.value).toBe('draft-saved')
  })
})
