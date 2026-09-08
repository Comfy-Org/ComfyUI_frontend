import { describe, expect, it, vi } from 'vitest'

import { useLegacyBilling } from './useLegacyBilling'

const mockSubscribe = vi.fn()
const mockSubscribeDirect = vi.fn()

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    canAccessSubscriptionFeatures: { value: false },
    subscriptionTier: { value: null },
    subscriptionDuration: { value: null },
    subscriptionStatus: { value: null },
    isCancelled: { value: false },
    fetchStatus: vi.fn(),
    manageSubscription: vi.fn(),
    subscribe: mockSubscribe,
    subscribeDirect: mockSubscribeDirect,
    showSubscriptionDialog: vi.fn()
  })
}))

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => ({
    purchaseCredits: vi.fn()
  })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ balance: null })
}))

describe('useLegacyBilling', () => {
  describe('resubscribe', () => {
    it('performs the checkout via the unwrapped subscribeDirect', async () => {
      mockSubscribeDirect.mockResolvedValue(undefined)
      const billing = useLegacyBilling()

      await billing.resubscribe()

      expect(mockSubscribeDirect).toHaveBeenCalledOnce()
      expect(mockSubscribe).not.toHaveBeenCalled()
    })

    it('tags the attempt as a resubscribe and forwards the click-time source', async () => {
      mockSubscribeDirect.mockResolvedValue(undefined)
      const billing = useLegacyBilling()

      await billing.resubscribe({ source: 'settings_billing_panel' })

      expect(mockSubscribeDirect).toHaveBeenCalledWith({
        operation: 'resubscribe',
        source: 'settings_billing_panel'
      })
    })

    it('propagates a checkout failure instead of swallowing it', async () => {
      mockSubscribeDirect.mockRejectedValue(new Error('checkout rejected'))
      const billing = useLegacyBilling()

      await expect(billing.resubscribe()).rejects.toThrow('checkout rejected')
    })
  })

  describe('subscribe', () => {
    it('still goes through the wrapped subscribe, unaffected by resubscribe', async () => {
      mockSubscribe.mockResolvedValue(undefined)
      const billing = useLegacyBilling()

      await billing.subscribe('plan-slug')

      expect(mockSubscribe).toHaveBeenCalledOnce()
      expect(mockSubscribeDirect).not.toHaveBeenCalled()
    })
  })
})
