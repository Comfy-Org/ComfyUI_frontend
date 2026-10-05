import { previewOf } from '@/test/fakeBillingClient'

import {
  buildSubscribeRequest,
  paysOnOwnSite,
  teamCheckoutPlan,
  tierCheckoutPlan
} from './checkoutRequest'

const annualTeam = previewOf({
  new_plan: {
    ...previewOf().new_plan,
    tier: 'TEAM',
    duration: 'ANNUAL',
    price_cents: 756_000
  }
})

describe('teamCheckoutPlan', () => {
  it.for([
    ['ANNUAL', 630],
    ['MONTHLY', 665]
  ] as const)(
    'prices a %s stop as the app does and grants what the stop names',
    ([duration, monthlyUsd]) => {
      const quoted = previewOf({
        new_plan: { ...annualTeam.new_plan, duration }
      })
      expect(
        teamCheckoutPlan(
          quoted,
          {
            default_stop_index: 0,
            stops: [
              {
                id: 'stop_700',
                credits: 147_700n,
                monthly: { list_price_cents: 70_000n, price_cents: 66_500n },
                yearly: { list_price_cents: 70_000n, price_cents: 63_000n }
              }
            ]
          },
          'stop_700',
          'Team Plan'
        )
      ).toEqual({
        name: 'Team Plan',
        monthlyPriceUsd: { monthly: monthlyUsd, yearly: monthlyUsd },
        monthlyCredits: 147_700,
        pricedByQuote: false
      })
    }
  )

  it('grants nothing for a stop the catalog does not list', () => {
    expect(
      teamCheckoutPlan(annualTeam, undefined, 'stop_x', 'Team Plan')
        .monthlyCredits
    ).toBe(0)
  })
})

describe('tierCheckoutPlan', () => {
  it.for([
    ['CREATOR', { monthly: 35, yearly: 28 }, 7400],
    ['FOUNDERS_EDITION', { monthly: 0, yearly: 0 }, 0]
  ] as const)('reads %s from the shared catalog', ([tier, price, credits]) => {
    const quoted = previewOf({ new_plan: { ...previewOf().new_plan, tier } })
    expect(tierCheckoutPlan(quoted, 'Plan')).toEqual({
      name: 'Plan',
      monthlyPriceUsd: price,
      monthlyCredits: credits,
      pricedByQuote: true
    })
  })
})

describe('buildSubscribeRequest', () => {
  it('sends only the plan for a bare quote and no choice', () => {
    expect(
      buildSubscribeRequest({ planSlug: 'pro_monthly' }, previewOf(), {})
    ).toEqual({ plan_slug: 'pro_monthly' })
  })

  it('carries every identity the quote, the link and the choice name', () => {
    expect(
      buildSubscribeRequest(
        {
          planSlug: 'team_per_credit_annual',
          teamCreditStopId: 'stop_700',
          returnUrl: 'https://billing.test/v1/result'
        },
        previewOf({
          quote_id: 'q_1',
          quote_version: 3,
          promotion_code: 'SPRING',
          proration_at: '2026-09-18T12:00:00.000Z'
        }),
        { savedPaymentMethodId: 'pm_1', confirmReactivation: true }
      )
    ).toEqual({
      plan_slug: 'team_per_credit_annual',
      saved_payment_method_id: 'pm_1',
      team_credit_stop_id: 'stop_700',
      quote_id: 'q_1',
      quote_version: 3,
      promotion_code: 'SPRING',
      proration_at: '2026-09-18T12:00:00.000Z',
      return_url: 'https://billing.test/v1/result',
      confirm_reactivation: true
    })
  })

  it('leaves a later change to be priced when it takes effect', () => {
    expect(
      buildSubscribeRequest(
        { planSlug: 'pro_monthly' },
        previewOf({
          is_immediate: false,
          proration_at: '2026-09-18T12:00:00.000Z'
        }),
        { confirmationToken: 'ctok' }
      )
    ).toEqual({ plan_slug: 'pro_monthly', confirmation_token: 'ctok' })
  })
})

describe('paysOnOwnSite', () => {
  it.for<{ name: string; methodType: string | undefined; away: boolean }>([
    { name: 'an Alipay account', methodType: 'alipay', away: true },
    { name: 'any other non-card method', methodType: 'sepa_debit', away: true },
    { name: 'a card', methodType: 'card', away: false },
    { name: 'a method nobody named', methodType: undefined, away: false }
  ])('says $name pays on its own site: $away', ({ methodType, away }) => {
    expect(paysOnOwnSite(methodType)).toBe(away)
  })
})
