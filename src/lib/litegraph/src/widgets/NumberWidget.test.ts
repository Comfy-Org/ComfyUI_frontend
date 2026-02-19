import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'
import type { INumericWidget } from '@/lib/litegraph/src/types/widgets'

import { NumberWidget } from './NumberWidget'

function createMockCanvas() {
  return { prompt: vi.fn() } as unknown as LGraphCanvas
}

function createMockEvent(canvasX: number): CanvasPointerEvent {
  return { canvasX } as unknown as CanvasPointerEvent
}

function createNumberWidget(
  node: LGraphNode,
  overrides: Partial<INumericWidget> = {}
): NumberWidget {
  return new NumberWidget(
    {
      type: 'number',
      name: 'test',
      value: 50,
      options: { min: 0, max: 100 },
      y: 0,
      ...overrides
    },
    node
  )
}

describe('NumberWidget.onClick', () => {
  let node: LGraphNode

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    node = new LGraphNode('TestNode')
    node.id = 1
    node.size = [200, 100]
  })

  it('passes number input options to canvas.prompt for center click', () => {
    const canvas = createMockCanvas()
    const e = createMockEvent(100)
    const widget = createNumberWidget(node)

    widget.onClick({ e, node, canvas })

    expect(canvas.prompt).toHaveBeenCalledWith(
      'Value',
      50,
      expect.any(Function),
      e,
      { inputType: 'number', min: 0, max: 100, step: 1 }
    )
  })

  it('uses widget step2 option for step value', () => {
    const canvas = createMockCanvas()
    const e = createMockEvent(100)
    const widget = createNumberWidget(node, {
      options: { min: 0, max: 1, step2: 0.05 }
    })

    widget.onClick({ e, node, canvas })

    expect(canvas.prompt).toHaveBeenCalledWith(
      'Value',
      50,
      expect.any(Function),
      e,
      { inputType: 'number', min: 0, max: 1, step: 0.05 }
    )
  })

  it('does not call prompt when clicking left arrow area', () => {
    const canvas = createMockCanvas()
    const e = createMockEvent(20)
    const widget = createNumberWidget(node)

    widget.onClick({ e, node, canvas })

    expect(canvas.prompt).not.toHaveBeenCalled()
  })

  it('does not call prompt when clicking right arrow area', () => {
    const canvas = createMockCanvas()
    const e = createMockEvent(180)
    const widget = createNumberWidget(node)

    widget.onClick({ e, node, canvas })

    expect(canvas.prompt).not.toHaveBeenCalled()
  })

  it('passes undefined min/max when options have no bounds', () => {
    const canvas = createMockCanvas()
    const e = createMockEvent(100)
    const widget = createNumberWidget(node, { options: {} })

    widget.onClick({ e, node, canvas })

    expect(canvas.prompt).toHaveBeenCalledWith(
      'Value',
      50,
      expect.any(Function),
      e,
      { inputType: 'number', min: undefined, max: undefined, step: 1 }
    )
  })
})
