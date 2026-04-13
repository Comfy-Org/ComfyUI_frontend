import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type {
  INodeInputSlot,
  INodeOutputSlot,
  LLink
} from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { createMockLLink } from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      graph_mouse: {}
    }
  }
}))

import { applyFirstWidgetValueToGraph } from './widgetValuePropagation'

type SourceNode = Pick<LGraphNode, 'graph' | 'outputs' | 'widgets'>

function createWidget(
  name: string,
  value: unknown,
  callback = vi.fn()
): IBaseWidget {
  return fromPartial<IBaseWidget>({
    name,
    value,
    callback
  })
}

function createTargetNode(
  widget: IBaseWidget,
  id = 7
): Pick<LGraphNode, 'id' | 'inputs' | 'widgets'> {
  return fromPartial<Pick<LGraphNode, 'id' | 'inputs' | 'widgets'>>({
    id,
    inputs: [
      fromPartial<INodeInputSlot>({
        widget: { name: widget.name }
      })
    ],
    widgets: [widget]
  })
}

function createLink(targetId: LLink['target_id'], targetSlot = 0): LLink {
  return createMockLLink({
    target_id: targetId,
    target_slot: targetSlot
  })
}

function createSourceNode(options: {
  link: LLink
  targetNode: Pick<LGraphNode, 'id' | 'inputs' | 'widgets'>
  widgets?: IBaseWidget[]
}): SourceNode {
  return {
    graph: {
      links: { 1: options.link },
      getNodeById: vi.fn((id: LLink['target_id']) =>
        id === options.targetNode.id ? options.targetNode : null
      )
    } as unknown as NonNullable<LGraphNode['graph']>,
    outputs: [{ links: [1] } as INodeOutputSlot],
    widgets: options.widgets ?? []
  }
}

describe('applyFirstWidgetValueToGraph', () => {
  it('returns early when the source widget is missing', () => {
    const targetCallback = vi.fn()
    const targetWidget = createWidget('value', 'unchanged', targetCallback)
    const targetNode = createTargetNode(targetWidget)
    const sourceNode = createSourceNode({
      link: createLink(targetNode.id),
      targetNode
    })

    expect(() => applyFirstWidgetValueToGraph(sourceNode)).not.toThrow()
    expect(targetWidget.value).toBe('unchanged')
    expect(targetCallback).not.toHaveBeenCalled()
  })

  it('propagates the first widget value to the linked widget', () => {
    const targetCallback = vi.fn()
    const targetWidget = createWidget('value', 'old', targetCallback)
    const targetNode = createTargetNode(targetWidget)
    const sourceNode = createSourceNode({
      link: createLink(targetNode.id),
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
      expect.anything(),
      expect.anything()
    )
  })

  it('applies a transform before propagating the widget value', () => {
    const targetWidget = createWidget('value', 'old')
    const targetNode = createTargetNode(targetWidget)
    const sourceNode = createSourceNode({
      link: createLink(targetNode.id),
      targetNode,
      widgets: [createWidget('source', 'draft')]
    })

    applyFirstWidgetValueToGraph(sourceNode, [], (value) => `${value}-saved`)

    expect(targetWidget.value).toBe('draft-saved')
  })
})
