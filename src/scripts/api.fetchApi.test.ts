import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { addBreadcrumb, trackFetchTimeout } = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  trackFetchTimeout: vi.fn()
}))

vi.mock('@sentry/vue', () => ({ addBreadcrumb }))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackFetchTimeout })
}))

import { api } from '@/scripts/api'

function mockPendingFetch() {
  return vi.mocked(global.fetch).mockImplementation((_input, init) => {
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      if (!signal) return

      if (signal.aborted) {
        reject(signal.reason)
        return
      }

      signal.addEventListener('abort', () => reject(signal.reason), {
        once: true
      })
    })
  })
}

describe('api.fetchApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // Reset api state
    api.user = 'test-user'
  })

  describe('header handling', () => {
    it('should add Comfy-User header with plain object headers', async () => {
      const mockFetch = vi
        .mocked(global.fetch)
        .mockResolvedValue(new Response())

      await api.fetchApi('/test', {
        headers: {}
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          headers: {
            'Comfy-User': 'test-user'
          }
        })
      )
    })

    it('should add Comfy-User header with Headers instance', async () => {
      const mockFetch = vi
        .mocked(global.fetch)
        .mockResolvedValue(new Response())
      const headers = new Headers()

      await api.fetchApi('/test', { headers })

      expect(mockFetch).toHaveBeenCalled()
      const callHeaders = mockFetch.mock.calls[0][1]?.headers
      expect(callHeaders).toEqual(headers)
    })

    it('should add Comfy-User header with array headers', async () => {
      const mockFetch = vi
        .mocked(global.fetch)
        .mockResolvedValue(new Response())
      const headers: [string, string][] = []

      await api.fetchApi('/test', { headers })

      expect(mockFetch).toHaveBeenCalled()
      const callHeaders = mockFetch.mock.calls[0][1]?.headers
      expect(callHeaders).toContainEqual(['Comfy-User', 'test-user'])
    })

    it('should preserve existing headers when adding Comfy-User', async () => {
      const mockFetch = vi
        .mocked(global.fetch)
        .mockResolvedValue(new Response())

      await api.fetchApi('/test', {
        headers: {
          'Content-Type': 'application/json',
          'X-Custom': 'value'
        }
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'X-Custom': 'value',
            'Comfy-User': 'test-user'
          }
        })
      )
    })

    it('should not allow developer-specified headers to be overridden by options', async () => {
      const mockFetch = vi
        .mocked(global.fetch)
        .mockResolvedValue(new Response())

      await api.fetchApi('/test', {
        headers: {
          'Comfy-User': 'fennec-girl'
        }
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          headers: {
            'Comfy-User': 'test-user'
          }
        })
      )
    })
  })

  describe('default options', () => {
    it('should set cache to no-cache by default', async () => {
      const mockFetch = vi
        .mocked(global.fetch)
        .mockResolvedValue(new Response())

      await api.fetchApi('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          cache: 'no-cache'
        })
      )
    })

    it('should include required headers even when no headers option is provided', async () => {
      const mockFetch = vi
        .mocked(global.fetch)
        .mockResolvedValue(new Response())

      await api.fetchApi('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Comfy-User': 'test-user'
          })
        })
      )
    })

    it('should not override existing cache option', async () => {
      const mockFetch = vi
        .mocked(global.fetch)
        .mockResolvedValue(new Response())

      await api.fetchApi('/test', { cache: 'force-cache' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          cache: 'force-cache'
        })
      )
    })
  })

  describe('URL construction', () => {
    it('should use apiURL for route construction', async () => {
      const mockFetch = vi
        .mocked(global.fetch)
        .mockResolvedValue(new Response())

      await api.fetchApi('/test/route')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test/route'),
        expect.any(Object)
      )
    })
  })

  describe('response header timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('aborts with a TimeoutError and forwards normalized diagnostics', async () => {
      mockPendingFetch()

      const request = api.fetchApi(
        '/userdata/private%20workflow.json?directory=secret',
        { method: 'post' }
      )
      const rejection = expect(request).rejects.toMatchObject({
        name: 'TimeoutError',
        message: 'Fetch timeout'
      })
      await vi.advanceTimersByTimeAsync(60_000)

      await rejection
      expect(trackFetchTimeout).toHaveBeenCalledExactlyOnceWith({
        route: '/userdata/:resource',
        method: 'POST',
        timeout_ms: 60_000
      })
      expect(addBreadcrumb).toHaveBeenCalledExactlyOnceWith({
        category: 'fetch',
        message: 'Timeout on POST /userdata/:resource',
        level: 'warning',
        data: { timeout_ms: 60_000 }
      })
    })

    it('uses a bounded fallback for unknown routes', async () => {
      mockPendingFetch()

      const request = api.fetchApi('/private-name/secret-id')
      const rejection = expect(request).rejects.toMatchObject({
        name: 'TimeoutError'
      })
      await vi.advanceTimersByTimeAsync(60_000)

      await rejection
      expect(trackFetchTimeout).toHaveBeenCalledExactlyOnceWith({
        route: '/other',
        method: 'GET',
        timeout_ms: 60_000
      })
    })

    it('preserves a caller-owned 120 second timeout', async () => {
      mockPendingFetch()
      const controller = new AbortController()
      setTimeout(
        () =>
          controller.abort(new DOMException('Upload timeout', 'TimeoutError')),
        120_000
      )

      const request = api.fetchApi('/upload/image', {
        signal: controller.signal
      })
      const rejection = expect(request).rejects.toMatchObject({
        name: 'TimeoutError',
        message: 'Upload timeout'
      })
      await vi.advanceTimersByTimeAsync(60_000)

      expect(controller.signal.aborted).toBe(false)
      expect(trackFetchTimeout).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(60_000)
      await rejection
      expect(trackFetchTimeout).not.toHaveBeenCalled()
    })

    it('preserves caller cancellation without timeout telemetry', async () => {
      mockPendingFetch()
      const controller = new AbortController()

      const request = api.fetchApi('/assets', { signal: controller.signal })
      controller.abort()

      await expect(request).rejects.toMatchObject({ name: 'AbortError' })
      expect(trackFetchTimeout).not.toHaveBeenCalled()
      expect(addBreadcrumb).not.toHaveBeenCalled()
    })

    it('clears the timeout when fetch resolves', async () => {
      vi.mocked(global.fetch).mockResolvedValue(new Response())

      await api.fetchApi('/test')

      expect(vi.getTimerCount()).toBe(0)
    })

    it('clears the timeout when fetch rejects', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

      await expect(api.fetchApi('/test')).rejects.toThrow('Network error')

      expect(vi.getTimerCount()).toBe(0)
    })
  })
})
