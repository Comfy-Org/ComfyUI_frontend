import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useLegacyBilling } from './useLegacyBilling'

const {
  mockCanAccessSubscriptionFeatures,
  mockSubscriptionTier,
  mockSubscriptionDuration,
  mockFormattedRenewalDate,
  mockFormattedEndDate,
  mockIsCancelled,
  mockFetchStatus,
  mockManageSubscription,
  mockSubscribe,
  mockShowSubscriptionDialog,
  mockBalance,
  mockFetchBalance
} = vi.hoisted(() => ({
  mockCanAccessSubscriptionFeatures: { value: true },
  mockSubscriptionTier: { value: 'PRO' as string | null },
  mockSubscriptionDuration: { value: 'MONTHLY' as string | null },
  mockFormattedRenewalDate: { value: 'Jan 1, 2025' },
  mockFormattedEndDate: { value: '' },
  mockIsCancelled: { value: false },
  mockFetchStatus: vi.fn().mockResolvedValue(undefined),
  mockManageSubscription: vi.fn().mockResolvedValue(undefined),
  mockSubscribe: vi.fn().mockResolvedValue(undefined),
  mockShowSubscriptionDialog: vi.fn(),
  mockBalance: {
    value: {
      amount_micros: 5000000,
      currency: 'usd',
      effective_balance_micros: 5000000,
      prepaid_balance_micros: 0,
      cloud_credit_balance_micros: 0
    } as {
      amount_micros?: number
      currency?: string
      effective_balance_micros?: number
      prepaid_balance_micros?: number
      cloud_credit_balance_micros?: number
    } | null
  },
  mockFetchBalance: vi.fn().mockResolvedValue({ amount_micros: 5000000 })
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    canAccessSubscriptionFeatures: mockCanAccessSubscriptionFeatures,
    subscriptionTier: mockSubscriptionTier,
    subscriptionDuration: mockSubscriptionDuration,
    formattedRenewalDate: mockFormattedRenewalDate,
    formattedEndDate: mockFormattedEndDate,
    isCancelled: mockIsCancelled,
    fetchStatus: mockFetchStatus,
    manageSubscription: mockManageSubscription,
    subscribe: mockSubscribe,
    showSubscriptionDialog: mockShowSubscriptionDialog
  })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    get balance() {
      return mockBalance.value
    },
    fetchBalance: mockFetchBalance
  })
}))

describe('useLegacyBilling', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockCanAccessSubscriptionFeatures.value = true
    mockSubscriptionTier.value = 'PRO'
    mockSubscriptionDuration.value = 'MONTHLY'
    mockFormattedRenewalDate.value = 'Jan 1, 2025'
    mockFormattedEndDate.value = ''
    mockIsCancelled.value = false
    mockBalance.value = {
      amount_micros: 5000000,
      currency: 'usd',
      effective_balance_micros: 5000000,
      prepaid_balance_micros: 0,
      cloud_credit_balance_micros: 0
    }
  })

  describe('canAccessSubscriptionFeatures', () => {
    it('returns true when subscription can access features', () => {
      mockCanAccessSubscriptionFeatures.value = true
      const { canAccessSubscriptionFeatures } = useLegacyBilling()
      expect(canAccessSubscriptionFeatures.value).toBe(true)
    })

    it('returns false when subscription cannot access features', () => {
      mockCanAccessSubscriptionFeatures.value = false
      const { canAccessSubscriptionFeatures } = useLegacyBilling()
      expect(canAccessSubscriptionFeatures.value).toBe(false)
    })
  })

  describe('isFreeTier', () => {
    it('returns true when subscription tier is FREE', () => {
      mockSubscriptionTier.value = 'FREE'
      const { isFreeTier } = useLegacyBilling()
      expect(isFreeTier.value).toBe(true)
    })

    it('returns false when subscription tier is not FREE', () => {
      mockSubscriptionTier.value = 'PRO'
      const { isFreeTier } = useLegacyBilling()
      expect(isFreeTier.value).toBe(false)
    })
  })

  describe('subscription', () => {
    it('returns subscription info when active', () => {
      const { subscription } = useLegacyBilling()
      expect(subscription.value).toEqual({
        isActive: true,
        tier: 'PRO',
        duration: 'MONTHLY',
        planSlug: null,
        renewalDate: 'Jan 1, 2025',
        endDate: null,
        isCancelled: false,
        hasFunds: true
      })
    })

    it('returns null when no subscription and no tier', () => {
      mockCanAccessSubscriptionFeatures.value = false
      mockSubscriptionTier.value = null
      const { subscription } = useLegacyBilling()
      expect(subscription.value).toBeNull()
    })

    it('returns subscription with endDate when cancelled', () => {
      mockIsCancelled.value = true
      mockFormattedEndDate.value = 'Feb 1, 2025'
      const { subscription } = useLegacyBilling()
      expect(subscription.value?.isCancelled).toBe(true)
      expect(subscription.value?.endDate).toBe('Feb 1, 2025')
    })

    it('returns hasFunds false when balance is zero', () => {
      mockBalance.value = { amount_micros: 0 }
      const { subscription } = useLegacyBilling()
      expect(subscription.value?.hasFunds).toBe(false)
    })
  })

  describe('balance', () => {
    it('returns balance info from auth store', () => {
      const { balance } = useLegacyBilling()
      expect(balance.value).toEqual({
        amountMicros: 5000000,
        currency: 'usd',
        effectiveBalanceMicros: 5000000,
        prepaidBalanceMicros: 0,
        cloudCreditBalanceMicros: 0
      })
    })

    it('returns null when no balance', () => {
      mockBalance.value = null
      const { balance } = useLegacyBilling()
      expect(balance.value).toBeNull()
    })

    it('handles missing optional balance fields', () => {
      mockBalance.value = { amount_micros: 1000 }
      const { balance } = useLegacyBilling()
      expect(balance.value).toEqual({
        amountMicros: 1000,
        currency: 'usd',
        effectiveBalanceMicros: 1000,
        prepaidBalanceMicros: 0,
        cloudCreditBalanceMicros: 0
      })
    })
  })

  describe('plans', () => {
    it('returns empty array (legacy has no plans)', () => {
      const { plans } = useLegacyBilling()
      expect(plans.value).toEqual([])
    })
  })

  describe('currentPlanSlug', () => {
    it('returns null (legacy has no plan slugs)', () => {
      const { currentPlanSlug } = useLegacyBilling()
      expect(currentPlanSlug.value).toBeNull()
    })
  })

  describe('initialize', () => {
    it('fetches status and balance', async () => {
      const { initialize } = useLegacyBilling()
      await initialize()
      expect(mockFetchStatus).toHaveBeenCalled()
      expect(mockFetchBalance).toHaveBeenCalled()
    })

    it('does not re-initialize if already initialized', async () => {
      const { initialize } = useLegacyBilling()
      await initialize()
      await initialize()
      expect(mockFetchStatus).toHaveBeenCalledTimes(1)
    })

    it('re-fetches balance for free tier with zero balance', async () => {
      mockSubscriptionTier.value = 'FREE'
      mockBalance.value = { amount_micros: 0 }
      const { initialize } = useLegacyBilling()
      await initialize()
      expect(mockFetchBalance).toHaveBeenCalledTimes(2)
    })

    it('sets error on failure', async () => {
      mockFetchStatus.mockRejectedValueOnce(new Error('Network error'))
      const { initialize, error } = useLegacyBilling()
      await expect(initialize()).rejects.toThrow('Network error')
      expect(error.value).toBe('Network error')
    })
  })

  describe('fetchStatus', () => {
    it('calls underlying fetchStatus', async () => {
      const { fetchStatus } = useLegacyBilling()
      await fetchStatus()
      expect(mockFetchStatus).toHaveBeenCalled()
    })

    it('sets error on failure', async () => {
      mockFetchStatus.mockRejectedValueOnce(new Error('Fetch failed'))
      const { fetchStatus, error } = useLegacyBilling()
      await expect(fetchStatus()).rejects.toThrow('Fetch failed')
      expect(error.value).toBe('Fetch failed')
    })
  })

  describe('fetchBalance', () => {
    it('calls auth store fetchBalance', async () => {
      const { fetchBalance } = useLegacyBilling()
      await fetchBalance()
      expect(mockFetchBalance).toHaveBeenCalled()
    })

    it('sets error on failure', async () => {
      mockFetchBalance.mockRejectedValueOnce(new Error('Balance fetch failed'))
      const { fetchBalance, error } = useLegacyBilling()
      await expect(fetchBalance()).rejects.toThrow('Balance fetch failed')
      expect(error.value).toBe('Balance fetch failed')
    })
  })

  describe('subscribe', () => {
    it('calls legacy subscribe', async () => {
      const { subscribe } = useLegacyBilling()
      await subscribe('pro-monthly')
      expect(mockSubscribe).toHaveBeenCalled()
    })
  })

  describe('previewSubscribe', () => {
    it('returns null (legacy does not support preview)', async () => {
      const { previewSubscribe } = useLegacyBilling()
      const result = await previewSubscribe('pro-monthly')
      expect(result).toBeNull()
    })
  })

  describe('manageSubscription', () => {
    it('calls legacy manageSubscription', async () => {
      const { manageSubscription } = useLegacyBilling()
      await manageSubscription()
      expect(mockManageSubscription).toHaveBeenCalled()
    })
  })

  describe('cancelSubscription', () => {
    it('calls legacy manageSubscription', async () => {
      const { cancelSubscription } = useLegacyBilling()
      await cancelSubscription()
      expect(mockManageSubscription).toHaveBeenCalled()
    })
  })

  describe('fetchPlans', () => {
    it('does nothing (legacy has no plans)', async () => {
      const { fetchPlans } = useLegacyBilling()
      await fetchPlans()
      // No error should be thrown
    })
  })

  describe('requireActiveSubscription', () => {
    it('does not show dialog when subscription can access features', async () => {
      mockCanAccessSubscriptionFeatures.value = true
      const { requireActiveSubscription } = useLegacyBilling()
      await requireActiveSubscription()
      expect(mockShowSubscriptionDialog).not.toHaveBeenCalled()
    })

    it('shows dialog when subscription cannot access features', async () => {
      mockCanAccessSubscriptionFeatures.value = false
      const { requireActiveSubscription } = useLegacyBilling()
      await requireActiveSubscription()
      expect(mockShowSubscriptionDialog).toHaveBeenCalled()
    })
  })

  describe('showSubscriptionDialog', () => {
    it('calls legacy showSubscriptionDialog', () => {
      const { showSubscriptionDialog } = useLegacyBilling()
      showSubscriptionDialog()
      expect(mockShowSubscriptionDialog).toHaveBeenCalled()
    })
  })
})
