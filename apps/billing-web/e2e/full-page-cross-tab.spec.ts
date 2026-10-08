/**
 * The full-page checkout after the page it rendered is no longer the truth:
 * a sibling tab paid, or the page came back from the back-forward cache. Both
 * re-read the server rather than trusting what they last rendered.
 *
 * Playwright's Chromium disables the back-forward cache, so the restore is
 * modelled by dispatching `pageshow` with `persisted: true`, the event the
 * browser fires on a real restore.
 */
import type { Page } from '@playwright/test'

import type { MockCloud } from './fixtures/cloud'
import { declinedOperation, processingOperation } from './fixtures/scenario'
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
const WAITING = "This payment is already processing and can't be canceled."

const payButton = (page: Page) =>
  page.getByRole('button', { name: 'Pay and subscribe' })
const waiting = (page: Page) => page.getByTestId('checkout-phase-footnote')

/** The server reports the operation pending once a subscribe has been issued. */
function pendingAfterSubscribe(cloud: MockCloud, id: string) {
  cloud.reply('GET', '/billing/status', () => ({
    body: cloud.requests.some(
      (request) => request.path === '/billing/subscribe'
    )
      ? {
          ...cloud.scenario.status,
          pending_billing_op_id: id,
          pending_billing_op_type: 'subscription'
        }
      : cloud.scenario.status
  }))
}

test('a Pay in one tab takes a sibling tab on the same checkout to the waiting state without any interaction', async ({
  page,
  context,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  pendingAfterSubscribe(cloud, 'op_subscribe')
  cloud.scenario.operations.op_subscribe = processingOperation('op_subscribe')
  await signIn(CHECKOUT)
  // The same signed-in identity, so the sibling lands on the checkout directly.
  const sibling = await context.newPage()
  await sibling.goto(CHECKOUT)
  await expect(sibling).toHaveURL(CHECKOUT)
  await expect(payButton(sibling)).toBeEnabled()
  const statusReadsBefore = cloud.requests.filter(
    (request) => request.path === '/billing/status'
  ).length

  await payButton(page).click()

  await expect(waiting(sibling)).toHaveText(WAITING)
  await expect(payButton(sibling)).toBeDisabled()
  expect(
    cloud.requests.filter((request) => request.path === '/billing/status')
      .length
  ).toBeGreaterThan(statusReadsBefore)
  expect(
    cloud.requests.filter((request) => request.path === '/billing/subscribe')
  ).toHaveLength(1)
})

test('a decline shows its card only in the tab that paid; a sibling goes back to the plain payment form', async ({
  page,
  context,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  pendingAfterSubscribe(cloud, 'op_subscribe')
  cloud.scenario.operations.op_subscribe = processingOperation('op_subscribe')
  await signIn(CHECKOUT)
  const sibling = await context.newPage()
  await sibling.goto(CHECKOUT)
  await expect(payButton(sibling)).toBeEnabled()

  await payButton(page).click()
  await expect(waiting(sibling)).toHaveText(WAITING)

  cloud.scenario.operations.op_subscribe = declinedOperation('op_subscribe')

  await expect(page.getByRole('alert')).toContainText('Payment declined')
  await expect(payButton(sibling)).toBeEnabled()
  await expect(sibling.getByText('Payment declined')).toBeHidden()
  await expect(waiting(sibling)).toHaveText('')
})

test('a page restored from the back-forward cache re-reads the operation instead of showing the form it left with', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.paymentMethods = []
  await signIn(CHECKOUT)
  await expect(payButton(page)).toBeEnabled()

  cloud.scenario.status = {
    ...cloud.scenario.status,
    pending_billing_op_id: 'op_meanwhile',
    pending_billing_op_type: 'subscription'
  }
  cloud.scenario.operations.op_meanwhile = processingOperation('op_meanwhile')
  await page.evaluate(() => {
    const event = new Event('pageshow')
    Object.defineProperty(event, 'persisted', { value: true })
    window.dispatchEvent(event)
  })

  await expect(waiting(page)).toHaveText(WAITING)
  await expect(payButton(page)).toBeDisabled()
  expect(
    cloud.requests.filter((request) => request.path === '/billing/subscribe')
  ).toHaveLength(0)
})
