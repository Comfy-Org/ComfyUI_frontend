import type { BillingChargeBreakdown } from '@comfyorg/account-core/billing'

import type { CheckoutPage } from '@/checkout/checkoutPage'
import type { SuccessBreakdown } from '@/checkout/successBreakdown'
import { successBreakdown } from '@/checkout/successBreakdown'
import { createBillingI18n } from '@/i18n'
import { succeededOperation } from '@/test/fakeBillingClient'

const { t } = createBillingI18n().global

const context = { t, locale: 'en' }

function settled(
  attribution: 'started' | 'returned' | 'settled',
  chargeBreakdown?: BillingChargeBreakdown
): CheckoutPage {
  const operation = {
    ...succeededOperation('op_paid'),
    receipt: {
      amountChargedCents: chargeBreakdown?.amount_charged_cents ?? 10_000,
      creditsAdded: 21_100,
      ...(chargeBreakdown === undefined ? {} : { chargeBreakdown })
    }
  }
  return { kind: 'terminal', attribution, operation }
}

function charged(
  overrides: Partial<BillingChargeBreakdown>
): BillingChargeBreakdown {
  return {
    amount_charged_cents: 8_000,
    currency: 'usd',
    prorated: false,
    reasons: [],
    ...overrides
  }
}

const PROMO = charged({
  amount_charged_cents: 7_750,
  reasons: [
    {
      kind: 'promo_code',
      amount_cents: 2_000,
      discount: {
        kind: 'promotion',
        code: 'SAVE20',
        name: 'Save 20%',
        duration: 'once',
        term: 'first_month'
      }
    },
    { kind: 'account_balance', amount_cents: 250 }
  ]
})

const PROMO_ROWS: SuccessBreakdown = {
  deductions: [
    { label: 'Save 20%', amount: '−$20.00', subline: 'First month' },
    {
      label: 'Account balance',
      amount: '−$2.50',
      subline: 'Credit already on your account'
    }
  ],
  paidToday: { label: 'Paid today', amount: '$77.50', sublines: [] }
}

describe('successBreakdown', () => {
  it.for<{
    name: string
    page: CheckoutPage
    breakdown: SuccessBreakdown | undefined
  }>([
    {
      name: 'no breakdown reported: the card stays as is',
      page: settled('started'),
      breakdown: undefined
    },
    {
      name: 'a promo code and the account balance, in the server order',
      page: settled('started', PROMO),
      breakdown: PROMO_ROWS
    },
    {
      name: 'a provider return reads the same rows from the op status',
      page: settled('returned', PROMO),
      breakdown: PROMO_ROWS
    },
    {
      name: 'a discount the subscription already holds, unnamed',
      page: settled(
        'started',
        charged({
          amount_charged_cents: 7_500,
          reasons: [
            {
              kind: 'subscription_discount',
              amount_cents: 2_500,
              discount: {
                kind: 'promotion',
                code: 'LOYAL',
                duration: 'repeating'
              }
            }
          ]
        })
      ),
      breakdown: {
        deductions: [{ label: 'Promo code', amount: '−$25.00' }],
        paidToday: { label: 'Paid today', amount: '$75.00', sublines: [] }
      }
    },
    {
      name: 'a promo reason with its term in months',
      page: settled(
        'started',
        charged({
          reasons: [
            {
              kind: 'promo_code',
              amount_cents: 2_000,
              discount: {
                kind: 'promotion',
                code: 'LOYAL',
                name: 'Loyalty',
                duration: 'repeating',
                duration_in_months: 3,
                term: 'months'
              }
            }
          ]
        })
      ),
      breakdown: {
        deductions: [
          { label: 'Loyalty', amount: '−$20.00', subline: 'For 3 months' }
        ],
        paidToday: { label: 'Paid today', amount: '$80.00', sublines: [] }
      }
    },
    {
      name: 'a one-time code on a monthly plan change covers this payment only',
      page: settled(
        'started',
        charged({
          reasons: [
            {
              kind: 'promo_code',
              amount_cents: 2_000,
              discount: {
                kind: 'promotion',
                code: 'SWITCH20',
                name: 'Switch offer',
                duration: 'once',
                term: 'this_payment'
              }
            }
          ]
        })
      ),
      breakdown: {
        deductions: [
          {
            label: 'Switch offer',
            amount: '−$20.00',
            subline: 'This payment only'
          }
        ],
        paidToday: { label: 'Paid today', amount: '$80.00', sublines: [] }
      }
    },
    {
      name: 'prorated: no itemized rows, only the paid amount and why',
      page: settled(
        'started',
        charged({ amount_charged_cents: 4_321, prorated: true })
      ),
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
      name: 'a charge equal to the plan price still shows the reported rows',
      page: settled(
        'started',
        charged({
          amount_charged_cents: 10_000,
          reasons: [{ kind: 'account_balance', amount_cents: 500 }]
        })
      ),
      breakdown: {
        deductions: [
          {
            label: 'Account balance',
            amount: '−$5.00',
            subline: 'Credit already on your account'
          }
        ],
        paidToday: { label: 'Paid today', amount: '$100.00', sublines: [] }
      }
    },
    {
      name: 'a payment this page did not send is not a Success',
      page: settled('settled', PROMO),
      breakdown: undefined
    }
  ])('$name', ({ page, breakdown }) => {
    expect(successBreakdown(page, context)).toEqual(breakdown)
  })
})
