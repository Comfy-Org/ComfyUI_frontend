import type { SubscriptionPreview } from '@comfyorg/account-core/billing'

import type { SummaryLedger } from '@/checkout/summaryLedger'
import {
  buildSummaryLedger,
  formatHeadlineMoney,
  planPurchaseOf
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
        credits_today: 147_700,
        credits_next_period: 147_700,
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
        discounts: [],
        chips: [],
        acceptsPromo: true,
        total: '$700.00',
        trailing: ['Renews at $700.00 on July\u00A028,\u00A02026']
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
        credits_today: 1_772_400,
        credits_next_period: 1_772_400,
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
        discounts: [],
        chips: [],
        acceptsPromo: true,
        total: '$7,560.00',
        trailing: ['Renews at $7,560.00 on June\u00A028,\u00A02027']
      }
    },
    {
      name: '$0 due new subscription: no row contradicts the total, and the trailing line says why the card is collected',
      quote: {
        transition_type: 'new_subscription',
        amount_due_cents: 0,
        cost_today_cents: 756_000,
        renewal_amount_cents: 756_000,
        renewal_at: JUNE_28_2027,
        credits_today_cents: 840_000,
        credits_next_period_cents: 840_000,
        credits_today: 1_772_400,
        credits_next_period: 1_772_400,
        new_plan: planOf('TEAM', 'ANNUAL', 756_000)
      },
      ledger: {
        family: 'charge_now',
        eyebrow: 'Subscribe to Team Plan · Comfy Studios',
        headline: { amount: '$0', currency: 'USD' },
        credits: { count: '1,772,400', qualifier: 'credits per year' },
        items: [],
        discounts: [],
        chips: [],
        acceptsPromo: true,
        total: '$0.00',
        trailing: [
          'Renews at $7,560.00 on June\u00A028,\u00A02027',
          "You won't be charged today. Your payment method renews the plan at $7,560.00 on June\u00A028,\u00A02027."
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
        credits_today: 6858,
        credits_next_period: 21_100,
        current_plan: planOf('CREATOR', 'MONTHLY', 3500),
        new_plan: planOf('PRO', 'MONTHLY', 10_000)
      },
      ledger: {
        family: 'prorated_change',
        eyebrow: 'Upgrade to Pro Plan · Comfy Studios',
        headline: { amount: '$32.50', currency: 'USD' },
        credits: {
          count: '6,858',
          qualifier: 'credits added today (expire July\u00A028)'
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
        discounts: [],
        chips: [],
        acceptsPromo: true,
        total: '$32.50',
        trailing: [
          'Existing credits are kept',
          'Renews at $100.00 on July\u00A028,\u00A02026'
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
        credits_today: 6858,
        credits_next_period: 21_100,
        current_plan: planOf('CREATOR', 'MONTHLY', 3500),
        new_plan: planOf('PRO', 'MONTHLY', 10_000)
      },
      ledger: {
        family: 'charge_now',
        eyebrow: 'Upgrade to Pro Plan · Comfy Studios',
        headline: { amount: '$32.50', currency: 'USD' },
        credits: {
          count: '6,858',
          qualifier: 'credits added today (expire July\u00A028)'
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
        discounts: [],
        chips: [],
        acceptsPromo: true,
        total: '$32.50',
        trailing: ['Renews at $100.00 on July\u00A028,\u00A02026']
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
        credits_today: 88_620,
        credits_next_period: 88_620,
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
        discounts: [],
        chips: [],
        acceptsPromo: true,
        total: '$336.00',
        trailing: [
          'Renews at $336.00 on June\u00A028,\u00A02027',
          "This month's credits stay valid until July\u00A028,\u00A02026"
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
        credits_today: 253_200,
        credits_next_period: 253_200,
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
        discounts: [],
        chips: [],
        acceptsPromo: true,
        total: '$960.00',
        trailing: [
          'Renews at $960.00 on June\u00A028,\u00A02027',
          "This month's credits stay valid until July\u00A028,\u00A02026"
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
        credits_today: 0,
        credits_next_period: 7400,
        current_plan: planOf('PRO', 'MONTHLY', 10_000),
        new_plan: planOf('CREATOR', 'MONTHLY', 3500)
      },
      ledger: {
        family: 'scheduled',
        eyebrow: 'Switch to Creator Plan · Comfy Studios',
        headline: { amount: '$35', currency: 'USD', rate: '/ mo' },
        credits: {
          count: '7,400',
          qualifier: 'credits refill monthly after July\u00A028,\u00A02026'
        },
        items: [
          {
            label: 'Creator Plan',
            amount: '$35.00 /mo',
            sublines: ['Starts July\u00A028,\u00A02026, billed monthly']
          }
        ],
        discounts: [],
        chips: [],
        acceptsPromo: false,
        total: '$0.00',
        trailing: ["You'll keep Pro until July\u00A028,\u00A02026"]
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
        credits_today: 0,
        credits_next_period: 7400,
        current_plan: planOf('CREATOR', 'ANNUAL', 33_600),
        new_plan: planOf('CREATOR', 'MONTHLY', 3500)
      },
      ledger: {
        family: 'scheduled',
        eyebrow: 'Switch to Creator Monthly · Comfy Studios',
        headline: { amount: '$35', currency: 'USD', rate: '/ mo' },
        credits: {
          count: '7,400',
          qualifier: 'credits refill monthly after June\u00A028,\u00A02027'
        },
        items: [
          {
            label: 'Creator Monthly',
            amount: '$35.00 /mo',
            sublines: ['Starts June\u00A028,\u00A02027, billed monthly']
          }
        ],
        discounts: [],
        chips: [],
        acceptsPromo: false,
        total: '$0.00',
        trailing: ["You'll keep Creator Yearly until June\u00A028,\u00A02027"]
      }
    },
    {
      name: 'lowered team commitment: the kept commitment is named by its rate',
      quote: {
        transition_type: 'downgrade',
        is_immediate: false,
        effective_at: JULY_28,
        amount_due_cents: 0,
        cost_today_cents: 0,
        renewal_amount_cents: 70_000,
        credits_today_cents: 0,
        credits_next_period_cents: 70_000,
        credits_today: 0,
        credits_next_period: 147_700,
        current_plan: planOf('TEAM', 'MONTHLY', 140_000),
        new_plan: planOf('TEAM', 'MONTHLY', 70_000)
      },
      ledger: {
        family: 'scheduled',
        eyebrow: 'Switch to Team Plan · Comfy Studios',
        headline: { amount: '$700', currency: 'USD', rate: '/ mo' },
        credits: {
          count: '147,700',
          qualifier: 'credits refill monthly after July\u00A028,\u00A02026'
        },
        items: [
          {
            label: 'Team Plan',
            amount: '$700.00 /mo',
            sublines: ['Starts July\u00A028,\u00A02026, billed monthly']
          }
        ],
        discounts: [],
        chips: [],
        acceptsPromo: false,
        total: '$0.00',
        trailing: [
          "You'll keep Team at $1,400.00 /mo until July\u00A028,\u00A02026"
        ]
      }
    },
    {
      name: 'raised team commitment itemizing its proration: the tier-upgrade summary, remaining and unused time at the server amounts',
      quote: {
        transition_type: 'upgrade',
        proration_at: PRICED_AT,
        amount_due_cents: 19_000,
        cost_today_cents: 19_000,
        proration_remaining_cents: 38_000,
        proration_unused_cents: 19_000,
        renewal_amount_cents: 40_000,
        renewal_at: JULY_28,
        credits_today_cents: 19_000,
        credits_next_period_cents: 40_000,
        credits_today: 40_090,
        credits_next_period: 84_400,
        current_plan: planOf('TEAM', 'MONTHLY', 20_000),
        new_plan: planOf('TEAM', 'MONTHLY', 40_000)
      },
      ledger: {
        family: 'prorated_change',
        eyebrow: 'Upgrade to Team Plan · Comfy Studios',
        headline: { amount: '$190', currency: 'USD' },
        credits: {
          count: '40,090',
          qualifier: 'credits added today (expire July\u00A028)'
        },
        items: [
          {
            label: 'Remaining time on Team Plan',
            amount: '$380.00',
            sublines: ['Credits refill to 84,400 each month']
          },
          {
            label: 'Unused time on Team Plan',
            amount: '−$190.00',
            sublines: [],
            credit: true
          }
        ],
        discounts: [],
        chips: [],
        acceptsPromo: true,
        total: '$190.00',
        trailing: [
          'Existing credits are kept',
          'Renews at $400.00 on July\u00A028,\u00A02026'
        ]
      }
    },
    {
      name: 'raised team commitment without itemized proration: one prorated row at the net charge',
      quote: {
        transition_type: 'upgrade',
        proration_at: PRICED_AT,
        amount_due_cents: 19_000,
        cost_today_cents: 19_000,
        renewal_amount_cents: 40_000,
        renewal_at: JULY_28,
        credits_today_cents: 19_000,
        credits_next_period_cents: 40_000,
        credits_today: 40_090,
        credits_next_period: 84_400,
        current_plan: planOf('TEAM', 'MONTHLY', 20_000),
        new_plan: planOf('TEAM', 'MONTHLY', 40_000)
      },
      ledger: {
        family: 'prorated_change',
        eyebrow: 'Upgrade to Team Plan · Comfy Studios',
        headline: { amount: '$190', currency: 'USD' },
        credits: {
          count: '40,090',
          qualifier: 'credits added today (expire July\u00A028)'
        },
        items: [
          {
            label: 'Team Plan - Prorated',
            amount: '$190.00',
            sublines: [
              'Remaining time for Team plan, less unused time from Team plan',
              'Credits refill to 84,400 each month'
            ]
          }
        ],
        discounts: [],
        chips: [],
        acceptsPromo: true,
        total: '$190.00',
        trailing: [
          'Existing credits are kept',
          'Renews at $400.00 on July\u00A028,\u00A02026'
        ]
      }
    }
  ])('$name', ({ quote, ledger }) => {
    expect(ledgerOf(quote)).toEqual(ledger)
  })

  it.for<{
    name: string
    quote: Partial<SubscriptionPreview>
    zeroDue?: string
  }>([
    {
      name: 'an upgrade a code takes to $0',
      quote: {
        transition_type: 'upgrade',
        amount_due_cents: 0,
        cost_today_cents: 5000,
        renewal_amount_cents: 5000,
        renewal_at: JULY_28,
        current_plan: planOf('CREATOR', 'MONTHLY', 2800),
        new_plan: planOf('PRO', 'MONTHLY', 5000),
        promotion_code: 'FREE',
        discounts: [{ kind: 'promotion', code: 'FREE', amount_off_cents: 5000 }]
      },
      zeroDue:
        "You won't be charged today. Your payment method renews the plan at $50.00 on July\u00A028,\u00A02026."
    },
    {
      name: 'a prorated upgrade a code takes to $0',
      quote: {
        transition_type: 'upgrade',
        proration_at: PRICED_AT,
        amount_due_cents: 0,
        cost_today_cents: 2200,
        renewal_amount_cents: 5000,
        renewal_at: JULY_28,
        current_plan: planOf('CREATOR', 'MONTHLY', 2800),
        new_plan: planOf('PRO', 'MONTHLY', 5000),
        promotion_code: 'FREE',
        discounts: [{ kind: 'promotion', code: 'FREE', amount_off_cents: 2200 }]
      },
      zeroDue:
        "You won't be charged today. Your payment method renews the plan at $50.00 on July\u00A028,\u00A02026."
    },
    {
      name: 'a $0 new subscription the quote gives no renewal date',
      quote: {
        transition_type: 'new_subscription',
        amount_due_cents: 0,
        cost_today_cents: 0,
        renewal_amount_cents: 2800
      },
      zeroDue:
        "You won't be charged today. Your payment method renews the plan at $28.00."
    },
    {
      name: 'a scheduled change, which charges nothing today by design',
      quote: {
        transition_type: 'downgrade',
        is_immediate: false,
        effective_at: JULY_28,
        amount_due_cents: 0,
        cost_today_cents: 0,
        current_plan: planOf('PRO', 'MONTHLY', 10_000),
        new_plan: planOf('CREATOR', 'MONTHLY', 3500)
      }
    },
    {
      name: 'a charge above $0',
      quote: { amount_due_cents: 2800, renewal_at: JULY_28 }
    }
  ])('explains a zero total: $name', ({ quote, zeroDue }) => {
    const explained = ledgerOf(quote).trailing.filter((line) =>
      line.startsWith("You won't be charged today.")
    )
    expect(explained).toEqual(zeroDue === undefined ? [] : [zeroDue])
  })

  it('names the cadence of a kept yearly plan even when the new plan is yearly too', () => {
    const { trailing } = ledgerOf({
      transition_type: 'downgrade',
      is_immediate: false,
      effective_at: JUNE_28_2027,
      amount_due_cents: 0,
      cost_today_cents: 0,
      current_plan: planOf('PRO', 'ANNUAL', 50_000),
      new_plan: planOf('CREATOR', 'ANNUAL', 28_000)
    })

    expect(trailing).toEqual([
      "You'll keep Pro Yearly until June\u00A028,\u00A02027"
    ])
  })

  it('names only the plan when the session has no workspace', () => {
    expect(ledgerOf({}, null).eyebrow).toBe('Subscribe to Creator Plan')
  })

  it('drops the prorated row too when the quote leaves its gap to the total unexplained', () => {
    expect(
      ledgerOf({
        transition_type: 'upgrade',
        proration_at: PRICED_AT,
        amount_due_cents: 0,
        cost_today_cents: 3250,
        current_plan: planOf('CREATOR', 'MONTHLY', 3500),
        new_plan: planOf('PRO', 'MONTHLY', 10_000)
      }).items
    ).toEqual([])
  })
})

type Discount = NonNullable<SubscriptionPreview['discounts']>[number]

const ANNUAL_RATE: Discount = {
  kind: 'plan',
  code: 'annual_plan_discount_20',
  name: 'Annual plan discount',
  amount_off_cents: 189_000
}
const EDUCATION: Discount = {
  kind: 'promotion',
  code: 'COMFY-EDU',
  name: 'Education discount',
  amount_off_cents: 151_200
}
const entered = (
  code: string,
  amountOff?: number,
  name?: string
): Discount => ({
  kind: 'promotion',
  code,
  ...(amountOff === undefined ? {} : { amount_off_cents: amountOff }),
  ...(name === undefined ? {} : { name })
})

function discountSlotsOf(
  discounts: Discount[],
  promotionCode?: string,
  amountDueCents = 0
) {
  const ledger = ledgerOf({
    transition_type: 'new_subscription',
    amount_due_cents: amountDueCents,
    cost_today_cents: 756_000,
    new_plan: planOf('TEAM', 'ANNUAL', 756_000),
    discounts,
    ...(promotionCode === undefined ? {} : { promotion_code: promotionCode })
  })
  return { discounts: ledger.discounts, chips: ledger.chips }
}

describe('buildSummaryLedger discounts', () => {
  it.for<{
    name: string
    discounts: Discount[]
    promotionCode?: string
    amountDueCents?: number
    slots: ReturnType<typeof discountSlotsOf>
  }>([
    {
      name: 'a catalog coupon folds into the price: no row, no chip',
      discounts: [ANNUAL_RATE],
      amountDueCents: 756_000,
      slots: { discounts: [], chips: [] }
    },
    {
      name: 'an unnamed entered code reads "Promo code"; the code sits only on its removable chip',
      discounts: [ANNUAL_RATE, entered('COMFYFREE', 756_000)],
      promotionCode: 'COMFYFREE',
      slots: {
        discounts: [{ label: 'Promo code', amount: '−$7,560.00' }],
        chips: [{ code: 'COMFYFREE', removable: true }]
      }
    },
    {
      name: 'a named entered code reads its coupon name',
      discounts: [entered('LAUNCH20', 151_200, 'Launch week')],
      promotionCode: 'LAUNCH20',
      amountDueCents: 604_800,
      slots: {
        discounts: [{ label: 'Launch week', amount: '−$1,512.00' }],
        chips: [{ code: 'LAUNCH20', removable: true }]
      }
    },
    {
      name: 'the entered code matches the quote whatever its case',
      discounts: [entered('launch20', 151_200)],
      promotionCode: 'LAUNCH20',
      amountDueCents: 604_800,
      slots: {
        discounts: [{ label: 'Promo code', amount: '−$1,512.00' }],
        chips: [{ code: 'LAUNCH20', removable: true }]
      }
    },
    {
      name: 'a held discount is a row whose chip has no remove',
      discounts: [EDUCATION],
      amountDueCents: 604_800,
      slots: {
        discounts: [{ label: 'Education discount', amount: '−$1,512.00' }],
        chips: [{ code: 'COMFY-EDU', removable: false }]
      }
    },
    {
      name: 'a held discount the server lists first renders first',
      discounts: [ANNUAL_RATE, EDUCATION, entered('COMFY50', 302_400)],
      promotionCode: 'COMFY50',
      amountDueCents: 302_400,
      slots: {
        discounts: [
          { label: 'Education discount', amount: '−$1,512.00' },
          { label: 'Promo code', amount: '−$3,024.00' }
        ],
        chips: [
          { code: 'COMFY-EDU', removable: false },
          { code: 'COMFY50', removable: true }
        ]
      }
    },
    {
      name: 'an entered code the server lists first renders first',
      discounts: [entered('COMFY50', 302_400), ANNUAL_RATE, EDUCATION],
      promotionCode: 'COMFY50',
      amountDueCents: 302_400,
      slots: {
        discounts: [
          { label: 'Promo code', amount: '−$3,024.00' },
          { label: 'Education discount', amount: '−$1,512.00' }
        ],
        chips: [
          { code: 'COMFY-EDU', removable: false },
          { code: 'COMFY50', removable: true }
        ]
      }
    },
    {
      name: 'an entered code with no reported amount keeps its row, amount left out',
      discounts: [EDUCATION, entered('COMFY50')],
      promotionCode: 'COMFY50',
      amountDueCents: 302_400,
      slots: {
        discounts: [
          { label: 'Education discount', amount: '−$1,512.00' },
          { label: 'Promo code' }
        ],
        chips: [
          { code: 'COMFY-EDU', removable: false },
          { code: 'COMFY50', removable: true }
        ]
      }
    }
  ])('$name', ({ discounts, promotionCode, amountDueCents, slots }) => {
    expect(discountSlotsOf(discounts, promotionCode, amountDueCents)).toEqual(
      slots
    )
  })

  it('keeps the plan row over a $0 due once an entered code explains it', () => {
    const { items } = ledgerOf({
      transition_type: 'new_subscription',
      amount_due_cents: 0,
      cost_today_cents: 0,
      subtotal_cents: 756_000,
      new_plan: planOf('TEAM', 'ANNUAL', 756_000),
      discounts: [entered('COMFYFREE', 756_000)],
      promotion_code: 'COMFYFREE'
    })

    expect(items).toEqual([
      { label: 'Team Plan', amount: '$7,560.00', sublines: ['Billed yearly'] }
    ])
  })
  it('prices the plan row before the code, so the row, the discount and the total add up', () => {
    const ledger = ledgerOf({
      transition_type: 'new_subscription',
      subtotal_cents: 2000,
      cost_today_cents: 1600,
      amount_due_cents: 1600,
      cost_next_period_cents: 2000,
      renewal_amount_cents: 2000,
      new_plan: planOf('STANDARD', 'MONTHLY', 2000),
      promotion_code: 'EMBED_QA_20PCT_ONCE',
      discounts: [
        {
          ...entered('EMBED_QA_20PCT_ONCE', 400, 'Embedded QA 20% once'),
          term: 'first_month',
          duration: 'once'
        }
      ]
    })

    expect({
      items: ledger.items.map(({ label, amount }) => [label, amount]),
      discounts: ledger.discounts,
      total: ledger.total
    }).toEqual({
      items: [['Standard Plan', '$20.00']],
      discounts: [
        {
          label: 'Embedded QA 20% once',
          amount: '−$4.00',
          subline: 'First month'
        }
      ],
      total: '$16.00'
    })
  })
})

describe('buildSummaryLedger server-reported fields', () => {
  const discountRowsOf = (
    discount: Partial<Discount>,
    transition: SubscriptionPreview['transition_type'] = 'new_subscription',
    duration: Plan['duration'] = 'MONTHLY'
  ) =>
    ledgerOf({
      transition_type: transition,
      amount_due_cents: 604_800,
      cost_today_cents: 756_000,
      new_plan: planOf('TEAM', duration, 756_000),
      promotion_code: 'COMFY20',
      discounts: [{ ...entered('COMFY20', 151_200), ...discount }]
    }).discounts

  it.for<{
    name: string
    discount: Partial<Discount>
    subline?: string
  }>([
    {
      name: 'this payment only',
      discount: { term: 'this_payment', duration: 'once' },
      subline: 'This payment only'
    },
    {
      name: 'the first month',
      discount: { term: 'first_month', duration: 'once' },
      subline: 'First month'
    },
    {
      name: 'the first year',
      discount: { term: 'first_year', duration: 'once' },
      subline: 'First year'
    },
    {
      name: 'a number of months',
      discount: {
        term: 'months',
        duration: 'repeating',
        duration_in_months: 3
      },
      subline: 'For 3 months'
    },
    {
      name: 'a single month',
      discount: {
        term: 'months',
        duration: 'repeating',
        duration_in_months: 1
      },
      subline: 'For 1 month'
    },
    {
      name: 'months the quote does not count',
      discount: { term: 'months', duration: 'repeating' }
    },
    {
      name: 'an ongoing discount',
      discount: { term: 'ongoing', duration: 'forever' }
    },
    {
      name: 'no term from the server',
      discount: { duration: 'once' }
    }
  ])(
    'bounds a discount row by the server-reported term: $name',
    ({ discount, subline }) => {
      expect(discountRowsOf(discount)).toEqual([
        {
          label: 'Promo code',
          amount: '−$1,512.00',
          ...(subline === undefined ? {} : { subline })
        }
      ])
    }
  )

  it.for<{
    transition: SubscriptionPreview['transition_type']
    duration: Plan['duration']
  }>([
    { transition: 'new_subscription', duration: 'MONTHLY' },
    { transition: 'upgrade', duration: 'MONTHLY' },
    { transition: 'downgrade', duration: 'MONTHLY' },
    { transition: 'duration_change', duration: 'ANNUAL' }
  ])(
    'words the term the same on a $transition to a $duration plan',
    ({ transition, duration }) => {
      const sublineOf = (term: Discount['term']) =>
        discountRowsOf({ term, duration: 'once' }, transition, duration)[0]
          .subline

      expect([
        sublineOf('this_payment'),
        sublineOf('first_month'),
        sublineOf('first_year')
      ]).toEqual(['This payment only', 'First month', 'First year'])
    }
  )

  it.for<{
    name: string
    duration: Plan['duration']
    rate: SummaryLedger['items'][number]['comparedRate']
  }>([
    {
      name: 'yearly',
      duration: 'ANNUAL',
      rate: {
        keypath: 'checkout.fullPage.summary.item.comparedYearly',
        amount: '$7,560',
        listAmount: '$8,400'
      }
    },
    {
      name: 'monthly',
      duration: 'MONTHLY',
      rate: {
        keypath: 'checkout.fullPage.summary.item.comparedMonthly',
        amount: '$7,560',
        listAmount: '$8,400'
      }
    }
  ])(
    'strikes through the list price a discounted $name rate replaces',
    ({ duration, rate }) => {
      const [item] = ledgerOf({
        transition_type: 'new_subscription',
        amount_due_cents: 756_000,
        cost_today_cents: 756_000,
        credits_today_cents: 0,
        credits_next_period_cents: 0,
        credits_today: 0,
        credits_next_period: 0,
        new_plan: planOf('TEAM', duration, 756_000, {
          list_price_cents: 840_000
        })
      }).items

      expect(item).toEqual({
        label: 'Team Plan',
        amount: '$7,560.00',
        comparedRate: rate,
        sublines: []
      })
    }
  )

  it.for<{
    name: string
    extra: Partial<Plan>
    rate: Pick<SummaryLedger['items'][number], 'comparedRate' | 'sublines'>
  }>([
    {
      name: 'reads a yearly rate in the monthly figures the server sent',
      extra: {
        list_price_cents: 840_000,
        monthly_price_cents: 63_000,
        monthly_list_price_cents: 70_000
      },
      rate: {
        comparedRate: {
          keypath: 'checkout.fullPage.summary.item.comparedYearlyMonthly',
          amount: '$630',
          listAmount: '$700'
        },
        sublines: []
      }
    },
    {
      name: 'states a yearly monthly rate plainly when no list price came with it',
      extra: { monthly_price_cents: 63_000 },
      rate: { sublines: ['$630 /mo × 12 months, billed yearly'] }
    },
    {
      name: 'strikes through any list price the server sent, even one at the price',
      extra: { list_price_cents: 756_000 },
      rate: {
        comparedRate: {
          keypath: 'checkout.fullPage.summary.item.comparedYearly',
          amount: '$7,560',
          listAmount: '$7,560'
        },
        sublines: []
      }
    }
  ])('$name', ({ extra, rate }) => {
    const [item] = ledgerOf({
      transition_type: 'new_subscription',
      amount_due_cents: 756_000,
      cost_today_cents: 756_000,
      credits_today_cents: 0,
      credits_next_period_cents: 0,
      credits_today: 0,
      credits_next_period: 0,
      new_plan: planOf('TEAM', 'ANNUAL', 756_000, extra)
    }).items

    expect(item).toEqual({ label: 'Team Plan', amount: '$7,560.00', ...rate })
  })

  const PRORATED_OVER_BALANCE: Partial<SubscriptionPreview> = {
    transition_type: 'upgrade',
    proration_at: PRICED_AT,
    amount_due_cents: 2750,
    cost_today_cents: 2750,
    balance_applied_cents: 500,
    subtotal_cents: 3250,
    renewal_at: JULY_28,
    current_plan: planOf('CREATOR', 'MONTHLY', 3500),
    new_plan: planOf('PRO', 'MONTHLY', 10_000)
  }

  it('lists the account balance the server applied, and keeps the row it explains', () => {
    const ledger = ledgerOf(PRORATED_OVER_BALANCE)

    expect(ledger.items.map(({ label, amount }) => [label, amount])).toEqual([
      ['Pro Plan - Prorated', '$32.50']
    ])
    expect(ledger.balance).toEqual({
      label: 'Account balance',
      amount: '−$5.00',
      subline: 'Credit already on your account'
    })
    expect(ledger.total).toBe('$27.50')
  })

  it('shows no balance row when the server applied none', () => {
    expect(ledgerOf({ amount_due_cents: 2800 })).not.toHaveProperty('balance')
  })

  it('shows no Subtotal under a single money row, even with a discount and a reported subtotal', () => {
    const ledger = ledgerOf({
      ...PRORATED_OVER_BALANCE,
      balance_applied_cents: undefined,
      amount_due_cents: 2250,
      promotion_code: 'COMFY10',
      discounts: [entered('COMFY10', 1000)]
    })

    expect(ledger.discounts).toHaveLength(1)
    expect(ledger).not.toHaveProperty('subtotal')
  })
})

describe('buildSummaryLedger itemized proration', () => {
  const ITEMIZED_UPGRADE: Partial<SubscriptionPreview> = {
    transition_type: 'upgrade',
    proration_at: PRICED_AT,
    amount_due_cents: 3250,
    cost_today_cents: 3250,
    proration_remaining_cents: 5000,
    proration_unused_cents: 1750,
    renewal_at: JULY_28,
    credits_next_period_cents: 10_000,
    credits_next_period: 21_100,
    current_plan: planOf('CREATOR', 'MONTHLY', 3500),
    new_plan: planOf('PRO', 'MONTHLY', 10_000)
  }
  const REMAINING = {
    label: 'Remaining time on Pro Plan',
    amount: '$50.00',
    sublines: ['Credits refill to 21,100 each month']
  }
  const UNUSED = {
    label: 'Unused time on Creator Plan',
    amount: '−$17.50',
    sublines: [],
    credit: true
  }
  type Rows = Pick<
    SummaryLedger,
    'items' | 'subtotal' | 'discounts' | 'balance' | 'total'
  >

  it.for<{ name: string; quote: Partial<SubscriptionPreview>; rows: Rows }>([
    {
      name: 'both amounts reported: a remaining-time charge and an unused-time credit that add up to the total',
      quote: {},
      rows: { items: [REMAINING, UNUSED], discounts: [], total: '$32.50' }
    },
    {
      name: 'a code on top: the Subtotal the server reported, then the discount',
      quote: {
        amount_due_cents: 2250,
        subtotal_cents: 3250,
        promotion_code: 'COMFY10',
        discounts: [entered('COMFY10', 1000)]
      },
      rows: {
        items: [REMAINING, UNUSED],
        subtotal: '$32.50',
        discounts: [{ label: 'Promo code', amount: '−$10.00' }],
        total: '$22.50'
      }
    },
    {
      name: 'an account balance on top: the balance row, no Subtotal',
      quote: {
        amount_due_cents: 2750,
        subtotal_cents: 3250,
        balance_applied_cents: 500
      },
      rows: {
        items: [REMAINING, UNUSED],
        discounts: [],
        balance: {
          label: 'Account balance',
          amount: '−$5.00',
          subline: 'Credit already on your account'
        },
        total: '$27.50'
      }
    },
    {
      name: 'a gap to the total nothing explains: neither row',
      quote: { amount_due_cents: 0 },
      rows: { items: [], discounts: [], total: '$0.00' }
    },
    {
      name: 'only the remaining amount reported: the single net row',
      quote: { proration_unused_cents: undefined },
      rows: {
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
        discounts: [],
        total: '$32.50'
      }
    }
  ])('$name', ({ quote, rows }) => {
    const { items, subtotal, discounts, balance, total } = ledgerOf({
      ...ITEMIZED_UPGRADE,
      ...quote
    })

    expect({ items, subtotal, discounts, balance, total }).toEqual(rows)
  })

  it('names the cadence of both plans when the change crosses cadences', () => {
    const { items } = ledgerOf({
      ...ITEMIZED_UPGRADE,
      new_plan: planOf('PRO', 'ANNUAL', 100_000)
    })

    expect(items.map(({ label }) => label)).toEqual([
      'Remaining time on Pro Yearly',
      'Unused time on Creator Monthly'
    ])
  })
})

describe('buildSummaryLedger credit counts', () => {
  const STANDARD_GRANT = { credits_today: 4200, credits_next_period: 4200 }
  const TEAM_STOP_GRANT = { credits_today: 0, credits_next_period: 16_899 }
  const PRORATED_GRANT = { credits_today: 2531, credits_next_period: 16_899 }
  const TODAY_COUNT_ONLY = { credits_today: 4200 }
  const NEXT_PERIOD_COUNT_ONLY = { credits_next_period: 4200 }
  const UNEQUAL_GRANT_SAME_CENTS = {
    credits_today: 4201,
    credits_next_period: 4200
  }

  it.for<{
    name: string
    quote: Partial<SubscriptionPreview>
    expected: Pick<SummaryLedger, 'credits'> & {
      sublines: readonly string[]
    }
  }>([
    {
      name: 'a new subscription counts the grant the receipt will report',
      quote: {
        transition_type: 'new_subscription',
        credits_today_cents: 1991,
        credits_next_period_cents: 1991,
        new_plan: planOf('STANDARD', 'MONTHLY', 2000),
        ...STANDARD_GRANT
      },
      expected: {
        credits: { count: '4,200', qualifier: 'credits per month' },
        sublines: ['$20 /mo, billed monthly']
      }
    },
    {
      name: 'a scheduled change counts the grant its first period will add',
      quote: {
        transition_type: 'downgrade',
        is_immediate: false,
        effective_at: JULY_28,
        credits_today_cents: 0,
        credits_next_period_cents: 8010,
        current_plan: planOf('PRO', 'MONTHLY', 10_000),
        new_plan: planOf('TEAM', 'MONTHLY', 8009),
        ...TEAM_STOP_GRANT
      },
      expected: {
        credits: {
          count: '16,899',
          qualifier: 'credits refill monthly after July\u00A028,\u00A02026'
        },
        sublines: ['Starts July\u00A028,\u00A02026, billed monthly']
      }
    },
    {
      name: 'a prorated upgrade counts today and the refill as granted',
      quote: {
        transition_type: 'upgrade',
        proration_at: PRICED_AT,
        renewal_at: JULY_28,
        amount_due_cents: 1200,
        cost_today_cents: 1200,
        credits_today_cents: 1200,
        credits_next_period_cents: 8010,
        current_plan: planOf('STANDARD', 'MONTHLY', 2000),
        new_plan: planOf('PRO', 'MONTHLY', 8009),
        ...PRORATED_GRANT
      },
      expected: {
        credits: {
          count: '2,531',
          qualifier: 'credits added today (expire July\u00A028)'
        },
        sublines: [
          'Remaining time for Pro plan, less unused time from Standard plan',
          'Credits refill to 16,899 each month'
        ]
      }
    },
    {
      name: 'a grant unequal to the allowance stays dated even when both round to the same cents',
      quote: {
        transition_type: 'new_subscription',
        credits_today_cents: 1991,
        credits_next_period_cents: 1991,
        new_plan: planOf('STANDARD', 'MONTHLY', 2000),
        ...UNEQUAL_GRANT_SAME_CENTS
      },
      expected: {
        credits: { count: '4,201', qualifier: 'credits added today' },
        sublines: [
          '$20 /mo, billed monthly',
          'Credits refill to 4,200 each month'
        ]
      }
    },
    {
      name: "only today's count: it stays dated, with no refill line",
      quote: {
        transition_type: 'new_subscription',
        credits_today_cents: 1991,
        credits_next_period_cents: 1991,
        new_plan: planOf('STANDARD', 'MONTHLY', 2000),
        ...TODAY_COUNT_ONLY
      },
      expected: {
        credits: { count: '4,200', qualifier: 'credits added today' },
        sublines: ['$20 /mo, billed monthly']
      }
    },
    {
      name: "only the refill's count: no credits line for today, the refill still reads",
      quote: {
        transition_type: 'new_subscription',
        credits_today_cents: 1991,
        credits_next_period_cents: 1991,
        new_plan: planOf('STANDARD', 'MONTHLY', 2000),
        ...NEXT_PERIOD_COUNT_ONLY
      },
      expected: {
        credits: undefined,
        sublines: [
          '$20 /mo, billed monthly',
          'Credits refill to 4,200 each month'
        ]
      }
    },
    {
      name: 'no counts: the rounded cents are never converted, so no credit line renders',
      quote: {
        transition_type: 'new_subscription',
        credits_today_cents: 1991,
        credits_next_period_cents: 1991,
        new_plan: planOf('STANDARD', 'MONTHLY', 2000)
      },
      expected: {
        credits: undefined,
        sublines: ['$20 /mo, billed monthly']
      }
    },
    {
      name: 'no counts on a prorated upgrade: neither the grant nor the refill renders',
      quote: {
        transition_type: 'upgrade',
        proration_at: PRICED_AT,
        renewal_at: JULY_28,
        amount_due_cents: 1200,
        cost_today_cents: 1200,
        credits_today_cents: 1200,
        credits_next_period_cents: 8010,
        current_plan: planOf('STANDARD', 'MONTHLY', 2000),
        new_plan: planOf('PRO', 'MONTHLY', 8009)
      },
      expected: {
        credits: undefined,
        sublines: [
          'Remaining time for Pro plan, less unused time from Standard plan'
        ]
      }
    },
    {
      name: 'no counts on a scheduled change: no refill line',
      quote: {
        transition_type: 'downgrade',
        is_immediate: false,
        effective_at: JULY_28,
        credits_today_cents: 0,
        credits_next_period_cents: 8010,
        current_plan: planOf('PRO', 'MONTHLY', 10_000),
        new_plan: planOf('TEAM', 'MONTHLY', 8009)
      },
      expected: {
        credits: undefined,
        sublines: ['Starts July\u00A028,\u00A02026, billed monthly']
      }
    }
  ])('$name', ({ quote, expected }) => {
    const { credits, items } = ledgerOf(quote)

    expect({ credits, sublines: items[0]?.sublines }).toEqual(expected)
  })
})

describe('the eyebrow and the Pay button name the same purchase', () => {
  it.for<{
    name: string
    quote: Partial<SubscriptionPreview>
    eyebrow: string
    purchase: ReturnType<typeof planPurchaseOf>
  }>([
    {
      name: 'a tier upgrade',
      quote: {
        transition_type: 'upgrade',
        proration_at: PRICED_AT,
        current_plan: planOf('CREATOR', 'MONTHLY', 3500),
        new_plan: planOf('PRO', 'MONTHLY', 10_000)
      },
      eyebrow: 'Upgrade to Pro Plan',
      purchase: 'upgrade'
    },
    {
      name: 'a raised team commitment',
      quote: {
        transition_type: 'upgrade',
        proration_at: PRICED_AT,
        current_plan: planOf('TEAM', 'MONTHLY', 20_000),
        new_plan: planOf('TEAM', 'MONTHLY', 40_000)
      },
      eyebrow: 'Upgrade to Team Plan',
      purchase: 'upgrade'
    },
    {
      name: 'a lowered team commitment',
      quote: {
        transition_type: 'downgrade',
        is_immediate: false,
        effective_at: JULY_28,
        current_plan: planOf('TEAM', 'MONTHLY', 40_000),
        new_plan: planOf('TEAM', 'MONTHLY', 20_000)
      },
      eyebrow: 'Switch to Team Plan',
      purchase: 'change'
    }
  ])('$name', ({ quote, eyebrow, purchase }) => {
    expect({
      eyebrow: ledgerOf(quote, null).eyebrow,
      purchase: planPurchaseOf(previewOf({ currency: 'usd', ...quote }))
    }).toEqual({ eyebrow, purchase })
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
