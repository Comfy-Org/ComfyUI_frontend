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
  mockLocalStorage,
  mockReportError
} = vi.hoisted(() => ({
  mockTelemetry: {
    trackBeginCheckout: vi.fn(),
    trackBillingEvent: vi.fn()
  },
  mockGetAuthHeader: vi.fn(() =>
    Promise.resolve({ Authorization: 'Bearer test-token' })
  ),
  mockUserId: { value: 'user-123' },
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
  mockReportError: vi.fn(),
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

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mockReportError
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() =>
    reactive({
      getFirebaseAuthHeader: mockGetAuthHeader,
      fetchWithCustomerRecovery: (input: string, init?: RequestInit) =>
        fetch(input, init),
      userId: computed(() => mockUserId.value)
    })
  ),
  AuthStoreError: class extends Error {
    readonly status: number | undefined
    constructor(message: string, status?: number) {
      super(message)
      this.status = status
    }
  }
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
    mockIsCloud.value = true
    mockUserId.value = 'user-123'
    mockLocalStorage.__reset()
  })

  afterEach(() => {
    setDistribution('localhost')
    mockLocalStorage.__reset()
  })

  it('tracks begin_checkout with user id and tier metadata', async () => {
    const checkoutUrl = 'https://checkout.stripe.com/test'
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => window)

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
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
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
      })
    )
    expect(openSpy).toHaveBeenCalledWith(checkoutUrl, '_blank')
    expect(mockReportError).not.toHaveBeenCalled()
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
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({})
      })
    )
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
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => window)

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
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => window)
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
    expect(mockReportError).toHaveBeenCalledTimes(1)
    expect(mockReportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Subscription checkout popup was blocked'
      }),
      {
        errorType: 'cloud_checkout_popup_blocked',
        tags: {
          failure_kind: 'bad_state',
          feature_area: 'cloud',
          operation: 'navigate',
          outcome: 'aborted',
          assert_mode: 'soft'
        },
        context: {
          checkout_type: 'new',
          open_in_new_tab: true
        },
        level: 'error'
      }
    )
  })

  it('reports checkout-initiation failure via trackBillingEvent, so the marketing deep link inherits it too', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ message: 'declined for person@example.com' }),
      text: async () => ''
    } as Response)

    await expect(
      performSubscriptionCheckout('pro', 'yearly', {
        paymentIntentSource: 'deep_link'
      })
    ).rejects.toThrow()

    expect(mockTelemetry.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'subscription_checkout',
      stage: 'failed',
      outcome: 'failure',
      tier: 'pro',
      cycle: 'yearly',
      checkout_type: 'new',
      payment_intent_source: 'deep_link',
      failure_category: 'api_rejected'
    })
  })
})
