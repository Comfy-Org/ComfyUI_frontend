import { describe, expect, it } from 'vitest'

import {
  blockerClipPath,
  cardCorner,
  clampCardPosition,
  clampSpotlight,
  noTargetCardLeft,
  resolvePlacement
} from './coachmarkLayout'

const VIEWPORT = { width: 1000, height: 800 }

describe('clampSpotlight', () => {
  it('grows the target rect by the pad on every side', () => {
    const r = new DOMRect(100, 100, 50, 40)
    expect(clampSpotlight(r, 8, VIEWPORT)).toEqual({
      left: '92px',
      top: '92px',
      width: '66px',
      height: '56px'
    })
  })

  it('clamps the near edges to the viewport inset', () => {
    const r = new DOMRect(0, 0, 10, 10)
    expect(clampSpotlight(r, 8, VIEWPORT)).toMatchObject({
      left: '2px',
      top: '2px'
    })
  })

  it('clamps the far edges to the viewport inset', () => {
    const r = new DOMRect(990, 100, 50, 40)
    const { left, width } = clampSpotlight(r, 8, VIEWPORT)
    expect(left).toBe('982px')
    expect(width).toBe('16px')
  })

  it('never produces a negative size for an off-screen target', () => {
    const r = new DOMRect(2000, 100, 50, 40)
    expect(clampSpotlight(r, 8, VIEWPORT)).toMatchObject({ width: '0px' })
  })
})

describe('blockerClipPath', () => {
  it('punches a hole at the target rect corners', () => {
    const clip = blockerClipPath(new DOMRect(10, 20, 30, 40))
    expect(clip).toContain('evenodd')
    // Inner loop traces the target rect (left/top → left/bottom → right/...).
    expect(clip).toContain('10px 20px')
    expect(clip).toContain('10px 60px')
    expect(clip).toContain('40px 60px')
    expect(clip).toContain('40px 20px')
  })
})

describe('resolvePlacement', () => {
  it('passes through an explicit placement', () => {
    const r = new DOMRect(100, 0, 50, 10)
    expect(resolvePlacement('bottom', r, 1000)).toBe('bottom')
    expect(resolvePlacement('leftCenter', r, 1000)).toBe('leftCenter')
  })

  it('auto picks the side of the target with more room', () => {
    expect(resolvePlacement('auto', new DOMRect(100, 0, 50, 10), 1000)).toBe(
      'right'
    )
    expect(resolvePlacement('auto', new DOMRect(900, 0, 50, 10), 1000)).toBe(
      'left'
    )
  })
})

describe('cardCorner', () => {
  const r = new DOMRect(400, 200, 50, 40)

  it('places left of the target, nudged below the top inset', () => {
    expect(cardCorner('left', r, 120)).toEqual({ x: 84, y: 208 })
  })

  it('clamps the left placement to the top-safe inset near the top', () => {
    expect(cardCorner('left', new DOMRect(400, 10, 50, 40), 120).y).toBe(56)
  })

  it('vertically centers leftCenter and center on the target', () => {
    expect(cardCorner('leftCenter', r, 120)).toEqual({ x: 84, y: 160 })
    expect(cardCorner('center', r, 120)).toEqual({ x: 275, y: 160 })
  })

  it('places right, bottom and topRight relative to the target edges', () => {
    expect(cardCorner('right', r, 120)).toEqual({ x: 466, y: 208 })
    expect(cardCorner('bottom', r, 120)).toEqual({ x: 275, y: 256 })
    expect(cardCorner('topRight', r, 120)).toEqual({ x: 134, y: 216 })
  })
})

describe('clampCardPosition', () => {
  it('keeps an in-bounds corner unchanged', () => {
    expect(clampCardPosition({ x: 84, y: 208 }, 120, VIEWPORT)).toEqual({
      left: '84px',
      top: '208px'
    })
  })

  it('clamps left within the viewport margin and the right edge', () => {
    expect(clampCardPosition({ x: -50, y: 208 }, 120, VIEWPORT).left).toBe(
      '12px'
    )
    expect(clampCardPosition({ x: 900, y: 208 }, 120, VIEWPORT).left).toBe(
      '684px'
    )
  })

  it('clamps top below the top bar and above the bottom edge', () => {
    expect(clampCardPosition({ x: 84, y: 10 }, 120, VIEWPORT).top).toBe('56px')
    expect(clampCardPosition({ x: 84, y: 900 }, 120, VIEWPORT).top).toBe(
      '664px'
    )
  })
})

describe('noTargetCardLeft', () => {
  it('centers the card on a wide viewport', () => {
    expect(noTargetCardLeft(1000)).toBe(350)
  })

  it('clamps to the viewport margin when the viewport is narrower than the card', () => {
    expect(noTargetCardLeft(200)).toBe(12)
  })
})
