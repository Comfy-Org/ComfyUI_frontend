import { describe, expect, it, vi } from 'vitest'

interface ImageLike {
  complete: boolean
  naturalWidth: number
}

function createBitmapCache(svg: ImageLike, bitmapSize: number) {
  let bitmap: HTMLCanvasElement | null = null

  return {
    get(): HTMLCanvasElement | ImageLike {
      if (bitmap) return bitmap
      if (!svg.complete || svg.naturalWidth === 0) return svg

      const canvas = document.createElement('canvas')
      canvas.width = bitmapSize
      canvas.height = bitmapSize
      const ctx = canvas.getContext('2d')
      if (!ctx) return svg

      bitmap = canvas
      return bitmap
    }
  }
}

describe('SVG bitmap cache', () => {
  const BITMAP_SIZE = 16
  function mockGetContext(returnValue: CanvasRenderingContext2D | null) {
    return vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(
        (() => returnValue) as typeof HTMLCanvasElement.prototype.getContext
      )
  }

  const stubContext = {} as CanvasRenderingContext2D

  it('returns the SVG when image is not yet complete', () => {
    const svg: ImageLike = { complete: false, naturalWidth: 0 }
    const cache = createBitmapCache(svg, BITMAP_SIZE)

    expect(cache.get()).toBe(svg)
  })

  it('returns the SVG when naturalWidth is 0', () => {
    const svg: ImageLike = { complete: true, naturalWidth: 0 }
    const cache = createBitmapCache(svg, BITMAP_SIZE)

    expect(cache.get()).toBe(svg)
  })

  it('creates a bitmap canvas once the SVG is loaded', () => {
    const svg: ImageLike = { complete: true, naturalWidth: 16 }
    const cache = createBitmapCache(svg, BITMAP_SIZE)
    mockGetContext(stubContext)

    const result = cache.get()

    expect(result).toBeInstanceOf(HTMLCanvasElement)
    expect((result as HTMLCanvasElement).width).toBe(BITMAP_SIZE)
    expect((result as HTMLCanvasElement).height).toBe(BITMAP_SIZE)
    vi.restoreAllMocks()
  })

  it('returns the cached bitmap on subsequent calls', () => {
    const svg: ImageLike = { complete: true, naturalWidth: 16 }
    const cache = createBitmapCache(svg, BITMAP_SIZE)
    mockGetContext(stubContext)

    const first = cache.get()
    const second = cache.get()

    expect(first).toBe(second)
    vi.restoreAllMocks()
  })

  it('does not re-create the canvas on subsequent calls', () => {
    const svg: ImageLike = { complete: true, naturalWidth: 16 }
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
    const svg: ImageLike = { complete: true, naturalWidth: 16 }
    const cache = createBitmapCache(svg, BITMAP_SIZE)

    mockGetContext(null)

    expect(cache.get()).toBe(svg)

    vi.restoreAllMocks()
  })
})
