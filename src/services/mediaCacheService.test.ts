import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMediaCache } from './mediaCacheService'

// Mock fetch
global.fetch = vi.fn()

let objectUrlCounter = 0
global.URL = {
  createObjectURL: vi.fn(() => `blob:mock-url-${++objectUrlCounter}`),
  revokeObjectURL: vi.fn()
} as Partial<typeof URL> as typeof URL

function mockFetchSuccess() {
  vi.mocked(global.fetch).mockResolvedValue({
    ok: true,
    status: 200,
    blob: () => Promise.resolve(new Blob(['data']))
  } as Response)
}

describe('mediaCacheService', () => {
  beforeEach(() => {
    useMediaCache().clearCache()
    vi.mocked(global.URL.revokeObjectURL).mockClear()
    vi.mocked(global.fetch).mockReset()
  })

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

    it('keeps the url alive while a second consumer still holds it', async () => {
      mockFetchSuccess()
      const { getCachedMedia, acquireUrl, releaseUrl } = useMediaCache()

      const src = 'two-consumers.png'
      const entry = await getCachedMedia(src)
      const objectUrl = entry.objectUrl!

      expect(acquireUrl(src)).toBe(objectUrl)
      expect(acquireUrl(src)).toBe(objectUrl)

      releaseUrl(src)

      expect(global.URL.revokeObjectURL).not.toHaveBeenCalledWith(objectUrl)

      releaseUrl(src)

      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(objectUrl)
    })

    it('does not revoke a url that was never acquired', async () => {
      mockFetchSuccess()
      const { getCachedMedia, releaseUrl } = useMediaCache()

      const src = 'never-acquired.png'
      const entry = await getCachedMedia(src)
      const objectUrl = entry.objectUrl!

      releaseUrl(src)

      expect(global.URL.revokeObjectURL).not.toHaveBeenCalledWith(objectUrl)
    })
  })
})
