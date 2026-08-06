import { describe, expect, it } from 'vitest'

import {
  cloneFillSpec,
  defaultFillSpec,
  defaultGradientStops,
  fillSpecStamp,
  linearEndpoints,
  normalizeFillSpec,
  paintFillInto,
  renderFillBitmap
} from './fill'

function gradientCtx() {
  const calls: string[] = []
  const gradient = {
    addColorStop: (offset: number, color: string) =>
      calls.push(`stop:${offset}:${color}`)
  } as unknown as CanvasGradient
  const ctx = {
    fillStyle: '' as string | CanvasGradient,
    fillRect: (...args: number[]) => calls.push(`fillRect:${args.join(',')}`),
    createLinearGradient: (...args: number[]) => {
      calls.push(`linear:${args.map((v) => Math.round(v)).join(',')}`)
      return gradient
    },
    createRadialGradient: (...args: number[]) => {
      calls.push(`radial:${args.map((v) => Math.round(v)).join(',')}`)
      return gradient
    }
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, gradient }
}

describe('normalizeFillSpec', () => {
  it('falls back to solid gray for junk', () => {
    expect(normalizeFillSpec(null)).toEqual({ type: 'solid', color: '#808080' })
    expect(normalizeFillSpec({ type: 'weird' })).toEqual({
      type: 'solid',
      color: '#808080'
    })
  })

  it('keeps solid color', () => {
    expect(normalizeFillSpec({ type: 'solid', color: '#123456' })).toEqual({
      type: 'solid',
      color: '#123456'
    })
  })

  it('sorts and clamps gradient stops, requiring at least two', () => {
    const spec = normalizeFillSpec({
      type: 'linear',
      angle: 45,
      stops: [
        { offset: 2, color: '#ffffff' },
        { offset: -1, color: '#000000' }
      ]
    })
    expect(spec).toEqual({
      type: 'linear',
      angle: 45,
      stops: [
        { offset: 0, color: '#000000', alpha: undefined },
        { offset: 1, color: '#ffffff', alpha: undefined }
      ]
    })
    const bad = normalizeFillSpec({
      type: 'linear',
      angle: 0,
      stops: [{ offset: 0, color: '#fff' }]
    })
    expect(bad.type === 'linear' && bad.stops).toEqual(defaultGradientStops())
  })

  it('clamps radial center and radius', () => {
    const spec = normalizeFillSpec({
      type: 'radial',
      cx: 2,
      cy: -1,
      radius: 99,
      stops: defaultGradientStops()
    })
    expect(spec).toMatchObject({ type: 'radial', cx: 1, cy: 0, radius: 4 })
  })
})

describe('linearEndpoints', () => {
  it('angle 0 spans left → right through the center', () => {
    const { from, to } = linearEndpoints(0, 100, 50)
    expect(from).toEqual({ x: 0, y: 25 })
    expect(to).toEqual({ x: 100, y: 25 })
  })

  it('angle 90 spans top → bottom', () => {
    const { from, to } = linearEndpoints(90, 100, 50)
    expect(from.x).toBeCloseTo(50, 5)
    expect(from.y).toBeCloseTo(0, 5)
    expect(to.y).toBeCloseTo(50, 5)
  })

  it('diagonal covers the projected extent of the rect', () => {
    const { from, to } = linearEndpoints(45, 100, 100)
    const len = Math.hypot(to.x - from.x, to.y - from.y)
    expect(len).toBeCloseTo(Math.SQRT2 * 100, 5)
  })
})

describe('cloneFillSpec / stamp', () => {
  it('clone is deep for stops', () => {
    const spec = normalizeFillSpec({
      type: 'linear',
      angle: 0,
      stops: defaultGradientStops()
    })
    const copy = cloneFillSpec(spec)
    if (copy.type === 'linear') copy.stops[0].color = '#ff0000'
    expect(spec.type === 'linear' && spec.stops[0].color).toBe('#000000')
  })

  it('stamp changes with params', () => {
    const a = fillSpecStamp({ type: 'solid', color: '#000000' })
    const b = fillSpecStamp({ type: 'solid', color: '#000001' })
    expect(a).not.toBe(b)
  })
})

describe('paintFillInto', () => {
  it('solid fill sets the colour and covers the full rect', () => {
    const { ctx, calls } = gradientCtx()
    paintFillInto(ctx, { type: 'solid', color: '#123456' }, 10, 20)
    expect(ctx.fillStyle).toBe('#123456')
    expect(calls).toEqual(['fillRect:0,0,10,20'])
  })

  it('linear fill spans the angle-0 endpoints and adds every stop', () => {
    const { ctx, calls, gradient } = gradientCtx()
    paintFillInto(
      ctx,
      { type: 'linear', angle: 0, stops: defaultGradientStops() },
      100,
      50
    )
    expect(calls).toEqual([
      'linear:0,25,100,25',
      'stop:0:#000000',
      'stop:1:#ffffff',
      'fillRect:0,0,100,50'
    ])
    expect(ctx.fillStyle).toBe(gradient)
  })

  it('radial fill scales the centre and radius to the rect diagonal', () => {
    const { ctx, calls } = gradientCtx()
    paintFillInto(
      ctx,
      {
        type: 'radial',
        cx: 0.5,
        cy: 0.5,
        radius: 1,
        stops: defaultGradientStops()
      },
      60,
      80
    )
    expect(calls[0]).toBe('radial:30,40,0,30,40,50')
  })

  it('stops with alpha become rgba(), expanding 3-digit hex', () => {
    const { ctx, calls } = gradientCtx()
    paintFillInto(
      ctx,
      {
        type: 'linear',
        angle: 0,
        stops: [
          { offset: 0, color: '#fff', alpha: 0.5 },
          { offset: 1, color: '#000000', alpha: 1 }
        ]
      },
      10,
      10
    )
    expect(calls).toContain('stop:0:rgba(255,255,255,0.5)')
    expect(calls).toContain('stop:1:#000000')
  })
})

describe('renderFillBitmap', () => {
  it('clamps dimensions to at least 1 and paints through a 2d context', () => {
    const { ctx } = gradientCtx()
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (kind: string) {
      return kind === '2d' ? ctx : null
    } as typeof HTMLCanvasElement.prototype.getContext
    try {
      const canvas = renderFillBitmap(defaultFillSpec(), 0, 0)
      expect(canvas?.width).toBe(1)
      expect(canvas?.height).toBe(1)
    } finally {
      HTMLCanvasElement.prototype.getContext = orig
    }
  })

  it('returns null when no 2d context is available', () => {
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function () {
      return null
    } as typeof HTMLCanvasElement.prototype.getContext
    try {
      expect(renderFillBitmap(defaultFillSpec(), 10, 10)).toBeNull()
    } finally {
      HTMLCanvasElement.prototype.getContext = orig
    }
  })
})
