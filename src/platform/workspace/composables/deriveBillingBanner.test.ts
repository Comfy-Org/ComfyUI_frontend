import { describe, expect, it } from 'vitest'

import type { BillingBannerInputs } from './useBillingBanner'
import { deriveBillingBanner } from './useBillingBanner'

const funded: BillingBannerInputs = {
  billingControlEnabled: true,
  isTeamPlan: true,
  isLoaded: true,
  isActiveSubscription: true,
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
  isActiveSubscription: false
}

const paymentFailed: Partial<BillingBannerInputs> = {
  billingStatus: 'payment_failed',
  isActiveSubscription: false
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

  it('shows no banner when billing control is rolled back, even out of credits', () => {
    expect(derive({ billingControlEnabled: false, hasFunds: false })).toBeNull()
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
      derive({ isActiveSubscription: false, billingStatus: 'inactive' })
    ).toBeNull()
  })
})
