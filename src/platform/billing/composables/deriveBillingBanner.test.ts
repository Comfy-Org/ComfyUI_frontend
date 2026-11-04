import { describe, expect, it } from 'vitest'

import type { BillingBannerInputs } from './useBillingBanner'
import { deriveBillingBanner } from './useBillingBanner'

const funded: BillingBannerInputs = {
  billingControlEnabled: true,
  isTeamPlan: true,
  isEnterprise: false,
  isKnownPersonalTier: false,
  isLoaded: true,
  billingStatus: 'paid',
  canAccessSubscriptionFeatures: true,
  hasFunds: true,
  isCancelled: false,
  endDate: null,
  withinEnterpriseEndingNotice: false,
  canManage: true,
  isPlanEnded: false,
  isPlanTerminal: false,
  planEndedDismissed: false,
  outOfCreditsDismissed: false,
  planChangeDismissed: false,
  hasScheduledChange: false,
  topUpDeniedPastDue: false,
  runDeniedPastDue: false,
  unifiedBillingSettingsEnabled: false,
  isActive: true
}

function derive(overrides: Partial<BillingBannerInputs>) {
  return deriveBillingBanner({ ...funded, ...overrides })
}

describe('deriveBillingBanner', () => {
  it('shows no banner for a healthy funded team', () => {
    expect(derive({})).toBeNull()
  })

  describe('paused', () => {
    const paused: Partial<BillingBannerInputs> = {
      billingStatus: 'paused',
      canAccessSubscriptionFeatures: false
    }

    it.for<{ name: string; inputs: Partial<BillingBannerInputs> }>([
      { name: 'a funded team', inputs: {} },
      { name: 'an exhausted team', inputs: { hasFunds: false } },
      { name: 'an ended plan', inputs: { isPlanEnded: true } },
      {
        name: 'an ending plan',
        inputs: { isCancelled: true, endDate: '2026-08-01T00:00:00Z' }
      },
      { name: 'a scheduled change', inputs: { hasScheduledChange: true } },
      {
        name: 'a known personal tier',
        inputs: { isTeamPlan: false, isKnownPersonalTier: true }
      },
      { name: 'an Enterprise plan', inputs: { isEnterprise: true } },
      { name: 'a member', inputs: { canManage: false } },
      {
        name: 'billing control rolled back',
        inputs: { billingControlEnabled: false }
      },
      { name: 'a subscription not yet read', inputs: { isLoaded: false } }
    ])('ranks paused above everything for $name', ({ inputs }) => {
      expect(derive({ ...paused, ...inputs })).toBe('paused')
    })

    it.for<{ name: string; inputs: Partial<BillingBannerInputs> }>([
      {
        name: 'payment failed',
        inputs: {
          billingStatus: 'payment_failed',
          canAccessSubscriptionFeatures: false
        }
      },
      {
        name: 'inactive access with a paid status',
        inputs: { billingStatus: 'paid', canAccessSubscriptionFeatures: false }
      }
    ])('shows no paused banner for $name', ({ inputs }) => {
      expect(derive(inputs)).not.toBe('paused')
    })
  })

  describe('personal plan', () => {
    const personal: Partial<BillingBannerInputs> = {
      isTeamPlan: false,
      isKnownPersonalTier: true
    }
    const endingSoon: Partial<BillingBannerInputs> = {
      isCancelled: true,
      endDate: '2026-08-01T00:00:00Z'
    }
    // usePlanEnded leaves personal plans out; only the terminal test applies.
    const terminal: Partial<BillingBannerInputs> = {
      isPlanTerminal: true,
      canAccessSubscriptionFeatures: false
    }

    it.for([
      {
        name: 'out of credits',
        inputs: { hasFunds: false },
        kind: 'outOfCredits'
      },
      { name: 'an ending plan', inputs: endingSoon, kind: 'ending' },
      { name: 'an ended plan', inputs: terminal, kind: 'planEnded' }
    ] as const)('shows $name to a known personal tier', ({ inputs, kind }) => {
      expect(derive({ ...personal, ...inputs })).toBe(kind)
    })

    it.for([
      { name: 'out of credits', inputs: { hasFunds: false } },
      { name: 'an ending plan', inputs: endingSoon },
      { name: 'an ended plan', inputs: terminal }
    ])('fails closed on $name for an unrecognized tier', ({ inputs }) => {
      expect(
        derive({ ...inputs, isTeamPlan: false, isKnownPersonalTier: false })
      ).toBeNull()
    })

    it('keeps out of credits and ending behind billing control', () => {
      expect(
        derive({ ...personal, hasFunds: false, billingControlEnabled: false })
      ).toBeNull()
      expect(
        derive({ ...personal, ...endingSoon, billingControlEnabled: false })
      ).toBeNull()
    })

    it('ships plan ended without the billing control flag', () => {
      expect(
        derive({ ...personal, ...terminal, billingControlEnabled: false })
      ).toBe('planEnded')
    })

    it('ranks plan ended above out of credits', () => {
      expect(derive({ ...personal, ...terminal, hasFunds: false })).toBe(
        'planEnded'
      )
    })

    it('stays hidden once plan ended is dismissed', () => {
      expect(
        derive({ ...personal, ...terminal, planEndedDismissed: true })
      ).toBeNull()
    })

    it('hides out of credits once dismissed', () => {
      expect(
        derive({ ...personal, hasFunds: false, outOfCreditsDismissed: true })
      ).toBeNull()
    })

    it('never shows a scheduled plan change', () => {
      expect(derive({ ...personal, hasScheduledChange: true })).toBeNull()
    })
  })

  it('hides existing notices when billing control is rolled back', () => {
    expect(derive({ billingControlEnabled: false, hasFunds: false })).toBeNull()
  })

  it('shows no banner until the subscription snapshot has loaded', () => {
    expect(derive({ isLoaded: false, hasFunds: false })).toBeNull()
  })

  it('surfaces out of credits when the balance is exhausted', () => {
    expect(derive({ hasFunds: false })).toBe('outOfCredits')
  })

  it('hides cloud credit banners when unified billing is on and the plan is not active', () => {
    expect(
      derive({
        unifiedBillingSettingsEnabled: true,
        isActive: false,
        hasFunds: false,
        topUpDeniedPastDue: true
      })
    ).toBeNull()
  })

  it('keeps cloud credit banners when unified billing is on and the plan is active', () => {
    expect(
      derive({
        unifiedBillingSettingsEnabled: true,
        isActive: true,
        hasFunds: false
      })
    ).toBe('outOfCredits')
  })

  it('shows out of credits to members too', () => {
    expect(derive({ hasFunds: false, canManage: false })).toBe('outOfCredits')
  })

  it('hides out of credits once dismissed', () => {
    expect(derive({ hasFunds: false, outOfCreditsDismissed: true })).toBeNull()
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

  it('shows the ending banner to members too', () => {
    expect(
      derive({
        isCancelled: true,
        endDate: '2026-08-01T00:00:00Z',
        canManage: false
      })
    ).toBe('ending')
  })

  describe('plan ended', () => {
    const ended: Partial<BillingBannerInputs> = {
      isPlanEnded: true,
      canAccessSubscriptionFeatures: false
    }

    it('shows for team and Enterprise, owners and members alike', () => {
      expect(derive(ended)).toBe('planEnded')
      expect(derive({ ...ended, canManage: false })).toBe('planEnded')
      expect(derive({ ...ended, isTeamPlan: false, isEnterprise: true })).toBe(
        'planEnded'
      )
    })

    it('ships without the billing control flag', () => {
      expect(derive({ ...ended, billingControlEnabled: false })).toBe(
        'planEnded'
      )
    })

    it('ranks above out of credits', () => {
      expect(derive({ ...ended, hasFunds: false })).toBe('planEnded')
    })

    it('stays hidden once dismissed', () => {
      expect(derive({ ...ended, planEndedDismissed: true })).toBeNull()
    })
  })

  it('shows no banner for an inactive subscription (that is a run-lock modal)', () => {
    expect(
      derive({
        canAccessSubscriptionFeatures: false
      })
    ).toBeNull()
  })

  it.for([
    {
      name: 'member whose run is denied for a past-due payment and has no credits',
      inputs: {
        canAccessSubscriptionFeatures: false,
        hasFunds: false,
        runDeniedPastDue: true
      },
      expected: 'outOfCredits' as const
    },
    {
      name: 'past-due owner with no credits',
      inputs: {
        canAccessSubscriptionFeatures: false,
        hasFunds: false,
        topUpDeniedPastDue: true
      },
      expected: 'outOfCredits' as const
    },
    {
      name: 'past-due workspace that still has credits',
      inputs: {
        canAccessSubscriptionFeatures: false,
        hasFunds: true,
        topUpDeniedPastDue: true
      },
      expected: null
    },
    {
      name: 'past-due out of credits with billing control off',
      inputs: {
        canAccessSubscriptionFeatures: false,
        hasFunds: false,
        topUpDeniedPastDue: true,
        billingControlEnabled: false
      },
      expected: null
    },
    {
      name: 'dismissed past-due out of credits',
      inputs: {
        canAccessSubscriptionFeatures: false,
        hasFunds: false,
        topUpDeniedPastDue: true,
        outOfCreditsDismissed: true
      },
      expected: null
    }
  ])('derives $name as $expected', ({ inputs, expected }) => {
    expect(derive(inputs)).toBe(expected)
  })

  it('shows the plan change banner when the server reports a scheduled change', () => {
    expect(derive({ hasScheduledChange: true })).toBe('planChange')
  })

  it('keeps the plan change banner owner-only', () => {
    expect(derive({ hasScheduledChange: true, canManage: false })).toBeNull()
  })

  it('hides a dismissed plan change banner', () => {
    expect(
      derive({ hasScheduledChange: true, planChangeDismissed: true })
    ).toBeNull()
  })

  it('prefers the ending banner when the plan is cancelled, not changing', () => {
    expect(
      derive({
        hasScheduledChange: true,
        isCancelled: true,
        endDate: '2026-08-01T00:00:00Z'
      })
    ).toBe('ending')
  })

  it('shows a member the ending notice, not the plan change, once cancelled', () => {
    expect(
      derive({
        hasScheduledChange: true,
        isCancelled: true,
        endDate: '2026-08-01T00:00:00Z',
        canManage: false
      })
    ).toBe('ending')
  })

  it('keeps out-of-credits ahead of a scheduled change', () => {
    expect(derive({ hasScheduledChange: true, hasFunds: false })).toBe(
      'outOfCredits'
    )
  })

  describe('enterprise ending notice', () => {
    const enterprise: Partial<BillingBannerInputs> = {
      isTeamPlan: false,
      isEnterprise: true,
      isCancelled: true,
      endDate: '2026-09-13T12:00:00Z'
    }

    it.for([
      {
        case: 'outside the notice window',
        inputs: { withinEnterpriseEndingNotice: false },
        kind: null
      },
      {
        case: 'inside the notice window',
        inputs: { withinEnterpriseEndingNotice: true },
        kind: 'ending'
      },
      {
        case: 'inside the window for a member',
        inputs: { withinEnterpriseEndingNotice: true, canManage: false },
        kind: 'ending'
      },
      {
        case: 'inside the window without a cancellation',
        inputs: { withinEnterpriseEndingNotice: true, isCancelled: false },
        kind: null
      },
      {
        case: 'inside the window once access is gone',
        inputs: {
          withinEnterpriseEndingNotice: true,
          canAccessSubscriptionFeatures: false
        },
        kind: null
      },
      {
        case: 'out of credits',
        inputs: { hasFunds: false },
        kind: null
      },
      {
        case: 'a plan that also reads as team',
        inputs: { withinEnterpriseEndingNotice: false, isTeamPlan: true },
        kind: null
      }
    ] as const)('shows $kind $case', ({ inputs, kind }) => {
      expect(derive({ ...enterprise, ...inputs })).toBe(kind)
    })

    it('gives an unrecognized tier no banner at all', () => {
      expect(
        derive({
          isTeamPlan: false,
          isEnterprise: false,
          isCancelled: true,
          endDate: '2026-09-13T12:00:00Z',
          withinEnterpriseEndingNotice: true
        })
      ).toBeNull()
    })

    it('never applies the window to a self-serve team cancellation', () => {
      expect(
        derive({ isCancelled: true, endDate: '2026-11-02T12:00:00Z' })
      ).toBe('ending')
    })
  })
})
