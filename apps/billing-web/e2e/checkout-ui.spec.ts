import { E2E_FIREBASE_CONFIG } from './fixtures/env'
import { installFakeStripe } from './fixtures/stripe'
import { entryPath, expect, test } from './fixtures/test'

const CHECKOUT = entryPath('checkout', { plan: 'pro_monthly' })

test('without the flag, checkout is the embedded checkout', async ({
  page,
  signIn
}) => {
  await signIn(CHECKOUT)

  await expect(
    page.getByRole('heading', { name: 'Confirm your payment' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Checkout', exact: true })
  ).toBeHidden()
})

test('with the flag on full_page, checkout is the full-page checkout', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.checkoutUi = 'full_page'
  await signIn(CHECKOUT)

  await expect(
    page.getByRole('heading', { name: 'Checkout', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Confirm your payment' })
  ).toBeHidden()
  expect(
    cloud.requests.some(
      (request) =>
        request.path === '/features' &&
        request.authorization === 'Bearer e2e-workspace-jwt'
    )
  ).toBe(true)
})

test('when the flag read fails, checkout falls back to the embedded checkout', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.checkoutUi = 'full_page'
  cloud.reply('GET', '/features', (request) =>
    request.authorization === null
      ? { body: { firebase_config: E2E_FIREBASE_CONFIG } }
      : { status: 500, body: { billing_web_checkout_ui: 'full_page' } }
  )
  await signIn(CHECKOUT)

  await expect(
    page.getByRole('heading', { name: 'Confirm your payment' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Checkout', exact: true })
  ).toBeHidden()
})

test('top-up remains usable across reload when the flag serves embedded', async ({
  context,
  page,
  cloud,
  signIn
}) => {
  await installFakeStripe(context)
  cloud.scenario.checkoutUi = 'embedded'
  await signIn(entryPath('top-up', { amount_cents: '2500' }))

  const summary = page.getByRole('region', { name: 'Order summary' })
  const pay = page.getByRole('button', { name: 'Pay', exact: true })
  await expect(summary).toContainText('Add credits · Personal')
  await expect(pay).toBeEnabled()

  await page.reload()

  await expect(summary).toContainText('5,275 credits')
  await expect(summary).toContainText('$25.00')
  await expect(page.getByText('·· 4242')).toBeVisible()
  await expect(pay).toBeEnabled()
})
