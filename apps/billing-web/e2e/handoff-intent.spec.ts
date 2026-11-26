import { E2E_USER } from './fixtures/env'
import { installFakeStripe } from './fixtures/stripe'
import { expect, test } from './fixtures/test'

const TOPUP_LANDING =
  /\/v1\/top-up\?product=comfyui&return_to=platform_billing&amount_cents=2500$/

test.beforeEach(async ({ context, cloud }) => {
  await installFakeStripe(context)
  cloud.scenario.checkoutUi = 'full_page'
  cloud.reply('POST', '/auth/handoffs/exchange', () => ({
    body: {
      session_token: 'handoff-scoped-session',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      user: { id: E2E_USER.uid, email: E2E_USER.email },
      workspace: { id: E2E_USER.workspaceId, name: 'Acme', type: 'team' },
      role: 'owner'
    }
  }))
})

test('a handoff for Add credits opens the top-up checkout for its amount and keeps it across a reload', async ({
  page,
  cloud
}) => {
  await page.goto(
    '/handoff?intent=top-up&amount_cents=2500#token=one-time-token'
  )

  await expect(page).toHaveURL(TOPUP_LANDING)
  const summary = page.getByRole('region', { name: 'Order summary' })
  await expect(summary).toContainText('Add credits · Acme')
  const quote = cloud.requests.find(
    (request) => request.path === '/billing/topup/quote'
  )
  expect(quote?.body).toEqual({ amount_cents: 2500 })
  expect(quote?.authorization).toBe('Bearer handoff-scoped-session')

  await page.reload()

  await expect(page).toHaveURL(TOPUP_LANDING)
  await expect(summary).toContainText('Add credits · Acme')
})

test('a handoff for Add credits with auto top-up shows the consent with the monthly limit and pays on the hosted checkout with the settings', async ({
  page,
  cloud
}) => {
  const checkoutUrl = 'https://checkout.stripe.com/c/pay/cs_test_front4122'
  cloud.reply('POST', '/billing/topup/checkout', () => ({
    body: { checkout_url: checkoutUrl, session_id: 'cs_test_front4122' }
  }))
  await page.goto(
    '/handoff?intent=top-up&amount_cents=2500&auto_top_up_threshold_credits=1000&auto_top_up_target_credits=11550&auto_top_up_monthly_budget_cents=10000#token=one-time-token'
  )

  await expect(page.getByTestId('checkout-auto-top-up-consent')).toHaveText(
    'Top-ups are charged to your default card, Visa ···· 4242, up to $100.00 a month. Turn this off anytime in Billing.'
  )
  const leavesForStripe = page.waitForRequest(checkoutUrl)
  await page.getByRole('button', { name: 'Pay' }).click()
  await leavesForStripe

  const checkout = cloud.requests.find(
    (request) => request.path === '/billing/topup/checkout'
  )
  expect(checkout?.authorization).toBe('Bearer handoff-scoped-session')
  expect(checkout?.body).toMatchObject({
    amount_cents: 2500,
    return_url: expect.stringMatching(/\/return\/topup$/),
    auto_top_up: {
      threshold_credits: 1000,
      target_credits: 11550,
      monthly_budget_cents: 10000
    }
  })
  expect(
    cloud.requests.some((request) => request.path === '/billing/topup')
  ).toBe(false)
})

test('a handoff with an unknown intent opens the billing home', async ({
  page
}) => {
  await page.goto('/handoff?intent=pricing#token=one-time-token')

  await expect(page).toHaveURL(/\/$/)
})
