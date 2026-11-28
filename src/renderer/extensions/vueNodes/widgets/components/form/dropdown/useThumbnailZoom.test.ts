import { describe, expect, it } from 'vitest'

import {
  THUMBNAIL_SIZE,
  wheelZoomFactor,
  zoomThumbnail
} from './useThumbnailZoom'

describe('wheelZoomFactor', () => {
  it('zooms in when scrolling up and out when scrolling down', () => {
    expect(wheelZoomFactor({ deltaY: -10, deltaMode: 0 })).toBeGreaterThan(1)
    expect(wheelZoomFactor({ deltaY: 10, deltaMode: 0 })).toBeLessThan(1)
  })

  it('undoes a zoom step with the opposite step', () => {
    const zoomIn = wheelZoomFactor({ deltaY: -30, deltaMode: 0 })
    const zoomOut = wheelZoomFactor({ deltaY: 30, deltaMode: 0 })
    expect(zoomIn * zoomOut).toBeCloseTo(1)
  })

  it('treats a line delta like sixteen pixels', () => {
    expect(wheelZoomFactor({ deltaY: 2, deltaMode: 1 })).toBeCloseTo(
      wheelZoomFactor({ deltaY: 32, deltaMode: 0 })
    )
  })

  it('limits a single mouse notch to the same step as a large pixel delta', () => {
    expect(wheelZoomFactor({ deltaY: 4, deltaMode: 1 })).toBe(
      wheelZoomFactor({ deltaY: 500, deltaMode: 0 })
    )
    expect(wheelZoomFactor({ deltaY: 500, deltaMode: 0 })).toBeGreaterThan(0.7)
  })
})

describe('zoomThumbnail', () => {
  it('scales the size by the factor within the allowed range', () => {
    expect(zoomThumbnail(100, 1.5)).toBe(150)
    expect(zoomThumbnail(100, 0.1)).toBe(THUMBNAIL_SIZE.min)
    expect(zoomThumbnail(300, 2)).toBe(THUMBNAIL_SIZE.max)
  })
})
