import { afterEach, describe, expect, it, vi } from 'vitest'

import { disposeMediaCache, useMediaCache } from './mediaCacheService'

vi.hoisted(() => vi.spyOn(window, 'addEventListener'))

function unloadCalls(calls: unknown[][]) {
  return calls.filter(([type]) => type === 'beforeunload')
}

const unloadListenersAddedAtImport = unloadCalls(
  vi.mocked(window.addEventListener).mock.calls
).length

describe('mediaCacheService', () => {
  afterEach(() => disposeMediaCache())

  describe('lifecycle', () => {
    it('registers no unload listener at import', () => {
      expect(unloadListenersAddedAtImport).toBe(0)
    })

    it('owns its unload listener and cleanup interval from creation until disposal', () => {
      vi.useFakeTimers()
      const addListener = vi.spyOn(window, 'addEventListener')
      const removeListener = vi.spyOn(window, 'removeEventListener')

      useMediaCache()
      useMediaCache()
      expect(unloadCalls(addListener.mock.calls)).toHaveLength(1)
      expect(vi.getTimerCount()).toBe(1)

      disposeMediaCache()
      expect(unloadCalls(removeListener.mock.calls)).toEqual([
        ['beforeunload', unloadCalls(addListener.mock.calls)[0][1]]
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
