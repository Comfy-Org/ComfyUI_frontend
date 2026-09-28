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
const EYEBROW = 'Subscribe to Pro Plan · Personal'
const FORM_FAILED = "The payment form couldn't load"
const SAVED_FAILED = "Your saved payment methods couldn't load"

const payButton = (page: Page) =>
  page.getByRole('button', { name: 'Pay and subscribe' })
const tab = (page: Page, name: 'Saved' | 'Add new payment') =>
  page.getByRole('tab', { name })

function failPaymentElementLoads(page: Page) {
  return page.addInitScript(() => {
    Object.assign(window, { __e2eStripeLoadErrors: 1 })
  })
}

test('names the plan and the workspace, and enables Pay once the form is ready', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  await signIn(CHECKOUT)

  await expect(page.getByText(EYEBROW)).toBeVisible()
  await expect(payButton(page)).toBeEnabled()
  await expect(tab(page, 'Saved')).toBeHidden()
  await expect(
    page.getByRole('heading', { name: 'Confirm your payment' })
  ).toBeHidden()
  expect(
    cloud.requests.some((request) => request.path === '/billing/capabilities')
  ).toBe(true)
})

test('360-4874: with no saved method a failed form takes the column, and Try again remounts it', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  await failPaymentElementLoads(page)
  await signIn(CHECKOUT)

  await expect(page.getByText(FORM_FAILED)).toBeVisible()
  await expect(payButton(page)).toBeHidden()
  await expect(page.getByText(EYEBROW)).toBeVisible()

  await page.getByRole('button', { name: 'Try again' }).click()

  await expect(payButton(page)).toBeEnabled()
  await expect(page.getByText(FORM_FAILED)).toBeHidden()
})

test('opens on the saved method and subscribes with it, no card token', async ({
  page,
  cloud,
  signIn
}) => {
  await signIn(CHECKOUT)

  await expect(tab(page, 'Saved')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('visa •••• 4242')).toBeVisible()
  await expect(page.getByText('Billing address')).toBeHidden()
  await payButton(page).click()

  await expect
    .poll(() =>
      cloud.requests.find((request) => request.path === '/billing/subscribe')
    )
    .toMatchObject({ body: { saved_payment_method_id: 'pm_e2e' } })
  const subscribe = cloud.requests.find(
    (request) => request.path === '/billing/subscribe'
  )
  expect(subscribe?.body).not.toHaveProperty('confirmation_token')
})

test('368-15319: a failed form beside a saved method stays inside Add new, and Saved stays payable', async ({
  page,
  signIn
}) => {
  await failPaymentElementLoads(page)
  await signIn(CHECKOUT)

  await expect(tab(page, 'Saved')).toHaveAttribute('aria-selected', 'true')
  await expect(payButton(page)).toBeEnabled()
  await expect(page.getByText(FORM_FAILED)).toBeHidden()

  await tab(page, 'Add new payment').click()

  await expect(page.getByText(FORM_FAILED)).toBeVisible()
  await expect(
    page.getByText('or pay with a saved payment method.', { exact: false })
  ).toBeVisible()
  await expect(payButton(page)).toBeHidden()

  await page.getByRole('button', { name: 'Try again' }).click()

  await expect(payButton(page)).toBeEnabled()
  await expect(tab(page, 'Add new payment')).toHaveAttribute(
    'aria-selected',
    'true'
  )
})

test('368-15401: a failed saved-methods read errors on Saved only, and Add new stays live', async ({
  page,
  cloud,
  signIn
}) => {
  let healthy = false
  cloud.reply('GET', '/billing/payment-methods', () =>
    healthy
      ? { body: cloud.scenario.paymentMethods }
      : { status: 500, body: { code: 'INTERNAL', message: 'boom' } }
  )
  await signIn(CHECKOUT)

  await expect(tab(page, 'Saved')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(SAVED_FAILED)).toBeVisible()
  await expect(page.getByText('Billing address')).toBeHidden()
  await expect(payButton(page)).toBeHidden()

  await tab(page, 'Add new payment').click()
  await expect(payButton(page)).toBeEnabled()

  await tab(page, 'Saved').click()
  healthy = true
  await page.getByRole('button', { name: 'Try again' }).click()

  await expect(page.getByText('visa •••• 4242')).toBeVisible()
  await expect(page.getByText(SAVED_FAILED)).toBeHidden()
  await expect(payButton(page)).toBeEnabled()
})
