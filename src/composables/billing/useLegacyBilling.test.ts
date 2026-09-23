import type { MockedFunction } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useLegacyBilling } from './useLegacyBilling'

vi.mock(import('firebase/auth'))

vi.mock(import('@/platform/cloud/subscription/composables/useSubscription'))

let mockSubscribe: MockedFunction<
  ReturnType<typeof useSubscription>['subscribe']
>
let mockSubscribeDirect: MockedFunction<
  ReturnType<typeof useSubscription>['subscribeDirect']
>

vi.mock(import('@/composables/auth/useAuthActions'))

describe('useLegacyBilling', () => {
  beforeEach(() => {
    const subscription = useSubscription()
    mockSubscribe = vi.mocked(subscription.subscribe)
    mockSubscribeDirect = vi.mocked(subscription.subscribeDirect)
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
