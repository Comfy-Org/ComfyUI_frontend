/**
 * Everything between Pay and a terminal on the full page: the two submit
 * phases, the 3DS challenge and its refusal, a reload while the bank is
 * still waiting, and a method that finishes paying on its own site.
 */
import type { Page } from '@playwright/test'

import type { BillingOpStatusResponse } from '@comfyorg/ingest-types'

import type { MockCloud } from './fixtures/cloud'
import { PORTAL_URL } from './fixtures/env'
import {
  challengeRequiredOperation,
  pendingOperation,
  succeededOperation
} from './fixtures/scenario'
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
const OPERATION = 'op_subscribe'
const CLIENT_SECRET = 'pi_e2e_secret'
const PHASE_A = 'Nothing has been charged yet.'
const PHASE_B = "This payment is already processing and can't be canceled."
const REDIRECTING =
  'Taking you to Alipay to finish paying. Nothing has been charged yet.'

const payButton = (page: Page) =>
  page.getByRole('button', { name: 'Pay and subscribe' })
const footnote = (page: Page) => page.getByTestId('checkout-phase-footnote')
const backArrow = (page: Page) => page.getByRole('button', { name: 'Back' })
const completeVerification = (page: Page) =>
  page.getByRole('button', { name: 'Complete verification' })
const cancelPayment = (page: Page) =>
  page.getByRole('button', { name: 'Cancel payment' })

/** The operation as the mocked Cloud reports it; a spec moves it on. */
function scriptOperation(cloud: MockCloud) {
  const state = { reply: challengeRequiredOperation(OPERATION, CLIENT_SECRET) }
  cloud.reply('GET', `/billing/ops/${OPERATION}`, () => ({
    body: state.reply
  }))
  return (reply: BillingOpStatusResponse) => {
    state.reply = reply
  }
}

const processing = (): BillingOpStatusResponse => ({
  ...challengeRequiredOperation(OPERATION, CLIENT_SECRET),
  authentication_state: 'processing'
})

function holdChallenge(page: Page) {
  return page.addInitScript(() => {
    Object.assign(window, { __e2eStripeHoldNextAction: true })
  })
}

/** Settles the held challenge the way Stripe would, with the intent's status. */
function releaseChallenge(page: Page, intentStatus: string) {
  return page.evaluate(
    `window.__e2eFakeStripe.releaseNextAction({ paymentIntent: { status: '${intentStatus}' } })`
  )
}

/** Empty until the first challenge, since the fake only loads with the card form. */
const nextActionCalls = (page: Page): Promise<unknown> =>
  page.evaluate('window.__e2eFakeStripe?.nextActionCalls ?? []')

const subscribeRequests = (cloud: MockCloud) =>
  cloud.requests.filter((request) => request.path === '/billing/subscribe')

test('145-4584 → 342-4767: Pay walks Phase A, locked with nothing charged, into Phase B once the bank answers, then to success', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  const moveOperation = scriptOperation(cloud)
  await holdChallenge(page)
  await signIn(CHECKOUT)
  await expect(backArrow(page)).toBeVisible()
  await expect(footnote(page)).toHaveText('')

  await payButton(page).click()

  await expect(footnote(page)).toHaveText(PHASE_A)
  await expect(footnote(page)).toHaveAttribute('aria-live', 'polite')
  await expect(payButton(page)).toBeDisabled()
  await expect(backArrow(page)).toBeHidden()
  await expect(cancelPayment(page)).toBeHidden()
  expect(await nextActionCalls(page)).toEqual([{ clientSecret: CLIENT_SECRET }])

  await releaseChallenge(page, 'succeeded')

  await expect(footnote(page)).toHaveText(PHASE_B)
  await expect(cancelPayment(page)).toBeHidden()
  await expect(payButton(page)).toBeDisabled()

  moveOperation(succeededOperation(OPERATION))

  await expect(
    page.getByRole('heading', { name: "You're all set" })
  ).toBeVisible()
  expect(subscribeRequests(cloud)).toHaveLength(1)
})

test('a card Pay shows only the spinner until the server says which phase it is in', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  const moveOperation = scriptOperation(cloud)
  moveOperation(pendingOperation(OPERATION))
  await signIn(CHECKOUT)

  await payButton(page).click()

  await expect(payButton(page)).toHaveAttribute('aria-busy', 'true')
  await expect(backArrow(page)).toBeHidden()
  await expect(footnote(page)).toHaveText('')

  moveOperation(processing())

  await expect(footnote(page)).toHaveText(PHASE_B)
})

test('a saved-method Pay keeps the tabs and the list inert through Phase A', async ({
  page,
  cloud,
  signIn
}) => {
  scriptOperation(cloud)
  await holdChallenge(page)
  await signIn(CHECKOUT)
  await expect(page.getByRole('tab', { name: 'Saved' })).toBeEnabled()

  await payButton(page).click()

  await expect(footnote(page)).toHaveText(PHASE_A)
  await expect(page.getByRole('tablist')).toHaveAttribute('inert', '')
  await expect(backArrow(page)).toBeHidden()
})

test('314-10555: a challenge the bank refuses lands on capture with Payment not completed, the form still mounted and Pay live', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  scriptOperation(cloud)
  await holdChallenge(page)
  await signIn(CHECKOUT)

  await payButton(page).click()
  await expect(footnote(page)).toHaveText(PHASE_A)

  await releaseChallenge(page, 'requires_action')

  const card = page.getByRole('alert')
  await expect(card).toContainText('Payment not completed')
  await expect(card).toContainText("you haven't been charged")
  await expect(footnote(page)).toHaveText('')
  await expect(payButton(page)).toBeEnabled()
  await expect(backArrow(page)).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Contact support' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: "You're all set" })
  ).toBeHidden()
  await expect(page).toHaveURL(/\/v1\/checkout\?/)
  expect(await nextActionCalls(page)).toHaveLength(1)
})

test('a reload during Phase A renders the verify state and re-opens the challenge from the secret the server still holds', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  cloud.scenario.status = {
    ...cloud.scenario.status,
    pending_billing_op_id: OPERATION,
    pending_billing_op_type: 'subscription',
    payment_intent_client_secret: CLIENT_SECRET
  }
  const moveOperation = scriptOperation(cloud)
  await holdChallenge(page)
  await signIn(CHECKOUT)

  await expect(footnote(page)).toHaveText(PHASE_A)
  await expect(payButton(page)).toBeDisabled()
  await expect(backArrow(page)).toBeHidden()
  await expect
    .poll(() => nextActionCalls(page))
    .toEqual([{ clientSecret: CLIENT_SECRET }])
  expect(subscribeRequests(cloud)).toHaveLength(0)

  await releaseChallenge(page, 'succeeded')
  await expect(footnote(page)).toHaveText(PHASE_B)

  moveOperation(succeededOperation(OPERATION))
  await expect(
    page.getByRole('heading', { name: 'Already completed' })
  ).toBeVisible()
})

test('312-9930: coming back from Alipay without paying stays on the checkout and offers Complete verification instead of sending the customer straight back', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  cloud.scenario.status = {
    ...cloud.scenario.status,
    pending_billing_op_id: OPERATION,
    pending_billing_op_type: 'subscription',
    payment_intent_client_secret: CLIENT_SECRET
  }
  scriptOperation(cloud)
  await page.addInitScript((redirectTo) => {
    Object.assign(window, { __e2eStripeRedirectTo: redirectTo })
  }, PORTAL_URL)
  await signIn(CHECKOUT)

  await expect(completeVerification(page)).toBeEnabled()
  await expect(footnote(page)).toHaveText(PHASE_A)
  await expect(backArrow(page)).toBeHidden()
  await expect(page).toHaveURL(/\/v1\/checkout\?/)
  expect(await nextActionCalls(page)).toEqual([])

  await completeVerification(page).click()

  await expect(page).toHaveURL(PORTAL_URL)
  expect(subscribeRequests(cloud)).toHaveLength(0)
})

test('340-13834: coming back from an Alipay payment the server ended unpaid opens capture on Payment not completed, never a decline', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  cloud.scenario.status = {
    ...cloud.scenario.status,
    pending_billing_op_id: OPERATION,
    pending_billing_op_type: 'subscription'
  }
  const moveOperation = scriptOperation(cloud)
  const now = new Date().toISOString()
  moveOperation({
    id: OPERATION,
    status: 'failed',
    retryable: true,
    recovery_action: 'retry',
    started_at: now,
    completed_at: now
  })
  await signIn(CHECKOUT)

  const card = page.getByRole('alert')
  await expect(card).toContainText('Payment not completed')
  await expect(card).not.toContainText('Payment declined')
  await expect(payButton(page)).toBeEnabled()
  expect(subscribeRequests(cloud)).toHaveLength(0)
})

test('447-6886: a redirect method shows the pre-money line, never Phase B, and leaves for the provider with the checkout as its return', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  scriptOperation(cloud)
  await page.addInitScript((redirectTo) => {
    Object.assign(window, {
      __e2eStripeMethodType: 'alipay',
      __e2eStripeRedirectTo: redirectTo
    })
  }, PORTAL_URL)
  await signIn(CHECKOUT)

  await payButton(page).click()

  await expect(footnote(page)).toHaveText(REDIRECTING)
  await expect(cancelPayment(page)).toBeHidden()
  await expect(page).toHaveURL(PORTAL_URL)
  const [subscribe] = subscribeRequests(cloud)
  expect(subscribe.body).toMatchObject({
    confirmation_token: 'ctok_e2e_fake',
    return_url: expect.stringMatching(/\/v1\/checkout\?/)
  })
})

test('446-10925: coming back from the provider is a fresh mount on Phase B, then the terminal', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  cloud.scenario.status = {
    ...cloud.scenario.status,
    pending_billing_op_id: OPERATION,
    pending_billing_op_type: 'subscription'
  }
  const moveOperation = scriptOperation(cloud)
  moveOperation(processing())
  await signIn(CHECKOUT)

  await expect(footnote(page)).toHaveText(PHASE_B)
  await expect(payButton(page)).toBeDisabled()
  expect(await nextActionCalls(page)).toEqual([])

  moveOperation(succeededOperation(OPERATION))
  await expect(
    page.getByRole('heading', { name: 'Already completed' })
  ).toBeVisible()
  expect(subscribeRequests(cloud)).toHaveLength(0)
})
