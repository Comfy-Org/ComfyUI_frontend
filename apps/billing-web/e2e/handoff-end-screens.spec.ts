import type { Page } from '@playwright/test'

import { E2E_USER } from './fixtures/env'
import { succeededOperation } from './fixtures/scenario'
import { installFakeStripe } from './fixtures/stripe'
import { expect, test } from './fixtures/test'

const SESSION_MS = 30 * 60 * 1000
const TOPUP_HANDOFF =
  '/handoff?intent=top-up&amount_cents=2500#token=one-time-token'

const payButton = (page: Page) =>
  page.getByRole('button', { name: 'Pay', exact: true })
const nothingCharged = (page: Page) => page.getByText(/Nothing was charged/)

test.beforeEach(async ({ context, page, cloud }) => {
  await installFakeStripe(context)
  cloud.scenario.checkoutUi = 'full_page'
  cloud.reply('POST', '/auth/handoffs/exchange', () => ({
    body: {
      session_token: 'handoff-scoped-session',
      expires_at: new Date(Date.now() + SESSION_MS).toISOString(),
      user: { id: E2E_USER.uid, email: E2E_USER.email },
      workspace: { id: E2E_USER.workspaceId, name: 'Acme', type: 'team' },
      role: 'owner'
    }
  }))
  await page.clock.install()
})

test('a handoff session that never started a payment ends on the link screen, and keeps it across a reload', async ({
  page
}) => {
  await page.goto(TOPUP_HANDOFF)
  await expect(payButton(page)).toBeEnabled()

  await page.clock.fastForward(SESSION_MS)

  const ended = page.getByRole('heading', {
    name: 'This checkout link no longer works'
  })
  await expect(ended).toBeVisible()
  await expect(nothingCharged(page)).toBeVisible()
  await expect(page).toHaveURL(/\/handoff$/)

  await page.reload()

  await expect(ended).toBeVisible()
})

test('a handoff session that already paid ends without saying nothing was charged, and keeps that across a reload', async ({
  page,
  cloud
}) => {
  cloud.scenario.operations.op_topup = {
    ...succeededOperation('op_topup'),
    amount_charged_cents: 2500,
    credits_added: 5275
  }
  await page.goto(TOPUP_HANDOFF)
  await payButton(page).click()
  await expect(
    page.getByRole('heading', { name: '5,275 credits added' })
  ).toBeVisible()

  await page.clock.fastForward(SESSION_MS)

  const ended = page.getByRole('heading', {
    name: 'This checkout session has ended'
  })
  await expect(ended).toBeVisible()
  await expect(nothingCharged(page)).toBeHidden()

  await page.reload()

  await expect(ended).toBeVisible()
  await expect(nothingCharged(page)).toBeHidden()
})
