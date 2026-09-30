/**
 * `page.route` fulfils every request in this suite without a CORS preflight
 * the browser would otherwise send, so it cannot catch a Cloud allow-list
 * gap (e.g. `Idempotency-Key` missing from `Access-Control-Allow-Headers`)
 * — that is covered by the live test plan, not here.
 */
import type { BillingOpStatusResponse } from '@comfyorg/ingest-types'

import type { MockCloud } from './fixtures/cloud'
import { E2E_USER } from './fixtures/env'
import { expectStraightToHost } from './fixtures/planless'
import {
  challengeRequiredOperation,
  contactSupportOperation,
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

// Above the 8 s poll backoff cap, well below the 30 s parked cadence.
const FAST_BACKOFF_DEADLINE_MS = 15_000

/**
 * The only scenarios in this fixture set that collect a card: a payment
 * method configured, and no saved method standing in for the card form.
 */
function withEmbeddedPaymentMethod(cloud: MockCloud): void {
  cloud.scenario.preview = {
    ...cloud.scenario.preview,
    payment_method_configuration_id: 'pmc_e2e'
  }
  cloud.scenario.paymentMethods = []
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
  await expect(page.getByText('Pro', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Pay and subscribe' }).click()

  await expect(
    page.getByRole('heading', { name: "You're all set" })
  ).toBeVisible()
  await expect(page.getByText('Pro', { exact: true })).toBeVisible()

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
    page.getByRole('heading', { name: 'Review your scheduled change' })
  ).toBeVisible()
  await expect(page.getByText('Pro', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Confirm change' }).click()

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

test('a reactivating upgrade taller than the frame scrolls to its confirm', async ({
  page,
  cloud,
  signIn
}) => {
  await page.setViewportSize({ width: 1280, height: 520 })
  cloud.scenario.preview = {
    ...cloud.scenario.preview,
    transition_type: 'upgrade',
    requires_reactivation_confirmation: true,
    cost_today_cents: 90_000,
    amount_due_cents: 90_000,
    current_plan: {
      ...cloud.scenario.preview.new_plan,
      slug: 'standard_monthly',
      tier: 'STANDARD',
      price_cents: 2000,
      period_end: new Date(Date.now() + 86_400_000).toISOString()
    }
  }
  await signIn(CHECKOUT)

  const heading = page.getByRole('heading', { name: 'Confirm your upgrade' })
  await expect(heading).toBeVisible()
  const confirm = page.getByRole('button', { name: /Confirm & reactivate/ })
  await expect(confirm).not.toBeInViewport()

  const box = await heading.boundingBox()
  if (!box) throw new Error('the confirm heading has no box')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 40)
  await page.mouse.wheel(0, 2000)

  await expect(confirm).toBeInViewport()
})

test('a saved default method is charged in place of the card form', async ({
  page,
  cloud,
  signIn
}) => {
  await signIn(CHECKOUT)

  await expect(page.getByText('visa •••• 4242')).toBeVisible()
  await page.getByRole('button', { name: 'Pay and subscribe' }).click()

  await expect(
    page.getByRole('heading', { name: "You're all set" })
  ).toBeVisible()
  const subscribe = cloud.requests.find(
    (request) => request.path === '/billing/subscribe'
  )
  expect(subscribe?.body).toMatchObject({
    plan_slug: 'pro_monthly',
    saved_payment_method_id: 'pm_e2e'
  })
  expect(subscribe?.body).not.toHaveProperty('confirmation_token')
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

  await expect(page.getByRole('alert')).toContainText(
    'Your bank declined this payment. Try another payment method or contact your bank.'
  )
  await expect(
    page.getByRole('button', { name: 'Pay and subscribe' })
  ).toBeEnabled()
  await expect(page).toHaveURL(/\/v1\/checkout\?/)

  expect(await fakeStripeCalls(page, 'confirmationTokens')).toBe(1)
  expect(await fakeStripeCalls(page, 'nextActions')).toBe(0)
})

test('a failure with no coded reason reads as a bank decline, as the app does', async ({
  page,
  cloud,
  signIn
}) => {
  withEmbeddedPaymentMethod(cloud)
  cloud.scenario.operations.op_subscribe =
    contactSupportOperation('op_subscribe')
  await signIn(CHECKOUT)

  await page.getByRole('button', { name: 'Pay and subscribe' }).click()

  await expect(page.getByRole('alert')).toContainText(
    'Your bank declined this payment. Try another payment method or contact your bank.'
  )
  await expect(
    page.getByRole('heading', { name: 'Confirm your payment' })
  ).toBeVisible()
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

test('a completed 3DS challenge does not ask to verify again while the server settles', async ({
  page,
  cloud,
  signIn
}) => {
  withEmbeddedPaymentMethod(cloud)
  let polls = 0
  let settled = false
  cloud.reply('GET', '/billing/ops/op_subscribe', () => {
    polls += 1
    return {
      body: settled
        ? succeededOperation('op_subscribe')
        : challengeRequiredOperation('op_subscribe', 'seti_e2e_secret')
    }
  })
  await signIn(CHECKOUT)

  await page.getByRole('button', { name: 'Pay and subscribe' }).click()

  await expect.poll(() => fakeStripeCalls(page, 'nextActions')).toBe(1)
  const pollsAtChallengeEnd = polls
  await expect.poll(() => polls).toBeGreaterThan(pollsAtChallengeEnd)

  await expect(
    page.getByRole('heading', { name: 'Confirm your payment' })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Complete verification' })
  ).toHaveCount(0)

  settled = true
  await expect(
    page.getByRole('heading', { name: "You're all set" })
  ).toBeVisible()
  expect(await fakeStripeCalls(page, 'nextActions')).toBe(1)
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
  const blocked: BillingOpStatusResponse = {
    ...challenge,
    phase: 'awaiting_invoice_payment'
  }
  const actionless: BillingOpStatusResponse = {
    ...blocked,
    authentication_state: 'processing'
  }
  const replies = [actionless, actionless, blocked]
  let polls = 0
  cloud.reply('GET', '/billing/ops/op_subscribe', () => ({
    body: replies[polls++] ?? succeededOperation('op_subscribe')
  }))
  await signIn(CHECKOUT)

  await page.getByRole('button', { name: 'Pay and subscribe' }).click()

  await expect(
    page.getByRole('heading', { name: "You're all set" })
  ).toBeVisible({ timeout: FAST_BACKOFF_DEADLINE_MS })
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

test('a checkout link naming a team credit stop quotes it along with the plan', async ({
  page,
  cloud,
  signIn
}) => {
  await signIn(
    entryPath('checkout', {
      plan: 'pro_monthly',
      team_credit_stop_id: 'stop_700'
    })
  )

  await expect(
    page.getByRole('heading', { name: 'Confirm your payment' })
  ).toBeVisible()
  const preview = cloud.requests.find(
    (request) => request.path === '/billing/preview-subscribe'
  )
  expect(preview?.body).toStrictEqual({
    plan_slug: 'pro_monthly',
    team_credit_stop_id: 'stop_700'
  })
})

test.describe('a checkout link that names no plan goes back to the host to choose one', () => {
  test('for a signed-out visitor', async ({ page }) => {
    await expectStraightToHost(page, 'ws_team_e2e')
  })

  test('for a signed-in customer, in the tab they signed in on', async ({
    page,
    signIn
  }) => {
    await signIn(CHECKOUT)
    await expect(
      page.getByRole('button', { name: 'Pay and subscribe' })
    ).toBeVisible()

    await expectStraightToHost(page, 'ws_e2e')
  })

  test('for a signed-in customer the host opens a new tab for, before that tab has a session', async ({
    context,
    signIn
  }) => {
    await signIn(CHECKOUT)

    await expectStraightToHost(await context.newPage(), 'ws_e2e')
  })

  test('for a signed-in customer whose link names a workspace they cannot manage, never the refusal', async ({
    context,
    cloud,
    signIn
  }) => {
    await signIn(CHECKOUT)
    cloud.reply('POST', '/auth/token', () => ({
      status: 403,
      body: { error: 'refused' }
    }))
    const tab = await context.newPage()

    await expectStraightToHost(tab, 'ws_not_a_member')
    await expect(tab.getByRole('alert')).toHaveCount(0)
  })
})

test('Close on a checkout tab the product opened closes that tab', async ({
  page,
  context,
  signIn
}) => {
  await signIn(CHECKOUT)
  const [checkoutTab] = await Promise.all([
    context.waitForEvent('page'),
    page.evaluate((url) => {
      window.open(url, '_blank')
    }, CHECKOUT)
  ])
  await expect(
    checkoutTab.getByRole('heading', { name: 'Confirm your payment' })
  ).toBeVisible()

  const closed = checkoutTab.waitForEvent('close')
  await checkoutTab.getByRole('button', { name: 'Close' }).click()
  await closed

  expect(checkoutTab.isClosed()).toBe(true)
})

test('Back on a checkout tab opened directly goes back to the product', async ({
  page,
  signIn
}) => {
  await signIn(CHECKOUT)

  await page.getByRole('button', { name: 'Back' }).click()

  await expect(page).toHaveURL(
    `https://testcloud.comfy.org/?workspace=${E2E_USER.workspaceId}`
  )
})
