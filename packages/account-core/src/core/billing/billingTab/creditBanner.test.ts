import { describe, expect, it } from 'vitest'

import type { LocalCreditBannerInput } from './creditBanner'
import { deriveLocalCreditBanner } from './creditBanner'

const open: LocalCreditBannerInput = {
  unifiedBillingSettingsEnabled: true,
  isCloud: false,
  isActive: false,
  subscriptionState: null,
  hasFunds: true,
  lowBalance: undefined,
  outOfCreditsDismissed: false,
  lowCreditsDismissed: false,
  autoTopUp: null
}

function derive(overrides: Partial<LocalCreditBannerInput>) {
  return deriveLocalCreditBanner({ ...open, ...overrides })
}

describe('deriveLocalCreditBanner', () => {
  it('stays hidden on cloud until the served plan is active', () => {
    expect(
      derive({
        isCloud: true,
        isActive: false,
        hasFunds: false,
        lowBalance: true
      })
    ).toBeNull()
  })

  it.for([
    {
      name: 'out of credits',
      input: { isCloud: true, isActive: true, hasFunds: false },
      expected: 'outOfCredits' as const
    },
    {
      name: 'low credits',
      input: { isCloud: true, isActive: true, lowBalance: true },
      expected: 'lowCredits' as const
    }
  ])(
    'shows the $name cloud banner when the served plan is active',
    ({ input, expected }) => {
      expect(derive(input)).toBe(expected)
    }
  )

  it.for([
    { subscriptionState: 'never_subscribed', isActive: true, open: false },
    { subscriptionState: 'paused', isActive: true, open: false },
    { subscriptionState: 'past_due', isActive: true, open: false },
    { subscriptionState: 'ended', isActive: true, open: false },
    { subscriptionState: 'activating', isActive: true, open: false },
    { subscriptionState: 'active', isActive: false, open: true },
    { subscriptionState: 'cancel_scheduled', isActive: false, open: true },
    { subscriptionState: null, isActive: true, open: true },
    { subscriptionState: null, isActive: false, open: false }
  ] as const)(
    'opens cloud credit banners for served state $subscriptionState with is_active $isActive: $open',
    ({ subscriptionState, isActive, open }) => {
      const cloud = { isCloud: true, isActive, subscriptionState }
      expect(derive({ ...cloud, hasFunds: false })).toBe(
        open ? 'outOfCredits' : null
      )
      expect(derive({ ...cloud, lowBalance: true })).toBe(
        open ? 'lowCredits' : null
      )
    }
  )

  it('keeps local credit banners on a never-subscribed workspace', () => {
    expect(
      derive({
        isCloud: false,
        isActive: true,
        subscriptionState: 'never_subscribed',
        hasFunds: false
      })
    ).toBe('outOfCredits')
  })

  it('stays hidden when unified billing settings is off', () => {
    expect(
      derive({
        unifiedBillingSettingsEnabled: false,
        hasFunds: false,
        lowBalance: true
      })
    ).toBeNull()
  })

  it('keeps local credit banners when the plan is not active', () => {
    expect(derive({ isCloud: false, isActive: false, hasFunds: false })).toBe(
      'outOfCredits'
    )
  })

  it.for([
    { lowBalance: undefined, kind: null },
    { lowBalance: false, kind: null },
    { lowBalance: true, kind: 'lowCredits' as const }
  ])('reads low_balance $lowBalance as $kind', ({ lowBalance, kind }) => {
    expect(derive({ lowBalance })).toBe(kind)
  })

  it('ranks out of credits above low credits', () => {
    expect(derive({ hasFunds: false, lowBalance: true })).toBe('outOfCredits')
  })

  it('shows low credits once out of credits is dismissed', () => {
    expect(
      derive({
        hasFunds: false,
        lowBalance: true,
        outOfCreditsDismissed: true
      })
    ).toBe('lowCredits')
  })

  it('hides a dismissed low-credits banner', () => {
    expect(derive({ lowBalance: true, lowCreditsDismissed: true })).toBeNull()
  })

  it.for([
    { hasFunds: false, lowBalance: true, outOfCreditsDismissed: false },
    { hasFunds: false, lowBalance: false, outOfCreditsDismissed: false },
    { hasFunds: false, lowBalance: true, outOfCreditsDismissed: true },
    { hasFunds: true, lowBalance: true, outOfCreditsDismissed: false },
    { hasFunds: true, lowBalance: false, outOfCreditsDismissed: false }
  ])(
    'ranks auto top-up above out of credits and low credits ($hasFunds, $lowBalance, dismissed $outOfCreditsDismissed)',
    (row) => {
      expect(derive({ ...row, autoTopUp: 'autoTopUpFailed' })).toBe(
        'autoTopUpFailed'
      )
      expect(derive({ ...row, autoTopUp: 'autoTopUpOff' })).toBe('autoTopUpOff')
    }
  )

  it('falls back to out of credits and low credits with no auto top-up banner', () => {
    expect(derive({ hasFunds: false, lowBalance: true })).toBe('outOfCredits')
    expect(
      derive({ hasFunds: false, outOfCreditsDismissed: true, lowBalance: true })
    ).toBe('lowCredits')
  })
})
