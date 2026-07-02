import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useMediaCache } from './mediaCacheService'

const NativeURL = URL

// Mock fetch
global.fetch = vi.fn()
global.URL = {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn()
} as Partial<typeof URL> as typeof URL

describe('mediaCacheService', () => {
  describe('URL reference counting', () => {
    it('should handle URL acquisition for non-existent cache entry', () => {
      const { acquireUrl } = useMediaCache()

      const url = acquireUrl('non-existent.jpg')
      expect(url).toBeUndefined()
    })

    it('should handle URL release for non-existent cache entry', () => {
      const { releaseUrl } = useMediaCache()

      // Should not throw error
      expect(() => releaseUrl('non-existent.jpg')).not.toThrow()
    })

    it('should provide acquireUrl and releaseUrl methods', () => {
      const cache = useMediaCache()

      expect(typeof cache.acquireUrl).toBe('function')
      expect(typeof cache.releaseUrl).toBe('function')
    })
  })
})

type MediaCache = ReturnType<typeof useMediaCache>

const mockFetch = vi.fn()
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()

class MockURL extends NativeURL {
  static override createObjectURL(blob: Blob): string {
    return mockCreateObjectURL(blob)
  }

  static override revokeObjectURL(url: string): void {
    mockRevokeObjectURL(url)
  }
}

function response(ok: boolean, blob = new Blob(['image'])): Response {
  return {
    ok,
    status: ok ? 200 : 404,
    blob: () => Promise.resolve(blob)
  } as Response
}

async function freshCache(options?: {
  maxSize?: number
  maxAge?: number
}): Promise<MediaCache> {
  vi.resetModules()
  const module = await import('./mediaCacheService')
  return module.useMediaCache(options)
}

describe('useMediaCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    mockFetch.mockReset()
    mockCreateObjectURL.mockReset()
    mockRevokeObjectURL.mockReset()
    mockCreateObjectURL.mockImplementation(
      (_blob: Blob) => `blob:${mockCreateObjectURL.mock.calls.length}`
    )
    vi.stubGlobal('fetch', mockFetch)
    vi.stubGlobal('URL', MockURL)
  })

  afterEach(() => {
    window.dispatchEvent(new Event('beforeunload'))
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('fetches media once and returns cached entries on later reads', async () => {
    mockFetch.mockResolvedValue(response(true))
    const cache = await freshCache()

    const first = await cache.getCachedMedia('/image.png')
    vi.setSystemTime(100)
    const second = await cache.getCachedMedia('/image.png')

    expect(first).toMatchObject({
      src: '/image.png',
      objectUrl: 'blob:1',
      isLoading: false
    })
    expect(second).toEqual(first)
    expect(second.lastAccessed).toBe(100)
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch).toHaveBeenCalledWith('/image.png', {
      cache: 'force-cache'
    })
  })

  it('stores an error entry when fetch fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockFetch.mockResolvedValue(response(false))
    const cache = await freshCache()

    const entry = await cache.getCachedMedia('/missing.png')

    expect(entry).toMatchObject({
      src: '/missing.png',
      error: true,
      isLoading: false
    })
    expect(warn).toHaveBeenCalledWith(
      'Failed to cache media:',
      '/missing.png',
      expect.any(Error)
    )
  })

  it('ref-counts acquired object URLs and removes the cache entry on final release', async () => {
    mockFetch.mockResolvedValue(response(true))
    const cache = await freshCache()
    await cache.getCachedMedia('/image.png')

    expect(cache.acquireUrl('/image.png')).toBe('blob:1')
    expect(cache.acquireUrl('/image.png')).toBe('blob:1')
    cache.releaseUrl('/image.png')
    expect(mockRevokeObjectURL).not.toHaveBeenCalled()
    expect(cache.cache.has('/image.png')).toBe(true)

    cache.releaseUrl('/image.png')

    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:1')
    expect(cache.cache.has('/image.png')).toBe(false)
  })

  it('returns undefined when acquiring a URL that is not cached', async () => {
    const cache = await freshCache()

    expect(cache.acquireUrl('/missing.png')).toBeUndefined()
    cache.releaseUrl('/missing.png')
    expect(mockRevokeObjectURL).not.toHaveBeenCalled()
  })

  it('expires old cache entries during scheduled cleanup', async () => {
    mockFetch.mockResolvedValue(response(true))
    const cache = await freshCache({ maxAge: 100 })
    await cache.getCachedMedia('/old.png')

    vi.setSystemTime(200)
    vi.advanceTimersByTime(5 * 60 * 1000)

    expect(cache.cache.has('/old.png')).toBe(false)
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:1')
  })

  it('keeps expired entries while their object URL is still acquired', async () => {
    mockFetch.mockResolvedValue(response(true))
    const cache = await freshCache({ maxAge: 100 })
    await cache.getCachedMedia('/held.png')
    cache.acquireUrl('/held.png')

    vi.setSystemTime(200)
    vi.advanceTimersByTime(5 * 60 * 1000)

    expect(cache.cache.has('/held.png')).toBe(true)
    expect(mockRevokeObjectURL).not.toHaveBeenCalled()
  })

  it('removes the oldest unused entries when the cache is over size', async () => {
    mockFetch.mockResolvedValue(response(true))
    const cache = await freshCache({ maxSize: 1, maxAge: 1_000_000 })
    await cache.getCachedMedia('/old.png')
    vi.setSystemTime(1)
    await cache.getCachedMedia('/new.png')

    vi.advanceTimersByTime(5 * 60 * 1000)

    expect(cache.cache.has('/old.png')).toBe(false)
    expect(cache.cache.has('/new.png')).toBe(true)
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:1')
  })

  it('clears all cached URLs on demand and before unload', async () => {
    mockFetch.mockResolvedValue(response(true))
    const cache = await freshCache()
    await cache.getCachedMedia('/first.png')
    await cache.getCachedMedia('/second.png')

    cache.clearCache()

    expect(cache.cache.size).toBe(0)
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:1')
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:2')

    await cache.getCachedMedia('/third.png')
    window.dispatchEvent(new Event('beforeunload'))

    expect(cache.cache.size).toBe(0)
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:3')
  })
})
