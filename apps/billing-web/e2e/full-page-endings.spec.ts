/**
 * The full-page terminals, each reached the way a customer reaches it: their
 * own Pay, a revisit after the money settled, a bank capture that is still
 * settling, a refusal, a stale plan link and a checkout that could not load.
 */
import type { BillingOpChargeBreakdown } from '@comfyorg/ingest-types'
import type { Locator, Page } from '@playwright/test'

import type { MockCloud } from './fixtures/cloud'
import { PORTAL_URL } from './fixtures/env'
import {
  capabilitiesWith,
  challengeRequiredOperation,
  pendingOperation,
  succeededOperation
} from './fixtures/scenario'
import { expectStraightToPricingTable } from './fixtures/planless'
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
  await expect(page.getByTestId('checkout-ending-paid-today')).toBeHidden()
  await expect(code(page)).toBeHidden()
  await expect(page.getByText('You can close this tab now.')).toBeVisible()
  await expect(page.getByText(/Closing in/)).toBeHidden()

  await page.getByRole('button', { name: 'Close' }).click()

  await expect(heading(page, 'Host app')).toBeVisible()
  const back = new URL(page.url())
  expect(back.searchParams.get('billing_result')).toBe('success')
  expect(back.searchParams.get('billing_ref')).toBe('op_subscribe')
})

/** What the real Cloud answers once this plan is active: no longer pending, and not for sale again. */
function settleOnServer(cloud: MockCloud) {
  cloud.scenario.status = {
    ...cloud.scenario.status,
    plan_slug: 'pro_monthly',
    subscription_tier: 'PRO'
  }
  cloud.scenario.preview = { ...cloud.scenario.preview, allowed: false }
}

test('a scheduled change ends on the plan that starts, its date, and the plan kept until then, not on an updated plan', async ({
  page,
  cloud,
  signIn
}) => {
  const preview = cloud.scenario.preview
  cloud.scenario.preview = {
    ...preview,
    transition_type: 'duration_change',
    is_immediate: false,
    effective_at: '2026-11-04T00:00:00.000Z',
    amount_due_cents: 0,
    cost_today_cents: 0,
    current_plan: {
      ...preview.new_plan,
      slug: 'pro_yearly',
      duration: 'ANNUAL'
    }
  }
  chargedWith(cloud, {
    amount_charged_cents: 0,
    currency: 'usd',
    prorated: false,
    reasons: []
  })
  await signIn(CHECKOUT)
  await page.getByRole('button', { name: 'Confirm change' }).click()

  await expect(heading(page, 'Your plan change is scheduled')).toBeVisible()
  await expect(
    page.getByText(
      "Your plan for Personal changes to Pro on November 4, 2026. You'll keep Pro Yearly until then."
    )
  ).toBeVisible()
  await expect(page.getByText(/successfully updated/)).toBeHidden()
  const card = page.getByTestId('checkout-ending-plan')
  await expect(card.getByText('Pro', { exact: true })).toBeVisible()
  await expect(card).toContainText('$50.00 USD / mo')
  await expect(page.getByText(/credits added/)).toBeHidden()
  await expect(page.getByTestId('checkout-ending-paid-today')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Close' })).toBeVisible()
})

test('a reload after its own Pay went through renders Already completed on every load, never a form', async ({
  page,
  cloud,
  signIn
}) => {
  await signIn(CHECKOUT)
  await payButton(page).click()
  await expect(heading(page, "You're all set")).toBeVisible()
  settleOnServer(cloud)

  await page.reload()

  await expect(heading(page, 'Already completed')).toBeVisible()
  await expect(code(page)).toHaveText('op_subscribe')
  await expect(page.getByTestId('checkout-ending-plan')).toBeHidden()

  await page.reload()

  await expect(heading(page, 'Already completed')).toBeVisible()
  await expect(payButton(page)).toBeHidden()
  expect(subscribeRequests(cloud)).toHaveLength(1)
})

/** How the real preview route refuses a link: a 400 with its own code and sentence. */
function refuseQuote(cloud: MockCloud, message: string) {
  cloud.reply('POST', '/billing/preview-subscribe', () => ({
    status: 400,
    body: { code: 'TRANSITION_NOT_ALLOWED', message }
  }))
}

test('E2: reopening the checkout link after its own Pay went through is Already completed, even when the quote refuses it with a 400', async ({
  page,
  cloud,
  signIn
}) => {
  await signIn(CHECKOUT)
  await payButton(page).click()
  await expect(heading(page, "You're all set")).toBeVisible()
  refuseQuote(cloud, 'the selected plan is already the current plan')

  await page.goto(CHECKOUT)

  await expect(heading(page, 'Already completed')).toBeVisible()
  await expect(code(page)).toHaveText('op_subscribe')
  await expect(heading(page, "Couldn't load your checkout")).toBeHidden()
  await expect(payButton(page)).toBeHidden()
  expect(subscribeRequests(cloud)).toHaveLength(1)
})

test("a coded quote refusal on a link nothing here paid is Checkout not available in the server's words", async ({
  page,
  cloud,
  signIn
}) => {
  refuseQuote(cloud, 'the selected plan is already the current plan')
  await signIn(CHECKOUT)

  await expect(heading(page, 'Checkout not available')).toBeVisible()
  await expect(
    page.getByText('the selected plan is already the current plan')
  ).toBeVisible()
  await expect(code(page)).toHaveText('TRANSITION_NOT_ALLOWED')
  await expect(page.getByRole('button', { name: 'Try again' })).toBeHidden()
  await expect(contactSupport(page)).toBeVisible()
})

const RECEIPT_PLAN = { slug: 'pro_monthly', duration: 'MONTHLY' } as const

test('77-4068: a Pay that goes through counts the credits the server says it added', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.operations.op_subscribe = {
    ...succeededOperation('op_subscribe'),
    amount_charged_cents: 5000,
    credits_added: 10_000,
    plan: RECEIPT_PLAN
  }
  await signIn(CHECKOUT)
  await payButton(page).click()

  await expect(heading(page, "You're all set")).toBeVisible()
  await expect(page.getByTestId('checkout-ending-plan')).toContainText(
    '10,000 credits added'
  )
})

const paidToday = (page: Page) => page.getByTestId('checkout-ending-paid-today')

function chargedWith(cloud: MockCloud, breakdown: BillingOpChargeBreakdown) {
  cloud.scenario.operations.op_subscribe = {
    ...succeededOperation('op_subscribe'),
    amount_charged_cents: breakdown.amount_charged_cents,
    credits_added: 10_000,
    plan: RECEIPT_PLAN,
    charge_breakdown: breakdown
  }
}

const LAUNCH_PROMO = {
  kind: 'promo_code',
  amount_cents: 1000,
  discount: {
    kind: 'promotion',
    code: 'LAUNCH20',
    name: 'Launch 20%',
    duration: 'once',
    term: 'first_month'
  }
} as const

const LAUNCH_PROMO_ON_A_CHANGE = {
  ...LAUNCH_PROMO,
  discount: { ...LAUNCH_PROMO.discount, term: 'this_payment' }
} as const

test('758-15763: a Pay under a promo code keeps the plan rate on Success and lists the reasons the server reported, then what was paid today', async ({
  page,
  cloud,
  signIn
}) => {
  chargedWith(cloud, {
    amount_charged_cents: 3750,
    currency: 'usd',
    prorated: false,
    reasons: [LAUNCH_PROMO, { kind: 'account_balance', amount_cents: 250 }]
  })
  cloud.scenario.preview = {
    ...cloud.scenario.preview,
    amount_due_cents: 4000,
    promotion_code: 'LAUNCH20',
    discounts: [
      {
        kind: 'promotion',
        code: 'LAUNCH20',
        name: 'Launch 20%',
        amount_off_cents: 1000,
        duration: 'once',
        term: 'first_month'
      }
    ]
  }
  await signIn(CHECKOUT)
  await payButton(page).click()

  await expect(heading(page, "You're all set")).toBeVisible()
  const card = page.getByTestId('checkout-ending-plan')
  await expect(card).toContainText('$50.00')
  await expect(paidToday(page)).toHaveText(
    /Launch 20%\s*−\$10\.00\s*First month\s*Account balance\s*−\$2\.50\s*Credit already on your account\s*Paid today\s*\$37\.50/
  )
})

test('a one-time code on a monthly plan change reads This payment only on the summary and on Success', async ({
  page,
  cloud,
  signIn
}) => {
  chargedWith(cloud, {
    amount_charged_cents: 4000,
    currency: 'usd',
    prorated: false,
    reasons: [LAUNCH_PROMO_ON_A_CHANGE]
  })
  const preview = cloud.scenario.preview
  cloud.scenario.preview = {
    ...preview,
    transition_type: 'upgrade',
    amount_due_cents: 4000,
    promotion_code: 'LAUNCH20',
    discounts: [
      {
        kind: 'promotion',
        code: 'LAUNCH20',
        name: 'Launch 20%',
        amount_off_cents: 1000,
        duration: 'once',
        term: 'this_payment'
      }
    ],
    current_plan: {
      ...preview.new_plan,
      slug: 'creator_monthly',
      tier: 'CREATOR',
      price_cents: 3500
    }
  }
  await signIn(CHECKOUT)
  await expect(page.getByText('This payment only')).toBeVisible()
  await expect(page.getByText('First month')).toHaveCount(0)
  await page.getByRole('button', { name: 'Confirm upgrade' }).click()

  await expect(heading(page, "You're all set")).toBeVisible()
  await expect(paidToday(page)).toHaveText(
    /Launch 20%\s*−\$10\.00\s*This payment only\s*Paid today\s*\$40\.00/
  )
})

test('765-15713: a prorated upgrade reads Paid today and why, without itemizing the proration', async ({
  page,
  cloud,
  signIn
}) => {
  chargedWith(cloud, {
    amount_charged_cents: 3250,
    currency: 'usd',
    prorated: true,
    reasons: []
  })
  const preview = cloud.scenario.preview
  cloud.scenario.preview = {
    ...preview,
    transition_type: 'upgrade',
    proration_at: '2026-07-10T09:30:00.000Z',
    amount_due_cents: 3250,
    cost_today_cents: 3250,
    credits_today_cents: 3250,
    credits_next_period_cents: 10_000,
    renewal_amount_cents: 10_000,
    current_plan: {
      ...preview.new_plan,
      slug: 'creator_monthly',
      tier: 'CREATOR',
      price_cents: 3500
    }
  }
  await signIn(CHECKOUT)
  await page.getByRole('button', { name: 'Confirm upgrade' }).click()

  await expect(heading(page, "You're all set")).toBeVisible()
  await expect(paidToday(page)).toHaveText(
    /^\s*Paid today\s*\$32\.50\s*Prorated for the rest of this billing period\s*$/
  )
})

test('a payment settled after a return from the provider lists the reasons its operation reports', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.operations.op_subscribe = challengeRequiredOperation(
    'op_subscribe',
    'pi_e2e_secret'
  )
  await page.addInitScript((redirectTo) => {
    Object.assign(window, {
      __e2eStripeMethodType: 'alipay',
      __e2eStripeRedirectTo: redirectTo
    })
  }, PORTAL_URL)
  await signIn(CHECKOUT)
  await payButton(page).click()
  await expect(page).toHaveURL(PORTAL_URL)

  chargedWith(cloud, {
    amount_charged_cents: 4000,
    currency: 'usd',
    prorated: false,
    reasons: [LAUNCH_PROMO]
  })
  settleOnServer(cloud)
  await page.goBack()

  await expect(heading(page, "You're all set")).toBeVisible()
  await expect(paidToday(page)).toHaveText(
    /Launch 20%\s*−\$10\.00\s*First month\s*Paid today\s*\$40\.00/
  )
})

test('390-4947 / 328-4444: a charge whose credits are still landing reads Payment received, then Already completed names the plan once they land', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.operations.op_subscribe = {
    ...succeededOperation('op_subscribe'),
    amount_charged_cents: 5000,
    plan: RECEIPT_PLAN
  }
  await signIn(CHECKOUT)
  await payButton(page).click()

  await expect(heading(page, 'Payment received')).toBeVisible()
  const receipt = page.getByTestId('checkout-ending-receipt')
  await expect(receipt).toContainText('Payment$50.00')
  await expect(receipt).toContainText('Credits addedAdding…')
  await expect(receipt).toContainText('PlanPro')
  await expect(code(page)).toHaveText('op_subscribe')

  cloud.scenario.operations.op_subscribe = {
    ...cloud.scenario.operations.op_subscribe,
    credits_added: 10_000
  }
  settleOnServer(cloud)
  await page.reload()

  await expect(heading(page, 'Already completed')).toBeVisible()
  await expect(page.getByTestId('checkout-ending-plan')).toContainText(
    'Pro$50.00 USD / mo10,000 credits added'
  )
  await expect(code(page)).toBeHidden()
  expect(subscribeRequests(cloud)).toHaveLength(1)
})

test('a later checkout in the same tab for a plan still for sale opens the form, not the old payment', async ({
  page,
  signIn
}) => {
  await signIn(CHECKOUT)
  await payButton(page).click()
  await expect(heading(page, "You're all set")).toBeVisible()

  await page.goto(entryPath('checkout', { plan: 'creator_monthly' }))

  await expect(payButton(page)).toBeVisible()
  await expect(heading(page, 'Already completed')).toBeHidden()
})

test('a quote the server refuses with nothing paid here ends on Checkout not available, not a form Pay cannot use', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.scenario.preview = { ...cloud.scenario.preview, allowed: false }
  await signIn(CHECKOUT)

  await expect(heading(page, 'Checkout not available')).toBeVisible()
  await expect(code(page)).toHaveText('UNSPECIFIED')
  await expect(payButton(page)).toBeHidden()
})

test("a reload on We couldn't confirm stays on it, never a live form, and lands on Success once the payment settles", async ({
  page,
  cloud,
  signIn
}) => {
  const stuck = {
    ...pendingOperation('op_subscribe'),
    status: 'reconciliation_needed' as const
  }
  cloud.scenario.operations.op_subscribe = stuck
  await signIn(CHECKOUT)
  await payButton(page).click()
  const unconfirmed = heading(page, "We couldn't confirm your payment")
  await expect(unconfirmed).toBeVisible()

  await page.reload()

  await expect(unconfirmed).toBeVisible()
  await expect(payButton(page)).toBeHidden()

  cloud.scenario.operations.op_subscribe = succeededOperation('op_subscribe')
  settleOnServer(cloud)
  await page.reload()

  await expect(heading(page, "You're all set")).toBeVisible()
  await expect(page.getByTestId('checkout-ending-plan')).toContainText('Pro')
  expect(subscribeRequests(cloud)).toHaveLength(1)
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
      'A payment for Personal went through. Check your plan in settings for the details.'
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

test('433-6840: a retired team plan whose link carries its commit stop opens the pricing table on the Team tab', async ({
  page,
  cloud,
  signIn
}) => {
  cloud.reply('POST', '/billing/preview-subscribe', () => ({
    status: 400,
    body: { code: 'INVALID_PLAN', message: 'Plan not found' }
  }))
  await signIn(
    entryPath('checkout', {
      plan: 'team_per_credit_monthly',
      team_credit_stop_id: 'stop_1'
    })
  )

  await expect(heading(page, "This plan isn't available")).toBeVisible()
  await expect(code(page)).toHaveText('PLAN_NOT_FOUND')

  await page.getByRole('button', { name: 'View plans' }).click()

  await expect(heading(page, 'Host app')).toBeVisible()
  await expect(page).toHaveURL(
    'https://testcloud.comfy.org/?pricing=team&workspace=ws_e2e'
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

test('G7: a catalog team plan linked without its commit stop, which the quote refuses with a 400, is Plan not available and View plans opens the Team tab', async ({
  page,
  cloud,
  signIn
}) => {
  const [listed] = cloud.scenario.plans.plans
  cloud.scenario.plans = {
    ...cloud.scenario.plans,
    plans: [
      ...cloud.scenario.plans.plans,
      { ...listed, slug: 'team_per_credit_monthly', tier: 'TEAM' }
    ]
  }
  refuseQuote(
    cloud,
    'team_credit_stop_id is required for the per-credit Team plan'
  )
  await signIn(entryPath('checkout', { plan: 'team_per_credit_monthly' }))

  await expect(heading(page, "This plan isn't available")).toBeVisible()
  await expect(code(page)).toHaveText('CHECKOUT_LINK_INVALID')
  await expect(heading(page, "Couldn't load your checkout")).toBeHidden()

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
  await expectStraightToPricingTable(page, 'ws_team_e2e')
})

test('a checkout link that names no plan, opened by the host in a new tab, goes back to the host even for a signed-in customer on the flag', async ({
  context,
  signIn
}) => {
  await signIn(CHECKOUT)

  await expectStraightToPricingTable(await context.newPage(), 'ws_e2e')
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

test('421-5804: a capabilities read that fails says so without claiming nothing was charged, and Try again opens the checkout', async ({
  page,
  cloud,
  signIn
}) => {
  let reads = 0
  cloud.reply('GET', '/billing/capabilities', () => {
    reads += 1
    return reads === 1
      ? { status: 503, body: { code: 'UNAVAILABLE', message: 'down' } }
      : {
          body: cloud.scenario.capabilities,
          headers: {
            'x-capability-revision': String(
              cloud.scenario.capabilities.revision
            )
          }
        }
  })
  await signIn(CHECKOUT)

  await expect(heading(page, "Couldn't load your checkout")).toBeVisible()
  await expect(
    page.getByText(
      "We couldn't check whether this workspace can check out, so checkout can't open yet. Try again, or contact support if this keeps happening."
    )
  ).toBeVisible()
  await expect(page.getByText(/Nothing has been charged/)).toBeHidden()
  await expect(code(page)).toHaveText('REQUEST_FAILED')

  await page.getByRole('button', { name: 'Try again' }).click()

  await expect(payButton(page)).toBeEnabled()
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
  await expect(
    page.getByText(
      "We couldn't check your recent payments, so checkout can't open yet. Try again, or contact support if this keeps happening."
    )
  ).toBeVisible()
  await expect(page.getByText(/Nothing has been charged/)).toBeHidden()
  await expect(payButton(page)).toBeHidden()

  reachable = true
  await page.getByRole('button', { name: 'Try again' }).click()

  await expect(heading(page, 'Already completed')).toBeVisible()
  await expect(code(page)).toHaveText('op_unread')
  expect(subscribeRequests(cloud)).toHaveLength(0)
})
