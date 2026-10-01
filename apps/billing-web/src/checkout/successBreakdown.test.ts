import type { SubscriptionPreview } from '@comfyorg/account-core/billing'

import type { CheckoutPage } from '@/checkout/checkoutPage'
import type { SuccessBreakdown } from '@/checkout/successBreakdown'
import { successBreakdown } from '@/checkout/successBreakdown'
import { createBillingI18n } from '@/i18n'
import { previewOf, succeededOperation } from '@/test/fakeBillingClient'

const { t } = createBillingI18n().global

const context = {
  workspace: 'Comfy Studios',
  tierName: (tier: SubscriptionPreview['new_plan']['tier']) =>
    t(`hosted.tier.${tier}`),
  t,
  locale: 'en'
}

const PRO_MONTHLY = {
  slug: 'pro_monthly',
  tier: 'PRO',
  duration: 'MONTHLY',
  price_cents: 10_000,
  credits_cents: 0,
  seat_summary: {
    seat_count: 1,
    total_cost_cents: 10_000,
    total_credits_cents: 0
  }
} as const satisfies SubscriptionPreview['new_plan']

function quoteOf(overrides: Partial<SubscriptionPreview>): SubscriptionPreview {
  return previewOf({
    currency: 'usd',
    new_plan: PRO_MONTHLY,
    amount_due_cents: 10_000,
    cost_today_cents: 10_000,
    ...overrides
  })
}

const ownPay: CheckoutPage = { kind: 'terminal', attribution: 'started' }

function settled(
  attribution: 'started' | 'returned' | 'settled',
  amountChargedCents?: number
): CheckoutPage {
  const operation = {
    ...succeededOperation('op_paid'),
    receipt: { amountChargedCents, creditsAdded: 21_100 }
  }
  return {
    kind: 'terminal',
    attribution,
    operation,
    plan: { tier: 'PRO', duration: 'MONTHLY', price_cents: 10_000n }
  }
}

describe('successBreakdown', () => {
  it.for<{
    name: string
    page: CheckoutPage
    quote?: SubscriptionPreview
    breakdown: SuccessBreakdown | undefined
  }>([
    {
      name: 'in-page Pay with a promo code entered at checkout',
      page: ownPay,
      quote: quoteOf({
        amount_due_cents: 8_000,
        promotion_code: 'SAVE20',
        discounts: [
          {
            kind: 'promotion',
            code: 'SAVE20',
            name: 'Save 20%',
            amount_off_cents: 2_000,
            duration: 'once'
          }
        ]
      }),
      breakdown: {
        deductions: [
          { label: 'Save 20%', amount: '−$20.00', subline: 'First month' }
        ],
        paidToday: { label: 'Paid today', amount: '$80.00', sublines: [] }
      }
    },
    {
      name: 'in-page Pay under a discount the subscription already holds',
      page: ownPay,
      quote: quoteOf({
        amount_due_cents: 7_500,
        discounts: [
          {
            kind: 'promotion',
            code: 'LOYAL',
            name: 'Loyalty',
            amount_off_cents: 2_500,
            duration: 'repeating',
            duration_in_months: 3
          }
        ]
      }),
      breakdown: {
        deductions: [
          { label: 'Loyalty', amount: '−$25.00', subline: 'For 3 months' }
        ],
        paidToday: { label: 'Paid today', amount: '$75.00', sublines: [] }
      }
    },
    {
      name: 'in-page Pay partly covered by the account balance',
      page: ownPay,
      quote: quoteOf({ amount_due_cents: 9_000, balance_applied_cents: 1_000 }),
      breakdown: {
        deductions: [
          {
            label: 'Account balance',
            amount: '−$10.00',
            subline: 'Credit already on your account'
          }
        ],
        paidToday: { label: 'Paid today', amount: '$90.00', sublines: [] }
      }
    },
    {
      name: 'a prorated upgrade: no itemized rows, only the paid amount and why',
      page: ownPay,
      quote: quoteOf({
        transition_type: 'upgrade',
        proration_at: '2026-07-10T09:30:00.000Z',
        current_plan: {
          ...PRO_MONTHLY,
          slug: 'standard_monthly',
          tier: 'STANDARD'
        },
        amount_due_cents: 4_321,
        cost_today_cents: 4_321,
        balance_applied_cents: 0
      }),
      breakdown: {
        deductions: [],
        paidToday: {
          label: 'Paid today',
          amount: '$43.21',
          sublines: ['Prorated for the rest of this billing period']
        }
      }
    },
    {
      name: 'paid today matches the plan rate: the card stays as is',
      page: ownPay,
      quote: quoteOf({}),
      breakdown: undefined
    },
    {
      name: 'a plan-level discounted rate charged in full',
      page: ownPay,
      quote: quoteOf({
        new_plan: { ...PRO_MONTHLY, list_price_cents: 12_000 },
        discounts: [{ kind: 'plan', code: 'ANNUAL', amount_off_cents: 2_000 }]
      }),
      breakdown: undefined
    },
    {
      name: 'a scheduled change that charges nothing today',
      page: ownPay,
      quote: quoteOf({
        is_immediate: false,
        transition_type: 'downgrade',
        amount_due_cents: 0,
        cost_today_cents: 0
      }),
      breakdown: undefined
    },
    {
      name: 'in-page Pay whose finished op reported the charge',
      page: settled('started', 7_900),
      quote: quoteOf({
        amount_due_cents: 8_000,
        promotion_code: 'SAVE20',
        discounts: [
          {
            kind: 'promotion',
            code: 'SAVE20',
            name: 'Save 20%',
            amount_off_cents: 2_000
          }
        ]
      }),
      breakdown: {
        deductions: [{ label: 'Save 20%', amount: '−$20.00' }],
        paidToday: { label: 'Paid today', amount: '$79.00', sublines: [] }
      }
    },
    {
      name: 'a provider return reads only the op status: Paid today alone',
      page: settled('returned', 8_000),
      quote: quoteOf({
        amount_due_cents: 8_000,
        promotion_code: 'SAVE20',
        discounts: [
          {
            kind: 'promotion',
            code: 'SAVE20',
            amount_off_cents: 2_000
          }
        ]
      }),
      breakdown: {
        deductions: [],
        paidToday: { label: 'Paid today', amount: '$80.00', sublines: [] }
      }
    },
    {
      name: 'a provider return charged the plan rate',
      page: settled('returned', 10_000),
      breakdown: undefined
    },
    {
      name: 'a provider return whose op does not report the charge',
      page: settled('returned'),
      breakdown: undefined
    },
    {
      name: 'a payment this page did not send is not a Success',
      page: settled('settled', 8_000),
      breakdown: undefined
    }
  ])('$name', ({ page, quote, breakdown }) => {
    expect(successBreakdown(page, quote, context)).toEqual(breakdown)
  })
})
