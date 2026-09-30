/**
 * The credit top-up on the full page: the quote the server gives for the
 * link's amount, the charge to the method on file, and its endings.
 */
import type { Page } from '@playwright/test'

import { capabilitiesWith, succeededOperation } from './fixtures/scenario'
import { entryPath, expect, test as base } from './fixtures/test'

const test = base.extend<{ fullPage: void }>({
  fullPage: [
    async ({ cloud }, use) => {
      cloud.scenario.checkoutUi = 'full_page'
      await use(undefined)
    },
    { auto: true }
  ]
})

const TOPUP = entryPath('top-up', { amount_cents: '2500' })

const payButton = (page: Page) =>
  page.getByRole('button', { name: 'Pay and add credits' })

test('265-4362: the summary leads with the credits the server quotes and dates their expiry, with no promo entry', async ({
  page,
  cloud,
  signIn
}) => {
  await signIn(TOPUP)

  const summary = page.getByRole('region', { name: 'Order summary' })
  await expect(summary).toHaveAttribute('aria-busy', 'false')
  await expect(summary).toContainText('Add credits · Personal')
  await expect(summary).toContainText('5,275 credits')
  await expect(summary).toContainText('Credits$25.00')
  await expect(summary).toContainText('Expire September 30, 2027')
  await expect(summary).toContainText('Total due today$25.00')
  await expect(
    page.getByRole('button', { name: 'Add promo code' })
  ).toBeHidden()
  const quote = cloud.requests.find(
    (request) => request.path === '/billing/topup/quote'
  )
  expect(quote?.body).toEqual({ amount_cents: 2500 })
})

test('77-3783: a Pay that goes through names the credits added and what they cost', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.operations.op_topup = {
    ...succeededOperation('op_topup'),
    amount_charged_cents: 2500,
    credits_added: 5275
  }
  await signIn(TOPUP)
  await payButton(page).click()

  await expect(
    page.getByRole('heading', { name: '5,275 credits added' })
  ).toBeVisible()
  await expect(
    page.getByText('Credits for Personal have been successfully added.')
  ).toBeVisible()
  await expect(page.getByTestId('checkout-ending-receipt')).toContainText(
    'Added+5,275'
  )
  await expect(page.getByTestId('checkout-ending-receipt')).toContainText(
    'Amount paid$25.00'
  )
  const topups = cloud.requests.filter(
    (request) => request.path === '/billing/topup'
  )
  expect(topups).toHaveLength(1)
})

test('394-4991 / 410-5225: credits still landing read Payment received, and a reload once they land is Already completed with no balance', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.operations.op_topup = {
    ...succeededOperation('op_topup'),
    amount_charged_cents: 2500
  }
  await signIn(TOPUP)
  await payButton(page).click()

  await expect(
    page.getByRole('heading', { name: 'Payment received' })
  ).toBeVisible()
  const receipt = page.getByTestId('checkout-ending-receipt')
  await expect(receipt).toContainText('Payment$25.00')
  await expect(receipt).toContainText('Credits addedAdding…')
  await expect(receipt).not.toContainText('Plan')

  cloud.scenario.operations.op_topup = {
    ...cloud.scenario.operations.op_topup,
    credits_added: 5275
  }
  await page.reload()

  await expect(
    page.getByRole('heading', { name: 'Already completed' })
  ).toBeVisible()
  await expect(receipt).toContainText('Added+5,275')
  await expect(receipt).toContainText('Amount paid$25.00')
  await expect(page.getByText(/balance/i)).toBeHidden()
  await expect(payButton(page)).toBeHidden()
})

test('a workspace the server will not let top up sees Checkout not available', async ({
  page,
  cloud,
  signIn
}) => {
  const refused = capabilitiesWith({ can_top_up: false })
  cloud.reply('GET', '/billing/capabilities', () => ({
    body: {
      ...refused,
      denied_reasons: { can_top_up: 'not_workspace_owner' }
    },
    headers: { 'x-capability-revision': String(refused.revision) }
  }))
  await signIn(TOPUP)

  await expect(
    page.getByRole('heading', { name: 'Checkout not available' })
  ).toBeVisible()
  await expect(page.getByTestId('checkout-ending-code')).toHaveText(
    'NOT_WORKSPACE_OWNER'
  )
})
