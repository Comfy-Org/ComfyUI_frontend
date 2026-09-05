import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { KnobWidget } from './KnobWidget'

function fakeGradient() {
  return { addColorStop: vi.fn() } as unknown as CanvasGradient
}

function fakeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    createConicGradient: vi.fn(fakeGradient),
    createRadialGradient: vi.fn(fakeGradient),
    lineWidth: 1,
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: ''
  } as unknown as CanvasRenderingContext2D
}

describe('KnobWidget', () => {
  it('draws a non-numeric restored value without throwing', () => {
    const widget = new KnobWidget(
      {
        type: 'knob',
        name: 'cfg',
        value: fromAny('0.5'),
        options: { min: 0, max: 1, step2: 0.01 },
        y: 0
      },
      new LGraphNode('TestNode')
    )
    const ctx = fakeCtx()
    expect(() => widget.drawWidget(ctx, { width: 200 })).not.toThrow()
    expect(ctx.fillText).toHaveBeenCalledWith(
      'cfg\n0.500',
      expect.any(Number),
      expect.any(Number)
    )
  })
})
