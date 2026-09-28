/**
 * One URL, re-read from the live operation on every mount: a reload while
 * money is in flight, a Pay that collides with an operation already under
 * way, and a session that expires mid-checkout all land on whatever the
 * server says is true, never on a fresh form over a pending charge.
 */
import type { Page } from '@playwright/test'

import { E2E_USER } from './fixtures/env'
import { pendingOperation, succeededOperation } from './fixtures/scenario'
import type { MockCloud } from './fixtures/cloud'
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
const EYEBROW = 'Subscribe to Pro Plan · Personal'
const WAITING = 'Finishing your payment…'

const payButton = (page: Page) =>
  page.getByRole('button', { name: 'Pay and subscribe' })
const waiting = (page: Page) => page.getByRole('status')

function markPending(cloud: MockCloud, id: string) {
  cloud.scenario.status = {
    ...cloud.scenario.status,
    pending_billing_op_id: id,
    pending_billing_op_type: 'subscription'
  }
}

/** The server reports the operation pending only from the given status read on. */
function pendingFromRead(cloud: MockCloud, id: string, fromRead: number) {
  let reads = 0
  cloud.reply('GET', '/billing/status', () => {
    reads += 1
    return {
      body:
        reads >= fromRead
          ? {
              ...cloud.scenario.status,
              pending_billing_op_id: id,
              pending_billing_op_type: 'subscription'
            }
          : cloud.scenario.status
    }
  })
}

const subscribeRequests = (cloud: MockCloud) =>
  cloud.requests.filter((request) => request.path === '/billing/subscribe')

test('a reload while a payment is in flight renders the waiting state, never a form, and follows it to Already completed', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  markPending(cloud, 'op_in_flight')
  cloud.scenario.operations.op_in_flight = pendingOperation('op_in_flight')
  await signIn(CHECKOUT)

  await expect(waiting(page)).toHaveText(WAITING)
  await expect(page.getByText(EYEBROW)).toBeVisible()
  await expect(payButton(page)).toBeHidden()
  await expect(page).toHaveURL(/\/v1\/checkout\?/)

  cloud.scenario.operations.op_in_flight = succeededOperation('op_in_flight')

  await expect(
    page.getByRole('heading', { name: 'Already completed' })
  ).toBeVisible()
  await expect(page.getByText('Reference: op_in_flight')).toBeVisible()
  await expect(page.getByText('Pro Plan')).toBeHidden()
  expect(subscribeRequests(cloud)).toHaveLength(0)
})

test('an operation parked on a payment method renders capture, and Pay resubmits it', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  markPending(cloud, 'op_parked')
  cloud.scenario.operations.op_parked = {
    ...pendingOperation('op_parked'),
    phase: 'awaiting_payment_method'
  }
  await signIn(CHECKOUT)

  await expect(payButton(page)).toBeEnabled()
  await expect(waiting(page)).toBeHidden()
  await payButton(page).click()

  await expect.poll(() => subscribeRequests(cloud)).toHaveLength(1)
})

test('a Pay refused for an operation already pending re-reads it and waits on it, never a decline', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  pendingFromRead(cloud, 'op_elsewhere', 2)
  cloud.scenario.operations.op_elsewhere = pendingOperation('op_elsewhere')
  await signIn(CHECKOUT)
  await expect(payButton(page)).toBeEnabled()

  await payButton(page).click()

  await expect(waiting(page)).toHaveText(WAITING)
  await expect(payButton(page)).toBeHidden()
  await expect(page.getByText('Payment declined')).toBeHidden()
  await expect(page.getByRole('link', { name: 'Contact support' })).toBeHidden()
  expect(subscribeRequests(cloud)).toHaveLength(0)
})

test('a Pay the server answers 409 for lands on Already completed once the re-read finds the payment settled', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  cloud.reply('POST', '/billing/subscribe', () => ({
    status: 409,
    body: { code: 'CONFLICT', message: 'operation already settled' }
  }))
  pendingFromRead(cloud, 'op_settled', 3)
  cloud.scenario.operations.op_settled = succeededOperation('op_settled')
  await signIn(CHECKOUT)
  await expect(payButton(page)).toBeEnabled()

  await payButton(page).click()

  await expect(
    page.getByRole('heading', { name: 'Already completed' })
  ).toBeVisible()
  await expect(page.getByText('Payment declined')).toBeHidden()
  await expect(page.getByRole('link', { name: 'Contact support' })).toBeHidden()
  expect(subscribeRequests(cloud)).toHaveLength(1)
})

const REFUSED = { status: 401, body: { error: 'unauthorized' } } as const
const BILLING_READS = [
  '/billing/status',
  '/billing/capabilities',
  '/billing/payment-methods'
]

for (const { name, pending, lands } of [
  { name: 'money in flight', pending: true, lands: 'waiting' },
  { name: 'nothing pending', pending: false, lands: 'capture' }
] as const) {
  test(`a session that expires mid-checkout goes through sign-in and comes back to the same URL, reconciling into ${lands} for ${name}, without charging`, async ({
    page,
    cloud,
    signIn
  }) => {
    cloud.scenario.paymentMethods = []
    await signIn(CHECKOUT)
    await expect(payButton(page)).toBeEnabled()

    cloud.reply('POST', '/auth/token', () => REFUSED)
    for (const path of BILLING_READS) cloud.reply('GET', path, () => REFUSED)
    await payButton(page).click()

    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/sign-in' &&
        url.searchParams.get('returnTo') === CHECKOUT
    )
    await expect(page.getByRole('alert')).toBeVisible()

    cloud.reply('POST', '/auth/token', () => ({
      body: {
        token: 'e2e-workspace-jwt-2',
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        permissions: ['workspace:read', 'billing:write'],
        role: 'owner',
        workspace: {
          id: E2E_USER.workspaceId,
          name: 'Personal',
          type: 'personal'
        }
      }
    }))
    for (const path of BILLING_READS) {
      cloud.reply('GET', path, () => ({
        body:
          path === '/billing/status'
            ? pending
              ? {
                  ...cloud.scenario.status,
                  pending_billing_op_id: 'op_after_reauth',
                  pending_billing_op_type: 'subscription'
                }
              : cloud.scenario.status
            : path === '/billing/capabilities'
              ? cloud.scenario.capabilities
              : cloud.scenario.paymentMethods
      }))
    }
    cloud.scenario.operations.op_after_reauth =
      pendingOperation('op_after_reauth')
    await page.getByRole('button', { name: 'Retry session' }).click()

    await expect(page).toHaveURL(CHECKOUT)
    if (lands === 'waiting') {
      await expect(waiting(page)).toHaveText(WAITING)
      await expect(payButton(page)).toBeHidden()
    } else {
      await expect(payButton(page)).toBeEnabled()
      await expect(waiting(page)).toBeHidden()
    }
    expect(subscribeRequests(cloud)).toHaveLength(0)
  })
}
