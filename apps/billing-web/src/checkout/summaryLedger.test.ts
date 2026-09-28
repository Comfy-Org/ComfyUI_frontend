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
        chips: [],
        acceptsPromo: true,
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
        chips: [],
        acceptsPromo: true,
        total: '$7,560.00',
        trailing: ['Renews at $7,560.00 on June 28, 2027']
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
        new_plan: planOf('TEAM', 'ANNUAL', 756_000)
      },
      ledger: {
        family: 'charge_now',
        eyebrow: 'Subscribe to Team Plan · Comfy Studios',
        headline: { amount: '$0', currency: 'USD' },
        credits: { count: '1,772,400', qualifier: 'credits per year' },
        items: [],
        adjustments: [],
        chips: [],
        acceptsPromo: true,
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
        chips: [],
        acceptsPromo: true,
        total: '$32.50',
        trailing: [
          'Existing credits are kept',
          'Renews at $100.00 on July 28, 2026'
        ]
      }
    },
    {
      name: 'tier upgrade without a proration instant: a plain charge, never labelled prorated',
      quote: {
        transition_type: 'upgrade',
        amount_due_cents: 10_000,
        cost_today_cents: 10_000,
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
        headline: { amount: '$100', currency: 'USD' },
        credits: { count: '21,100', qualifier: 'credits per month' },
        items: [
          {
            label: 'Pro Plan',
            amount: '$100.00',
            sublines: ['$100 /mo, billed monthly']
          }
        ],
        adjustments: [],
        chips: [],
        acceptsPromo: true,
        total: '$100.00',
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
        chips: [],
        acceptsPromo: true,
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
        chips: [],
        acceptsPromo: true,
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
        chips: [],
        acceptsPromo: false,
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
        chips: [],
        acceptsPromo: false,
        total: '$0.00',
        trailing: ["You'll keep Creator Yearly until June 28, 2027"]
      }
    },
    {
      name: 'team commit change priced at a proration instant: neutral, no proration copy and no credits delta',
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
        credits: { count: '295,400', qualifier: 'credits per month' },
        items: [
          {
            label: 'Team Plan',
            amount: '$123.45',
            sublines: ['$1,400 /mo, billed monthly']
          }
        ],
        adjustments: [],
        chips: [],
        acceptsPromo: true,
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
  const { adjustments, subtotal, promo, chips } = ledgerOf({
    transition_type: 'new_subscription',
    amount_due_cents: amountDueCents,
    cost_today_cents: 756_000,
    new_plan: planOf('TEAM', 'ANNUAL', 756_000),
    discounts,
    ...(promotionCode === undefined ? {} : { promotion_code: promotionCode })
  })
  return { adjustments, subtotal, promo, chips }
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
      slots: {
        adjustments: [],
        subtotal: undefined,
        promo: undefined,
        chips: []
      }
    },
    {
      name: 'an unnamed entered code reads "Promo code"; the code sits only on its removable chip',
      discounts: [ANNUAL_RATE, entered('COMFYFREE', 756_000)],
      promotionCode: 'COMFYFREE',
      slots: {
        adjustments: [],
        subtotal: undefined,
        promo: { label: 'Promo code', amount: '−$7,560.00' },
        chips: [{ code: 'COMFYFREE', removable: true }]
      }
    },
    {
      name: 'a named entered code reads its coupon name',
      discounts: [entered('LAUNCH20', 151_200, 'Launch week')],
      promotionCode: 'LAUNCH20',
      amountDueCents: 604_800,
      slots: {
        adjustments: [],
        subtotal: undefined,
        promo: { label: 'Launch week', amount: '−$1,512.00' },
        chips: [{ code: 'LAUNCH20', removable: true }]
      }
    },
    {
      name: 'the entered code matches the quote whatever its case',
      discounts: [entered('launch20', 151_200)],
      promotionCode: 'LAUNCH20',
      amountDueCents: 604_800,
      slots: {
        adjustments: [],
        subtotal: undefined,
        promo: { label: 'Promo code', amount: '−$1,512.00' },
        chips: [{ code: 'LAUNCH20', removable: true }]
      }
    },
    {
      name: 'a held discount is a pre-applied row whose chip has no remove',
      discounts: [EDUCATION],
      amountDueCents: 604_800,
      slots: {
        adjustments: [{ label: 'Education discount', amount: '−$1,512.00' }],
        subtotal: undefined,
        promo: undefined,
        chips: [{ code: 'COMFY-EDU', removable: false }]
      }
    },
    {
      name: 'a held discount before an entered code: Subtotal names the base the code applied to',
      discounts: [ANNUAL_RATE, EDUCATION, entered('COMFY50', 302_400)],
      promotionCode: 'COMFY50',
      amountDueCents: 302_400,
      slots: {
        adjustments: [{ label: 'Education discount', amount: '−$1,512.00' }],
        subtotal: '$6,048.00',
        promo: { label: 'Promo code', amount: '−$3,024.00' },
        chips: [
          { code: 'COMFY-EDU', removable: false },
          { code: 'COMFY50', removable: true }
        ]
      }
    },
    {
      name: 'an entered code with no reported amount keeps its row and no Subtotal',
      discounts: [EDUCATION, entered('COMFY50')],
      promotionCode: 'COMFY50',
      amountDueCents: 302_400,
      slots: {
        adjustments: [{ label: 'Education discount', amount: '−$1,512.00' }],
        subtotal: undefined,
        promo: { label: 'Promo code' },
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
      cost_today_cents: 756_000,
      new_plan: planOf('TEAM', 'ANNUAL', 756_000),
      discounts: [entered('COMFYFREE', 756_000)],
      promotion_code: 'COMFYFREE'
    })

    expect(items).toEqual([
      { label: 'Team Plan', amount: '$7,560.00', sublines: ['Billed yearly'] }
    ])
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
