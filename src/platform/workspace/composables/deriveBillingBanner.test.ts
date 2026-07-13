import { describe, expect, it } from 'vitest'

import type { BillingBannerInputs } from './useBillingBanner'
import { deriveBillingBanner } from './useBillingBanner'

const funded: BillingBannerInputs = {
  isTeamWorkspace: true,
  isLoaded: true,
  isActiveSubscription: true,
  billingStatus: 'paid',
  subscriptionStatus: 'active',
  hasFunds: true,
  isCancelled: false,
  endDate: null,
  canManage: true,
  outOfCreditsDismissed: false
}

function derive(overrides: Partial<BillingBannerInputs>) {
  return deriveBillingBanner({ ...funded, ...overrides })
}

describe('deriveBillingBanner', () => {
  it('shows no banner for a healthy funded team', () => {
    expect(derive({})).toBeNull()
  })

  it('shows no banner outside a team workspace', () => {
    expect(derive({ isTeamWorkspace: false, hasFunds: false })).toBeNull()
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

  it('prioritizes payment failure over out of credits for owners', () => {
    expect(derive({ billingStatus: 'payment_failed', hasFunds: false })).toBe(
      'paymentFailed'
    )
  })

  it('hides the owner-only payment-failed banner from members, falling through to out of credits', () => {
    expect(
      derive({
        billingStatus: 'payment_failed',
        hasFunds: false,
        canManage: false
      })
    ).toBe('outOfCredits')
  })

  it('shows nothing to a member whose only problem is payment failure', () => {
    expect(
      derive({ billingStatus: 'payment_failed', canManage: false })
    ).toBeNull()
  })

  it('prioritizes paused above everything, for owners and members', () => {
    expect(
      derive({
        subscriptionStatus: 'paused',
        billingStatus: 'payment_failed',
        hasFunds: false
      })
    ).toBe('paused')
    expect(derive({ subscriptionStatus: 'paused', canManage: false })).toBe(
      'paused'
    )
  })

  it('surfaces the ending banner for a cancelled-but-active owner', () => {
    expect(
      derive({
        subscriptionStatus: 'canceled',
        isCancelled: true,
        endDate: '2026-08-01T00:00:00Z'
      })
    ).toBe('ending')
  })

  it('does not show the ending banner until the end date is populated', () => {
    expect(
      derive({
        subscriptionStatus: 'canceled',
        isCancelled: true,
        endDate: null
      })
    ).toBeNull()
  })

  it('hides the ending banner from members', () => {
    expect(
      derive({
        subscriptionStatus: 'canceled',
        isCancelled: true,
        endDate: '2026-08-01T00:00:00Z',
        canManage: false
      })
    ).toBeNull()
  })

  it('shows no banner for an inactive subscription (that is a run-lock modal)', () => {
    expect(
      derive({ isActiveSubscription: false, subscriptionStatus: 'ended' })
    ).toBeNull()
  })
})
