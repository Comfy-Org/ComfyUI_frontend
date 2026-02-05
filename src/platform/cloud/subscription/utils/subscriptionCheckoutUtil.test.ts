import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { performSubscriptionCheckout } from './subscriptionCheckoutUtil'

const {
  mockTelemetry,
  mockGetAuthHeader,
  mockUserId,
  mockIsCloud,
  mockGetCheckoutAttribution
} = vi.hoisted(() => ({
  mockTelemetry: {
    trackBeginCheckout: vi.fn()
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
    gclid: 'gclid-123',
    gbraid: 'gbraid-456',
    wbraid: 'wbraid-789'
  }))
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => mockTelemetry)
}))

vi.mock('@/stores/firebaseAuthStore', () => ({
  useFirebaseAuthStore: vi.fn(() => ({
    getFirebaseAuthHeader: mockGetAuthHeader,
    get userId() {
      return mockUserId.value
    }
  })),
  FirebaseAuthStoreError: class extends Error {}
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

describe('performSubscriptionCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsCloud.value = true
    mockUserId.value = 'user-123'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('tracks begin_checkout with user id and tier metadata', async () => {
    const checkoutUrl = 'https://checkout.stripe.com/test'
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ checkout_url: checkoutUrl })
    } as Response)

    await performSubscriptionCheckout('pro', 'yearly', true)

    expect(mockTelemetry.trackBeginCheckout).toHaveBeenCalledWith({
      user_id: 'user-123',
      tier: 'pro',
      cycle: 'yearly',
      checkout_type: 'new',
      ga_client_id: 'ga-client-id',
      ga_session_id: 'ga-session-id',
      ga_session_number: 'ga-session-number',
      gclid: 'gclid-123',
      gbraid: 'gbraid-456',
      wbraid: 'wbraid-789'
    })
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
          gclid: 'gclid-123',
          gbraid: 'gbraid-456',
          wbraid: 'wbraid-789'
        })
      })
    )
    expect(openSpy).toHaveBeenCalledWith(checkoutUrl, '_blank')
  })
})
