import type { Page } from '@playwright/test'

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

test('a tier upgrade reads the prorated charge and a dated credits delta', async ({
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
    credits_today_cents: 3250,
    credits_next_period_cents: 10_000,
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
    'Pro Plan - Prorated$32.50',
    'Remaining time for Pro plan, less unused time from Creator plan',
    'Credits refill to 21,100 each month',
    'Total due today$32.50',
    'Existing credits are kept',
    'Renews at $100.00 on July 28, 2026'
  ])
})

test('a held discount and an entered code read as rows, with no Subtotal the quote never reported', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.preview = {
    ...cloud.scenario.preview,
    amount_due_cents: 2000,
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
