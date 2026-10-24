import { describe, expect, it } from 'vitest'

import type { LocalCreditBannerInput } from './deriveLocalCreditBanner'
import { deriveLocalCreditBanner } from './deriveLocalCreditBanner'

const open: LocalCreditBannerInput = {
  unifiedBillingSettingsEnabled: true,
  isCloud: false,
  isActive: false,
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
