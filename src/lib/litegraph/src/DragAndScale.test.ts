import { describe, expect, it, vi } from 'vitest'

import { DragAndScale } from './DragAndScale'

function createDragAndScale(width: number, height: number): DragAndScale {
  const dpr = window.devicePixelRatio
  const element = {
    width: width * dpr,
    height: height * dpr
  } as HTMLCanvasElement
  return new DragAndScale(element)
}

describe('DragAndScale.fitToBounds', () => {
  it('centers bounds in viewport without insets', () => {
    const ds = createDragAndScale(1920, 1080)
    const bounds: [number, number, number, number] = [0, 0, 400, 300]

    ds.fitToBounds(bounds)

    // Content should be centered in full viewport
    const scaledW = 1920 / ds.scale
    const scaledH = 1080 / ds.scale
    expect(ds.offset[0]).toBeCloseTo(-bounds[2] * 0.5 + scaledW * 0.5)
    expect(ds.offset[1]).toBeCloseTo(-bounds[3] * 0.5 + scaledH * 0.5)
  })

  it('centers bounds within the unobscured region for a left inset', () => {
    const ds = createDragAndScale(1920, 1080)
    const bounds: [number, number, number, number] = [0, 0, 400, 300]
    const left = 300

    ds.fitToBounds(bounds, { insets: { left } })

    // The bounds center should map to the center of the visible region,
    // i.e. left + (fullCw - left) / 2 in canvas pixels.
    const boundsCenterX = bounds[0] + bounds[2] * 0.5
    const visibleCenterX = left + (1920 - left) / 2
    expect((boundsCenterX + ds.offset[0]) * ds.scale).toBeCloseTo(
      visibleCenterX
    )
  })

  it('centers bounds within the unobscured region for a right inset', () => {
    const ds = createDragAndScale(1920, 1080)
    const bounds: [number, number, number, number] = [0, 0, 400, 300]
    const right = 300

    ds.fitToBounds(bounds, { insets: { right } })

    const boundsCenterX = bounds[0] + bounds[2] * 0.5
    const visibleCenterX = (1920 - right) / 2
    expect((boundsCenterX + ds.offset[0]) * ds.scale).toBeCloseTo(
      visibleCenterX
    )
  })

  it('centers bounds within the unobscured region for a top inset', () => {
    const ds = createDragAndScale(1920, 1080)
    const bounds: [number, number, number, number] = [0, 0, 400, 300]
    const top = 200

    ds.fitToBounds(bounds, { insets: { top } })

    const boundsCenterY = bounds[1] + bounds[3] * 0.5
    const visibleCenterY = top + (1080 - top) / 2
    expect((boundsCenterY + ds.offset[1]) * ds.scale).toBeCloseTo(
      visibleCenterY
    )
  })

  it('uses reduced viewport for scale calculation with insets', () => {
    const ds = createDragAndScale(1920, 1080)
    const bounds: [number, number, number, number] = [0, 0, 800, 600]

    const dsNoInset = createDragAndScale(1920, 1080)
    dsNoInset.fitToBounds(bounds)

    ds.fitToBounds(bounds, { insets: { left: 300, right: 300 } })

    // Insets reduce available width, so scale should be smaller
    expect(ds.scale).toBeLessThan(dsNoInset.scale)
  })

  it('does nothing different when insets are all zero', () => {
    const ds = createDragAndScale(1920, 1080)
    const bounds: [number, number, number, number] = [0, 0, 400, 300]

    const dsNoInset = createDragAndScale(1920, 1080)
    dsNoInset.fitToBounds(bounds)

    ds.fitToBounds(bounds, { insets: { left: 0, right: 0, top: 0, bottom: 0 } })

    expect(ds.scale).toBeCloseTo(dsNoInset.scale)
    expect(ds.offset[0]).toBeCloseTo(dsNoInset.offset[0])
    expect(ds.offset[1]).toBeCloseTo(dsNoInset.offset[1])
  })
})

describe('DragAndScale.animateToBounds', () => {
  it('accepts insets in animation options', () => {
    const ds = createDragAndScale(1920, 1080)
    const bounds: [number, number, number, number] = [0, 0, 400, 300]

    // Should not throw when insets are provided
    expect(() =>
      ds.animateToBounds(bounds, () => {}, {
        duration: 1,
        insets: { left: 300, right: 200 }
      })
    ).not.toThrow()
  })

  it('ends at the same state as fitToBounds with the same insets', () => {
    vi.useFakeTimers()
    try {
      const bounds: [number, number, number, number] = [50, 50, 500, 400]
      const insets = { left: 150, right: 250, top: 100 }

      const dsFit = createDragAndScale(1200, 900)
      dsFit.fitToBounds(bounds, { insets })

      const dsAnimate = createDragAndScale(1200, 900)
      dsAnimate.animateToBounds(bounds, () => {}, { duration: 350, insets })
      vi.advanceTimersByTime(400)

      expect(dsAnimate.scale).toBeCloseTo(dsFit.scale, 4)
      expect(dsAnimate.offset[0]).toBeCloseTo(dsFit.offset[0], 4)
      expect(dsAnimate.offset[1]).toBeCloseTo(dsFit.offset[1], 4)
    } finally {
      vi.useRealTimers()
    }
  })
})
