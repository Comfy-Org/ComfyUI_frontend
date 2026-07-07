import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { WidgetId } from '@/types/widgetId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import {
  inputForWidget,
  promotedInputSource,
  promotedInputWidget,
  promotedInputWidgets,
  widgetPromotedSource
} from './promotedInputWidget'
import { resolveSubgraphInputTarget } from './resolveSubgraphInputTarget'

const mocks = vi.hoisted(() => ({
  widgets: new Map<string, Record<string, unknown>>(),
  setValue: vi.fn(),
  resolveSubgraphInputTarget: vi.fn()
}))

vi.mock('@/stores/widgetValueStore', () => ({
  useWidgetValueStore: () => ({
    getWidget: (id: string) => mocks.widgets.get(id),
    setValue: mocks.setValue
  })
}))

vi.mock('./resolveSubgraphInputTarget', () => ({
  resolveSubgraphInputTarget: mocks.resolveSubgraphInputTarget
}))

function input(overrides: Partial<INodeInputSlot> = {}): INodeInputSlot {
  return {
    name: 'prompt',
    type: 'STRING',
    label: 'Prompt',
    ...overrides
  } as INodeInputSlot
}

function node(overrides: Record<string, unknown> = {}): LGraphNode {
  return createMockLGraphNode({
    inputs: [],
    isSubgraphNode: () => true,
    getSlotFromWidget: vi.fn(),
    ...overrides
  })
}

describe('promotedInputWidget helpers', () => {
  beforeEach(() => {
    mocks.widgets.clear()
    mocks.setValue.mockClear()
    mocks.resolveSubgraphInputTarget.mockReset()
  })

  it('resolves promoted input sources only for widget-backed inputs', () => {
    const graphNode = node()
    mocks.resolveSubgraphInputTarget.mockReturnValue({
      nodeId: '12',
      widgetName: 'prompt'
    })

    expect(promotedInputSource(graphNode, input())).toBeUndefined()
    expect(
      promotedInputSource(
        graphNode,
        input({ widgetId: 'graph:12:prompt' as WidgetId })
      )
    ).toEqual({
      nodeId: '12',
      widgetName: 'prompt'
    })
    expect(resolveSubgraphInputTarget).toHaveBeenCalledWith(graphNode, 'prompt')
  })

  it('resolves promoted widget sources only on subgraph nodes with matching inputs', () => {
    const widget = { name: 'prompt' } as IBaseWidget
    const backingInput = input({ widgetId: 'graph:12:prompt' as WidgetId })
    mocks.resolveSubgraphInputTarget.mockReturnValue({
      nodeId: '12',
      widgetName: 'prompt'
    })

    expect(
      widgetPromotedSource(node({ isSubgraphNode: () => false }), widget)
    ).toBeUndefined()
    expect(
      widgetPromotedSource(node({ getSlotFromWidget: () => undefined }), widget)
    ).toBeUndefined()
    expect(
      widgetPromotedSource(
        node({ getSlotFromWidget: () => backingInput }),
        widget
      )
    ).toEqual({
      nodeId: '12',
      widgetName: 'prompt'
    })
  })

  it('projects store-backed widget fields with input fallbacks', () => {
    const widgetId = 'graph:12:prompt' as WidgetId
    const widget = promotedInputWidget(input({ widgetId }))

    expect(widget?.name).toBe('prompt')
    expect(widget?.label).toBe('Prompt')
    expect(widget?.y).toBe(0)
    expect(widget?.type).toBe('text')
    expect(widget?.options).toEqual({})
    expect(widget?.value).toBeUndefined()

    widget!.label = 'Ignored'
    widget!.y = 12
    widget!.value = 'next'
    widget!.callback?.('callback')

    expect(mocks.setValue).toHaveBeenCalledWith(widgetId, 'next')
    expect(mocks.setValue).toHaveBeenCalledWith(widgetId, 'callback')
  })

  it('projects live widget store fields and mutates store state', () => {
    const widgetId = 'graph:12:prompt' as WidgetId
    const state = {
      name: 'store-name',
      label: 'Store Label',
      y: 42,
      type: 'combo',
      options: { values: ['a'] },
      value: 'a'
    }
    mocks.widgets.set(widgetId, state)

    const widget = promotedInputWidget(input({ widgetId, label: undefined }))

    expect(widget?.name).toBe('store-name')
    expect(widget?.label).toBe('Store Label')
    expect(widget?.y).toBe(42)
    expect(widget?.type).toBe('combo')
    expect(widget?.options).toEqual({ values: ['a'] })
    expect(widget?.value).toBe('a')

    widget!.label = 'New Label'
    widget!.y = 52

    expect(state.label).toBe('New Label')
    expect(state.y).toBe(52)
  })

  it('returns null for non-promoted inputs and filters projected widget lists', () => {
    const widgetId = 'graph:12:prompt' as WidgetId
    const graphNode = node({
      inputs: [input(), input({ widgetId })]
    })

    expect(promotedInputWidget(input())).toBeNull()
    expect(promotedInputWidgets(graphNode)).toHaveLength(1)
  })

  it('returns undefined for null stored values', () => {
    const widgetId = 'graph:12:prompt' as WidgetId
    mocks.widgets.set(widgetId, { value: null })

    expect(promotedInputWidget(input({ widgetId }))?.value).toBeUndefined()
  })

  it('delegates input lookup to the graph node', () => {
    const widget = { name: 'prompt' } as IBaseWidget
    const backingInput = input({ widgetId: 'graph:12:prompt' as WidgetId })
    const graphNode = node({
      getSlotFromWidget: vi.fn(() => backingInput)
    })

    expect(inputForWidget(graphNode, widget)).toBe(backingInput)
    expect(graphNode.getSlotFromWidget).toHaveBeenCalledWith(widget)
  })
})
