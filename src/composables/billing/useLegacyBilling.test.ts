import { describe, expect, it, vi } from 'vitest'

import { useAuthActions } from '@/composables/auth/useAuthActions'

import { useLegacyBilling } from './useLegacyBilling'

vi.mock(import('firebase/auth'))

const mockSubscribe = vi.fn()
const mockSubscribeDirect = vi.fn()
const mockManageSubscription = vi.fn()

vi.mock<unknown>(
  import('@/platform/cloud/subscription/composables/useSubscription'),
  () => ({
    useSubscription: () => ({
      canAccessSubscriptionFeatures: { value: false },
      subscriptionTier: { value: null },
      subscriptionDuration: { value: null },
      subscriptionStatus: { value: null },
      isCancelled: { value: false },
      fetchStatus: vi.fn(),
      manageSubscription: mockManageSubscription,
      subscribe: mockSubscribe,
      subscribeDirect: mockSubscribeDirect,
      showSubscriptionDialog: vi.fn()
    })
  })
)

vi.mock(import('@/composables/auth/useAuthActions'))

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

  describe('when the billing portal tab is blocked', () => {
    const blocked = new Error('subscription.billingTabBlocked')

    it('rejects cancel so the dialog does not report success', async () => {
      mockManageSubscription.mockRejectedValueOnce(blocked)

      await expect(useLegacyBilling().cancelSubscription()).rejects.toBe(
        blocked
      )
    })

    it('reports manage subscription instead of rejecting', async () => {
      mockManageSubscription.mockRejectedValueOnce(blocked)

      await expect(
        useLegacyBilling().manageSubscription()
      ).resolves.toBeUndefined()
      expect(useAuthActions().reportError).toHaveBeenCalledWith(blocked)
    })
  })
})
