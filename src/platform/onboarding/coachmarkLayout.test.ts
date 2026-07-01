import { describe, expect, it } from 'vitest'

import {
  blockerClipPath,
  clampSpotlight,
  noTargetCardLeft
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

describe('noTargetCardLeft', () => {
  it('centers the card on a wide viewport', () => {
    expect(noTargetCardLeft(1000)).toBe(350)
  })

  it('clamps to the viewport margin when the viewport is narrower than the card', () => {
    expect(noTargetCardLeft(200)).toBe(12)
  })
})
