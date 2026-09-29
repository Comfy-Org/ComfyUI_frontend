/**
 * The full-page terminals, each reached the way a customer reaches it: their
 * own Pay, a revisit after the money settled, a bank capture that is still
 * settling, a refusal, a stale plan link and a checkout that could not load.
 */
import type { Locator, Page } from '@playwright/test'

import type { MockCloud } from './fixtures/cloud'
import {
  capabilitiesWith,
  pendingOperation,
  succeededOperation
} from './fixtures/scenario'
import { expectStraightToHost } from './fixtures/planless'
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
  await expect(page.getByText('You can close this tab now.')).toBeVisible()
  await expect(page.getByText(/Closing in/)).toBeHidden()

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
    page.getByText("Don't pay again, you could be charged twice.")
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

test('a member the owner manages billing for sees Checkout not available with the reason code, and support only', async ({
  page,
  cloud,
  signIn
}) => {
  const refused = capabilitiesWith({ can_subscribe_self_serve: false })
  cloud.reply('GET', '/billing/capabilities', () => ({
    body: {
      ...refused,
      denied_reasons: { can_subscribe_self_serve: 'not_workspace_owner' }
    },
    headers: { 'x-capability-revision': String(refused.revision) }
  }))
  await signIn(CHECKOUT)

  await expect(heading(page, 'Checkout not available')).toBeVisible()
  await expect(code(page)).toHaveText('NOT_WORKSPACE_OWNER')
  await expect(contactSupport(page)).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Close|Try again/ })
  ).toBeHidden()
})

test('643-14654: a change already scheduled is named from the server, and without one the refusal still says a change is scheduled', async ({
  page,
  cloud,
  signIn
}) => {
  const refused = capabilitiesWith({ can_subscribe_self_serve: false })
  cloud.reply('GET', '/billing/capabilities', () => ({
    body: {
      ...refused,
      denied_reasons: {
        can_subscribe_self_serve: 'subscription_change_in_progress'
      }
    },
    headers: { 'x-capability-revision': String(refused.revision) }
  }))
  cloud.scenario.status = {
    ...cloud.scenario.status,
    scheduled_change: {
      plan_slug: 'pro_monthly',
      effective_at: '2026-10-28T00:00:00.000Z',
      team_credit_stop: null
    }
  }
  await signIn(CHECKOUT)

  await expect(heading(page, 'Checkout not available')).toBeVisible()
  await expect(
    page.getByText(
      'Your plan is set to change to Pro on October 28, 2026. Cancel that change in your billing settings to make a different one.'
    )
  ).toBeVisible()
  await expect(code(page)).toHaveText('SUBSCRIPTION_CHANGE_IN_PROGRESS')

  cloud.scenario.status = { ...cloud.scenario.status, scheduled_change: null }
  await page.reload()

  await expect(
    page.getByText(
      'Your plan already has a change scheduled. Cancel it in your billing settings to make a different one.'
    )
  ).toBeVisible()
})

/** The element's text as the browser laid it out, one entry per rendered line. */
function renderedLines(locator: Locator): Promise<string[]> {
  return locator.evaluate((element) => {
    const lines: { top: number; text: string }[] = []
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? ''
      for (let index = 0; index < text.length; index += 1) {
        const range = document.createRange()
        range.setStart(node, index)
        range.setEnd(node, index + 1)
        const rect = range.getClientRects().item(0)
        if (rect === null || rect.width === 0) continue
        const last = lines.at(-1)
        if (last !== undefined && Math.abs(last.top - rect.top) < 4)
          last.text += text[index]
        else lines.push({ top: rect.top, text: text[index] })
      }
    }
    return lines.map((line) => line.text.trim()).filter(Boolean)
  })
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("662-14660: an ending's heading wraps in balanced lines", async ({
    page,
    cloud,
    signIn
  }) => {
    markPending(cloud, 'op_lost')
    cloud.scenario.operations.op_lost = {
      ...pendingOperation('op_lost'),
      status: 'reconciliation_needed'
    }
    await signIn(CHECKOUT)

    const title = heading(page, "We couldn't confirm your payment")
    await expect(title).toBeVisible()
    expect(await renderedLines(title)).toEqual([
      "We couldn't confirm",
      'your payment'
    ])
  })

  test('a long refusal code wraps only after an underscore', async ({
    page,
    cloud,
    signIn
  }) => {
    const refused = capabilitiesWith({ can_subscribe_self_serve: false })
    cloud.reply('GET', '/billing/capabilities', () => ({
      body: {
        ...refused,
        denied_reasons: {
          can_subscribe_self_serve: 'subscription_change_in_progress'
        }
      },
      headers: { 'x-capability-revision': String(refused.revision) }
    }))
    await signIn(CHECKOUT)

    await expect(code(page)).toHaveText('SUBSCRIPTION_CHANGE_IN_PROGRESS')
    const lines = await renderedLines(code(page))
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join('')).toBe('SUBSCRIPTION_CHANGE_IN_PROGRESS')
    for (const line of lines.slice(0, -1)) expect(line).toMatch(/_$/)
  })
})

test('433-6840: a link to a plan the catalog lacks renders Plan not available with PLAN_NOT_FOUND, and View plans opens the cloud pricing table', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.reply('POST', '/billing/preview-subscribe', () => ({
    status: 400,
    body: { code: 'INVALID_PLAN', message: 'Plan not found: pro_monthly' }
  }))
  await signIn(CHECKOUT)

  await expect(heading(page, "This plan isn't available")).toBeVisible()
  await expect(code(page)).toHaveText('PLAN_NOT_FOUND')

  await page.getByRole('button', { name: 'View plans' }).click()

  await expect(heading(page, 'Host app')).toBeVisible()
  await expect(page).toHaveURL(
    'https://testcloud.comfy.org/?pricing=1&workspace=ws_e2e'
  )
})

test('433-6840: a team link without its commit stop is an invalid link, and View plans opens the pricing table on the Team tab', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.preview = {
    ...cloud.scenario.preview,
    new_plan: { ...cloud.scenario.preview.new_plan, tier: 'TEAM' }
  }
  await signIn(entryPath('checkout', { plan: 'team_per_credit_monthly' }))

  await expect(heading(page, "This plan isn't available")).toBeVisible()
  await expect(code(page)).toHaveText('CHECKOUT_LINK_INVALID')
  await expect(payButton(page)).toBeHidden()
  expect(subscribeRequests(cloud)).toHaveLength(0)

  await page.getByRole('button', { name: 'View plans' }).click()

  await expect(heading(page, 'Host app')).toBeVisible()
  await expect(page).toHaveURL(
    'https://testcloud.comfy.org/?pricing=team&workspace=ws_e2e'
  )
})

test('433-6840: a checkout link that names no plan, routed once the tab is signed in on the flag, is Plan not available, and View plans opens the pricing table', async ({
  page,
  signIn
}) => {
  const planless = entryPath('checkout', {})
  await signIn(CHECKOUT)
  await expect(payButton(page)).toBeVisible()

  await page.goto(`/sign-in?returnTo=${encodeURIComponent(planless)}`)

  await expect(heading(page, "This plan isn't available")).toBeVisible()
  await expect(code(page)).toHaveText('CHECKOUT_LINK_INVALID')
  await expect(page).toHaveURL(planless)
  await expect(payButton(page)).toBeHidden()

  await page.getByRole('button', { name: 'View plans' }).click()

  await expect(heading(page, 'Host app')).toBeVisible()
  await expect(page).toHaveURL(
    'https://testcloud.comfy.org/?pricing=1&workspace=ws_e2e'
  )
})

test('a signed-out visitor on the flag still goes back to the host for a checkout link that names no plan', async ({
  page
}) => {
  await expectStraightToHost(page, 'ws_team_e2e')
})

test('a checkout link that names no plan, opened by the host in a new tab, goes back to the host even for a signed-in customer on the flag', async ({
  context,
  signIn
}) => {
  await signIn(CHECKOUT)

  await expectStraightToHost(await context.newPage(), 'ws_e2e')
})

test("433-6840: a checkout link the contract cannot read is the checkout's 404 on the full page, and still the entry error on the embedded one", async ({
  page,
  cloud,
  signIn
}) => {
  const unreadable = entryPath('checkout', {
    product: 'spreadsheet',
    plan: 'pro_monthly'
  })
  await signIn(unreadable)

  await expect(heading(page, "This plan isn't available")).toBeVisible()
  await expect(code(page)).toHaveText('CHECKOUT_LINK_INVALID')
  await expect(payButton(page)).toBeHidden()

  cloud.scenario.checkoutUi = 'embedded'
  await page.goto(unreadable)

  await expect(
    heading(page, "We couldn't open that billing page")
  ).toBeVisible()
  await expect(
    page.getByText("That link doesn't say which product sent you here.")
  ).toBeVisible()
})

test("a checkout that couldn't load retries in place on Try again, without leaving the URL", async ({
  page,
  cloud,
  signIn
}) => {
  let quotes = 0
  cloud.reply('POST', '/billing/preview-subscribe', () => {
    quotes += 1
    return quotes === 1
      ? { status: 503, body: { code: 'UNAVAILABLE', message: 'down' } }
      : { body: cloud.scenario.preview }
  })
  await signIn(CHECKOUT)

  await expect(heading(page, "Couldn't load your checkout")).toBeVisible()
  await expect(code(page)).toHaveText('REQUEST_FAILED')

  await page.getByRole('button', { name: 'Try again' }).click()

  await expect(payButton(page)).toBeEnabled()
  await expect(page).toHaveURL(CHECKOUT)
  expect(quotes).toBe(2)
})

test("a re-read of the workspace's payments that fails never claims nothing was charged, and Try again follows the payment once it answers", async ({
  page,
  cloud,
  signIn
}) => {
  markPending(cloud, 'op_unread')
  cloud.scenario.operations.op_unread = succeededOperation('op_unread')
  let reachable = false
  cloud.reply('GET', '/billing/status', () =>
    reachable
      ? { body: cloud.scenario.status }
      : { status: 503, body: { code: 'UNAVAILABLE', message: 'down' } }
  )
  await signIn(CHECKOUT)

  await expect(heading(page, "Couldn't load your checkout")).toBeVisible()
  await expect(page.getByText(/Nothing has been charged/)).toBeHidden()
  await expect(payButton(page)).toBeHidden()

  reachable = true
  await page.getByRole('button', { name: 'Try again' }).click()

  await expect(heading(page, 'Already completed')).toBeVisible()
  await expect(code(page)).toHaveText('op_unread')
  expect(subscribeRequests(cloud)).toHaveLength(0)
})
