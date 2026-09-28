/**
 * The full-page terminals, each reached the way a customer reaches it: their
 * own Pay, a revisit after the money settled, and a bank capture that is
 * still settling.
 */
import type { Page } from '@playwright/test'

import type { MockCloud } from './fixtures/cloud'
import { pendingOperation, succeededOperation } from './fixtures/scenario'
import { installFakeStripe } from './fixtures/stripe'
import { entryPath, expect, test as base } from './fixtures/test'

const test = base.extend<{ fullPage: void }>({
  fullPage: [
    async ({ context, cloud }, use) => {
      await installFakeStripe(context)
      cloud.scenario.checkoutUi = 'full_page'
      cloud.scenario.paymentMethods = []
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

const payButton = (page: Page) =>
  page.getByRole('button', { name: 'Pay and subscribe' })
const heading = (page: Page, name: string) =>
  page.getByRole('heading', { name })
const code = (page: Page) => page.getByTestId('checkout-ending-code')
const contactSupport = (page: Page) =>
  page.getByRole('link', { name: 'Contact support' })

function markPending(cloud: MockCloud, id: string) {
  cloud.scenario.status = {
    ...cloud.scenario.status,
    pending_billing_op_id: id,
    pending_billing_op_type: 'subscription'
  }
}

const subscribeRequests = (cloud: MockCloud) =>
  cloud.requests.filter((request) => request.path === '/billing/subscribe')

test('a Pay that goes through names the plan and the workspace, and Close goes back to the product with the outcome', async ({
  page,
  signIn
}) => {
  await signIn(CHECKOUT)
  await payButton(page).click()

  await expect(heading(page, "You're all set")).toBeVisible()
  await expect(
    page.getByText('Your plan for Personal has been successfully updated.')
  ).toBeVisible()
  await expect(page.getByTestId('checkout-ending-plan')).toContainText('Pro')
  await expect(code(page)).toBeHidden()

  await page.getByRole('button', { name: 'Close' }).click()

  await expect(heading(page, 'Host app')).toBeVisible()
  const back = new URL(page.url())
  expect(back.searchParams.get('billing_result')).toBe('success')
  expect(back.searchParams.get('billing_ref')).toBe('op_subscribe')
})

test('a revisit after the payment settled renders Already completed on every load, never a form', async ({
  page,
  cloud,
  signIn
}) => {
  markPending(cloud, 'op_done')
  cloud.scenario.operations.op_done = succeededOperation('op_done')
  await signIn(CHECKOUT)

  await expect(heading(page, 'Already completed')).toBeVisible()
  await expect(code(page)).toHaveText('op_done')
  await expect(page.getByTestId('checkout-ending-plan')).toBeHidden()

  await page.reload()

  await expect(heading(page, 'Already completed')).toBeVisible()
  await expect(payButton(page)).toBeHidden()
  expect(subscribeRequests(cloud)).toHaveLength(0)
})

test('FE-2856: a capture the bank is still settling renders Payment in progress, then resolves forward to success', async ({
  page,
  cloud,
  signIn
}) => {
  markPending(cloud, 'op_bank')
  cloud.scenario.operations.op_bank = {
    ...pendingOperation('op_bank'),
    phase: 'in_progress',
    authentication_state: 'processing'
  }
  await signIn(CHECKOUT)

  await expect(heading(page, 'Payment in progress')).toBeVisible()
  await expect(
    page.getByText(/don't pay again: you could be charged twice/)
  ).toBeVisible()
  await expect(code(page)).toHaveText('op_bank')
  await expect(contactSupport(page)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close' })).toBeHidden()
  await expect(payButton(page)).toBeHidden()

  cloud.scenario.operations.op_bank = succeededOperation('op_bank')

  await expect(heading(page, "You're all set")).toBeVisible()
  await expect(
    page.getByText(
      'A payment on this workspace completed — check your plan in settings.'
    )
  ).toBeVisible()
  await expect(code(page)).toHaveText('op_bank')
  expect(subscribeRequests(cloud)).toHaveLength(0)
})
