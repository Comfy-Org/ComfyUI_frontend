import { describe, expect, it } from 'vitest'

import type { LocalCreditBannerInput } from './deriveLocalCreditBanner'
import { deriveLocalCreditBanner } from './deriveLocalCreditBanner'

const open: LocalCreditBannerInput = {
  unifiedBillingSettingsEnabled: true,
  hasFunds: true,
  lowBalance: undefined,
  outOfCreditsDismissed: false,
  lowCreditsDismissed: false
}

function derive(overrides: Partial<LocalCreditBannerInput>) {
  return deriveLocalCreditBanner({ ...open, ...overrides })
}

describe('deriveLocalCreditBanner', () => {
  it('stays hidden when unified billing settings is off', () => {
    expect(
      derive({
        unifiedBillingSettingsEnabled: false,
        hasFunds: false,
        lowBalance: true
      })
    ).toBeNull()
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
})
