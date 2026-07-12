import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { DrawWidgetOptions } from '@/lib/litegraph/src/widgets/BaseWidget'

import { ColorsWidget } from './ColorsWidget'

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

describe('ColorsWidget', () => {
  it('has the colors type and draws the Vue-only placeholder', () => {
    const node = new LGraphNode('Test')
    const widget = new ColorsWidget(
      { type: 'colors', name: 'palette', value: [], options: {}, y: 0 },
      node
    )
    expect(widget.type).toBe('colors')
    const ctx = fakeCtx()
    widget.drawWidget(ctx, { width: 200 } as DrawWidgetOptions)
    expect(ctx.fillText).toHaveBeenCalled()
    expect(() => widget.onClick({} as never)).not.toThrow()
  })
})
