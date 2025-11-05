import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'

// Create mocks
const mockIsLoggedIn = ref(false)
const mockReportError = vi.fn()
const mockAccessBillingPortal = vi.fn()
const mockShowSubscriptionRequiredDialog = vi.fn()
const mockGetAuthHeader = vi.fn(() =>
  Promise.resolve({ Authorization: 'Bearer test-token' })
)

// Mock dependencies
vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({
    isLoggedIn: mockIsLoggedIn
  }))
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => null)
}))

vi.mock('@/composables/auth/useFirebaseAuthActions', () => ({
  useFirebaseAuthActions: vi.fn(() => ({
    reportError: mockReportError,
    accessBillingPortal: mockAccessBillingPortal
  }))
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: vi.fn(() => ({
    wrapWithErrorHandlingAsync: vi.fn(
      (fn, errorHandler) =>
        async (...args: any[]) => {
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
  isCloud: true
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => ({
    showSubscriptionRequiredDialog: mockShowSubscriptionRequiredDialog
  }))
}))

vi.mock('@/stores/firebaseAuthStore', () => ({
  useFirebaseAuthStore: vi.fn(() => ({
    getAuthHeader: mockGetAuthHeader
  })),
  FirebaseAuthStoreError: class extends Error {}
}))

// Mock fetch
global.fetch = vi.fn()

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsLoggedIn.value = false
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
      const { isActiveSubscription, fetchStatus } = useSubscription()

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
      const { isActiveSubscription, fetchStatus } = useSubscription()

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
      const { formattedRenewalDate, fetchStatus } = useSubscription()

      await fetchStatus()
      // The date format may vary based on timezone, so we just check it's a valid date string
      expect(formattedRenewalDate.value).toMatch(/^[A-Za-z]{3} \d{1,2}, \d{4}$/)
      expect(formattedRenewalDate.value).toContain('2025')
      expect(formattedRenewalDate.value).toContain('Nov')
    })

    it('should return empty string when renewal date is not available', () => {
      const { formattedRenewalDate } = useSubscription()

      expect(formattedRenewalDate.value).toBe('')
    })

    it('should format monthly price correctly', () => {
      const { formattedMonthlyPrice } = useSubscription()

      expect(formattedMonthlyPrice.value).toBe('$20')
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
      const { fetchStatus } = useSubscription()

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

      const { fetchStatus } = useSubscription()

      await expect(fetchStatus()).rejects.toThrow()
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

      const { subscribe } = useSubscription()

      await subscribe()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers/cloud-subscription-checkout'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json'
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

      const { subscribe } = useSubscription()

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

      const { requireActiveSubscription } = useSubscription()

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

      const { requireActiveSubscription } = useSubscription()

      await requireActiveSubscription()

      expect(mockShowSubscriptionRequiredDialog).toHaveBeenCalled()
    })
  })

  describe('action handlers', () => {
    it('should open usage history URL', () => {
      const windowOpenSpy = vi
        .spyOn(window, 'open')
        .mockImplementation(() => null)

      const { handleViewUsageHistory } = useSubscription()
      handleViewUsageHistory()

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://platform.comfy.org/profile/usage',
        '_blank'
      )

      windowOpenSpy.mockRestore()
    })

    it('should open learn more URL', () => {
      const windowOpenSpy = vi
        .spyOn(window, 'open')
        .mockImplementation(() => null)

      const { handleLearnMore } = useSubscription()
      handleLearnMore()

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://docs.comfy.org',
        '_blank'
      )

      windowOpenSpy.mockRestore()
    })

    it('should call accessBillingPortal for invoice history', async () => {
      const { handleInvoiceHistory } = useSubscription()

      await handleInvoiceHistory()

      expect(mockAccessBillingPortal).toHaveBeenCalled()
    })

    it('should call accessBillingPortal for manage subscription', async () => {
      const { manageSubscription } = useSubscription()

      await manageSubscription()

      expect(mockAccessBillingPortal).toHaveBeenCalled()
    })
  })
})
