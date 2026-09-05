import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { SliderWidget } from './SliderWidget'

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

describe('SliderWidget', () => {
  it('draws a non-numeric restored value without throwing', () => {
    const widget = new SliderWidget(
      {
        type: 'slider',
        name: 'denoise',
        value: fromAny('0.5'),
        options: { min: 0, max: 1, step2: 0.01 },
        y: 0
      },
      new LGraphNode('TestNode')
    )
    const ctx = fakeCtx()
    expect(() => widget.drawWidget(ctx, { width: 200 })).not.toThrow()
    expect(ctx.fillText).toHaveBeenCalledWith(
      'denoise  0.500',
      expect.any(Number),
      expect.any(Number)
    )
  })
})
