import { describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { computed } from 'vue'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import { AuthStoreError, useAuthStore } from '@/stores/authStore'
import { useSubscription } from '@/platform/billing/subscription/composables/useSubscription'
import type {
  BillingStatusResponse,
  RenewalInvoice
} from '@/platform/workspace/api/workspaceApi'
import { useLegacyBilling } from './useLegacyBilling'

vi.mock(import('firebase/auth'))

vi.mock(import('@/platform/billing/subscription/composables/useSubscription'))

vi.mock(import('@/composables/auth/useAuthActions'))

const statusWith = (
  partial: Partial<BillingStatusResponse>
): BillingStatusResponse =>
  Object.assign(
    {
      is_active: true,
      has_funds: false,
      max_seats: 0,
      occupied_seats: 0,
      scheduled_change: null,
      team_credit_stop: null
    } satisfies BillingStatusResponse,
    partial
  )

const refusal = () =>
  new AuthStoreError('refused', 409, 'WORKSPACE_BILLING_REQUIRED')

describe('useLegacyBilling', () => {
  describe('renewalInvoice', () => {
    const invoice: RenewalInvoice = {
      amount_due: 2000,
      currency: 'usd',
      hosted_invoice_url: 'https://invoice.stripe.com/i/test'
    }

    // The shared mock always grants access; derive it from the status as the
    // real composable does.
    const useInactiveStatus = (status: BillingStatusResponse) => {
      const sub = useSubscription()
      sub.subscriptionStatus.value = status
      Object.assign(sub, {
        canAccessSubscriptionFeatures: computed(() => status.is_active)
      })
    }

    it('exposes the renewal invoice from the billing status', () => {
      useSubscription().subscriptionStatus.value = statusWith({
        renewal_invoice: invoice
      })

      expect(useLegacyBilling().renewalInvoice.value).toEqual(invoice)
    })

    it('maps the legacy Agent-scoped balance when the server reports it', () => {
      useSubscription().subscriptionStatus.value = statusWith({
        scoped_has_funds: { agent: false }
      })

      expect(useLegacyBilling().subscription.value?.agentScopedHasFunds).toBe(
        false
      )
    })

    it('uses the Agent-effective funds verdict for legacy admission', () => {
      useAuthStore().balance = { currency: 'usd', amount_micros: 1 }
      useSubscription().subscriptionStatus.value = statusWith({
        scoped_effective_has_funds: { agent: false }
      })

      expect(useLegacyBilling().subscription.value?.agentHasFunds).toBe(false)
    })

    it('keeps a tierless past-due status as a subscription', () => {
      useInactiveStatus(
        statusWith({
          is_active: false,
          billing_status: 'payment_failed',
          renewal_invoice: invoice
        })
      )

      expect(useLegacyBilling().subscription.value).not.toBeNull()
    })

    it('still nulls the subscription for an inactive tierless status without an invoice', () => {
      useInactiveStatus(statusWith({ is_active: false }))

      expect(useLegacyBilling().subscription.value).toBeNull()
    })

    it('is null when the billing status carries no renewal invoice', () => {
      useSubscription().subscriptionStatus.value = statusWith({})

      expect(useLegacyBilling().renewalInvoice.value).toBeNull()
    })
  })

  describe('funds', () => {
    type FundsCase = {
      name: string
      status: Partial<BillingStatusResponse>
      amountMicros: number
      hasFunds: boolean
      agentHasFunds: boolean
      agentScopedHasFunds: boolean | undefined
    }

    it.for<FundsCase>([
      {
        name: 'no funds on the server despite a positive total',
        status: { has_funds: false },
        amountMicros: 500,
        hasFunds: false,
        agentHasFunds: false,
        agentScopedHasFunds: undefined
      },
      {
        name: 'funds on the server despite a zero total',
        status: { has_funds: true },
        amountMicros: 0,
        hasFunds: true,
        agentHasFunds: true,
        agentScopedHasFunds: undefined
      },
      {
        name: 'a spent agent balance while shared credits remain',
        status: {
          has_funds: true,
          scoped_has_funds: { agent: false },
          scoped_effective_has_funds: { agent: true }
        },
        amountMicros: 500,
        hasFunds: true,
        agentHasFunds: true,
        agentScopedHasFunds: false
      },
      {
        name: 'agent funds from its own scoped balance',
        status: {
          has_funds: false,
          scoped_has_funds: { agent: true },
          scoped_effective_has_funds: { agent: true }
        },
        amountMicros: 0,
        hasFunds: false,
        agentHasFunds: true,
        agentScopedHasFunds: true
      }
    ])(
      'renders the server verdict: $name',
      ({
        status,
        amountMicros,
        hasFunds,
        agentHasFunds,
        agentScopedHasFunds
      }) => {
        useAuthStore().balance = {
          amount_micros: amountMicros,
          currency: 'usd'
        }
        useSubscription().subscriptionStatus.value = statusWith({
          has_funds: false,
          ...status
        })

        expect(useLegacyBilling().subscription.value).toMatchObject({
          hasFunds,
          agentHasFunds,
          agentScopedHasFunds
        })
      }
    )
  })

  describe('initialize', () => {
    it.for([
      {
        name: 'a free tier with a zero total',
        isFree: true,
        total: 0,
        reads: 2
      },
      { name: 'a free tier with credits', isFree: true, total: 500, reads: 1 },
      {
        name: 'a paid tier with a zero total',
        isFree: false,
        total: 0,
        reads: 1
      }
    ])(
      'reads the status $reads time(s) for $name',
      async ({ isFree, total, reads }) => {
        Object.assign(useSubscription(), {
          subscriptionTier: computed(() => (isFree ? 'FREE' : 'CREATOR'))
        })
        const store = useAuthStore()
        vi.mocked(store.fetchBalance).mockImplementation(async () => {
          store.balance = { amount_micros: total, currency: 'usd' }
          return store.balance
        })

        await useLegacyBilling().initialize()

        expect(useSubscription().fetchStatus).toHaveBeenCalledTimes(reads)
      }
    )
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
  })

  describe('topup', () => {
    it.for([
      { canAccess: true, purchases: [[5]] },
      { canAccess: false, purchases: [] }
    ])(
      'buys credits in dollars only when subscription features are available ($canAccess)',
      async ({ canAccess, purchases }) => {
        Object.assign(useSubscription(), {
          canAccessSubscriptionFeatures: computed(() => canAccess)
        })

        await useLegacyBilling().topup(500)

        expect(
          vi.mocked(useAuthActions().purchaseCreditsDirect).mock.calls
        ).toEqual(purchases)
      }
    )
  })

  describe('actions whose caller does not show a result', () => {
    it.for([
      {
        name: 'subscribe',
        rejecting: () => vi.mocked(useSubscription().subscribeDirect),
        run: (billing: ReturnType<typeof useLegacyBilling>) =>
          billing.subscribe('plan-slug'),
        resolved: undefined
      },
      {
        name: 'manageSubscription',
        rejecting: () => vi.mocked(useSubscription().manageSubscription),
        run: (billing: ReturnType<typeof useLegacyBilling>) =>
          billing.manageSubscription(),
        resolved: { ok: false, reason: 'failed' }
      }
    ])(
      'reports a failed $name once and resolves',
      async ({ rejecting, run, resolved }) => {
        const failure = new Error('request rejected')
        rejecting().mockRejectedValue(failure)

        await expect(run(useLegacyBilling())).resolves.toEqual(resolved)
        expect(useAuthActions().reportError).toHaveBeenCalledExactlyOnceWith(
          failure
        )
      }
    )
  })

  describe('cancelSubscription', () => {
    it('asks the portal to open on the cancel confirmation', async () => {
      vi.mocked(useSubscription().manageSubscription).mockResolvedValue(
        undefined
      )

      await useLegacyBilling().cancelSubscription()

      expect(useSubscription().manageSubscription).toHaveBeenCalledWith({
        cancelSubscription: true
      })
    })

    it('leaves manageSubscription without the cancel option', async () => {
      vi.mocked(useSubscription().manageSubscription).mockResolvedValue(
        undefined
      )

      await useLegacyBilling().manageSubscription()

      expect(useSubscription().manageSubscription).toHaveBeenCalledWith()
    })

    it('rejects a failed billing portal request without reporting it', async () => {
      const failure = new Error('portal down')
      vi.mocked(useSubscription().manageSubscription).mockRejectedValue(failure)

      await expect(useLegacyBilling().cancelSubscription()).rejects.toBe(
        failure
      )
      expect(useAuthActions().reportError).not.toHaveBeenCalled()
    })
  })

  describe('workspace billing required refusal', () => {
    type Billing = ReturnType<typeof useLegacyBilling>
    type RefusalCase = {
      name: string
      rejecting: () => Mock
      run: (billing: Billing) => Promise<unknown>
      resolved?: unknown
    }
    const retryMessage =
      "We couldn't update your subscription. Please try again."

    it.for<RefusalCase>([
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
        run: (billing) => billing.manageSubscription(),
        resolved: { ok: false, reason: 'failed' }
      }
    ])(
      'refreshes the status and reports once without retrying $name',
      async ({ rejecting, run, resolved }) => {
        rejecting().mockRejectedValue(refusal())

        await expect(run(useLegacyBilling())).resolves.toEqual(resolved)

        expect(rejecting()).toHaveBeenCalledOnce()
        expect(useSubscription().fetchStatusDirect).toHaveBeenCalledOnce()
        expect(useAuthActions().reportError).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ message: retryMessage })
        )
      }
    )

    it.for<RefusalCase>([
      {
        name: 'cancelSubscription',
        rejecting: () => vi.mocked(useSubscription().manageSubscription),
        run: (billing) => billing.cancelSubscription()
      },
      {
        name: 'resubscribe',
        rejecting: () => vi.mocked(useSubscription().subscribeDirect),
        run: (billing) => billing.resubscribe()
      }
    ])(
      'refreshes the status and rejects $name for its caller to show, without retrying',
      async ({ rejecting, run }) => {
        rejecting().mockRejectedValue(refusal())

        await expect(run(useLegacyBilling())).rejects.toThrow(retryMessage)

        expect(rejecting()).toHaveBeenCalledOnce()
        expect(useSubscription().fetchStatusDirect).toHaveBeenCalledOnce()
        expect(useAuthActions().reportError).not.toHaveBeenCalled()
      }
    )
  })
})
