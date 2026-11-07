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

  describe('failed media caching', () => {
    const imageResponse = () =>
      new Response(new Blob(['image-bytes']), { status: 200 })

    it('serves a successful result without refetching', async () => {
      vi.mocked(fetch).mockResolvedValue(imageResponse())
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
      const { getCachedMedia } = useMediaCache()

      const first = await getCachedMedia('thumb.webp')
      const second = await getCachedMedia('thumb.webp')

      expect(first.error).toBeUndefined()
      expect(second.objectUrl).toBe('blob:mock-url')
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it.for([
      {
        scenario: 'a non-OK response',
        failure: () => Promise.resolve(new Response('nope', { status: 500 }))
      },
      {
        scenario: 'a network error',
        failure: () => Promise.reject(new TypeError('fetch failed'))
      }
    ])(
      'retries after $scenario instead of serving the cached error',
      async ({ failure }) => {
        vi.mocked(fetch).mockImplementationOnce(failure)
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
        const { getCachedMedia } = useMediaCache()

        const failed = await getCachedMedia('thumb.webp')
        expect(failed.error).toBe(true)

        vi.mocked(fetch).mockResolvedValueOnce(imageResponse())
        const retried = await getCachedMedia('thumb.webp')

        expect(retried.error).toBeUndefined()
        expect(retried.objectUrl).toBe('blob:mock-url')
        expect(fetch).toHaveBeenCalledTimes(2)
      }
    )
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
