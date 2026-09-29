import type { SubscriptionPreview } from '@comfyorg/account-core/billing'

import type { SummaryLedger } from '@/checkout/summaryLedger'
import {
  buildSummaryLedger,
  formatHeadlineMoney
} from '@/checkout/summaryLedger'
import { createBillingI18n } from '@/i18n'
import { previewOf } from '@/test/fakeBillingClient'

const { t } = createBillingI18n().global

type Plan = SubscriptionPreview['new_plan']

function planOf(
  tier: Plan['tier'],
  duration: Plan['duration'],
  totalCostCents: number,
  extra: Partial<Plan> = {}
): Plan {
  return {
    slug: `${tier.toLowerCase()}_${duration.toLowerCase()}`,
    tier,
    duration,
    price_cents: totalCostCents,
    credits_cents: 0,
    seat_summary: {
      seat_count: 1,
      total_cost_cents: totalCostCents,
      total_credits_cents: 0
    },
    ...extra
  }
}

function ledgerOf(
  quote: Partial<SubscriptionPreview>,
  workspace: string | null = 'Comfy Studios'
): SummaryLedger {
  return buildSummaryLedger(previewOf({ currency: 'usd', ...quote }), {
    workspace: workspace ?? undefined,
    tierName: (tier) => t(`hosted.tier.${tier}`),
    t,
    locale: 'en'
  })
}

const JULY_28 = '2026-07-28T00:00:00.000Z'
const JUNE_28_2027 = '2027-06-28T00:00:00.000Z'
const PRICED_AT = '2026-07-10T09:30:00.000Z'

describe('buildSummaryLedger', () => {
  it.for<{
    name: string
    quote: Partial<SubscriptionPreview>
    ledger: SummaryLedger
  }>([
    {
      name: 'new subscription, monthly: the charge, the allowance rate, one row',
      quote: {
        transition_type: 'new_subscription',
        amount_due_cents: 70_000,
        cost_today_cents: 70_000,
        renewal_amount_cents: 70_000,
        renewal_at: JULY_28,
        credits_today_cents: 70_000,
        credits_next_period_cents: 70_000,
        new_plan: planOf('TEAM', 'MONTHLY', 70_000)
      },
      ledger: {
        family: 'charge_now',
        eyebrow: 'Subscribe to Team Plan · Comfy Studios',
        headline: { amount: '$700', currency: 'USD' },
        credits: { count: '147,700', qualifier: 'credits per month' },
        items: [
          {
            label: 'Team Plan',
            amount: '$700.00',
            sublines: ['$700 /mo, billed monthly']
          }
        ],
        adjustments: [],
        total: '$700.00',
        trailing: ['Renews at $700.00 on July 28, 2026']
      }
    },
    {
      name: 'new subscription, yearly: a yearly allowance and a yearly renewal',
      quote: {
        transition_type: 'new_subscription',
        amount_due_cents: 756_000,
        cost_today_cents: 756_000,
        renewal_amount_cents: 756_000,
        renewal_at: JUNE_28_2027,
        credits_today_cents: 840_000,
        credits_next_period_cents: 840_000,
        new_plan: planOf('TEAM', 'ANNUAL', 756_000)
      },
      ledger: {
        family: 'charge_now',
        eyebrow: 'Subscribe to Team Plan · Comfy Studios',
        headline: { amount: '$7,560', currency: 'USD' },
        credits: { count: '1,772,400', qualifier: 'credits per year' },
        items: [
          {
            label: 'Team Plan',
            amount: '$7,560.00',
            sublines: ['Billed yearly']
          }
        ],
        adjustments: [],
        total: '$7,560.00',
        trailing: ['Renews at $7,560.00 on June 28, 2027']
      }
    },
    {
      name: '$0 due new subscription: the trailing line says why the card is collected',
      quote: {
        transition_type: 'new_subscription',
        amount_due_cents: 0,
        cost_today_cents: 756_000,
        renewal_amount_cents: 756_000,
        renewal_at: JUNE_28_2027,
        credits_today_cents: 840_000,
        credits_next_period_cents: 840_000,
        new_plan: planOf('TEAM', 'ANNUAL', 756_000)
      },
      ledger: {
        family: 'charge_now',
        eyebrow: 'Subscribe to Team Plan · Comfy Studios',
        headline: { amount: '$0', currency: 'USD' },
        credits: { count: '1,772,400', qualifier: 'credits per year' },
        items: [
          {
            label: 'Team Plan',
            amount: '$7,560.00',
            sublines: ['Billed yearly']
          }
        ],
        adjustments: [],
        total: '$0.00',
        trailing: [
          'Renews at $7,560.00 on June 28, 2027',
          "You won't be charged today. Your payment method renews the plan at $7,560.00 on June 28, 2027."
        ]
      }
    },
    {
      name: 'tier upgrade priced at a proration instant: the prorated charge, a credits delta with its verb and expiry',
      quote: {
        transition_type: 'upgrade',
        proration_at: PRICED_AT,
        amount_due_cents: 3250,
        cost_today_cents: 3250,
        renewal_amount_cents: 10_000,
        renewal_at: JULY_28,
        credits_today_cents: 3250,
        credits_next_period_cents: 10_000,
        current_plan: planOf('CREATOR', 'MONTHLY', 3500),
        new_plan: planOf('PRO', 'MONTHLY', 10_000)
      },
      ledger: {
        family: 'prorated_change',
        eyebrow: 'Upgrade to Pro Plan · Comfy Studios',
        headline: { amount: '$32.50', currency: 'USD' },
        credits: {
          count: '6,858',
          qualifier: 'credits added today (expire July 28)'
        },
        items: [
          {
            label: 'Pro Plan - Prorated',
            amount: '$32.50',
            sublines: [
              'Remaining time for Pro plan, less unused time from Creator plan',
              'Credits refill to 21,100 each month'
            ]
          }
        ],
        adjustments: [],
        total: '$32.50',
        trailing: [
          'Existing credits are kept',
          'Renews at $100.00 on July 28, 2026'
        ]
      }
    },
    {
      name: "tier upgrade without a proration instant: today's charge and grant, never labelled prorated",
      quote: {
        transition_type: 'upgrade',
        amount_due_cents: 3250,
        cost_today_cents: 3250,
        renewal_amount_cents: 10_000,
        renewal_at: JULY_28,
        credits_today_cents: 3250,
        credits_next_period_cents: 10_000,
        current_plan: planOf('CREATOR', 'MONTHLY', 3500),
        new_plan: planOf('PRO', 'MONTHLY', 10_000)
      },
      ledger: {
        family: 'charge_now',
        eyebrow: 'Upgrade to Pro Plan · Comfy Studios',
        headline: { amount: '$32.50', currency: 'USD' },
        credits: {
          count: '6,858',
          qualifier: 'credits added today (expire July 28)'
        },
        items: [
          {
            label: 'Pro Plan',
            amount: '$32.50',
            sublines: [
              '$100 /mo, billed monthly',
              'Credits refill to 21,100 each month'
            ]
          }
        ],
        adjustments: [],
        total: '$32.50',
        trailing: ['Renews at $100.00 on July 28, 2026']
      }
    },
    {
      name: 'monthly to yearly priced at a proration instant: not prorated, a bare grant and the overlap note',
      quote: {
        transition_type: 'duration_change',
        proration_at: PRICED_AT,
        amount_due_cents: 33_600,
        cost_today_cents: 33_600,
        renewal_amount_cents: 33_600,
        renewal_at: JUNE_28_2027,
        credits_today_cents: 42_000,
        credits_next_period_cents: 42_000,
        current_plan: planOf('CREATOR', 'MONTHLY', 3500, {
          period_end: JULY_28
        }),
        new_plan: planOf('CREATOR', 'ANNUAL', 33_600)
      },
      ledger: {
        family: 'charge_now',
        eyebrow: 'Switch to Creator Yearly · Comfy Studios',
        headline: { amount: '$336', currency: 'USD' },
        credits: { count: '88,620', qualifier: 'credits' },
        items: [
          {
            label: 'Creator Yearly',
            amount: '$336.00',
            sublines: ['Billed yearly', 'Credits refill to 88,620 each year']
          }
        ],
        adjustments: [],
        total: '$336.00',
        trailing: [
          'Renews at $336.00 on June 28, 2027',
          "This month's credits stay valid until July 28, 2026"
        ]
      }
    },
    {
      name: 'tier upgrade onto yearly: a full charge, never labelled prorated',
      quote: {
        transition_type: 'upgrade',
        amount_due_cents: 96_000,
        cost_today_cents: 96_000,
        renewal_amount_cents: 96_000,
        renewal_at: JUNE_28_2027,
        credits_today_cents: 120_000,
        credits_next_period_cents: 120_000,
        current_plan: planOf('CREATOR', 'MONTHLY', 3500, {
          period_end: JULY_28
        }),
        new_plan: planOf('PRO', 'ANNUAL', 96_000)
      },
      ledger: {
        family: 'charge_now',
        eyebrow: 'Upgrade to Pro Yearly · Comfy Studios',
        headline: { amount: '$960', currency: 'USD' },
        credits: { count: '253,200', qualifier: 'credits' },
        items: [
          {
            label: 'Pro Yearly',
            amount: '$960.00',
            sublines: ['Billed yearly', 'Credits refill to 253,200 each year']
          }
        ],
        adjustments: [],
        total: '$960.00',
        trailing: [
          'Renews at $960.00 on June 28, 2027',
          "This month's credits stay valid until July 28, 2026"
        ]
      }
    },
    {
      name: 'tier downgrade priced at a proration instant: scheduled, the future rate as headline, $0 today',
      quote: {
        transition_type: 'downgrade',
        is_immediate: false,
        proration_at: PRICED_AT,
        effective_at: JULY_28,
        amount_due_cents: 0,
        cost_today_cents: 0,
        renewal_amount_cents: 3500,
        credits_today_cents: 0,
        credits_next_period_cents: 3507,
        current_plan: planOf('PRO', 'MONTHLY', 10_000),
        new_plan: planOf('CREATOR', 'MONTHLY', 3500)
      },
      ledger: {
        family: 'scheduled',
        eyebrow: 'Switch to Creator Plan · Comfy Studios',
        headline: { amount: '$35', currency: 'USD', rate: '/ mo' },
        credits: {
          count: '7,400',
          qualifier: 'credits refill monthly after July 28, 2026'
        },
        items: [
          {
            label: 'Creator Plan',
            amount: '$35.00 /mo',
            sublines: ['Starts July 28, 2026, billed monthly']
          }
        ],
        adjustments: [],
        total: '$0.00',
        trailing: ["You'll keep Pro until July 28, 2026"]
      }
    },
    {
      name: 'yearly to monthly: a period-end change that names both cadences',
      quote: {
        transition_type: 'duration_change',
        is_immediate: false,
        effective_at: JUNE_28_2027,
        amount_due_cents: 0,
        cost_today_cents: 0,
        renewal_amount_cents: 3500,
        credits_today_cents: 0,
        credits_next_period_cents: 3507,
        current_plan: planOf('CREATOR', 'ANNUAL', 33_600),
        new_plan: planOf('CREATOR', 'MONTHLY', 3500)
      },
      ledger: {
        family: 'scheduled',
        eyebrow: 'Switch to Creator Monthly · Comfy Studios',
        headline: { amount: '$35', currency: 'USD', rate: '/ mo' },
        credits: {
          count: '7,400',
          qualifier: 'credits refill monthly after June 28, 2027'
        },
        items: [
          {
            label: 'Creator Monthly',
            amount: '$35.00 /mo',
            sublines: ['Starts June 28, 2027, billed monthly']
          }
        ],
        adjustments: [],
        total: '$0.00',
        trailing: ["You'll keep Creator Yearly until June 28, 2027"]
      }
    },
    {
      name: "team commit change priced at a proration instant: neutral, no proration copy, today's grant dated",
      quote: {
        transition_type: 'upgrade',
        proration_at: PRICED_AT,
        amount_due_cents: 12_345,
        cost_today_cents: 12_345,
        renewal_amount_cents: 140_000,
        renewal_at: JULY_28,
        credits_today_cents: 5000,
        credits_next_period_cents: 140_000,
        current_plan: planOf('TEAM', 'MONTHLY', 70_000),
        new_plan: planOf('TEAM', 'MONTHLY', 140_000)
      },
      ledger: {
        family: 'charge_now',
        eyebrow: 'Change to Team Plan · Comfy Studios',
        headline: { amount: '$123.45', currency: 'USD' },
        credits: {
          count: '10,550',
          qualifier: 'credits added today (expire July 28)'
        },
        items: [
          {
            label: 'Team Plan',
            amount: '$123.45',
            sublines: [
              '$1,400 /mo, billed monthly',
              'Credits refill to 295,400 each month'
            ]
          }
        ],
        adjustments: [],
        total: '$123.45',
        trailing: ['Renews at $1,400.00 on July 28, 2026']
      }
    }
  ])('$name', ({ quote, ledger }) => {
    expect(ledgerOf(quote)).toEqual(ledger)
  })

  it('names only the plan when the session has no workspace', () => {
    expect(ledgerOf({}, null).eyebrow).toBe('Subscribe to Creator Plan')
  })

  it('leaves Subtotal out while a single money row precedes the total', () => {
    expect(ledgerOf({}).subtotal).toBeUndefined()
  })
})

describe('formatHeadlineMoney', () => {
  it.for([
    { cents: 70_000, text: '$700' },
    { cents: 756_000, text: '$7,560' },
    { cents: 3250, text: '$32.50' },
    { cents: 5, text: '$0.05' },
    { cents: 0, text: '$0' }
  ])('$cents cents reads $text', ({ cents, text }) => {
    expect(formatHeadlineMoney(cents, 'usd', 'en')).toBe(text)
  })
})
