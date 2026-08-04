import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY } from '@/platform/cloud/subscription/utils/subscriptionCheckoutTracker'

const {
  mockIsLoggedIn,
  mockReportError,
  mockAccessBillingPortal,
  mockShowSubscriptionRequiredDialog,
  mockGetAuthHeader,
  mockGetCheckoutAttribution,
  mockTelemetry,
  mockUserId,
  mockIsCloud,
  mockAuthStoreInitialized,
  mockGetBillingStatus,
  mockLocalStorage
} = vi.hoisted(() => ({
  mockIsLoggedIn: { value: false },
  mockIsCloud: { value: true },
  mockAuthStoreInitialized: { value: true },
  mockGetBillingStatus: vi.fn(),
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
  mockUserId: { value: 'user-123' },
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

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

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

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: {
    getBillingStatus: mockGetBillingStatus
  }
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => ({
    showSubscriptionRequiredDialog: mockShowSubscriptionRequiredDialog
  }))
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    getAuthHeader: mockGetAuthHeader,
    fetchWithCustomerRecovery: (input: string, init?: RequestInit) =>
      fetch(input, init),
    get isInitialized() {
      return mockAuthStoreInitialized.value
    },
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
    vi.useRealTimers()
    scope?.stop()
    scope = undefined
    setDistribution('localhost')
    mockLocalStorage.__reset()
  })

  beforeEach(() => {
    scope?.stop()
    scope = effectScope()
    setDistribution('cloud')

    vi.clearAllMocks()
    mockLocalStorage.__reset()
    mockIsLoggedIn.value = false
    mockTelemetry.trackSubscription.mockReset()
    mockTelemetry.trackMonthlySubscriptionSucceeded.mockReset()
    mockTelemetry.trackMonthlySubscriptionCancelled.mockReset()
    mockAccessBillingPortal.mockReset()
    mockAccessBillingPortal.mockResolvedValue(true)
    mockUserId.value = 'user-123'
    mockIsCloud.value = true
    mockAuthStoreInitialized.value = true
    mockGetBillingStatus.mockResolvedValue({
      is_active: false,
      has_funds: false,
      team_credit_stop: null
    })
    window.__CONFIG__ = {
      subscription_required: true
    } as typeof window.__CONFIG__
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        is_active: false,
        subscription_id: '',
        renewal_date: ''
      })
    } as Response)
  })

  describe('computed properties', () => {
    it('should compute canAccessSubscriptionFeatures correctly when subscription is active', async () => {
      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        max_seats: 1,
        occupied_seats: 1,
        renewal_date: '2025-11-16'
      })

      mockIsLoggedIn.value = true
      const { canAccessSubscriptionFeatures, fetchStatus } =
        useSubscriptionWithScope()

      await fetchStatus()
      expect(canAccessSubscriptionFeatures.value).toBe(true)
    })

    it('should compute canAccessSubscriptionFeatures as false when subscription is inactive', async () => {
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: true,
        max_seats: 1,
        occupied_seats: 1,
        renewal_date: '2025-11-16'
      })

      mockIsLoggedIn.value = true
      const { canAccessSubscriptionFeatures, fetchStatus } =
        useSubscriptionWithScope()

      await fetchStatus()
      expect(canAccessSubscriptionFeatures.value).toBe(false)
    })

    it('should format renewal date correctly', async () => {
      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        renewal_date: '2025-11-16T12:00:00Z'
      })

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
      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        subscription_tier: 'CREATOR',
        renewal_date: '2025-11-16T12:00:00Z'
      })

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
        has_funds: true,
        renewal_date: '2025-11-16',
        team_credit_stop: null
      }

      mockGetBillingStatus.mockResolvedValue(mockStatus)

      mockIsLoggedIn.value = true
      const { fetchStatus } = useSubscriptionWithScope()

      await fetchStatus()

      expect(mockGetBillingStatus).toHaveBeenCalledOnce()
    })

    it('should handle fetch errors gracefully', async () => {
      mockGetBillingStatus.mockRejectedValue(
        new Error('Subscription not found')
      )

      const { fetchStatus } = useSubscriptionWithScope()

      await expect(fetchStatus()).rejects.toThrow()
    })

    it('coalesces concurrent callers into one fetch', async () => {
      let resolveStatus: (value: {
        is_active: boolean
        has_funds: boolean
      }) => void = () => {}
      mockGetBillingStatus.mockReturnValue(
        new Promise((resolve) => {
          resolveStatus = resolve
        })
      )
      const { fetchStatus } = useSubscriptionWithScope()

      const first = fetchStatus()
      const second = fetchStatus()
      resolveStatus({ is_active: true, has_funds: true })
      await Promise.all([first, second])

      expect(mockGetBillingStatus).toHaveBeenCalledTimes(1)
    })

    it('does not downgrade known-good status on a failed fetch', async () => {
      mockGetBillingStatus.mockResolvedValueOnce({
        is_active: true,
        has_funds: true,
        max_seats: 1,
        occupied_seats: 1
      })
      const { fetchStatus, canAccessSubscriptionFeatures } =
        useSubscriptionWithScope()
      await fetchStatus()
      expect(canAccessSubscriptionFeatures.value).toBe(true)

      mockGetBillingStatus.mockRejectedValueOnce(new Error('Invalid token'))
      await fetchStatus().catch(() => {})

      expect(canAccessSubscriptionFeatures.value).toBe(true)
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
        .mockImplementation(() => window as unknown as Window)

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
      expect(
        JSON.parse(
          localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY) ??
            '{}'
        )
      ).toMatchObject({
        tier: 'standard',
        cycle: 'monthly',
        checkout_type: 'new'
      })

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

  describe('pending checkout recovery', () => {
    it('emits subscription_success when a pending new subscription becomes active', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-123',
          started_at_ms: Date.now(),
          tier: 'creator',
          cycle: 'yearly',
          checkout_type: 'new'
        })
      )

      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        subscription_tier: 'CREATOR',
        subscription_duration: 'ANNUAL',
        renewal_date: '2025-11-16'
      })

      mockIsLoggedIn.value = true
      useSubscriptionWithScope()

      await vi.waitFor(() => {
        expect(
          mockTelemetry.trackMonthlySubscriptionSucceeded
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: 'user-123',
            checkout_attempt_id: 'attempt-123',
            tier: 'creator',
            cycle: 'yearly',
            checkout_type: 'new',
            value: 336,
            currency: 'USD'
          })
        )
      })
      expect(
        localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
      ).toBeNull()
    })

    it('emits subscription_success when a pending upgrade reaches the target tier', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-456',
          started_at_ms: Date.now(),
          tier: 'pro',
          cycle: 'monthly',
          checkout_type: 'change',
          previous_tier: 'creator',
          previous_cycle: 'monthly'
        })
      )

      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        subscription_tier: 'PRO',
        subscription_duration: 'MONTHLY',
        renewal_date: '2025-11-16'
      })

      mockIsLoggedIn.value = true
      useSubscriptionWithScope()

      await vi.waitFor(() => {
        expect(
          mockTelemetry.trackMonthlySubscriptionSucceeded
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            checkout_attempt_id: 'attempt-456',
            tier: 'pro',
            cycle: 'monthly',
            checkout_type: 'change',
            previous_tier: 'creator',
            value: 100
          })
        )
      })
    })

    it('rechecks pending checkout attempts on status refresh', async () => {
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: false,
        renewal_date: ''
      })

      const { fetchStatus } = useSubscriptionWithScope()
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-visible',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )

      await fetchStatus()

      await vi.waitFor(() => {
        expect(mockGetBillingStatus).toHaveBeenCalledTimes(1)
      })
    })

    it('does not clear pending attempts before auth initialization resolves', async () => {
      mockAuthStoreInitialized.value = false
      mockIsLoggedIn.value = false

      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-pre-auth',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )

      useSubscriptionWithScope()

      await vi.waitFor(() => {
        expect(
          localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
        ).not.toBeNull()
      })
    })

    it('clears pending checkout attempts when initialized while logged out', async () => {
      localStorage.setItem(
        PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          attempt_id: 'attempt-logout',
          started_at_ms: Date.now(),
          tier: 'standard',
          cycle: 'monthly',
          checkout_type: 'new'
        })
      )

      mockIsLoggedIn.value = false
      useSubscriptionWithScope()

      await vi.waitFor(() => {
        expect(
          localStorage.getItem(PENDING_SUBSCRIPTION_CHECKOUT_STORAGE_KEY)
        ).toBeNull()
      })
    })
  })

  describe('requireActiveSubscription', () => {
    it('should not show dialog when subscription is active', async () => {
      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        renewal_date: '2025-11-16'
      })

      const { requireActiveSubscription } = useSubscriptionWithScope()

      await requireActiveSubscription()

      expect(mockShowSubscriptionRequiredDialog).not.toHaveBeenCalled()
    })

    it('should show dialog when subscription is inactive', async () => {
      mockGetBillingStatus.mockResolvedValue({
        is_active: false,
        has_funds: true,
        renewal_date: '2025-11-16'
      })

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

    it('should report canAccessSubscriptionFeatures as true when not on cloud', () => {
      mockIsCloud.value = false

      const { canAccessSubscriptionFeatures } = useSubscriptionWithScope()

      expect(canAccessSubscriptionFeatures.value).toBe(true)
    })

    it('does not perform explicit subscription status reads outside Cloud', async () => {
      mockIsCloud.value = false
      const { fetchStatus } = useSubscriptionWithScope()

      await fetchStatus()

      expect(mockGetBillingStatus).not.toHaveBeenCalled()
      expect(global.fetch).not.toHaveBeenCalled()
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

    it('does not start cancellation watching when the billing portal does not open', async () => {
      vi.useFakeTimers()
      mockIsLoggedIn.value = true
      mockAccessBillingPortal.mockResolvedValueOnce(false)

      mockGetBillingStatus.mockResolvedValue({
        is_active: true,
        has_funds: true,
        renewal_date: '2025-11-16'
      })

      try {
        const { fetchStatus, manageSubscription } = useSubscriptionWithScope()

        await fetchStatus()
        mockGetBillingStatus.mockClear()

        await manageSubscription()
        await vi.advanceTimersByTimeAsync(5000)

        expect(mockGetBillingStatus).not.toHaveBeenCalled()
        expect(
          mockTelemetry.trackMonthlySubscriptionCancelled
        ).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })

    it('tracks cancellation after manage subscription when status flips', async () => {
      vi.useFakeTimers()
      mockIsLoggedIn.value = true

      const activeStatus = {
        is_active: true,
        has_funds: true,
        renewal_date: '2025-11-16'
      }

      const cancelledStatus = {
        is_active: false,
        has_funds: true,
        renewal_date: '2025-11-16',
        cancel_at: '2025-12-01'
      }

      mockGetBillingStatus
        .mockResolvedValueOnce(activeStatus)
        .mockResolvedValueOnce(cancelledStatus)

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

      const activeStatus = {
        is_active: true,
        has_funds: true,
        renewal_date: '2025-11-16'
      }

      const cancelledStatus = {
        is_active: false,
        has_funds: true,
        renewal_date: '2025-11-16',
        cancel_at: '2025-12-01'
      }

      mockGetBillingStatus
        .mockResolvedValueOnce(activeStatus)
        .mockResolvedValueOnce(cancelledStatus)

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
