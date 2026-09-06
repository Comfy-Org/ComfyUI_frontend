import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import { GradientSliderWidget } from '@/lib/litegraph/src/widgets/GradientSliderWidget'
import { KnobWidget } from '@/lib/litegraph/src/widgets/KnobWidget'
import { SliderWidget } from '@/lib/litegraph/src/widgets/SliderWidget'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

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
    create: (node: LGraphNode) =>
      new KnobWidget(
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
]

describe('numeric widget rendering', () => {
  it.for(cases)(
    '$name tolerates values that cannot be coerced',
    ({ create }) => {
      const node = new LGraphNode('TestNode')
      const widget = create(node)
      node.addCustomWidget(widget)
      node.configure({
        id: 1,
        type: 'TestNode',
        pos: [0, 0],
        size: [200, 100],
        flags: {},
        order: 0,
        mode: 0,
        widgets_values: [Object.create(null)]
      } satisfies ISerialisedNode)

      const gradient = { addColorStop: vi.fn() }
      const ctx = createMockCanvasRenderingContext2D({
        createRadialGradient: vi.fn(() => gradient),
        createConicGradient: vi.fn(() => gradient)
      })

      expect(() => widget.drawWidget(ctx, { width: 200 })).not.toThrow()
      expect(ctx.fillText).toHaveBeenCalledWith(
        expect.stringContaining('NaN'),
        expect.any(Number),
        expect.any(Number)
      )
    }
  )
})
