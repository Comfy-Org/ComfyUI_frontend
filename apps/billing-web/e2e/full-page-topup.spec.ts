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
  page.getByRole('button', { name: 'Pay', exact: true })
const creditsIcon = (page: Page) =>
  page.getByTestId('checkout-ending-credits-icon')

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

test('180-6679: Pay reads just Pay, over terms that authorize one charge and link Terms and Privacy Policy', async ({
  page,
  signIn
}) => {
  await signIn(TOPUP)

  await expect(payButton(page)).toBeEnabled()
  await expect(
    page.getByText(
      "By continuing, you agree to Comfy Org's Terms and Privacy Policy, and authorize Comfy Org to charge your payment method once for this purchase.",
      { exact: true }
    )
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Terms' })).toHaveAttribute(
    'href',
    'https://comfy.org/terms-of-service/'
  )
  await expect(
    page.getByRole('link', { name: 'Privacy Policy' })
  ).toHaveAttribute('href', 'https://comfy.org/privacy-policy/')
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
  await expect(creditsIcon(page)).toBeVisible()
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
  await expect(creditsIcon(page)).toBeHidden()

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
  await expect(creditsIcon(page)).toBeVisible()
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

for (const { name, extra } of [
  { name: 'no amount', extra: {} },
  { name: 'an unreadable amount', extra: { amount_cents: '12.50' } }
]) {
  test(`769-15773: a top-up link with ${name} is not valid, and Add credits opens Plan & Credits`, async ({
    page,
    cloud,
    signIn
  }) => {
    await signIn(entryPath('top-up', extra))

    await expect(
      page.getByRole('heading', { name: "This link isn't valid" })
    ).toBeVisible()
    await expect(
      page.getByText(
        "The amount in your link isn't valid. Nothing has been charged. Choose an amount in your billing settings."
      )
    ).toBeVisible()
    await expect(page.getByTestId('checkout-ending-code')).toHaveText(
      'CHECKOUT_LINK_INVALID'
    )
    await expect(
      page.getByRole('link', { name: 'Contact support' })
    ).toBeVisible()
    expect(
      cloud.requests.some((request) => request.path === '/billing/topup/quote')
    ).toBe(false)

    await page.getByRole('button', { name: 'Add credits' }).click()

    await expect(page).toHaveURL(
      'https://testcloud.comfy.org/?settings=plan-credits&workspace=ws_e2e'
    )
  })
}
