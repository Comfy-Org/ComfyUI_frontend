import { afterEach, describe, expect, it } from 'vitest'

import {
  CARD_GAP,
  clampSpotlight,
  noTargetCardLeft,
  topSafeInset
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

describe('topSafeInset', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--comfy-topbar-height')
  })

  it('converts a rem top bar height to px and adds the card gap', () => {
    document.documentElement.style.setProperty('--comfy-topbar-height', '3rem')
    expect(topSafeInset()).toBe(48 + CARD_GAP)
  })

  it('reads a px top bar height directly and adds the card gap', () => {
    document.documentElement.style.setProperty('--comfy-topbar-height', '50px')
    expect(topSafeInset()).toBe(50 + CARD_GAP)
  })

  it('falls back to the card gap alone when the token is unset', () => {
    expect(topSafeInset()).toBe(CARD_GAP)
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
