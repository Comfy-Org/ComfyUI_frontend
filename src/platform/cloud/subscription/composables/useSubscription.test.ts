import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'

const {
  mockIsLoggedIn,
  mockReportError,
  mockAccessBillingPortal,
  mockShowSubscriptionRequiredDialog,
  mockGetAuthHeader,
  mockGetCheckoutAttribution,
  mockTelemetry,
  mockUserId,
  mockIsCloud
} = vi.hoisted(() => ({
  mockIsLoggedIn: { value: false },
  mockIsCloud: { value: true },
  mockReportError: vi.fn(),
  mockAccessBillingPortal: vi.fn(),
  mockShowSubscriptionRequiredDialog: vi.fn(),
  mockGetAuthHeader: vi.fn(() =>
    Promise.resolve({ Authorization: 'Bearer test-token' })
  ),
  mockGetCheckoutAttribution: vi.fn(() => ({
    im_ref: 'impact-click-001',
    utm_source: 'impact'
  })),
  mockTelemetry: {
    trackSubscription: vi.fn(),
    trackMonthlySubscriptionSucceeded: vi.fn(),
    trackMonthlySubscriptionCancelled: vi.fn()
  },
  mockUserId: { value: 'user-123' }
}))

let scope: ReturnType<typeof effectScope> | undefined
type Distribution = 'desktop' | 'localhost' | 'cloud'

const setDistribution = (distribution: Distribution) => {
  ;(
    globalThis as typeof globalThis & { __DISTRIBUTION__: Distribution }
  ).__DISTRIBUTION__ = distribution
}

function useSubscriptionWithScope() {
  if (!scope) {
    throw new Error('Test scope not initialized')
  }

  const subscription = scope.run(() => useSubscription())
  if (!subscription) {
    throw new Error('Failed to initialize subscription composable')
  }

  return subscription
}

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({
    isLoggedIn: mockIsLoggedIn
  }))
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => mockTelemetry)
}))

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: vi.fn(() => ({
    reportError: mockReportError,
    accessBillingPortal: mockAccessBillingPortal
  }))
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: vi.fn(() => ({
    wrapWithErrorHandlingAsync: vi.fn(
      (fn, errorHandler) =>
        async (...args: Parameters<typeof fn>) => {
          try {
            return await fn(...args)
          } catch (error) {
            if (errorHandler) {
              errorHandler(error)
            }
            throw error
          }
        }
    )
  }))
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock('@/platform/telemetry/utils/checkoutAttribution', () => ({
  getCheckoutAttribution: mockGetCheckoutAttribution
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => ({
    showSubscriptionRequiredDialog: mockShowSubscriptionRequiredDialog
  }))
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    getAuthHeader: mockGetAuthHeader,
    get userId() {
      return mockUserId.value
    }
  })),
  AuthStoreError: class extends Error {}
}))

// Mock fetch
global.fetch = vi.fn()

describe('useSubscription', () => {
  afterEach(() => {
    scope?.stop()
    scope = undefined
    setDistribution('localhost')
  })

  beforeEach(() => {
    scope?.stop()
    scope = effectScope()
    setDistribution('cloud')

    vi.clearAllMocks()
    mockIsLoggedIn.value = false
    mockTelemetry.trackSubscription.mockReset()
    mockTelemetry.trackMonthlySubscriptionSucceeded.mockReset()
    mockTelemetry.trackMonthlySubscriptionCancelled.mockReset()
    mockUserId.value = 'user-123'
    mockIsCloud.value = true
    window.__CONFIG__ = {
      subscription_required: true
    } as typeof window.__CONFIG__
    localStorage.clear()
    vi.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input)

      if (url.includes('/customers/pending-subscription-success/')) {
        return {
          ok: true,
          status: 204
        } as Response
      }

      if (url.includes('/customers/pending-subscription-success')) {
        return {
          ok: true,
          status: 204
        } as Response
      }

      return {
        ok: true,
        json: async () => ({
          is_active: false,
          subscription_id: '',
          renewal_date: ''
        })
      } as Response
    })
  })

  describe('computed properties', () => {
    it('should compute isActiveSubscription correctly when subscription is active', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          is_active: true,
          subscription_id: 'sub_123',
          renewal_date: '2025-11-16'
        })
      } as Response)

      mockIsLoggedIn.value = true
      const { isActiveSubscription, fetchStatus } = useSubscriptionWithScope()

      await fetchStatus()
      expect(isActiveSubscription.value).toBe(true)
    })

    it('should compute isActiveSubscription as false when subscription is inactive', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          is_active: false,
          subscription_id: 'sub_123',
          renewal_date: '2025-11-16'
        })
      } as Response)

      mockIsLoggedIn.value = true
      const { isActiveSubscription, fetchStatus } = useSubscriptionWithScope()

      await fetchStatus()
      expect(isActiveSubscription.value).toBe(false)
    })

    it('should format renewal date correctly', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          is_active: true,
          subscription_id: 'sub_123',
          renewal_date: '2025-11-16T12:00:00Z'
        })
      } as Response)

      mockIsLoggedIn.value = true
      const { formattedRenewalDate, fetchStatus } = useSubscriptionWithScope()

      await fetchStatus()
      // The date format may vary based on timezone, so we just check it's a valid date string
      expect(formattedRenewalDate.value).toMatch(/^[A-Za-z]{3} \d{1,2}, \d{4}$/)
      expect(formattedRenewalDate.value).toContain('2025')
      expect(formattedRenewalDate.value).toContain('Nov')
    })

    it('should return empty string when renewal date is not available', () => {
      const { formattedRenewalDate } = useSubscriptionWithScope()

      expect(formattedRenewalDate.value).toBe('')
    })

    it('should return subscription tier from status', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          is_active: true,
          subscription_id: 'sub_123',
          subscription_tier: 'CREATOR',
          renewal_date: '2025-11-16T12:00:00Z'
        })
      } as Response)

      mockIsLoggedIn.value = true
      const { subscriptionTier, fetchStatus } = useSubscriptionWithScope()

      await fetchStatus()
      expect(subscriptionTier.value).toBe('CREATOR')
    })

    it('should return null when subscription tier is not available', () => {
      const { subscriptionTier } = useSubscriptionWithScope()

      expect(subscriptionTier.value).toBeNull()
    })
  })

  describe('fetchStatus', () => {
    it('should fetch subscription status successfully', async () => {
      const mockStatus = {
        is_active: true,
        subscription_id: 'sub_123',
        renewal_date: '2025-11-16'
      }

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockStatus
      } as Response)

      mockIsLoggedIn.value = true
      const { fetchStatus } = useSubscriptionWithScope()

      await fetchStatus()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers/cloud-subscription-status'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json'
          })
        })
      )
    })

    it('should handle fetch errors gracefully', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Subscription not found' })
      } as Response)

      const { fetchStatus } = useSubscriptionWithScope()

      await expect(fetchStatus()).rejects.toThrow()
    })

    it('syncs and consumes pending subscription success when requested', async () => {
      vi.mocked(global.fetch).mockImplementation(async (input) => {
        const url = String(input)

        if (url.includes('/customers/cloud-subscription-status')) {
          return {
            ok: true,
            json: async () => ({
              is_active: true,
              subscription_id: 'sub_123',
              renewal_date: '2025-11-16'
            })
          } as Response
        }

        if (url.endsWith('/customers/pending-subscription-success')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'event-123',
              transaction_id: 'stripe-event-123',
              value: 35,
              currency: 'USD',
              tier: 'creator',
              cycle: 'monthly',
              checkout_type: 'change',
              previous_tier: 'standard'
            })
          } as Response
        }

        if (
          url.endsWith(
            '/customers/pending-subscription-success/event-123/consume'
          )
        ) {
          return {
            ok: true,
            status: 204
          } as Response
        }

        throw new Error(`Unexpected fetch URL: ${url}`)
      })

      const { syncStatusAfterCheckout } = useSubscriptionWithScope()

      await syncStatusAfterCheckout()

      expect(
        mockTelemetry.trackMonthlySubscriptionSucceeded
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_id: 'stripe-event-123',
          value: 35,
          currency: 'USD',
          tier: 'creator',
          cycle: 'monthly',
          checkout_type: 'change',
          previous_tier: 'standard'
        })
      )
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          '/customers/pending-subscription-success/event-123/consume'
        ),
        expect.objectContaining({
          method: 'POST'
        })
      )
    })

    it('does not retrack a subscription success already delivered in this browser', async () => {
      localStorage.setItem(
        'comfy.subscription_success.delivered_transactions',
        JSON.stringify(['stripe-event-123'])
      )

      vi.mocked(global.fetch).mockImplementation(async (input) => {
        const url = String(input)

        if (url.includes('/customers/cloud-subscription-status')) {
          return {
            ok: true,
            json: async () => ({
              is_active: true,
              subscription_id: 'sub_123',
              renewal_date: '2025-11-16'
            })
          } as Response
        }

        if (url.endsWith('/customers/pending-subscription-success')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'event-123',
              transaction_id: 'stripe-event-123',
              value: 20,
              currency: 'USD',
              tier: 'standard',
              cycle: 'monthly',
              checkout_type: 'new'
            })
          } as Response
        }

        if (
          url.endsWith(
            '/customers/pending-subscription-success/event-123/consume'
          )
        ) {
          return {
            ok: true,
            status: 204
          } as Response
        }

        throw new Error(`Unexpected fetch URL: ${url}`)
      })

      const { syncStatusAfterCheckout } = useSubscriptionWithScope()

      await syncStatusAfterCheckout()

      expect(
        mockTelemetry.trackMonthlySubscriptionSucceeded
      ).not.toHaveBeenCalled()
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          '/customers/pending-subscription-success/event-123/consume'
        ),
        expect.objectContaining({
          method: 'POST'
        })
      )
    })
  })

  describe('subscribe', () => {
    it('should initiate subscription checkout successfully', async () => {
      const checkoutUrl = 'https://checkout.stripe.com/test'

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ checkout_url: checkoutUrl })
      } as Response)

      // Mock window.open
      const windowOpenSpy = vi
        .spyOn(window, 'open')
        .mockImplementation(() => null)

      const { subscribe } = useSubscriptionWithScope()

      await subscribe()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers/cloud-subscription-checkout'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            im_ref: 'impact-click-001',
            utm_source: 'impact'
          })
        })
      )

      expect(windowOpenSpy).toHaveBeenCalledWith(checkoutUrl, '_blank')

      windowOpenSpy.mockRestore()
    })

    it('should throw error when checkout URL is not returned', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({})
      } as Response)

      const { subscribe } = useSubscriptionWithScope()

      await expect(subscribe()).rejects.toThrow()
    })
  })

  describe('requireActiveSubscription', () => {
    it('should not show dialog when subscription is active', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          is_active: true,
          subscription_id: 'sub_123',
          renewal_date: '2025-11-16'
        })
      } as Response)

      const { requireActiveSubscription } = useSubscriptionWithScope()

      await requireActiveSubscription()

      expect(mockShowSubscriptionRequiredDialog).not.toHaveBeenCalled()
    })

    it('should show dialog when subscription is inactive', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          is_active: false,
          subscription_id: 'sub_123',
          renewal_date: '2025-11-16'
        })
      } as Response)

      const { requireActiveSubscription } = useSubscriptionWithScope()

      await requireActiveSubscription()

      expect(mockShowSubscriptionRequiredDialog).toHaveBeenCalled()
    })
  })

  describe('non-cloud environments', () => {
    it('should not fetch subscription status when not on cloud', async () => {
      mockIsCloud.value = false
      mockIsLoggedIn.value = true

      useSubscriptionWithScope()

      await vi.dynamicImportSettled()

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should report isActiveSubscription as true when not on cloud', () => {
      mockIsCloud.value = false

      const { isActiveSubscription } = useSubscriptionWithScope()

      expect(isActiveSubscription.value).toBe(true)
    })
  })

  describe('action handlers', () => {
    it('should open usage history URL', () => {
      const windowOpenSpy = vi
        .spyOn(window, 'open')
        .mockImplementation(() => null)

      const { handleViewUsageHistory } = useSubscriptionWithScope()
      handleViewUsageHistory()

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://stagingplatform.comfy.org/profile/usage',
        '_blank'
      )

      windowOpenSpy.mockRestore()
    })

    it('should open learn more URL', () => {
      const windowOpenSpy = vi
        .spyOn(window, 'open')
        .mockImplementation(() => null)

      const { handleLearnMore } = useSubscriptionWithScope()
      handleLearnMore()

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://docs.comfy.org',
        '_blank'
      )

      windowOpenSpy.mockRestore()
    })

    it('should call accessBillingPortal for invoice history', async () => {
      const { handleInvoiceHistory } = useSubscriptionWithScope()

      await handleInvoiceHistory()

      expect(mockAccessBillingPortal).toHaveBeenCalled()
    })

    it('should call accessBillingPortal for manage subscription', async () => {
      const { manageSubscription } = useSubscriptionWithScope()

      await manageSubscription()

      expect(mockAccessBillingPortal).toHaveBeenCalled()
    })

    it('tracks cancellation after manage subscription when status flips', async () => {
      vi.useFakeTimers()
      mockIsLoggedIn.value = true

      const activeResponse = {
        ok: true,
        json: async () => ({
          is_active: true,
          subscription_id: 'sub_active',
          renewal_date: '2025-11-16'
        })
      }

      const cancelledResponse = {
        ok: true,
        json: async () => ({
          is_active: false,
          subscription_id: 'sub_cancelled',
          renewal_date: '2025-11-16',
          end_date: '2025-12-01'
        })
      }

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(activeResponse as Response)
        .mockResolvedValueOnce(activeResponse as Response)
        .mockResolvedValueOnce(cancelledResponse as Response)

      try {
        const { fetchStatus, manageSubscription } = useSubscriptionWithScope()

        await fetchStatus()
        await manageSubscription()

        await vi.advanceTimersByTimeAsync(5000)

        expect(
          mockTelemetry.trackMonthlySubscriptionCancelled
        ).toHaveBeenCalledTimes(1)
      } finally {
        vi.useRealTimers()
      }
    })

    it('handles rapid focus events during cancellation polling', async () => {
      vi.useFakeTimers()
      mockIsLoggedIn.value = true

      const activeResponse = {
        ok: true,
        json: async () => ({
          is_active: true,
          subscription_id: 'sub_active',
          renewal_date: '2025-11-16'
        })
      }

      const cancelledResponse = {
        ok: true,
        json: async () => ({
          is_active: false,
          subscription_id: 'sub_cancelled',
          renewal_date: '2025-11-16',
          end_date: '2025-12-01'
        })
      }

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(activeResponse as Response)
        .mockResolvedValueOnce(activeResponse as Response)
        .mockResolvedValueOnce(cancelledResponse as Response)

      try {
        const { fetchStatus, manageSubscription } = useSubscriptionWithScope()

        await fetchStatus()
        await manageSubscription()

        window.dispatchEvent(new Event('focus'))
        await vi.waitFor(() => {
          expect(
            mockTelemetry.trackMonthlySubscriptionCancelled
          ).toHaveBeenCalledTimes(1)
        })
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
