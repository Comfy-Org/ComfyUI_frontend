import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { performSubscriptionCheckout } from './subscriptionCheckoutUtil'

const { mockTelemetry, mockGetAuthHeader, mockUserId, mockIsCloud } =
  vi.hoisted(() => ({
    mockTelemetry: {
      trackBeginCheckout: vi.fn()
    },
    mockGetAuthHeader: vi.fn(() =>
      Promise.resolve({ Authorization: 'Bearer test-token' })
    ),
    mockUserId: { value: 'user-123' },
    mockIsCloud: { value: true }
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
      checkout_type: 'new'
    })
    expect(openSpy).toHaveBeenCalledWith(checkoutUrl, '_blank')
  })
})
