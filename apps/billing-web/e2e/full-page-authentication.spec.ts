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

/** The bank asks for a challenge the server has not handed this page yet. */
const awaitingChallenge = (): BillingOpStatusResponse => {
  const { payment_intent_client_secret: _, ...operation } =
    challengeRequiredOperation(OPERATION, CLIENT_SECRET)
  return operation
}

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

const CANCEL_PATH = `/billing/ops/${OPERATION}/cancel`

const cancelRequests = (cloud: MockCloud) =>
  cloud.requests.filter((request) => request.path === CANCEL_PATH)

const elementUnmounts = (page: Page): Promise<unknown> =>
  page.evaluate('window.__e2eFakeStripe.unmounts')

/** The operation as the server reads it back once a cancel discarded it. */
const canceledOperation = (): BillingOpStatusResponse => {
  const now = new Date().toISOString()
  return {
    id: OPERATION,
    status: 'failed',
    decline_reason: 'authentication_failed',
    retryable: true,
    recovery_action: 'retry',
    started_at: now,
    completed_at: now
  }
}

/** Pay with a new card into Phase A, before Stripe's challenge window opens. */
async function payIntoPhaseA(
  page: Page,
  signIn: (path: string) => Promise<void>,
  moveOperation: (reply: BillingOpStatusResponse) => void
) {
  moveOperation(awaitingChallenge())
  await signIn(CHECKOUT)
  await payButton(page).click()
  await expect(footnote(page)).toHaveText(PHASE_A)
}

const operationReads = (cloud: MockCloud) =>
  cloud.requests.filter(
    (request) =>
      request.method === 'GET' && request.path === `/billing/ops/${OPERATION}`
  ).length

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
  expect(await nextActionCalls(page)).toEqual([{ clientSecret: CLIENT_SECRET }])
  await expect(cancelPayment(page)).toBeHidden()

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

test('on a phone, Phase A hides the back arrow without moving the logo', async ({
  page,
  cloud,
  signIn
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  cloud.scenario.paymentMethods = []
  scriptOperation(cloud)
  await holdChallenge(page)
  await signIn(CHECKOUT)
  const logo = page.getByRole('img', { name: 'Comfy' })
  const before = await logo.boundingBox()

  await payButton(page).click()

  await expect(footnote(page)).toHaveText(PHASE_A)
  await expect(backArrow(page)).toBeHidden()
  expect(await logo.boundingBox()).toEqual(before)
})

test('a card Pay shows only the spinner while the server is still confirming it, never Phase B before the challenge', async ({
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
  const readsBefore = operationReads(cloud)
  await expect
    .poll(() => operationReads(cloud))
    .toBeGreaterThan(readsBefore + 1)

  await expect(footnote(page)).toHaveText('')

  moveOperation(awaitingChallenge())

  await expect(footnote(page)).toHaveText(PHASE_A)
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

test('312-9930: an Alipay checkout restored from the back-forward cache loads afresh and offers Complete verification', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  scriptOperation(cloud)
  await holdChallenge(page)
  await page.addInitScript((redirectTo) => {
    const [entry] = performance.getEntriesByType('navigation')
    const reloaded =
      entry instanceof PerformanceNavigationTiming && entry.type === 'reload'
    Object.assign(window, {
      __e2eStripeMethodType: 'alipay',
      ...(reloaded ? { __e2eStripeRedirectTo: redirectTo } : {})
    })
  }, PORTAL_URL)
  await signIn(CHECKOUT)
  await payButton(page).click()
  await expect
    .poll(() => nextActionCalls(page))
    .toEqual([{ clientSecret: CLIENT_SECRET }])
  await expect(footnote(page)).toHaveText(REDIRECTING)

  cloud.scenario.status = {
    ...cloud.scenario.status,
    pending_billing_op_id: OPERATION,
    pending_billing_op_type: 'subscription',
    payment_intent_client_secret: CLIENT_SECRET
  }
  await page.evaluate(() => {
    const event = new Event('pageshow')
    Object.defineProperty(event, 'persisted', { value: true })
    window.dispatchEvent(event)
  })

  await expect(completeVerification(page)).toBeEnabled()
  await expect(footnote(page)).toHaveText(PHASE_A)
  expect(await nextActionCalls(page)).toEqual([])
  expect(subscribeRequests(cloud)).toHaveLength(1)
})

test('340-12967: a reload during Phase A shows the locked form, never Complete verification, while the challenge re-opens', async ({
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
  await holdChallenge(page)
  await page.addInitScript(() => {
    const offered = { seen: false }
    Object.assign(window, { __e2eVerifyOffered: offered })
    new MutationObserver(() => {
      for (const button of document.querySelectorAll('button'))
        if (button.textContent.includes('Complete verification'))
          offered.seen = true
    }).observe(document, { subtree: true, childList: true })
  })
  await signIn(CHECKOUT)

  await expect
    .poll(() => nextActionCalls(page))
    .toEqual([{ clientSecret: CLIENT_SECRET }])
  await expect(footnote(page)).toHaveText(PHASE_A)
  await expect(page.getByTestId('checkout-skeleton')).toHaveCount(0)
  await expect(page.getByTestId('checkout-waiting')).not.toHaveAttribute(
    'aria-busy'
  )
  expect(await page.evaluate('window.__e2eVerifyOffered.seen')).toBe(false)
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

test('coming back from Alipay after its own payment went through is Success, naming the plan the server now lists', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  const moveOperation = scriptOperation(cloud)
  await page.addInitScript((redirectTo) => {
    Object.assign(window, {
      __e2eStripeMethodType: 'alipay',
      __e2eStripeRedirectTo: redirectTo
    })
  }, PORTAL_URL)
  await signIn(CHECKOUT)
  await payButton(page).click()
  await expect(page).toHaveURL(PORTAL_URL)

  moveOperation(succeededOperation(OPERATION))
  cloud.scenario.status = {
    ...cloud.scenario.status,
    plan_slug: 'pro_monthly',
    subscription_tier: 'PRO'
  }
  cloud.scenario.preview = { ...cloud.scenario.preview, allowed: false }
  await page.goBack()

  await expect(
    page.getByRole('heading', { name: "You're all set" })
  ).toBeVisible()
  const plan = page.getByTestId('checkout-ending-plan')
  await expect(plan).toContainText('Pro')
  await expect(plan).toContainText('$50.00')
  await expect(
    page.getByRole('heading', { name: 'Already completed' })
  ).toBeHidden()
  expect(subscribeRequests(cloud)).toHaveLength(1)
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

test('145-4326: Cancel payment during Phase A goes back to the form as typed, with no card, Pay live and no challenge window', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  const moveOperation = scriptOperation(cloud)
  cloud.reply('POST', CANCEL_PATH, () => {
    moveOperation(canceledOperation())
    return { body: { billing_op_id: OPERATION, status: 'canceled' } }
  })
  await payIntoPhaseA(page, signIn, moveOperation)

  await cancelPayment(page).click()

  await expect(cancelPayment(page)).toBeHidden()
  await expect(footnote(page)).toHaveText('')
  await expect(backArrow(page)).toBeVisible()
  await expect(payButton(page)).toBeEnabled()
  await expect(page.getByRole('alert')).toBeHidden()
  expect(await elementUnmounts(page)).toBe(0)
  expect(await nextActionCalls(page)).toEqual([])
  expect(cancelRequests(cloud)).toHaveLength(1)
  expect(subscribeRequests(cloud)).toHaveLength(1)
})

test('342-4767: a cancel the payment won the race against shows Phase B and follows the payment to success', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  const moveOperation = scriptOperation(cloud)
  cloud.reply('POST', CANCEL_PATH, () => {
    moveOperation(processing())
    return {
      status: 409,
      body: {
        code: 'PAYMENT_IN_FLIGHT',
        message: 'billing operation has applied or its payment is in progress'
      }
    }
  })
  await payIntoPhaseA(page, signIn, moveOperation)

  await cancelPayment(page).click()

  await expect(footnote(page)).toHaveText(PHASE_B)
  await expect(cancelPayment(page)).toBeHidden()
  await expect(payButton(page)).toBeDisabled()
  await expect(backArrow(page)).toBeHidden()

  moveOperation(succeededOperation(OPERATION))

  await expect(
    page.getByRole('heading', { name: "You're all set" })
  ).toBeVisible()
  expect(cancelRequests(cloud)).toHaveLength(1)
})

test('786-16245: a second click while the cancel is settling sends nothing more, and the page asks again until it settles', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  const moveOperation = scriptOperation(cloud)
  const asked = { times: 0 }
  cloud.reply('POST', CANCEL_PATH, () => {
    asked.times += 1
    if (asked.times === 1)
      return {
        status: 202,
        body: { billing_op_id: OPERATION, status: 'cancel_requested' }
      }
    moveOperation(canceledOperation())
    return { body: { billing_op_id: OPERATION, status: 'canceled' } }
  })
  await payIntoPhaseA(page, signIn, moveOperation)

  await cancelPayment(page).dblclick()

  await expect(page.getByRole('button', { name: 'Canceling…' })).toBeDisabled()
  await expect(footnote(page)).toHaveText(PHASE_A)
  await expect(cancelPayment(page)).toBeHidden()
  await expect(footnote(page)).toHaveText('')
  await expect(page.getByRole('alert')).toBeHidden()
  expect(cancelRequests(cloud)).toHaveLength(2)
})

test('786-16314: a payment the server will not cancel hides Cancel payment and says why', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  const moveOperation = scriptOperation(cloud)
  cloud.reply('POST', CANCEL_PATH, () => ({
    status: 409,
    body: {
      code: 'NOT_CANCELABLE',
      message: 'billing operation is not waiting on authentication'
    }
  }))
  await payIntoPhaseA(page, signIn, moveOperation)

  await cancelPayment(page).click()

  await expect(
    page.getByText(
      "This payment can't be canceled right now. Finish verifying, or contact support if it doesn't go through."
    )
  ).toBeVisible()
  await expect(cancelPayment(page)).toBeHidden()
  await expect(footnote(page)).toHaveText(PHASE_A)
  await expect(
    page.getByRole('heading', { name: "You're all set" })
  ).toBeHidden()
})

/** Answers the first cancel as still settling and the next as canceled. */
function cancelSettlingOnce(
  cloud: MockCloud,
  moveOperation: (reply: BillingOpStatusResponse) => void
) {
  const asked = { times: 0 }
  cloud.reply('POST', CANCEL_PATH, () => {
    asked.times += 1
    if (asked.times === 1)
      return {
        status: 202,
        body: { billing_op_id: OPERATION, status: 'cancel_requested' }
      }
    moveOperation(canceledOperation())
    return { body: { billing_op_id: OPERATION, status: 'canceled' } }
  })
}

test("closing Stripe's challenge window cancels the payment on the server before another Pay is sent", async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  const moveOperation = scriptOperation(cloud)
  cancelSettlingOnce(cloud, moveOperation)
  await holdChallenge(page)
  await signIn(CHECKOUT)
  await payButton(page).click()
  await expect(footnote(page)).toHaveText(PHASE_A)

  await releaseChallenge(page, 'requires_payment_method')

  await expect(page.getByRole('alert')).toContainText('Payment not completed')
  await expect.poll(() => cancelRequests(cloud).length).toBe(1)

  await payButton(page).click()

  await expect.poll(() => subscribeRequests(cloud).length).toBe(2)
  const paths = cloud.requests.map((request) => request.path)
  expect(cancelRequests(cloud)).toHaveLength(2)
  expect(paths.lastIndexOf(CANCEL_PATH)).toBeLessThan(
    paths.lastIndexOf('/billing/subscribe')
  )
})

test("Cancel payment while the page is about to re-open the challenge keeps Stripe's window closed", async ({
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
  cancelSettlingOnce(cloud, moveOperation)
  await page.addInitScript(() => {
    Object.assign(window, { __e2eStripeHoldRetrieve: true })
  })
  await signIn(CHECKOUT)
  await expect(footnote(page)).toHaveText(PHASE_A)
  await expect
    .poll(() => page.evaluate('typeof window.__e2eFakeStripe?.releaseRetrieve'))
    .toBe('function')

  await cancelPayment(page).click()
  await expect(page.getByRole('button', { name: 'Canceling…' })).toBeDisabled()
  await page.evaluate('window.__e2eFakeStripe.releaseRetrieve()')

  await expect(payButton(page)).toBeEnabled()
  await expect(cancelPayment(page)).toBeHidden()
  expect(cancelRequests(cloud)).toHaveLength(2)
  expect(await nextActionCalls(page)).toEqual([])
})
