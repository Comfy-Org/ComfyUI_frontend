import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCaptureCheckoutAttributionFromSearch, mockUseCurrentUser } =
  vi.hoisted(() => ({
    mockCaptureCheckoutAttributionFromSearch: vi.fn(),
    mockUseCurrentUser: vi.fn()
  }))

vi.mock('@/platform/telemetry/utils/checkoutAttribution', () => ({
  captureCheckoutAttributionFromSearch: mockCaptureCheckoutAttributionFromSearch
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: mockUseCurrentUser
}))

import { ImpactTelemetryProvider } from './ImpactTelemetryProvider'

const IMPACT_SCRIPT_URL =
  'https://utt.impactcdn.com/A6951770-3747-434a-9ac7-4e582e67d91f1.js'

async function flushAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('ImpactTelemetryProvider', () => {
  beforeEach(() => {
    mockCaptureCheckoutAttributionFromSearch.mockReset()
    mockUseCurrentUser.mockReset()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()

    const queueFn: NonNullable<Window['ire']> = (...args: unknown[]) => {
      ;(queueFn.a ??= []).push(args)
    }
    window.ire = queueFn
    window.ire_o = undefined

    vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
      if (selector === `script[src="${IMPACT_SCRIPT_URL}"]`) {
        return document.createElement('script')
      }

      return null
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('captures attribution and invokes identify with hashed email', async () => {
    mockUseCurrentUser.mockReturnValue({
      resolvedUserInfo: ref({ id: 'user-123' }),
      userEmail: ref('User@Example.com')
    })
    vi.stubGlobal('crypto', {
      subtle: {
        digest: vi.fn(async () => new Uint8Array([0, 1, 2]).buffer)
      }
    })
    const provider = new ImpactTelemetryProvider()
    provider.trackPageView('pricing', {
      path: 'https://cloud.comfy.org/pricing?im_ref=impact-123'
    })

    await flushAsyncWork()

    expect(window.ire_o).toBe('ire')
    expect(mockCaptureCheckoutAttributionFromSearch).toHaveBeenCalledWith(
      '?im_ref=impact-123'
    )
    expect(window.ire?.a).toHaveLength(1)
    expect(window.ire?.a?.[0]?.[0]).toBe('identify')
    expect(window.ire?.a?.[0]?.[1]).toMatchObject({
      customerId: 'user-123'
    })
  })

  it('falls back to current URL search and empty identify values when user is unresolved', async () => {
    mockUseCurrentUser.mockImplementation(() => {
      throw new Error('No active pinia')
    })
    window.history.pushState({}, '', '/?im_ref=fallback-123')

    const provider = new ImpactTelemetryProvider()
    provider.trackPageView('home')

    await flushAsyncWork()

    expect(mockCaptureCheckoutAttributionFromSearch).toHaveBeenCalledWith(
      '?im_ref=fallback-123'
    )
    expect(window.ire?.a).toHaveLength(1)
    expect(window.ire?.a?.[0]).toEqual([
      'identify',
      {
        customerId: '',
        customerEmail: ''
      }
    ])
  })

  it('deduplicates repeated identify payloads', async () => {
    mockUseCurrentUser.mockReturnValue({
      resolvedUserInfo: ref({ id: 'user-123' }),
      userEmail: ref('user@example.com')
    })
    vi.stubGlobal('crypto', {
      subtle: {
        digest: vi.fn(async () => new Uint8Array([16, 32, 48]).buffer)
      }
    })
    const provider = new ImpactTelemetryProvider()
    provider.trackPageView('home', {
      path: 'https://cloud.comfy.org/?im_ref=1'
    })
    provider.trackPageView('pricing', {
      path: 'https://cloud.comfy.org/pricing?im_ref=2'
    })

    await flushAsyncWork()

    expect(window.ire?.a).toHaveLength(1)
    expect(window.ire?.a?.[0]?.[0]).toBe('identify')
    expect(window.ire?.a?.[0]?.[1]).toMatchObject({
      customerId: 'user-123'
    })
  })
})
