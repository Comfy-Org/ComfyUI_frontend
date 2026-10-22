import { describe, expect, it, vi } from 'vitest'

import { useMediaCache } from './mediaCacheService'

describe('mediaCacheService', () => {
  describe('lifecycle', () => {
    it('owns its unload listener and cleanup interval from creation until disposal', async () => {
      vi.useFakeTimers()
      vi.resetModules()
      const addListener = vi.spyOn(window, 'addEventListener')
      const removeListener = vi.spyOn(window, 'removeEventListener')
      const unloadCalls = (spy: typeof addListener) =>
        spy.mock.calls.filter(([type]) => type === 'beforeunload')

      const { useMediaCache, disposeMediaCache } =
        await import('./mediaCacheService')
      expect(unloadCalls(addListener)).toHaveLength(0)
      expect(vi.getTimerCount()).toBe(0)

      useMediaCache()
      useMediaCache()
      expect(unloadCalls(addListener)).toHaveLength(1)
      expect(vi.getTimerCount()).toBe(1)

      disposeMediaCache()
      expect(unloadCalls(removeListener)).toEqual([
        ['beforeunload', unloadCalls(addListener)[0][1]]
      ])
      expect(vi.getTimerCount()).toBe(0)
    })
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
  })
})
