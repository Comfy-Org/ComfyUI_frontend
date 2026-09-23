import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { useFeatureFlags } from '@/composables/useFeatureFlags'
import { firebaseIdentity } from '@/platform/auth/firebaseIdentity'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import type { useTelemetry } from '@/platform/telemetry'
import { useAuthStore } from '@/stores/authStore'

const { addBreadcrumb, trackFetchTimeout, trackUnifiedAuthRetry } = vi.hoisted(
  () => ({
    addBreadcrumb: vi.fn(),
    trackFetchTimeout: vi.fn(),
    trackUnifiedAuthRetry: vi.fn()
  })
)

vi.mock(import('@sentry/vue'), () => ({ addBreadcrumb }))

vi.mock(import('@/platform/telemetry'), () => ({
  useTelemetry: () =>
    fromPartial<ReturnType<typeof useTelemetry>>({
      trackFetchTimeout,
      trackUnifiedAuthRetry
    })
}))

// Only the unified-remint regression suite below flips this to `true`; every
// other test in this file runs the (unaffected) non-cloud path.
const mockDistribution = vi.hoisted(() => ({ isCloud: false }))
vi.mock(import('@/platform/distribution/types'), () => mockDistribution)

// authStore/workspaceAuthStore are real Pinia stores (global testing Pinia
// from vitest.setup.ts); their actions are stubbed per-test below via
// vi.mocked(store.action), not by mocking the store modules themselves.
vi.mock(import('firebase/auth'))

const mockFeatureFlags = vi.hoisted(() => ({
  flags: { unifiedCloudAuthEnabled: true }
}))
vi.mock(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () =>
    fromPartial<ReturnType<typeof useFeatureFlags>>(mockFeatureFlags)
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

const fetchTimeoutRejection = {
  status: 'rejected',
  reason: { name: 'TimeoutError', message: 'Fetch timeout' }
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

    it('aborts with a TimeoutError and forwards normalized diagnostics', async () => {
      mockPendingFetch()

      const request = api.fetchApi(
        '/userdata/private%20workflow.json?directory=secret',
        { method: 'post' }
      )
      const settled = Promise.allSettled([request])
      await vi.advanceTimersByTimeAsync(60_000)

      expect(await settled).toMatchObject([fetchTimeoutRejection])
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
      const settled = Promise.allSettled([request])
      await vi.advanceTimersByTimeAsync(60_000)

      expect(await settled).toMatchObject([fetchTimeoutRejection])
      expect(trackFetchTimeout).toHaveBeenCalledExactlyOnceWith({
        route: '/other',
        method: 'GET',
        timeout_ms: 60_000
      })
    })

    it('normalizes the video metadata endpoint', async () => {
      mockPendingFetch()

      const request = api.fetchApi('/video_metadata?filename=private.mp4')
      const settled = Promise.allSettled([request])
      await vi.advanceTimersByTimeAsync(60_000)

      expect(await settled).toMatchObject([fetchTimeoutRejection])
      expect(trackFetchTimeout).toHaveBeenCalledExactlyOnceWith({
        route: '/video_metadata',
        method: 'GET',
        timeout_ms: 60_000
      })
    })

    it('uses a caller-owned 120 second timeout', async () => {
      mockPendingFetch()

      const request = api.fetchApi('/upload/image', {
        timeoutMs: 120_000
      })
      const settled = Promise.allSettled([request])
      await vi.advanceTimersByTimeAsync(60_000)

      expect(trackFetchTimeout).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(60_000)
      expect(await settled).toMatchObject([fetchTimeoutRejection])
      expect(trackFetchTimeout).toHaveBeenCalledExactlyOnceWith({
        route: '/upload/:resource',
        method: 'GET',
        timeout_ms: 120_000
      })
    })

    it('applies the default timeout alongside caller cancellation', async () => {
      mockPendingFetch()
      const controller = new AbortController()

      const request = api.fetchApi('/assets', { signal: controller.signal })
      const settled = Promise.allSettled([request])
      await vi.advanceTimersByTimeAsync(60_000)

      expect(await settled).toMatchObject([fetchTimeoutRejection])
      expect(trackFetchTimeout).toHaveBeenCalledExactlyOnceWith({
        route: '/assets',
        method: 'GET',
        timeout_ms: 60_000
      })
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

  // Regression coverage for the unified-remint retry inheriting a shrunk
  // deadline (Sentry CLOUD-FRONTEND-STAGING-4MF): the post-401 retry used to
  // reuse the original 60s AbortSignal, so a slow re-mint round trip could
  // leave it only a few seconds before the retry itself finished. Before the
  // fix, this test's retry would be aborted with a TimeoutError at t=60s;
  // after the fix it gets a fresh 60s budget starting when the retry begins.
  describe('post-401 retry timeout budget', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      mockDistribution.isCloud = true
      // Real Pinia stores (global testing Pinia from vitest.setup.ts): the
      // identity port is stubbed so constructing them never reaches real
      // Firebase, and their actions stay real functions we override below.
      vi.spyOn(firebaseIdentity, 'onUserChanged').mockReturnValue(() => {})
      vi.spyOn(firebaseIdentity, 'onTokenChanged').mockReturnValue(() => {})
      useAuthStore().isInitialized = true
      vi.mocked(useAuthStore().getAuthHeader).mockResolvedValue({
        Authorization: 'Bearer tokenA'
      })
    })

    afterEach(() => {
      mockDistribution.isCloud = false
    })

    it('gives the retry fetch a fresh timeout window instead of the shrunk remainder', async () => {
      // The re-mint round trip (unifiedUser -> exchangeToken, each with its
      // own independent budget) takes 55s here -- most of the original 60s
      // window -- before the retry fetch even starts.
      vi.mocked(useWorkspaceAuthStore().remintUnifiedOnce).mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve('tokenB'), 55_000))
      )

      let fetchCall = 0
      vi.mocked(global.fetch).mockImplementation((_input, init) => {
        fetchCall++
        if (fetchCall === 1) {
          return Promise.resolve({ status: 401 } as Response)
        }
        // The retry itself takes 30s. Reusing the original signal (which
        // expires at t=60s, only 5s into the retry) would abort this before
        // it finishes; a fresh signal (starting its own 60s clock at t=55s)
        // does not.
        const signal = init?.signal
        return new Promise<Response>((resolve, reject) => {
          if (signal?.aborted) {
            reject(signal.reason)
            return
          }
          const onAbort = () => reject(signal?.reason)
          signal?.addEventListener('abort', onAbort, { once: true })
          setTimeout(() => {
            signal?.removeEventListener('abort', onAbort)
            resolve({ status: 200 } as Response)
          }, 30_000)
        })
      })

      const request = api.fetchApi('/test')
      const settled = Promise.allSettled([request])
      await vi.advanceTimersByTimeAsync(90_000)

      expect(await settled).toMatchObject([
        { status: 'fulfilled', value: { status: 200 } }
      ])
      expect(fetchCall).toBe(2)
    })
  })
})
