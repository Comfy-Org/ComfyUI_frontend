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
    function imageResponse() {
      return Promise.resolve(
        new Response(new Blob(['image-bytes']), { status: 200 })
      )
    }

    function serverError() {
      return Promise.resolve(new Response('nope', { status: 500 }))
    }

    function notFound() {
      return Promise.resolve(new Response('nope', { status: 404 }))
    }

    function networkError() {
      return Promise.reject(new TypeError('fetch failed'))
    }

    it('serves a successful result without refetching', async () => {
      vi.mocked(fetch).mockImplementation(imageResponse)
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
      const { getCachedMedia } = useMediaCache()

      const first = await getCachedMedia('thumb.webp')
      const second = await getCachedMedia('thumb.webp')

      expect(first.error).toBeUndefined()
      expect(second.objectUrl).toBe('blob:mock-url')
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch).toHaveBeenCalledWith('thumb.webp', {
        cache: 'force-cache'
      })
    })

    it.for([
      { scenario: 'a 500 response', failure: serverError },
      { scenario: 'a 404 response', failure: notFound },
      { scenario: 'a network error', failure: networkError }
    ])(
      'retries after $scenario instead of serving the cached error',
      async ({ failure }) => {
        vi.mocked(fetch).mockImplementationOnce(failure)
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
        const { getCachedMedia } = useMediaCache()

        const failed = await getCachedMedia('thumb.webp')
        expect(failed.error).toBe(true)

        vi.mocked(fetch).mockImplementationOnce(imageResponse)
        const retried = await getCachedMedia('thumb.webp')

        expect(retried.error).toBeUndefined()
        expect(retried.objectUrl).toBe('blob:mock-url')
        expect(fetch).toHaveBeenCalledTimes(2)
        expect(fetch).toHaveBeenNthCalledWith(2, 'thumb.webp', {
          cache: 'reload'
        })
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
