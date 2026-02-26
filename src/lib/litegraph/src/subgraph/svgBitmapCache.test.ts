import { describe, expect, it, vi } from 'vitest'

import { createBitmapCache } from './svgBitmapCache'

function mockSvg(
  overrides: Partial<{ complete: boolean; naturalWidth: number }> = {}
) {
  const img = new Image()
  Object.defineProperty(img, 'complete', {
    value: overrides.complete ?? true
  })
  Object.defineProperty(img, 'naturalWidth', {
    value: overrides.naturalWidth ?? 16
  })
  return img
}

describe('createBitmapCache', () => {
  const BITMAP_SIZE = 16
  function mockGetContext(returnValue: CanvasRenderingContext2D | null) {
    return vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(
        (() => returnValue) as typeof HTMLCanvasElement.prototype.getContext
      )
  }

  const stubContext = {
    drawImage: vi.fn()
  } as unknown as CanvasRenderingContext2D

  it('returns the SVG when image is not yet complete', () => {
    const svg = mockSvg({ complete: false, naturalWidth: 0 })
    const cache = createBitmapCache(svg, BITMAP_SIZE)

    expect(cache.get()).toBe(svg)
  })

  it('returns the SVG when naturalWidth is 0', () => {
    const svg = mockSvg({ complete: true, naturalWidth: 0 })
    const cache = createBitmapCache(svg, BITMAP_SIZE)

    expect(cache.get()).toBe(svg)
  })

  it('creates a bitmap canvas once the SVG is loaded', () => {
    const svg = mockSvg()
    const cache = createBitmapCache(svg, BITMAP_SIZE)
    mockGetContext(stubContext)

    const result = cache.get()

    expect(result).toBeInstanceOf(HTMLCanvasElement)
    expect((result as HTMLCanvasElement).width).toBe(BITMAP_SIZE)
    expect((result as HTMLCanvasElement).height).toBe(BITMAP_SIZE)
    vi.restoreAllMocks()
  })

  it('returns the cached bitmap on subsequent calls', () => {
    const svg = mockSvg()
    const cache = createBitmapCache(svg, BITMAP_SIZE)
    mockGetContext(stubContext)

    const first = cache.get()
    const second = cache.get()

    expect(first).toBe(second)
    vi.restoreAllMocks()
  })

  it('does not re-create the canvas on subsequent calls', () => {
    const svg = mockSvg()
    const cache = createBitmapCache(svg, BITMAP_SIZE)
    mockGetContext(stubContext)
    const createElementSpy = vi.spyOn(document, 'createElement')

    cache.get()
    const callCount = createElementSpy.mock.calls.length
    cache.get()

    expect(createElementSpy).toHaveBeenCalledTimes(callCount)
    vi.restoreAllMocks()
  })

  it('falls back to SVG when canvas context is unavailable', () => {
    const svg = mockSvg()
    const cache = createBitmapCache(svg, BITMAP_SIZE)
    mockGetContext(null)

    expect(cache.get()).toBe(svg)
    vi.restoreAllMocks()
  })
})
