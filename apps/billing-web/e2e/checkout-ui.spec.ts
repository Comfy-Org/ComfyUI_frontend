import { E2E_FIREBASE_CONFIG } from './fixtures/env'
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
