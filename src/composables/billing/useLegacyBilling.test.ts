import type { UsageBalance } from '@comfyorg/ingest-types'
import { describe, expect, it, vi } from 'vitest'

import { useLegacyBilling } from './useLegacyBilling'

const mockSubscribe = vi.fn()
const mockSubscribeDirect = vi.fn()
const mockBalance = vi.hoisted(() => ({
  value: null as UsageBalance | null
}))

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
  useAuthStore: () => ({
    get balance() {
      return mockBalance.value
    }
  })
}))

describe('useLegacyBilling', () => {
  it('maps the server-authoritative cloud credit total', () => {
    mockBalance.value = {
      amount_micros: 7_000,
      currency: 'USD',
      cloud_credit_balance_micros: 2_000,
      cloud_credit_total_micros: 5_000,
      prepaid_balance_micros: 2_000
    }

    expect(useLegacyBilling().balance.value).toEqual({
      amountMicros: 7_000,
      currency: 'USD',
      effectiveBalanceMicros: 7_000,
      cloudCreditBalanceMicros: 2_000,
      cloudCreditTotalMicros: 5_000,
      prepaidBalanceMicros: 2_000
    })
  })

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
