import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import { useVideoTrimWidget } from './useVideoTrimWidget'

type MockWidget = {
  type: string
  name: string
  value: string | number | boolean | object
  callback?: (value: unknown) => void
  options: Record<string, unknown>
  y: number
  linkedWidgets?: MockWidget[]
}

function createMockNode() {
  const widgets: MockWidget[] = []

  const node = {
    widgets,
    addWidget(
      type: string,
      name: string,
      value: string | number | boolean | object,
      callback: (value: unknown) => void,
      options: Record<string, unknown> = {}
    ) {
      const widget: MockWidget = {
        type,
        name,
        value,
        callback,
        options,
        y: 0
      }
      widgets.push(widget)
      return widget as unknown as IBaseWidget
    }
  } as unknown as LGraphNode

  return { node, widgets }
}

describe('useVideoTrimWidget', () => {
  it('creates parent and hidden linked trim widgets', () => {
    const { node, widgets } = createMockNode()

    const parent = useVideoTrimWidget(node)

    expect(widgets).toHaveLength(4)
    expect(parent.name).toBe('trim')
    expect(parent.type).toBe('videotrim')
    expect(parent.linkedWidgets).toHaveLength(3)
    expect(
      widgets.find((widget) => widget.name === 'trim_enabled')?.options
    ).toMatchObject({
      canvasOnly: true,
      serialize: true
    })
  })

  it('syncs sub-widgets when parent value changes', () => {
    const { node, widgets } = createMockNode()
    const parent = useVideoTrimWidget(node)

    parent.value = {
      trimEnabled: true,
      startFrame: 12,
      endFrame: 99
    }
    parent.callback?.(parent.value)

    expect(
      widgets.find((widget) => widget.name === 'trim_enabled')?.value
    ).toBe(true)
    expect(widgets.find((widget) => widget.name === 'start_frame')?.value).toBe(
      12
    )
    expect(widgets.find((widget) => widget.name === 'end_frame')?.value).toBe(
      99
    )
  })

  it('updates parent when a linked sub-widget changes', () => {
    const { node, widgets } = createMockNode()
    const parent = useVideoTrimWidget(node)
    const parentCallback = vi.fn()
    parent.callback = parentCallback

    const startFrameWidget = widgets.find(
      (widget) => widget.name === 'start_frame'
    )
    startFrameWidget?.callback?.(45)

    expect(parent.value.startFrame).toBe(45)
    expect(parentCallback).toHaveBeenCalled()
  })
})
