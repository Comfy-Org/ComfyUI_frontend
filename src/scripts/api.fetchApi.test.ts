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

  // PM-1802: the auth-rejection diagnostic is only worth anything if the
  // scheme it names is the scheme the request actually used. These are
  // integration tests on purpose - the agentRestClient tests invoke
  // `onAuthScheme` by hand, so they cannot falsify what fetchApi reports.
  describe('onAuthScheme (PM-1802)', () => {
    function signInOnCloud() {
      mockDistribution.isCloud = true
      vi.spyOn(firebaseIdentity, 'onUserChanged').mockReturnValue(() => {})
      vi.spyOn(firebaseIdentity, 'onTokenChanged').mockReturnValue(() => {})
      useAuthStore().isInitialized = true
    }

    afterEach(() => {
      mockDistribution.isCloud = false
    })

    it('reports none off-cloud, where no auth scheme is used at all', async () => {
      vi.mocked(global.fetch).mockResolvedValue(new Response())
      const onAuthScheme = vi.fn()

      await api.fetchApi('/test', { onAuthScheme })

      expect(onAuthScheme).toHaveBeenCalledExactlyOnceWith('none')
    })

    it('reports cloud-auth-header when a header was attached', async () => {
      signInOnCloud()
      vi.mocked(useAuthStore().getAuthHeader).mockResolvedValue({
        Authorization: 'Bearer tokenA'
      })
      vi.mocked(global.fetch).mockResolvedValue(new Response())
      const onAuthScheme = vi.fn()

      await api.fetchApi('/test', { onAuthScheme })

      expect(onAuthScheme).toHaveBeenCalledExactlyOnceWith('cloud-auth-header')
      expect(vi.mocked(global.fetch).mock.calls[0][1]?.headers).toMatchObject({
        Authorization: 'Bearer tokenA'
      })
    })

    // The case the alert is about, and the one the first implementation got
    // wrong: `addCloudAuthHeader` attaches nothing when auth is unavailable,
    // so announcing `cloud-auth-header` for taking this branch misidentified
    // an unauthenticated request as an authenticated one.
    it('reports none when the cloud auth header was unavailable', async () => {
      signInOnCloud()
      vi.mocked(useAuthStore().getAuthHeader).mockResolvedValue(null)
      vi.mocked(global.fetch).mockResolvedValue(new Response())
      const onAuthScheme = vi.fn()
      const onAuthHeader = vi.fn()

      await api.fetchApi('/test', { onAuthScheme, onAuthHeader })

      expect(onAuthScheme).toHaveBeenCalledExactlyOnceWith('none')
      // Agrees with the existing boolean rather than contradicting it.
      expect(onAuthHeader).toHaveBeenCalledExactlyOnceWith(false)
      expect(
        vi.mocked(global.fetch).mock.calls[0][1]?.headers
      ).not.toHaveProperty('Authorization')
    })

    it('reports none when getting the cloud auth header throws', async () => {
      signInOnCloud()
      vi.mocked(useAuthStore().getAuthHeader).mockRejectedValue(
        new Error('auth store unavailable')
      )
      vi.mocked(global.fetch).mockResolvedValue(new Response())
      const onAuthScheme = vi.fn()

      await api.fetchApi('/test', { onAuthScheme })

      expect(onAuthScheme).toHaveBeenCalledExactlyOnceWith('none')
    })

    it('is not broken by a throwing onAuthCredential callback', async () => {
      signInOnCloud()
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.mocked(useAuthStore().getAuthHeader).mockResolvedValue({
        Authorization: 'Bearer tokenA'
      })
      vi.mocked(global.fetch).mockResolvedValue(new Response('ok'))

      const response = await api.fetchApi('/test', {
        onAuthCredential: () => {
          throw new Error('callback bug')
        }
      })

      expect(await response.text()).toBe('ok')
      expect(vi.mocked(global.fetch).mock.calls[0][1]?.headers).toMatchObject({
        Authorization: 'Bearer tokenA'
      })
    })

    it('reports the credential kind each auth path sent', async () => {
      vi.mocked(global.fetch).mockResolvedValue(new Response())
      const offCloud = vi.fn()
      await api.fetchApi('/test', { onAuthCredential: offCloud })

      signInOnCloud()
      const getAuthHeader = vi.mocked(useAuthStore().getAuthHeader)
      const bearer = vi.fn()
      getAuthHeader.mockResolvedValueOnce({ Authorization: 'Bearer tokenA' })
      await api.fetchApi('/test', { onAuthCredential: bearer })
      const apiKey = vi.fn()
      getAuthHeader.mockResolvedValueOnce({ 'X-API-KEY': 'key' })
      await api.fetchApi('/test', { onAuthCredential: apiKey })
      const missing = vi.fn()
      getAuthHeader.mockResolvedValueOnce(null)
      await api.fetchApi('/test', { onAuthCredential: missing })
      expect(
        [offCloud, bearer, apiKey, missing].map(
          (callback) => callback.mock.calls
        )
      ).toEqual([[['none']], [['bearer']], [['api-key']], [['none']]])
    })

    it('is not forwarded to fetch as a request option', async () => {
      vi.mocked(global.fetch).mockResolvedValue(new Response())

      await api.fetchApi('/test', { onAuthScheme: vi.fn() })

      expect(vi.mocked(global.fetch).mock.calls[0][1]).not.toHaveProperty(
        'onAuthScheme'
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

    it('ends the initial timeout before re-minting and gives the retry a fresh window', async () => {
      vi.mocked(useWorkspaceAuthStore().remintUnifiedOnce).mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve('tokenB'), 30_000))
      )

      let fetchCall = 0
      vi.mocked(global.fetch).mockImplementation((_input, init) => {
        fetchCall++
        if (fetchCall === 1) {
          return new Promise((resolve) =>
            setTimeout(() => resolve({ status: 401 } as Response), 40_000)
          )
        }
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
      await vi.advanceTimersByTimeAsync(100_000)

      expect(await settled).toMatchObject([
        { status: 'fulfilled', value: { status: 200 } }
      ])
      expect(fetchCall).toBe(2)
      expect(trackFetchTimeout).not.toHaveBeenCalled()
      expect(addBreadcrumb).not.toHaveBeenCalled()
    })
  })
})
