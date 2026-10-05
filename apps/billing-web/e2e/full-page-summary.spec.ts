import type { Page } from '@playwright/test'

import { switchToYearly } from './fixtures/scenario'
import { installFakeStripe } from './fixtures/stripe'
import { entryPath, expect, test as base } from './fixtures/test'

const test = base.extend<{ fullPage: void }>({
  fullPage: [
    async ({ context, cloud }, use) => {
      await installFakeStripe(context)
      cloud.scenario.checkoutUi = 'full_page'
      cloud.scenario.preview = {
        ...cloud.scenario.preview,
        payment_method_configuration_id: 'pmc_e2e'
      }
      await use(undefined)
    },
    { auto: true }
  ]
})

const CHECKOUT = entryPath('checkout', { plan: 'pro_monthly' })
const RENEWAL_AT = '2026-07-28T00:00:00.000Z'

async function expectSummary(page: Page, lines: readonly string[]) {
  const summary = page.getByRole('region', { name: 'Order summary' })
  await expect(summary).toHaveAttribute('aria-busy', 'false')
  for (const line of lines) await expect(summary).toContainText(line)
}

test('a new subscription reads its charge, allowance and renewal from the quote', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  cloud.scenario.preview = {
    ...cloud.scenario.preview,
    renewal_at: RENEWAL_AT,
    renewal_amount_cents: 5000
  }
  await signIn(CHECKOUT)

  await expectSummary(page, [
    'Subscribe to Pro Plan · Personal',
    '$50 USD',
    '21,100 credits per month',
    'Pro Plan$50.00',
    '$50 /mo, billed monthly',
    'Total due today$50.00',
    'Renews at $50.00 on July 28, 2026'
  ])
})

test('a quote without credit counts leaves the credits line out instead of converting the cents', async ({
  page,
  cloud,
  signIn
}) => {
  const {
    credits_today: _today,
    credits_next_period: _nextPeriod,
    ...uncounted
  } = cloud.scenario.preview
  cloud.scenario.preview = uncounted
  await signIn(CHECKOUT)

  await expectSummary(page, ['Subscribe to Pro Plan · Personal', '$50 USD'])
  await expect(
    page.getByRole('region', { name: 'Order summary' })
  ).not.toContainText('credits')
})

test('a tier upgrade itemizes the remaining time and the unused-time credit, with a dated credits delta', async ({
  page,
  cloud,
  signIn
}) => {
  const preview = cloud.scenario.preview
  cloud.scenario.preview = {
    ...preview,
    transition_type: 'upgrade',
    proration_at: '2026-07-10T09:30:00.000Z',
    amount_due_cents: 3250,
    cost_today_cents: 3250,
    proration_remaining_cents: 4500,
    proration_unused_cents: 1250,
    credits_today_cents: 3250,
    credits_next_period_cents: 10_000,
    credits_today: 6858,
    credits_next_period: 21_100,
    renewal_amount_cents: 10_000,
    renewal_at: RENEWAL_AT,
    current_plan: {
      ...preview.new_plan,
      slug: 'creator_monthly',
      tier: 'CREATOR',
      price_cents: 3500
    }
  }
  await signIn(CHECKOUT)

  await expectSummary(page, [
    'Upgrade to Pro Plan · Personal',
    '$32.50 USD',
    '6,858 credits added today (expire July 28)',
    'Remaining time on Pro Plan$45.00',
    'Credits refill to 21,100 each month',
    'Unused time on Creator Plan−$12.50',
    'Total due today$32.50',
    'Existing credits are kept',
    'Renews at $100.00 on July 28, 2026'
  ])
})

test('a raised team commitment reads like a tier upgrade: remaining and unused time named by each rate, credits added today, and Confirm upgrade', async ({
  page,
  cloud,
  signIn
}) => {
  const preview = cloud.scenario.preview
  const team = (cents: number) => ({
    ...preview.new_plan,
    slug: 'team_per_credit_monthly',
    tier: 'TEAM' as const,
    price_cents: cents,
    seat_summary: { ...preview.new_plan.seat_summary, total_cost_cents: cents }
  })
  cloud.scenario.preview = {
    ...preview,
    transition_type: 'upgrade',
    proration_at: '2026-07-10T09:30:00.000Z',
    amount_due_cents: 19_000,
    cost_today_cents: 19_000,
    proration_remaining_cents: 38_000,
    proration_unused_cents: 19_000,
    credits_today_cents: 19_000,
    credits_next_period_cents: 40_000,
    credits_today: 40_090,
    credits_next_period: 84_400,
    renewal_amount_cents: 40_000,
    renewal_at: RENEWAL_AT,
    current_plan: team(20_000),
    new_plan: team(40_000)
  }
  await signIn(
    entryPath('checkout', {
      plan: 'team_per_credit_monthly',
      team_credit_stop_id: 'stop_400'
    })
  )

  await expectSummary(page, [
    'Upgrade to Team Plan · Personal',
    '$190 USD',
    '40,090 credits added today (expire July 28)',
    'Remaining time on Team $400 /mo$380.00',
    'Credits refill to 84,400 each month',
    'Unused time on Team $200 /mo−$190.00',
    'Total due today$190.00',
    'Existing credits are kept',
    'Renews at $400.00 on July 28, 2026'
  ])
  await expect(
    page.getByRole('button', { name: 'Confirm upgrade' })
  ).toBeVisible()
})

test('294-8224: an upgrade a code takes to $0 says what the payment method on file will pay', async ({
  page,
  cloud,
  signIn
}) => {
  const preview = cloud.scenario.preview
  cloud.scenario.preview = {
    ...preview,
    transition_type: 'upgrade',
    amount_due_cents: 0,
    cost_today_cents: 5000,
    renewal_amount_cents: 5000,
    renewal_at: RENEWAL_AT,
    promotion_code: 'FREEMONTH',
    discounts: [
      { kind: 'promotion', code: 'FREEMONTH', amount_off_cents: 5000 }
    ],
    current_plan: {
      ...preview.new_plan,
      slug: 'creator_monthly',
      tier: 'CREATOR',
      price_cents: 3500
    }
  }
  await signIn(CHECKOUT)

  await expectSummary(page, [
    'Total due today$0.00',
    "You won't be charged today. Your payment method renews the plan at $50.00 on July 28, 2026."
  ])
})

test('294-8445: a yearly to yearly downgrade names the kept plan with its cadence', async ({
  page,
  cloud,
  signIn
}) => {
  const preview = cloud.scenario.preview
  cloud.scenario.preview = {
    ...preview,
    transition_type: 'downgrade',
    is_immediate: false,
    effective_at: RENEWAL_AT,
    amount_due_cents: 0,
    cost_today_cents: 0,
    new_plan: { ...preview.new_plan, duration: 'ANNUAL' },
    current_plan: {
      ...preview.new_plan,
      slug: 'creator_yearly',
      tier: 'CREATOR',
      duration: 'ANNUAL'
    }
  }
  await signIn(CHECKOUT)

  await expectSummary(page, ["You'll keep Creator Yearly until July 28, 2026"])
})

test('a held discount and an entered code read as rows, with no Subtotal the quote never reported', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.preview = {
    ...cloud.scenario.preview,
    cost_today_cents: 2000,
    amount_due_cents: 2000,
    subtotal_cents: 5000,
    promotion_code: 'COMFY50',
    discounts: [
      { kind: 'plan', code: 'annual_plan_discount_20', amount_off_cents: 999 },
      {
        kind: 'promotion',
        code: 'COMFY-EDU',
        name: 'Education discount',
        amount_off_cents: 1000
      },
      { kind: 'promotion', code: 'COMFY50', amount_off_cents: 2000 }
    ]
  }
  await signIn(CHECKOUT)

  await expectSummary(page, [
    'Pro Plan$50.00',
    'Education discount−$10.00',
    'Promo code−$20.00',
    'Total due today$20.00'
  ])
  const summary = page.getByRole('region', { name: 'Order summary' })
  await expect(summary).not.toContainText('−$9.99')
  await expect(summary).not.toContainText('Subtotal')
})

const YEARLY_CHECKOUT = entryPath('checkout', { plan: 'creator_yearly' })

test('a monthly to yearly switch reads its renewal date and struck-through monthly list price from the quote', async ({
  page,
  cloud,
  signIn
}) => {
  switchToYearly(cloud.scenario)
  await signIn(YEARLY_CHECKOUT)

  await expectSummary(page, [
    'Switch to Creator Yearly · Personal',
    '$268.80 USD',
    'Creator Yearly$268.80',
    '$22.40 $28 /mo × 12 months, billed yearly',
    'Renews at $268.80 on September 30, 2027',
    "This month's credits stay valid until October 30, 2026"
  ])
  const summary = page.getByRole('region', { name: 'Order summary' })
  await expect(summary.locator('s')).toHaveText('$28')
  await expect(summary).not.toContainText('Subtotal')
})

test('a promo code on a yearly switch is bounded to the first year', async ({
  page,
  cloud,
  signIn
}) => {
  switchToYearly(cloud.scenario)
  cloud.scenario.preview = {
    ...cloud.scenario.preview,
    cost_today_cents: 21_504,
    amount_due_cents: 21_504,
    promotion_code: 'COMFY20',
    discounts: [
      {
        kind: 'promotion',
        code: 'COMFY20',
        amount_off_cents: 5376,
        duration: 'once',
        term: 'first_year'
      }
    ]
  }
  await signIn(YEARLY_CHECKOUT)

  await expectSummary(page, [
    'Creator Yearly$268.80',
    'Promo code−$53.76',
    'First year',
    'Total due today$215.04'
  ])
})

test('744-15697: an account balance the server applied is the last deduction, and keeps the prorated rows it explains', async ({
  page,
  cloud,
  signIn
}) => {
  const preview = cloud.scenario.preview
  cloud.scenario.preview = {
    ...preview,
    transition_type: 'upgrade',
    proration_at: '2026-07-10T09:30:00.000Z',
    amount_due_cents: 2750,
    cost_today_cents: 2750,
    subtotal_cents: 3250,
    proration_remaining_cents: 4500,
    proration_unused_cents: 1250,
    balance_applied_cents: 500,
    credits_today_cents: 3250,
    credits_next_period_cents: 10_000,
    credits_today: 6858,
    credits_next_period: 21_100,
    renewal_amount_cents: 10_000,
    renewal_at: RENEWAL_AT,
    current_plan: {
      ...preview.new_plan,
      slug: 'creator_monthly',
      tier: 'CREATOR',
      price_cents: 3500
    }
  }
  await signIn(CHECKOUT)

  await expectSummary(page, [
    'Remaining time on Pro Plan$45.00',
    'Unused time on Creator Plan−$12.50',
    'Account balance−$5.00',
    'Credit already on your account',
    'Total due today$27.50'
  ])
})
