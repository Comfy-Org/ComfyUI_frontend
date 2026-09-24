import { expect } from '@playwright/test'
import type { Locator, Page, Request } from '@playwright/test'
import type {
  BillingBalanceResponse,
  BillingOpStatusResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  CreateTopupResponse,
  PaymentPortalResponse,
  Plan,
  PreviewSubscribeResponse,
  ResubscribeResponse,
  SavedPaymentMethod
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import {
  cloudAppExpect,
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import { CancelSubscriptionDialog } from '@e2e/fixtures/components/CancelSubscriptionDialog'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { createWorkspaceBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { member, workspace } from '@e2e/fixtures/utils/workspaceMocks'

/**
 * The SDK rails held against the legacy flow they replace: each row either
 * runs a mixed-rail session end to end, or runs the same scenario with the
 * rails off and on and asserts the customer sees the same thing.
 *
 * The transport tells the rails apart: the SDK runs on `fetch` and keys every
 * write, the legacy workspace client runs on axios' XHR adapter and keys none.
 */
interface Rails {
  subscription: boolean
  topup: boolean
}

const RAILS_OFF: Rails = { subscription: false, topup: false }
const SUBSCRIPTION_RAIL_ONLY: Rails = { subscription: true, topup: false }
const TOPUP_RAIL_ONLY: Rails = { subscription: false, topup: true }

const OPERATION_ID = 'op-e2e-parity'
const PORTAL_URL = 'https://billing.example/portal'

/** The purchase the Pay $50.00 button sends, and what it adds on the server. */
const TOPUP_MICROS = 10_000
/** What the Creator upgrade grants on the server. */
const SUBSCRIPTION_GRANT_MICROS = 20_000
const OPENING_BALANCE_MICROS = 1_000

const SAVED_CARD = {
  id: 'pm_e2e_visa',
  type: 'card',
  brand: 'visa',
  last4: '4242',
  is_default: true
} satisfies SavedPaymentMethod

function annualPlan(
  slug: string,
  tier: Plan['tier'],
  priceCents: number,
  creditsCents: number
): Plan {
  return {
    slug,
    tier,
    duration: 'ANNUAL',
    price_cents: priceCents,
    credits_cents: creditsCents,
    max_seats: 1,
    availability: { available: true },
    seat_summary: {
      seat_count: 1,
      total_cost_cents: priceCents,
      total_credits_cents: creditsCents
    }
  }
}

const STANDARD_ANNUAL_PLAN = annualPlan(
  'standard-annual',
  'STANDARD',
  19_200,
  4_200
)
const CREATOR_ANNUAL_PLAN = annualPlan(
  'creator-annual',
  'CREATOR',
  33_600,
  7_400
)

const PLAN_CATALOG = {
  current_plan_slug: 'standard-annual',
  plans: [STANDARD_ANNUAL_PLAN, CREATOR_ANNUAL_PLAN]
} satisfies BillingPlansResponse

const UPGRADE_QUOTE = {
  allowed: true,
  transition_type: 'upgrade',
  effective_at: '2026-09-21T00:00:00Z',
  is_immediate: true,
  cost_today_cents: CREATOR_ANNUAL_PLAN.price_cents,
  cost_next_period_cents: CREATOR_ANNUAL_PLAN.price_cents,
  credits_today_cents: CREATOR_ANNUAL_PLAN.credits_cents,
  credits_next_period_cents: CREATOR_ANNUAL_PLAN.credits_cents,
  new_plan: CREATOR_ANNUAL_PLAN
} satisfies PreviewSubscribeResponse

const ACTIVE_STANDARD = {
  is_active: true,
  subscription_status: 'active',
  subscription_tier: 'STANDARD',
  subscription_duration: 'ANNUAL',
  plan_slug: 'standard-annual',
  billing_rail: 'stripe',
  billing_status: 'paid',
  has_funds: true,
  renewal_date: '2099-02-20T00:00:00Z',
  team_credit_stop: null,
  scheduled_change: null,
  max_seats: 1,
  occupied_seats: 1
} satisfies BillingStatusResponse

const CANCELLED_STANDARD = {
  ...ACTIVE_STANDARD,
  subscription_status: 'canceled',
  cancel_at: '2099-02-20T00:00:00Z'
} satisfies BillingStatusResponse

const ACTIVE_CREATOR = {
  ...ACTIVE_STANDARD,
  subscription_tier: 'CREATOR',
  plan_slug: 'creator-annual'
} satisfies BillingStatusResponse

const SETTLED_OPERATION = {
  id: OPERATION_ID,
  status: 'succeeded',
  started_at: '2026-09-21T00:00:00Z',
  completed_at: '2026-09-21T00:00:05Z'
} satisfies BillingOpStatusResponse

/** The credits tile's shape, with every half carrying the one total. */
function balance(micros: number): BillingBalanceResponse {
  return {
    amount_micros: micros,
    currency: 'usd',
    effective_balance_micros: micros,
    cloud_credit_balance_micros: 0,
    prepaid_balance_micros: micros
  }
}

/**
 * A stand-in billing backend: each write moves the state the next read
 * returns, so a rendered value can only be right if the app re-read it.
 */
interface BillingServer {
  status: BillingStatusResponse
  balanceMicros: number
}

interface ParityRoutes {
  readonly server: BillingServer
  readonly topupRequests: Request[]
  readonly subscribeRequests: Request[]
  readonly previewRequests: Request[]
  readonly resubscribeRequests: Request[]
  readonly cancelRequests: Request[]
  readonly portalRequests: Request[]
  readonly statusRequests: Request[]
  readonly balanceRequests: Request[]
  openedUrls: () => Promise<string[]>
}

interface ParitySetup {
  rails: Rails
  status?: BillingStatusResponse
  paymentMethods?: SavedPaymentMethod[]
}

async function setupParity(
  page: Page,
  {
    rails,
    status = ACTIVE_STANDARD,
    paymentMethods = [SAVED_CARD]
  }: ParitySetup
): Promise<ParityRoutes> {
  const ws = workspace('personal', 'owner')
  const server: BillingServer = {
    status,
    balanceMicros: OPENING_BALANCE_MICROS
  }
  const routes = {
    topupRequests: [] as Request[],
    subscribeRequests: [] as Request[],
    previewRequests: [] as Request[],
    resubscribeRequests: [] as Request[],
    cancelRequests: [] as Request[],
    portalRequests: [] as Request[],
    statusRequests: [] as Request[],
    balanceRequests: [] as Request[]
  }

  // Recorded rather than performed: the portal is an external origin, and the
  // truthy handle is what arms the app's return refresh.
  await page.addInitScript(() => {
    const opened: string[] = []
    Object.defineProperty(window, '__openedUrls', { get: () => opened })
    window.open = (url?: string | URL) => {
      opened.push(String(url))
      return window
    }
  })

  await setupCloudApp(page, {
    workspace: ws,
    members: [
      member({
        email: CLOUD_SELF_EMAIL,
        role: 'owner',
        is_original_owner: true
      })
    ],
    features: {
      billing_control_enabled: true,
      unified_cloud_auth: true,
      billing_sdk_subscription_enabled: rails.subscription,
      billing_sdk_topup_enabled: rails.topup
    } satisfies RemoteConfig,
    billingCapabilities: createWorkspaceBillingCapabilities(ws)
  })
  // The handshake is the fallback channel; seeding it too keeps the two
  // channels agreeing, so neither alone is what the rows rest on.
  await new FeatureFlagHelper(page).seedServerFlags({
    billing_sdk_subscription_enabled: rails.subscription,
    billing_sdk_topup_enabled: rails.topup
  })

  await page.route('**/api/settings', (route) =>
    route.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
  )
  await page.route('**/api/billing/status', (route) => {
    routes.statusRequests.push(route.request())
    return route.fulfill(jsonRoute(server.status))
  })
  await page.route('**/api/billing/balance', (route) => {
    routes.balanceRequests.push(route.request())
    return route.fulfill(jsonRoute(balance(server.balanceMicros)))
  })
  await page.route('**/customers/balance', (route) =>
    route.fulfill(jsonRoute(balance(server.balanceMicros)))
  )
  await page.route('**/api/billing/plans', (route) =>
    route.fulfill(jsonRoute(PLAN_CATALOG))
  )
  await page.route('**/api/billing/payment-methods', (route) =>
    route.fulfill(jsonRoute(paymentMethods))
  )
  await page.route('**/api/billing/preview-subscribe', (route) => {
    routes.previewRequests.push(route.request())
    return route.fulfill(jsonRoute(UPGRADE_QUOTE))
  })
  await page.route('**/api/billing/subscribe', (route) => {
    routes.subscribeRequests.push(route.request())
    server.status = ACTIVE_CREATOR
    server.balanceMicros += SUBSCRIPTION_GRANT_MICROS
    return route.fulfill(
      jsonRoute({ billing_op_id: OPERATION_ID, status: 'subscribed' })
    )
  })
  await page.route('**/api/billing/subscription/cancel', (route) => {
    routes.cancelRequests.push(route.request())
    server.status = CANCELLED_STANDARD
    return route.fulfill(
      jsonRoute({ billing_op_id: OPERATION_ID, status: 'pending' })
    )
  })
  await page.route('**/api/billing/subscription/resubscribe', (route) => {
    routes.resubscribeRequests.push(route.request())
    server.status = ACTIVE_STANDARD
    return route.fulfill(
      jsonRoute({
        billing_op_id: OPERATION_ID,
        status: 'pending'
      } satisfies ResubscribeResponse)
    )
  })
  await page.route('**/api/billing/payment-portal', (route) => {
    routes.portalRequests.push(route.request())
    return route.fulfill(
      jsonRoute({ url: PORTAL_URL } satisfies PaymentPortalResponse)
    )
  })
  await page.route('**/api/billing/topup', (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    routes.topupRequests.push(route.request())
    server.balanceMicros += TOPUP_MICROS
    return route.fulfill(
      jsonRoute({
        billing_op_id: OPERATION_ID,
        topup_id: 'topup-e2e',
        status: 'completed',
        amount_cents: 5_000
      } satisfies CreateTopupResponse)
    )
  })
  await page.route('**/api/billing/ops/**', (route) =>
    route.fulfill(jsonRoute(SETTLED_OPERATION))
  )

  return {
    server,
    ...routes,
    openedUrls: () =>
      page.evaluate(
        () => (window as unknown as { __openedUrls: string[] }).__openedUrls
      )
  }
}

/** The SDK transport sends this header; the legacy axios client never does. */
function idempotencyKey(request: Request): string | undefined {
  return request.headers()['idempotency-key']
}

/** Which transport issued the request, and so which rail served it. */
function transport(request: Request): string {
  return request.resourceType()
}

async function bootApp(page: Page) {
  await page.goto(APP_URL)
  await waitForCloudApp(page)
}

/** Settings ▸ Workspace ▸ Plan & Credits. */
async function openPlanAndCredits(page: Page): Promise<Locator> {
  await page
    .getByRole('button', { name: /^Settings/ })
    .first()
    .click()
  const dialog = page.getByTestId('settings-dialog')
  await expect(dialog).toBeVisible()
  await dialog
    .locator('nav')
    .getByRole('button', { name: 'Plan & Credits' })
    .click()
  return dialog.getByRole('main')
}

async function buyFiftyDollars(page: Page): Promise<TopUpCreditsDialog> {
  const dialog = new TopUpCreditsDialog(page)
  await dialog.open()
  await dialog.root
    .getByRole('button', { name: 'Add credits', exact: true })
    .click()
  await dialog.root.getByRole('button', { name: 'Pay $50.00' }).click()
  return dialog
}

/** Opens the top-up confirm step and returns the saved-card note under it. */
async function savedCardNote(page: Page): Promise<Locator> {
  const dialog = new TopUpCreditsDialog(page)
  await dialog.open()
  await dialog.root
    .getByRole('button', { name: 'Add credits', exact: true })
    .click()
  await expect(
    dialog.root.getByRole('button', { name: 'Pay $50.00' })
  ).toBeVisible()
  return dialog.root.getByText(/payment method/)
}

/** A customer coming back to this tab from another one. */
async function returnToTab(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
}

const successToast = (page: Page) =>
  page.locator('.p-toast-message-success', {
    hasText: 'Credits added successfully!'
  })

/** The plan summary on the success step, which names what was bought. */
const successSummary = (page: Page) =>
  page.getByRole('heading', { name: "You're all set" }).locator('..')

async function confirmCreatorUpgrade(page: Page) {
  await cloudAppExpect(
    page.getByRole('heading', { name: 'Confirm your upgrade' })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Confirm upgrade' }).click()
}

/** The credits tile's headline figure, apart from the additional-credits row. */
const totalCredits = (panel: Locator) =>
  panel.getByText('Total credits').locator('..')

/** 2.11 credits per micro, the rate the credits tile renders at. */
function creditsLabel(micros: number): string {
  return Math.round(micros * 2.11).toLocaleString('en-US')
}

/**
 * Opens the portal from Plan & Credits, changes the plan on the server as the
 * portal would, and comes back: the panel must re-read and show the change.
 */
async function expectPortalReturnRefresh(
  page: Page,
  rails: Rails,
  expectedTransport: 'xhr' | 'fetch'
) {
  const routes = await setupParity(page, { rails })
  await bootApp(page)
  const panel = await openPlanAndCredits(page)
  await expect(panel.getByText(/Renews on/)).toBeVisible()

  await panel.getByRole('button', { name: 'Billing & invoices' }).click()
  await expect.poll(() => routes.openedUrls()).toEqual([PORTAL_URL])
  expect(routes.portalRequests.map(transport)).toEqual([expectedTransport])

  routes.server.status = CANCELLED_STANDARD
  const readsBeforeReturn = routes.statusRequests.length
  await returnToTab(page)

  await expect(panel.getByText(/Ends on/)).toBeVisible()
  await expect(panel.getByText(/Renews on/)).toBeHidden()
  const readsOnReturn = routes.statusRequests.slice(readsBeforeReturn)
  expect(readsOnReturn.length).toBeGreaterThan(0)
  expect(new Set(readsOnReturn.map(transport))).toEqual(
    new Set([expectedTransport])
  )
}

/**
 * Buys $50 of credits, then upgrades to Creator from Plan & Credits without
 * leaving the page, and returns the panel once the success step is closed.
 */
async function topUpThenUpgrade(page: Page): Promise<Locator> {
  await bootApp(page)
  const topUp = await buyFiftyDollars(page)
  await expect(successToast(page)).toBeVisible()
  await expect(topUp.root).toBeHidden()

  // A settled purchase lands the customer on Plan & Credits.
  const panel = page.getByTestId('settings-dialog').getByRole('main')
  await expect(
    panel.getByRole('heading', { name: 'Standard Yearly' })
  ).toBeVisible()
  await expect(totalCredits(panel)).toContainText(
    creditsLabel(OPENING_BALANCE_MICROS + TOPUP_MICROS)
  )
  await panel.getByRole('button', { name: 'Upgrade Plan' }).click()
  await page
    .getByRole('button', { name: /Creator Yearly$/ })
    .first()
    .click()
  await confirmCreatorUpgrade(page)
  await expect(successSummary(page)).toContainText('Creator')
  await page
    .getByRole('dialog')
    .filter({ has: page.getByRole('heading', { name: "You're all set" }) })
    .getByRole('button', { name: 'Close' })
    .last()
    .click()
  await expect(successSummary(page)).toBeHidden()
  return panel
}

const SAVED_CARD_NOTE = 'Your saved payment method is charged immediately.'

test.describe('Billing rail parity', { tag: '@cloud' }, () => {
  test.describe('with only the subscription rail on', () => {
    test('buys credits on the legacy transport and refreshes the balance', async ({
      page
    }) => {
      const routes = await setupParity(page, { rails: SUBSCRIPTION_RAIL_ONLY })
      await bootApp(page)
      const readsBeforePurchase = routes.balanceRequests.length

      await buyFiftyDollars(page)

      await expect(successToast(page)).toBeVisible()
      expect(routes.topupRequests).toHaveLength(1)
      const [purchase] = routes.topupRequests
      expect(transport(purchase)).toBe('xhr')
      expect(idempotencyKey(purchase)).toBeUndefined()
      expect(purchase.postDataJSON()).toEqual({ amount_cents: 5_000 })
      await expect
        .poll(() => routes.balanceRequests.length)
        .toBeGreaterThan(readsBeforePurchase)
      const panel = page.getByTestId('settings-dialog').getByRole('main')
      await expect(totalCredits(panel)).toContainText(
        creditsLabel(OPENING_BALANCE_MICROS + TOPUP_MICROS)
      )
      expect(routes.subscribeRequests).toHaveLength(0)
    })

    test('subscribes on the SDK transport and names the new plan', async ({
      page
    }) => {
      const routes = await setupParity(page, { rails: SUBSCRIPTION_RAIL_ONLY })
      await page.goto(`${APP_URL}/?pricing=creator&cycle=yearly`)

      await confirmCreatorUpgrade(page)

      await cloudAppExpect(successSummary(page)).toBeVisible()
      await expect(successSummary(page)).toContainText('Creator')
      await expect(successSummary(page)).toContainText('$336')
      expect(routes.subscribeRequests).toHaveLength(1)
      const [subscribe] = routes.subscribeRequests
      expect(transport(subscribe)).toBe('fetch')
      expect(idempotencyKey(subscribe)).toBeTruthy()
      expect(subscribe.postDataJSON()).toMatchObject({
        plan_slug: 'creator-annual',
        idempotency_key: idempotencyKey(subscribe)
      })
      expect(routes.previewRequests.length).toBeGreaterThan(0)
      expect(routes.previewRequests.map(transport)).not.toContain('xhr')
      expect(routes.topupRequests).toHaveLength(0)
    })

    test('completes a top-up and then a subscribe in one session, and totals both', async ({
      page
    }) => {
      const routes = await setupParity(page, { rails: SUBSCRIPTION_RAIL_ONLY })
      const panel = await topUpThenUpgrade(page)

      expect(routes.topupRequests.map(transport)).toEqual(['xhr'])
      expect(routes.subscribeRequests.map(transport)).toEqual(['fetch'])
      await expect(
        panel.getByRole('heading', { name: 'Creator Yearly' })
      ).toBeVisible()
      await expect(totalCredits(panel)).toContainText(
        creditsLabel(
          OPENING_BALANCE_MICROS + TOPUP_MICROS + SUBSCRIPTION_GRANT_MICROS
        )
      )
    })
  })

  test.describe('saved-card note in the top-up dialog', () => {
    test('shows the saved card while the rails are off', async ({ page }) => {
      await setupParity(page, { rails: RAILS_OFF })
      await bootApp(page)

      await expect(await savedCardNote(page)).toHaveText(SAVED_CARD_NOTE)
    })

    test('shows the same note while the top-up rail is on', async ({
      page
    }) => {
      await setupParity(page, { rails: TOPUP_RAIL_ONLY })
      await bootApp(page)

      await expect(await savedCardNote(page)).toHaveText(SAVED_CARD_NOTE)
    })

    test('shows the same note while the subscription rail is on', async ({
      page
    }) => {
      await setupParity(page, { rails: SUBSCRIPTION_RAIL_ONLY })
      await bootApp(page)

      await expect(await savedCardNote(page)).toHaveText(SAVED_CARD_NOTE)
    })
  })

  test.describe('returning from the billing portal', () => {
    test('re-reads the plan on the legacy transport and renders the change', async ({
      page
    }) => {
      await expectPortalReturnRefresh(page, RAILS_OFF, 'xhr')
    })

    test('re-reads the plan on the SDK transport and renders the same change', async ({
      page
    }) => {
      await expectPortalReturnRefresh(page, SUBSCRIPTION_RAIL_ONLY, 'fetch')
    })
  })

  test('resumes a cancelled plan on the SDK transport without charging again', async ({
    page
  }) => {
    const routes = await setupParity(page, { rails: SUBSCRIPTION_RAIL_ONLY })
    await bootApp(page)

    const cancelDialog = new CancelSubscriptionDialog(page)
    await cancelDialog.open(ACTIVE_STANDARD.renewal_date)
    await cancelDialog.confirmCancelButton.click()
    await expect(cancelDialog.root).toBeHidden()

    const panel = await openPlanAndCredits(page)
    await expect(panel.getByText(/Ends on/)).toBeVisible()
    await panel.getByRole('button', { name: 'Resume subscription' }).click()

    await expect(panel.getByText(/Renews on/)).toBeVisible()
    await expect(panel.getByText(/Ends on/)).toBeHidden()
    expect(routes.cancelRequests.map(transport)).toEqual(['fetch'])
    expect(routes.resubscribeRequests).toHaveLength(1)
    const [resume] = routes.resubscribeRequests
    expect(transport(resume)).toBe('fetch')
    expect(idempotencyKey(resume)).toBeTruthy()
    expect(routes.subscribeRequests).toHaveLength(0)
    expect(routes.topupRequests).toHaveLength(0)
  })
})
