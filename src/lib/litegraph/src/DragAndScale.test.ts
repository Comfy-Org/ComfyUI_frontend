import { describe, expect, it } from 'vitest'

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

  it('shifts center rightward when left inset is applied', () => {
    const ds = createDragAndScale(1920, 1080)
    const bounds: [number, number, number, number] = [0, 0, 400, 300]

    const dsNoInset = createDragAndScale(1920, 1080)
    dsNoInset.fitToBounds(bounds)

    ds.fitToBounds(bounds, { insets: { left: 300 } })

    // With a left inset, the offset should be shifted left (more negative)
    // to push content away from the left panel
    expect(ds.offset[0]).toBeLessThan(dsNoInset.offset[0])
  })

  it('shifts center leftward when right inset is applied', () => {
    const ds = createDragAndScale(1920, 1080)
    const bounds: [number, number, number, number] = [0, 0, 400, 300]

    const dsNoInset = createDragAndScale(1920, 1080)
    dsNoInset.fitToBounds(bounds)

    ds.fitToBounds(bounds, { insets: { right: 300 } })

    // With right inset, the available width shrinks and the content is
    // centered in the remaining left portion — offset decreases
    expect(ds.offset[0]).toBeLessThan(dsNoInset.offset[0])
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
})
