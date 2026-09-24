import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

import { ColorsWidget } from './ColorsWidget'

describe('ColorsWidget', () => {
  it('has the colors type and draws the Vue-only placeholder', () => {
    const node = new LGraphNode('Test')
    const widget = new ColorsWidget(
      { type: 'colors', name: 'palette', value: [], options: {}, y: 0 },
      node
    )
    expect(widget.type).toBe('colors')
    const ctx = createMockCanvasRenderingContext2D()
    widget.drawWidget(ctx, { width: 200 })
    expect(ctx.fillText).toHaveBeenCalled()
    expect(() => widget.onClick({} as never)).not.toThrow()
  })
})
