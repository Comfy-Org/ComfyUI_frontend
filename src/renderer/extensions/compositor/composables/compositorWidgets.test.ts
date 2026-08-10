import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import {
  getCompositorWidgetValue,
  resetCompositorStateWidgets,
  setCompositorWidgetValue
} from './compositorWidgets'

function makeNode() {
  const compositorWidget = {
    name: 'compositor',
    value: { layers: [] },
    callback: vi.fn()
  } as unknown as IBaseWidget
  const otherWidget = {
    name: 'other',
    value: 42,
    callback: vi.fn()
  } as unknown as IBaseWidget
  const node = {
    widgets: [otherWidget, compositorWidget],
    widgets_values: [42, { layers: [] }]
  } as unknown as LGraphNode
  return { node, compositorWidget, otherWidget }
}

describe('setCompositorWidgetValue', () => {
  it('writes the widget value, fires its callback, and syncs widgets_values', () => {
    const { node, compositorWidget } = makeNode()
    const next = { canvas: { w: 8, h: 8 }, layers: [] }

    setCompositorWidgetValue(node, next)

    expect(compositorWidget.value).toEqual(next)
    expect(compositorWidget.callback).toHaveBeenCalledWith(next)
    expect(node.widgets_values?.[1]).toEqual(next)
  })

  it('is a no-op when the compositor widget is missing', () => {
    const { node, otherWidget } = makeNode()
    node.widgets = [otherWidget]
    node.widgets_values = [42]

    setCompositorWidgetValue(node, { layers: [] })

    expect(otherWidget.value).toBe(42)
    expect(node.widgets_values).toEqual([42])
  })
})

describe('getCompositorWidgetValue', () => {
  it('returns the widget value when it has the expected shape', () => {
    const { node } = makeNode()

    expect(getCompositorWidgetValue(node)).toEqual({ layers: [] })
  })

  it('returns null for missing widgets or malformed values', () => {
    const { node, compositorWidget } = makeNode()
    compositorWidget.value = 'legacy-string'
    expect(getCompositorWidgetValue(node)).toBeNull()

    node.widgets = []
    expect(getCompositorWidgetValue(node)).toBeNull()
  })
})

describe('resetCompositorStateWidgets', () => {
  it('resets the compositor widget to the empty value durably', () => {
    const { node, compositorWidget } = makeNode()

    resetCompositorStateWidgets(node)

    expect(compositorWidget.value).toEqual({})
    expect(compositorWidget.callback).toHaveBeenCalledWith({})
    expect(node.widgets_values).toEqual([42, {}])
  })
})
