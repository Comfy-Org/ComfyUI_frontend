import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useLegacyBilling } from './useLegacyBilling'

vi.mock(import('firebase/auth'))

vi.mock(import('@/platform/cloud/subscription/composables/useSubscription'))

let subscription: ReturnType<typeof useSubscription>

vi.mock(import('@/composables/auth/useAuthActions'))

describe('useLegacyBilling', () => {
  beforeEach(() => {
    subscription = vi.mocked(useSubscription())
  })

  describe('resubscribe', () => {
    it('performs the checkout via the unwrapped subscribeDirect', async () => {
      vi.mocked(subscription.subscribeDirect).mockResolvedValue(undefined)
      const billing = useLegacyBilling()

      await billing.resubscribe()

      expect(subscription.subscribeDirect).toHaveBeenCalledOnce()
      expect(subscription.subscribe).not.toHaveBeenCalled()
    })

    it('tags the attempt as a resubscribe and forwards the click-time source', async () => {
      vi.mocked(subscription.subscribeDirect).mockResolvedValue(undefined)
      const billing = useLegacyBilling()

      await billing.resubscribe({ source: 'settings_billing_panel' })

      expect(subscription.subscribeDirect).toHaveBeenCalledWith({
        operation: 'resubscribe',
        source: 'settings_billing_panel'
      })
    })

    it('propagates a checkout failure instead of swallowing it', async () => {
      vi.mocked(subscription.subscribeDirect).mockRejectedValue(
        new Error('checkout rejected')
      )
      const billing = useLegacyBilling()

      await expect(billing.resubscribe()).rejects.toThrow('checkout rejected')
    })
  })

  describe('subscribe', () => {
    it('still goes through the wrapped subscribe, unaffected by resubscribe', async () => {
      vi.mocked(subscription.subscribe).mockResolvedValue(undefined)
      const billing = useLegacyBilling()

      await billing.subscribe('plan-slug')

      expect(subscription.subscribe).toHaveBeenCalledOnce()
      expect(subscription.subscribeDirect).not.toHaveBeenCalled()
    })
  })
})
