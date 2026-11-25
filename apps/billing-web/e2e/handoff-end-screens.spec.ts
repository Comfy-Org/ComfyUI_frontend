import type { Page } from '@playwright/test'

import type { MockCloud } from './fixtures/cloud'
import { E2E_USER } from './fixtures/env'
import {
  declinedOperation,
  pendingOperation,
  succeededOperation
} from './fixtures/scenario'
import { installFakeStripe } from './fixtures/stripe'
import { entryPath, expect, test } from './fixtures/test'

const SESSION_MS = 30 * 60 * 1000
const TOPUP_HANDOFF =
  '/handoff?intent=top-up&amount_cents=2500#token=one-time-token'
const OPERATION = '/billing/ops/op_topup'
const OUTCOME = `${OPERATION}/outcome`
const HANDOFF_KEY = 'comfy.billing-web.handoff.v1'

const payButton = (page: Page) =>
  page.getByRole('button', { name: 'Pay', exact: true })
const nothingCharged = (page: Page) => page.getByText(/Nothing was charged/)
const unknownResult = (page: Page) =>
  page.getByText(/may or may not have gone through/)
const endedOn = (page: Page, name: string) =>
  page.getByTestId('handoff-ending').getByRole('heading', { name })
const paymentCode = (page: Page) => page.getByTestId('checkout-ending-code')
const outcomeReads = (cloud: MockCloud) =>
  cloud.requests.filter(({ path }) => path === OUTCOME)
const storedHandoff = (page: Page) =>
  page.evaluate((key) => sessionStorage.getItem(key), HANDOFF_KEY)

async function payAndOutliveTheSession(page: Page, cloud: MockCloud) {
  cloud.scenario.operations.op_topup = pendingOperation('op_topup')
  await payButton(page).click()
  await expect
    .poll(() => cloud.requests.some(({ path }) => path === OPERATION))
    .toBe(true)
  await page.clock.fastForward(SESSION_MS)
}

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

  const ended = endedOn(page, 'This checkout link no longer works')
  await expect(ended).toBeVisible()
  await expect(nothingCharged(page)).toBeVisible()
  await expect(page).toHaveURL(/\/handoff$/)

  await page.reload()

  await expect(ended).toBeVisible()
})

test('a handoff session that already paid ends on the payment that went through, with its workspace and reference, and keeps that across a reload', async ({
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

  const ended = endedOn(page, "You're all set")
  await expect(ended).toBeVisible()
  await expect(page.getByText('A payment for Acme went through.')).toBeVisible()
  await expect(page.getByTestId('checkout-ending-code')).toHaveText('op_topup')
  await expect(page.getByRole('button', { name: 'Close' })).toBeHidden()
  await expect(nothingCharged(page)).toBeHidden()

  await page.reload()

  await expect(ended).toBeVisible()
  await expect(page.getByText('A payment for Acme went through.')).toBeVisible()
  await expect(nothingCharged(page)).toBeHidden()
})

test('a handoff session whose payment request got no readable answer ends unconfirmed, without saying nothing was charged, and keeps that across a reload', async ({
  page,
  cloud
}) => {
  cloud.reply('POST', '/billing/topup', () => ({
    status: 500,
    body: { code: 'INTERNAL', message: 'boom' }
  }))
  await page.goto(TOPUP_HANDOFF)
  await payButton(page).click()
  await expect
    .poll(() => cloud.requests.some(({ path }) => path === '/billing/topup'))
    .toBe(true)

  await page.clock.fastForward(SESSION_MS)

  const ended = endedOn(page, "We couldn't confirm your payment")
  await expect(ended).toBeVisible()
  await expect(page.getByText(/Don't pay again yet/)).toBeVisible()
  await expect(nothingCharged(page)).toBeHidden()

  await page.reload()

  await expect(ended).toBeVisible()
  await expect(nothingCharged(page)).toBeHidden()
})

test('a handoff session whose payment the card declined ends on the link screen, where nothing was charged, and keeps it across a reload', async ({
  page,
  cloud
}) => {
  cloud.scenario.operations.op_topup = declinedOperation('op_topup')
  await page.goto(TOPUP_HANDOFF)
  await payButton(page).click()
  await expect(page.getByRole('alert')).toContainText('Payment declined')

  await page.clock.fastForward(SESSION_MS)

  const ended = endedOn(page, 'This checkout link no longer works')
  await expect(ended).toBeVisible()
  await expect(nothingCharged(page)).toBeVisible()
  await expect(unknownResult(page)).toBeHidden()

  await page.reload()

  await expect(ended).toBeVisible()
  await expect(unknownResult(page)).toBeHidden()
})

test('a handoff session that only cancelled a subscription ends on the link screen, not on an unconfirmed payment, and keeps it across a reload', async ({
  page,
  cloud
}) => {
  await page.goto('/handoff?intent=subscription#token=one-time-token')
  await page.getByRole('button', { name: 'Cancel subscription' }).click()
  await page.getByRole('button', { name: 'Confirm cancellation' }).click()
  await expect
    .poll(() =>
      cloud.requests.some(({ path }) => path === '/billing/ops/op_cancel')
    )
    .toBe(true)

  await page.clock.fastForward(SESSION_MS)

  const ended = endedOn(page, 'This checkout link no longer works')
  await expect(ended).toBeVisible()
  await expect(nothingCharged(page)).toBeVisible()
  await expect(unknownResult(page)).toBeHidden()

  await page.reload()

  await expect(ended).toBeVisible()
  await expect(unknownResult(page)).toBeHidden()
})

test('a handoff tab left checking a payment turns into the payment that went through once Cloud reports it, with no reload, and keeps no bearer after', async ({
  page,
  cloud
}) => {
  let status = 'pending'
  cloud.reply('GET', OUTCOME, () => ({ body: { status } }))
  await page.goto(TOPUP_HANDOFF)
  await payAndOutliveTheSession(page, cloud)

  await expect(endedOn(page, 'Checking your payment')).toBeVisible()
  await expect(paymentCode(page)).toHaveText('op_topup')
  await expect.poll(() => outcomeReads(cloud).length).toBeGreaterThan(0)
  expect(await storedHandoff(page)).toContain('handoff-scoped-session')

  status = 'succeeded'
  await page.clock.fastForward(10_000)

  const ended = endedOn(page, "You're all set")
  await expect(ended).toBeVisible()
  await expect(page.getByText('A payment for Acme went through.')).toBeVisible()
  await expect(paymentCode(page)).toHaveText('op_topup')
  expect(
    new Set(outcomeReads(cloud).map(({ authorization }) => authorization))
  ).toEqual(new Set(['Bearer handoff-scoped-session']))
  expect(await storedHandoff(page)).not.toContain('handoff-scoped-session')
  const readsToLearnIt = outcomeReads(cloud).length

  await page.reload()

  await expect(ended).toBeVisible()
  await page.clock.fastForward(60_000)
  expect(outcomeReads(cloud)).toHaveLength(readsToLearnIt)
})

test('a handoff tab left checking a payment goes on checking it after a reload', async ({
  page,
  cloud
}) => {
  let status = 'pending'
  cloud.reply('GET', OUTCOME, () => ({ body: { status } }))
  await page.goto(TOPUP_HANDOFF)
  await payAndOutliveTheSession(page, cloud)
  await expect(endedOn(page, 'Checking your payment')).toBeVisible()

  await page.reload()
  await expect(endedOn(page, 'Checking your payment')).toBeVisible()
  status = 'succeeded'
  await page.clock.fastForward(10_000)

  await expect(endedOn(page, "You're all set")).toBeVisible()
})

test('a handoff tab left checking a payment that Cloud then reports failed ends unconfirmed with its code, never saying nothing was charged', async ({
  page,
  cloud
}) => {
  cloud.reply('GET', OUTCOME, () => ({ body: { status: 'failed' } }))
  await page.goto(TOPUP_HANDOFF)
  await payAndOutliveTheSession(page, cloud)

  const ended = endedOn(page, "We couldn't confirm your payment")
  await expect(ended).toBeVisible()
  await expect(page.getByText(/Don't pay again yet/)).toBeVisible()
  await expect(paymentCode(page)).toHaveText('op_topup')
  await expect(nothingCharged(page)).toBeHidden()
  expect(await storedHandoff(page)).not.toContain('handoff-scoped-session')

  await page.reload()

  await expect(ended).toBeVisible()
  await expect(paymentCode(page)).toHaveText('op_topup')
  await expect(nothingCharged(page)).toBeHidden()
})

test('a handoff tab left checking a payment ends unconfirmed, and stops asking, once Cloud refuses the ended session', async ({
  page,
  cloud
}) => {
  cloud.reply('GET', OUTCOME, () => ({
    status: 401,
    body: {
      code: 'INVALID_CREDENTIAL',
      message: 'The billing session has ended'
    }
  }))
  await page.goto(TOPUP_HANDOFF)
  await payAndOutliveTheSession(page, cloud)

  await expect(endedOn(page, "We couldn't confirm your payment")).toBeVisible()
  await expect(paymentCode(page)).toHaveText('op_topup')
  await expect(nothingCharged(page)).toBeHidden()
  expect(await storedHandoff(page)).not.toContain('handoff-scoped-session')

  await page.clock.fastForward(60_000)

  expect(outcomeReads(cloud)).toHaveLength(1)
})

test('a signed-in tab that is not a handoff never asks for a payment outcome and keeps no handoff record, with a payment still settling half an hour on', async ({
  page,
  cloud,
  signIn
}) => {
  await signIn(entryPath('top-up', { amount_cents: '2500' }))
  await payAndOutliveTheSession(page, cloud)

  await expect(page.getByTestId('handoff-ending')).toBeHidden()
  expect(
    cloud.requests.filter(({ path }) => path.endsWith('/outcome'))
  ).toEqual([])
  expect(await storedHandoff(page)).toBeNull()
})
