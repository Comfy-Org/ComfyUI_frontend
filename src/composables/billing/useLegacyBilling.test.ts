import { describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import { AuthStoreError, useAuthStore } from '@/stores/authStore'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useLegacyBilling } from './useLegacyBilling'

vi.mock(import('firebase/auth'))

vi.mock(import('@/platform/cloud/subscription/composables/useSubscription'))

vi.mock(import('@/composables/auth/useAuthActions'))

const refusal = () =>
  new AuthStoreError('refused', 409, 'WORKSPACE_BILLING_REQUIRED')

describe('useLegacyBilling', () => {
  it('maps the server-authoritative cloud credit total', () => {
    useAuthStore().balance = {
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
    it('performs the checkout via the unwrapped subscribeDirect', async () => {
      await useLegacyBilling().subscribe('plan-slug')

      expect(useSubscription().subscribeDirect).toHaveBeenCalledOnce()
      expect(useSubscription().subscribe).not.toHaveBeenCalled()
    })

    it('reports a failed subscribe once and resolves', async () => {
      const failure = new Error('checkout rejected')
      vi.mocked(useSubscription().subscribeDirect).mockRejectedValue(failure)

      await expect(
        useLegacyBilling().subscribe('plan-slug')
      ).resolves.toBeUndefined()
      expect(useAuthActions().reportError).toHaveBeenCalledExactlyOnceWith(
        failure
      )
    })
  })

  describe('workspace billing required refusal', () => {
    type Billing = ReturnType<typeof useLegacyBilling>
    const cases: {
      name: string
      rejecting: () => Mock
      run: (billing: Billing) => Promise<unknown>
    }[] = [
      {
        name: 'topup',
        rejecting: () => vi.mocked(useAuthActions().purchaseCreditsDirect),
        run: (billing) => billing.topup(500)
      },
      {
        name: 'subscribe',
        rejecting: () => vi.mocked(useSubscription().subscribeDirect),
        run: (billing) => billing.subscribe('plan')
      },
      {
        name: 'manageSubscription',
        rejecting: () => vi.mocked(useSubscription().manageSubscription),
        run: (billing) => billing.manageSubscription()
      },
      {
        name: 'resubscribe',
        rejecting: () => vi.mocked(useSubscription().subscribeDirect),
        run: (billing) => billing.resubscribe()
      }
    ]

    it.for(cases)(
      'refreshes the status and reports once without retrying $name',
      async ({ rejecting, run }) => {
        rejecting().mockRejectedValue(refusal())

        await expect(run(useLegacyBilling())).resolves.toBeUndefined()

        expect(rejecting()).toHaveBeenCalledOnce()
        expect(useSubscription().fetchStatusDirect).toHaveBeenCalledOnce()
        expect(useAuthActions().reportError).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            message: "We couldn't update your subscription. Please try again."
          })
        )
      }
    )
  })
})
