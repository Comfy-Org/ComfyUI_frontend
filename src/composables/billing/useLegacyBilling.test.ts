import { describe, expect, it, vi } from 'vitest'

import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useLegacyBilling } from './useLegacyBilling'

vi.mock(import('firebase/auth'))

vi.mock(import('@/platform/cloud/subscription/composables/useSubscription'))

vi.mock(import('@/composables/auth/useAuthActions'))

describe('useLegacyBilling', () => {
  describe('resubscribe', () => {
    it('performs the checkout via the unwrapped subscribeDirect', async () => {
      const billing = useLegacyBilling()

      await billing.resubscribe()

      expect(useSubscription().subscribeDirect).toHaveBeenCalledOnce()
      expect(useSubscription().subscribe).not.toHaveBeenCalled()
    })

    it('tags the attempt as a resubscribe and forwards the click-time source', async () => {
      const billing = useLegacyBilling()

      await billing.resubscribe({ source: 'settings_billing_panel' })

      expect(useSubscription().subscribeDirect).toHaveBeenCalledWith({
        operation: 'resubscribe',
        source: 'settings_billing_panel'
      })
    })

    it('propagates a checkout failure instead of swallowing it', async () => {
      vi.mocked(useSubscription().subscribeDirect).mockRejectedValue(
        new Error('checkout rejected')
      )
      const billing = useLegacyBilling()

      await expect(billing.resubscribe()).rejects.toThrow('checkout rejected')
    })
  })

  describe('subscribe', () => {
    it('still goes through the wrapped subscribe, unaffected by resubscribe', async () => {
      const billing = useLegacyBilling()

      await billing.subscribe('plan-slug')

      expect(useSubscription().subscribe).toHaveBeenCalledOnce()
      expect(useSubscription().subscribeDirect).not.toHaveBeenCalled()
    })
  })
})
