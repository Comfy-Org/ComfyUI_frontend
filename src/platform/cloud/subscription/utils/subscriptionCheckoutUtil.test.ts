import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive } from 'vue'

import { PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY } from '@/platform/cloud/subscription/utils/subscriptionCheckoutTracker'
import { performSubscriptionCheckout } from './subscriptionCheckoutUtil'

const {
  mockTelemetry,
  mockGetAuthHeader,
  mockUserId,
  mockIsCloud,
  mockGetCheckoutAttribution,
  mockLocalStorage
} = vi.hoisted(() => ({
  mockTelemetry: {
    trackBeginCheckout: vi.fn()
  },
  mockGetAuthHeader: vi.fn(() =>
    Promise.resolve({ Authorization: 'Bearer test-token' })
  ),
  mockUserId: { value: 'user-123' as string | undefined },
  mockIsCloud: { value: true },
  mockGetCheckoutAttribution: vi.fn(() => ({
    ga_client_id: 'ga-client-id',
    ga_session_id: 'ga-session-id',
    ga_session_number: 'ga-session-number',
    im_ref: 'impact-click-123',
    utm_source: 'impact',
    utm_medium: 'affiliate',
    utm_campaign: 'spring-launch',
    gclid: 'gclid-123',
    gbraid: 'gbraid-456',
    wbraid: 'wbraid-789'
  })),
  mockLocalStorage: (() => {
    const store = new Map<string, string>()

    return {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value)
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key)
      }),
      clear: vi.fn(() => {
        store.clear()
      }),
      __reset: () => {
        store.clear()
      }
    }
  })()
}))

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => mockTelemetry)
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() =>
    reactive({
      getAuthHeader: mockGetAuthHeader,
      userId: computed(() => mockUserId.value)
    })
  ),
  AuthStoreError: class extends Error {}
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock('@/platform/telemetry/utils/checkoutAttribution', () => ({
  getCheckoutAttribution: mockGetCheckoutAttribution
}))

global.fetch = vi.fn()

type Distribution = 'desktop' | 'localhost' | 'cloud'

const setDistribution = (distribution: Distribution) => {
  ;(
    globalThis as typeof globalThis & { __DISTRIBUTION__: Distribution }
  ).__DISTRIBUTION__ = distribution
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

describe('performSubscriptionCheckout', () => {
  beforeEach(() => {
    setDistribution('cloud')
    vi.clearAllMocks()
    mockIsCloud.value = true
    mockUserId.value = 'user-123'
    mockLocalStorage.__reset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setDistribution('localhost')
    mockLocalStorage.__reset()
  })

  it('tracks begin_checkout with user id and tier metadata', async () => {
    const checkoutUrl = 'https://checkout.stripe.com/test'
    const openSpy = vi
      .spyOn(window, 'open')
      .mockImplementation(() => window as unknown as Window)

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkout_url: checkoutUrl })
    } as Response)

    await performSubscriptionCheckout('pro', 'yearly')

    expect(mockTelemetry.trackBeginCheckout).toHaveBeenCalledWith({
      user_id: 'user-123',
      tier: 'pro',
      cycle: 'yearly',
      checkout_type: 'new',
      checkout_attempt_id: expect.any(String),
      ga_client_id: 'ga-client-id',
      ga_session_id: 'ga-session-id',
      ga_session_number: 'ga-session-number',
      im_ref: 'impact-click-123',
      utm_source: 'impact',
      utm_medium: 'affiliate',
      utm_campaign: 'spring-launch',
      gclid: 'gclid-123',
      gbraid: 'gbraid-456',
      wbraid: 'wbraid-789'
    })
    const beginCheckoutMetadata =
      mockTelemetry.trackBeginCheckout.mock.calls[0][0]
    const [, storedAttempt] = mockLocalStorage.setItem.mock.calls[0]
    expect(beginCheckoutMetadata.checkout_attempt_id).toBe(
      JSON.parse(storedAttempt).attempt_id
    )
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        '/customers/cloud-subscription-checkout/pro-yearly'
      ),
      expect.objectContaining({ method: 'POST' })
    )
    const requestBody = JSON.parse(
      vi.mocked(global.fetch).mock.calls[0][1]?.body as string
    )
    expect(requestBody).toEqual({
      ga_client_id: 'ga-client-id',
      ga_session_id: 'ga-session-id',
      ga_session_number: 'ga-session-number',
      im_ref: 'impact-click-123',
      utm_source: 'impact',
      utm_medium: 'affiliate',
      utm_campaign: 'spring-launch',
      gclid: 'gclid-123',
      gbraid: 'gbraid-456',
      wbraid: 'wbraid-789',
      checkout_attempt_id: expect.any(String)
    })
    // The id sent to the backend must be the same one on begin_checkout and
    // the persisted attempt — it is the funnel join key echoed back on the
    // server-side billing success events.
    expect(requestBody.checkout_attempt_id).toBe(
      beginCheckoutMetadata.checkout_attempt_id
    )
    expect(openSpy).toHaveBeenCalledWith(checkoutUrl, '_blank')
  })

  it('continues checkout when attribution collection fails', async () => {
    const checkoutUrl = 'https://checkout.stripe.com/test'
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    mockGetCheckoutAttribution.mockRejectedValueOnce(
      new Error('Attribution failed')
    )
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkout_url: checkoutUrl })
    } as Response)

    await performSubscriptionCheckout('pro', 'monthly')

    expect(warnSpy).toHaveBeenCalledWith(
      '[SubscriptionCheckout] Failed to collect checkout attribution',
      expect.any(Error)
    )
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/customers/cloud-subscription-checkout/pro'),
      expect.objectContaining({ method: 'POST' })
    )
    // Attribution failed, but the funnel join key is still sent.
    expect(
      JSON.parse(vi.mocked(global.fetch).mock.calls[0][1]?.body as string)
    ).toEqual({
      checkout_attempt_id: expect.any(String)
    })
    expect(mockTelemetry.trackBeginCheckout).toHaveBeenCalledWith({
      user_id: 'user-123',
      tier: 'pro',
      cycle: 'monthly',
      checkout_type: 'new',
      checkout_attempt_id: expect.any(String)
    })
    expect(openSpy).toHaveBeenCalledWith(checkoutUrl, '_blank')
  })

  it('carries the payment intent source into begin_checkout and the pending attempt', async () => {
    const checkoutUrl = 'https://checkout.stripe.com/test'
    const openSpy = vi
      .spyOn(window, 'open')
      .mockImplementation(() => window as unknown as Window)

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkout_url: checkoutUrl })
    } as Response)

    await performSubscriptionCheckout('pro', 'monthly', {
      paymentIntentSource: 'out_of_credits'
    })

    expect(mockTelemetry.trackBeginCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent_source: 'out_of_credits' })
    )
    const beginCheckoutMetadata =
      mockTelemetry.trackBeginCheckout.mock.calls[0][0]
    const [, storedAttempt] = mockLocalStorage.setItem.mock.calls[0]
    const pendingAttempt = JSON.parse(storedAttempt)
    expect(pendingAttempt).toMatchObject({
      payment_intent_source: 'out_of_credits'
    })
    expect(beginCheckoutMetadata.checkout_attempt_id).toBe(
      pendingAttempt.attempt_id
    )
    openSpy.mockRestore()
  })

  it('uses the latest userId when it changes after checkout starts', async () => {
    const checkoutUrl = 'https://checkout.stripe.com/test'
    const openSpy = vi
      .spyOn(window, 'open')
      .mockImplementation(() => window as unknown as Window)
    const authHeader = createDeferred<{ Authorization: string }>()

    mockUserId.value = 'user-early'
    mockGetAuthHeader.mockImplementationOnce(() => authHeader.promise)
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkout_url: checkoutUrl })
    } as Response)

    const checkoutPromise = performSubscriptionCheckout('pro', 'yearly')

    mockUserId.value = 'user-late'
    authHeader.resolve({ Authorization: 'Bearer test-token' })

    await checkoutPromise

    expect(mockTelemetry.trackBeginCheckout).toHaveBeenCalledTimes(1)
    expect(mockTelemetry.trackBeginCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-late',
        tier: 'pro',
        cycle: 'yearly',
        checkout_type: 'new',
        checkout_attempt_id: expect.any(String)
      })
    )
    expect(openSpy).toHaveBeenCalledWith(checkoutUrl, '_blank')
  })

  it('does not persist the pending attempt when the checkout popup is blocked', async () => {
    const checkoutUrl = 'https://checkout.stripe.com/test'
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkout_url: checkoutUrl })
    } as Response)

    await performSubscriptionCheckout('pro', 'monthly')

    expect(openSpy).toHaveBeenCalledWith(checkoutUrl, '_blank')
    const storedAttempt = window.localStorage.getItem(
      PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY
    )
    expect(storedAttempt).toBeNull()
    expect(mockLocalStorage.setItem).not.toHaveBeenCalled()
    expect(mockTelemetry.trackBeginCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        checkout_attempt_id: expect.any(String)
      })
    )
  })
})
