import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type {
  IBaseWidget,
  TWidgetValue
} from '@/lib/litegraph/src/types/widgets'
import { GradientSliderWidget } from '@/lib/litegraph/src/widgets/GradientSliderWidget'
import { KnobWidget } from '@/lib/litegraph/src/widgets/KnobWidget'
import { SliderWidget } from '@/lib/litegraph/src/widgets/SliderWidget'
import {
  createMockCanvas,
  createMockCanvasPointerEvent,
  createMockCanvasRenderingContext2D
} from '@/utils/__tests__/litegraphTestUtils'

function createKnob(node: LGraphNode) {
  return new KnobWidget(
    {
      type: 'knob',
      name: 'test',
      value: 1,
      options: { min: 0, max: 10, step2: 1 },
      y: 0
    },
    node
  )
}

function restoreWidgetValue(
  node: LGraphNode,
  widget: IBaseWidget,
  value: TWidgetValue
) {
  node.addCustomWidget(widget)
  node.configure({
    id: 1,
    type: 'TestNode',
    pos: [0, 0],
    size: [200, 100],
    flags: {},
    order: 0,
    mode: 0,
    widgets_values: [value]
  } satisfies ISerialisedNode)
}

const cases = [
  {
    name: 'slider',
    create: (node: LGraphNode) =>
      new SliderWidget(
        {
          type: 'slider',
          name: 'test',
          value: 1,
          options: { min: 0, max: 10, step2: 1 },
          y: 0
        },
        node
      )
  },
  {
    name: 'gradient slider',
    create: (node: LGraphNode) =>
      new GradientSliderWidget(
        {
          type: 'gradientslider',
          name: 'test',
          value: 1,
          options: { min: 0, max: 10, step2: 1 },
          y: 0
        },
        node
      )
  },
  {
    name: 'knob',
    create: createKnob
  }
]

const valueCases: [TWidgetValue, string][] = [
  [Object.create(null), 'NaN'],
  [null, '0.000']
]

describe('numeric widget rendering', () => {
  it.for(cases)('$name tolerates malformed values', ({ create }) => {
    for (const [value, expected] of valueCases) {
      const node = new LGraphNode('TestNode')
      const widget = create(node)
      restoreWidgetValue(node, widget, value)

      const gradient = { addColorStop: vi.fn() }
      const ctx = createMockCanvasRenderingContext2D({
        createRadialGradient: vi.fn(() => gradient),
        createConicGradient: vi.fn(() => gradient)
      })

      expect(() => widget.drawWidget(ctx, { width: 200 })).not.toThrow()
      expect(ctx.fillText).toHaveBeenCalledWith(
        expect.stringContaining(expected),
        expect.any(Number),
        expect.any(Number)
      )
    }
  })

  it('recovers from a malformed knob value when dragged', () => {
    const node = new LGraphNode('TestNode')
    const widget = createKnob(node)
    restoreWidgetValue(node, widget, Object.create(null))

    expect(() =>
      widget.onDrag({
        e: createMockCanvasPointerEvent(0, 0, {
          movementX: 16,
          movementY: 0,
          shiftKey: false
        }),
        node,
        canvas: createMockCanvas()
      })
    ).not.toThrow()
    expect(widget.value).toBe(1)
  })
})
