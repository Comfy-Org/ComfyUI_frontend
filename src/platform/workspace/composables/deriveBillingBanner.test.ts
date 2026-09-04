import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BillingBannerInputs } from './useBillingBanner'
import { deriveBillingBanner } from './useBillingBanner'

const funded: BillingBannerInputs = {
  billingControlEnabled: true,
  v1PaymentRecovery: true,
  isTeamPlan: true,
  isSalesManaged: false,
  isLoaded: true,
  canAccessSubscriptionFeatures: true,
  billingStatus: 'paid',
  hasFunds: true,
  isCancelled: false,
  endDate: null,
  canManage: true,
  outOfCreditsDismissed: false
}

// The backend folds billing_status into is_active, so every spend-denying status
// arrives paired with is_active=false. Pinning that pairing is what keeps these
// cases honest — spreading `funded` instead would assert an input the backend
// cannot emit, and pass no matter where the check sits.
const paused: Partial<BillingBannerInputs> = {
  billingStatus: 'paused',
  canAccessSubscriptionFeatures: false
}

const paymentFailed: Partial<BillingBannerInputs> = {
  billingStatus: 'payment_failed',
  canAccessSubscriptionFeatures: false
}

function derive(overrides: Partial<BillingBannerInputs>) {
  return deriveBillingBanner({ ...funded, ...overrides })
}

describe('deriveBillingBanner', () => {
  it('shows no banner for a healthy funded team', () => {
    expect(derive({})).toBeNull()
  })

  it('shows no banner outside a team plan', () => {
    expect(derive({ isTeamPlan: false, hasFunds: false })).toBeNull()
  })

  it('hides existing notices when billing control is rolled back', () => {
    expect(derive({ billingControlEnabled: false, hasFunds: false })).toBeNull()
  })

  it('keeps payment recovery independent from billing control', () => {
    expect(derive({ ...paymentFailed, billingControlEnabled: false })).toBe(
      'paymentFailed'
    )
  })

  it('hides payment recovery states when their flag is off', () => {
    expect(derive({ ...paymentFailed, v1PaymentRecovery: false })).toBeNull()
    expect(derive({ ...paused, v1PaymentRecovery: false })).toBeNull()
  })

  it('does not move existing notices onto the payment recovery flag', () => {
    expect(derive({ hasFunds: false, v1PaymentRecovery: false })).toBe(
      'outOfCredits'
    )
  })

  it('shows no banner until the subscription snapshot has loaded', () => {
    expect(derive({ isLoaded: false, hasFunds: false })).toBeNull()
  })

  it('surfaces out of credits when the balance is exhausted', () => {
    expect(derive({ hasFunds: false })).toBe('outOfCredits')
  })

  it('shows out of credits to members too', () => {
    expect(derive({ hasFunds: false, canManage: false })).toBe('outOfCredits')
  })

  it('hides out of credits once dismissed', () => {
    expect(derive({ hasFunds: false, outOfCreditsDismissed: true })).toBeNull()
  })

  it('shows payment failed to owners even though the backend reports the plan inactive', () => {
    expect(derive(paymentFailed)).toBe('paymentFailed')
  })

  it('prioritizes payment failure over out of credits for owners', () => {
    expect(derive({ ...paymentFailed, hasFunds: false })).toBe('paymentFailed')
  })

  it('hides payment failed from members, who get the run-lock modal instead', () => {
    expect(derive({ ...paymentFailed, canManage: false })).toBeNull()
  })

  it('prioritizes paused above everything, for owners and members', () => {
    expect(derive({ ...paused, hasFunds: false })).toBe('paused')
    expect(derive({ ...paused, canManage: false })).toBe('paused')
  })

  it('shows paused even though the backend reports the workspace inactive', () => {
    expect(derive(paused)).toBe('paused')
  })

  it('surfaces the ending banner for a cancelled-but-active owner', () => {
    expect(
      derive({
        isCancelled: true,
        endDate: '2026-08-01T00:00:00Z'
      })
    ).toBe('ending')
  })

  it('does not show the ending banner until the end date is populated', () => {
    expect(
      derive({
        isCancelled: true,
        endDate: null
      })
    ).toBeNull()
  })

  it('hides the ending banner from members', () => {
    expect(
      derive({
        isCancelled: true,
        endDate: '2026-08-01T00:00:00Z',
        canManage: false
      })
    ).toBeNull()
  })

  it('shows no banner for an inactive subscription (that is a run-lock modal)', () => {
    expect(
      derive({
        canAccessSubscriptionFeatures: false,
        billingStatus: 'inactive'
      })
    ).toBeNull()
  })

  describe('sales-managed ending notice window', () => {
    const NOW = new Date('2026-09-03T12:00:00Z')

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(NOW)
    })

    function daysFromNow(days: number): string {
      return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
    }

    const enterprise: Partial<BillingBannerInputs> = {
      isTeamPlan: false,
      isSalesManaged: true
    }

    it('stays quiet while the end date is beyond the notice window', () => {
      expect(
        derive({ ...enterprise, isCancelled: true, endDate: daysFromNow(30) })
      ).toBeNull()
    })

    it('surfaces the ending notice once the end date is near', () => {
      expect(
        derive({ ...enterprise, isCancelled: true, endDate: daysFromNow(10) })
      ).toBe('ending')
    })

    it('includes the window boundary itself', () => {
      expect(
        derive({ ...enterprise, isCancelled: true, endDate: daysFromNow(14) })
      ).toBe('ending')
    })

    it('hides the notice from members even inside the window', () => {
      expect(
        derive({
          ...enterprise,
          isCancelled: true,
          endDate: daysFromNow(10),
          canManage: false
        })
      ).toBeNull()
    })

    it('needs a populated end date, like the self-serve notice', () => {
      expect(derive({ ...enterprise, isCancelled: true })).toBeNull()
    })

    it('does not leak team-only banners into sales-managed workspaces', () => {
      expect(derive({ ...enterprise, hasFunds: false })).toBeNull()
      expect(
        derive({
          ...enterprise,
          billingStatus: 'paused',
          canAccessSubscriptionFeatures: false
        })
      ).toBeNull()
    })

    it('never applies the window to a self-serve team cancellation', () => {
      expect(derive({ isCancelled: true, endDate: daysFromNow(60) })).toBe(
        'ending'
      )
    })
  })
})
