import { E2E_USER } from './fixtures/env'
import { installFakeStripe } from './fixtures/stripe'
import { expect, test } from './fixtures/test'

const TOPUP_LANDING =
  /\/v1\/top-up\?product=comfyui&return_to=comfyui_credits&amount_cents=2500$/

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

test('a handoff with an unknown intent opens the billing home', async ({
  page
}) => {
  await page.goto('/handoff?intent=pricing#token=one-time-token')

  await expect(page).toHaveURL(/\/$/)
})
