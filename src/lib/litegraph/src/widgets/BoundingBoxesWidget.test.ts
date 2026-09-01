import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { DrawWidgetOptions } from '@/lib/litegraph/src/widgets/BaseWidget'

import { BoundingBoxesWidget } from './BoundingBoxesWidget'

function fakeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: ''
  } as unknown as CanvasRenderingContext2D
}

describe('BoundingBoxesWidget', () => {
  it('has the boundingboxes type and draws the Vue-only placeholder', () => {
    const node = new LGraphNode('Test')
    const widget = new BoundingBoxesWidget(
      {
        type: 'boundingboxes',
        name: 'editor_state',
        value: [],
        options: {},
        y: 0
      },
      node
    )
    expect(widget.type).toBe('boundingboxes')
    const ctx = fakeCtx()
    widget.drawWidget(ctx, { width: 200 } as DrawWidgetOptions)
    expect(ctx.fillText).toHaveBeenCalled()
    expect(() => widget.onClick({} as never)).not.toThrow()
  })
})
