import { E2E_USER } from './fixtures/env'
import { entryPath, expect, test } from './fixtures/test'

const CHECKOUT = entryPath('checkout', { plan: 'pro_monthly' })
const SCOPED = 'Bearer handoff-scoped-session'

test.beforeEach(async ({ page, cloud }) => {
  cloud.reply('POST', '/auth/handoffs/exchange', () => ({
    body: {
      session_token: 'handoff-scoped-session',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      user: { id: E2E_USER.uid, email: E2E_USER.email },
      workspace: { id: E2E_USER.workspaceId, name: 'Acme', type: 'team' },
      role: 'owner'
    }
  }))
  await page.goto('/handoff#token=one-time-token')
  await expect(page).not.toHaveURL(/\/handoff/)
})

test('a handoff tab shows the full-page checkout that billing capabilities serve', async ({
  page,
  cloud
}) => {
  await page.goto(CHECKOUT)

  await expect(
    page.getByRole('heading', { name: 'Checkout', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Confirm your payment' })
  ).toBeHidden()
  expect(
    cloud.requests.some(
      (request) =>
        request.path === '/billing/capabilities' &&
        request.authorization === SCOPED
    )
  ).toBe(true)
  expect(
    cloud.requests.filter(
      (request) =>
        request.path === '/features' && request.authorization !== null
    )
  ).toEqual([])
  await expect(page).not.toHaveURL(/\/sign-in/)
})

test('a handoff tab shows the embedded checkout when billing capabilities serve it', async ({
  page,
  cloud
}) => {
  cloud.scenario.capabilities.billing_web_checkout_ui = 'embedded'
  await page.goto(CHECKOUT)

  await expect(
    page.getByRole('heading', { name: 'Confirm your payment' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Checkout', exact: true })
  ).toBeHidden()
})
