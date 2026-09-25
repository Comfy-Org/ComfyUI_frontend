/**
 * `page.route` fulfils every request in this suite without a CORS preflight
 * the browser would otherwise send, so it cannot catch a Cloud allow-list
 * gap (e.g. `Idempotency-Key` missing from `Access-Control-Allow-Headers`)
 * — that is covered by the live test plan, not here.
 */
import type { MockCloud } from './fixtures/cloud'
import { E2E_USER } from './fixtures/env'
import {
  challengeRequiredOperation,
  declinedOperation,
  pendingOperation,
  succeededOperation
} from './fixtures/scenario'
import { installFakeStripe } from './fixtures/stripe'
import { entryPath, expect, test as base } from './fixtures/test'

const test = base.extend<{ stripeFake: void }>({
  // Depends on `cloud` so this route is added after its catch-all `abort`,
  // which Playwright would otherwise match first for js.stripe.com too.
  stripeFake: [
    // `cloud` is requested only to run after it in the fixture graph.
    async ({ context, cloud }, use) => {
      void cloud
      await installFakeStripe(context)
      await use(undefined)
    },
    { auto: true }
  ]
})

const CHECKOUT = entryPath('checkout', { plan: 'pro_monthly' })

/** The only scenarios in this fixture set with a payment method configured. */
function withEmbeddedPaymentMethod(cloud: MockCloud): void {
  cloud.scenario.preview = {
    ...cloud.scenario.preview,
    payment_method_configuration_id: 'pmc_e2e'
  }
}

async function fakeStripeCalls(
  page: { evaluate: (script: string) => Promise<unknown> },
  key: 'confirmationTokens' | 'nextActions'
): Promise<unknown> {
  return page.evaluate(`window.__e2eFakeStripe.${key}`)
}

/** Every argument `handleNextAction` was actually called with. */
async function fakeStripeNextActionCalls(page: {
  evaluate: (script: string) => Promise<unknown>
}): Promise<unknown> {
  return page.evaluate('window.__e2eFakeStripe.nextActionCalls')
}

test('submitting payment carries the idempotency key and plan, and settles as success', async ({
  page,
  cloud,
  signIn
}) => {
  withEmbeddedPaymentMethod(cloud)
  await signIn(CHECKOUT)

  await expect(
    page.getByRole('heading', { name: 'Confirm your payment' })
  ).toBeVisible()
  await expect(page.getByText('Pro · Monthly')).toBeVisible()

  await page.getByRole('button', { name: 'Pay and subscribe' }).click()

  await expect(
    page.getByRole('heading', { name: "You're all set" })
  ).toBeVisible()
  await expect(page.getByText('Pro · Monthly')).toBeVisible()

  const subscribe = cloud.requests.find(
    (request) => request.path === '/billing/subscribe'
  )
  expect(subscribe?.idempotencyKey).toBeTruthy()
  // The exact id the fake's createConfirmationToken resolved: proves the
  // token StripePaymentForm minted is the one that actually reached the
  // server, not just that some value was sent.
  expect(subscribe?.body).toMatchObject({
    plan_slug: 'pro_monthly',
    confirmation_token: 'ctok_e2e_fake'
  })

  expect(await fakeStripeCalls(page, 'confirmationTokens')).toBe(1)
  expect(await fakeStripeCalls(page, 'nextActions')).toBe(0)
})

test('a scheduled plan change confirms against the saved payment method, no card form', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.preview = {
    ...cloud.scenario.preview,
    transition_type: 'duration_change',
    is_immediate: false,
    cost_today_cents: 0,
    amount_due_cents: 0
  }
  await signIn(CHECKOUT)

  await expect(
    page.getByRole('button', { name: 'Pay and subscribe' })
  ).toBeVisible()
  await expect(page.getByText('Pro · Monthly')).toBeVisible()

  await page.getByRole('button', { name: 'Pay and subscribe' }).click()

  await expect(
    page.getByRole('heading', { name: "You're all set" })
  ).toBeVisible()

  const subscribe = cloud.requests.find(
    (request) => request.path === '/billing/subscribe'
  )
  expect(subscribe?.body).toMatchObject({ plan_slug: 'pro_monthly' })
  expect(subscribe?.body).not.toHaveProperty('confirmation_token')

  // The fake only installs itself once the app requests js.stripe.com, so
  // its absence proves Stripe.js was never loaded for this path.
  expect(await page.evaluate('window.__e2eFakeStripe')).toBeUndefined()
})

test('a declined payment shows the reason and stays on checkout', async ({
  page,
  cloud,
  signIn
}) => {
  withEmbeddedPaymentMethod(cloud)
  cloud.scenario.operations.op_subscribe = declinedOperation('op_subscribe')
  await signIn(CHECKOUT)

  await page.getByRole('button', { name: 'Pay and subscribe' }).click()

  await expect(
    page.getByRole('heading', { name: 'Payment declined' })
  ).toBeVisible()
  await expect(page.getByText('Your bank declined the payment.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(page).toHaveURL(/\/v1\/checkout\?/)

  expect(await fakeStripeCalls(page, 'confirmationTokens')).toBe(1)
  expect(await fakeStripeCalls(page, 'nextActions')).toBe(0)
})

test('a 3DS challenge is driven by the fake and settles as success', async ({
  page,
  cloud,
  signIn
}) => {
  withEmbeddedPaymentMethod(cloud)
  let polls = 0
  cloud.reply('GET', '/billing/ops/op_subscribe', () => {
    polls += 1
    return {
      body:
        polls === 1
          ? challengeRequiredOperation('op_subscribe', 'seti_e2e_secret')
          : succeededOperation('op_subscribe')
    }
  })
  await signIn(CHECKOUT)

  await page.getByRole('button', { name: 'Pay and subscribe' }).click()

  await expect(
    page.getByRole('heading', { name: "You're all set" })
  ).toBeVisible()

  expect(await fakeStripeCalls(page, 'confirmationTokens')).toBe(1)
  expect(await fakeStripeCalls(page, 'nextActions')).toBe(1)
  // The client secret the challenge port actually handed to Stripe's
  // handleNextAction, matching stripeChallengePort.ts's call shape — proves
  // the poll's own secret drove the challenge, not a stale or wrong one.
  expect(await fakeStripeNextActionCalls(page)).toEqual([
    { clientSecret: 'seti_e2e_secret' }
  ])
  expect(polls).toBeGreaterThanOrEqual(2)
})

test('a challenge whose authentication state lags the client secret is still driven in-session', async ({
  page,
  cloud,
  signIn
}) => {
  withEmbeddedPaymentMethod(cloud)
  const challenge = challengeRequiredOperation(
    'op_subscribe',
    'seti_e2e_secret'
  )
  let polls = 0
  cloud.reply('GET', '/billing/ops/op_subscribe', () => {
    polls += 1
    if (polls === 1) {
      return {
        body: {
          ...challenge,
          phase: 'awaiting_invoice_payment',
          authentication_state: 'processing'
        }
      }
    }
    return {
      body:
        polls === 2
          ? { ...challenge, phase: 'awaiting_invoice_payment' }
          : succeededOperation('op_subscribe')
    }
  })
  await signIn(CHECKOUT)

  await page.getByRole('button', { name: 'Pay and subscribe' }).click()

  await expect(
    page.getByRole('heading', { name: "You're all set" })
  ).toBeVisible()
  expect(await fakeStripeNextActionCalls(page)).toEqual([
    { clientSecret: 'seti_e2e_secret' }
  ])
})

test('reloading on the result page while pending recovers it and shows the settled outcome', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.status = {
    ...cloud.scenario.status,
    pending_billing_op_id: 'op_pending',
    pending_billing_op_type: 'subscription'
  }
  cloud.scenario.operations.op_pending = pendingOperation('op_pending')

  await signIn(entryPath('result'))

  await expect(
    page.getByRole('heading', { name: 'Review payment' })
  ).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Payment complete' })
  ).toHaveCount(0)

  // The server settles it in the background; a real backend would also stop
  // reporting it pending, which is what routes the reload through the tab's
  // own pointer instead of the (still-cleared) status endpoint.
  cloud.scenario.status = {
    ...cloud.scenario.status,
    pending_billing_op_id: undefined,
    pending_billing_op_type: undefined
  }
  cloud.scenario.operations.op_pending = succeededOperation('op_pending')

  await page.reload()

  await expect(
    page.getByRole('region', { name: 'Payment complete' })
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Return to ComfyUI' })
  ).toHaveAttribute(
    'href',
    `https://testcloud.comfy.org/?workspace=${E2E_USER.workspaceId}&billing_result=success&billing_ref=op_pending`
  )
  expect(
    cloud.requests.some((request) => request.path === '/billing/ops/op_pending')
  ).toBe(true)
})
