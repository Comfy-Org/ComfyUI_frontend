import type {
  BillingBalanceResponse,
  BillingOpStatusResponse,
  BillingStatusResponse
} from '@comfyorg/ingest-types'
import {
  cloudAppExpect,
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import {
  CLOUD_SELF_EMAIL,
  CloudAuthHelper
} from '@e2e/fixtures/helpers/CloudAuthHelper'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { APP_URL } from '@e2e/fixtures/utils/cloudAppSetup'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockWorkspace, workspace } from '@e2e/fixtures/utils/workspaceMocks'
import { expect } from '@playwright/test'
import type { Locator, Page, Request, Route } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

/**
 * What a page load, a sign-out, and a backgrounded tab do to the billing
 * reads and the operation poller once both SDK rails are on.
 *
 * Both rails GET the same routes, so the URL cannot separate them. The
 * transport can: the SDK runs on `fetch`, the legacy workspace client on
 * axios' XHR adapter. The SDK sends `Idempotency-Key` only on writes, so these
 * reads carry none on either rail and the transport is the whole signal.
 */
const RAILS_ON = {
  billing_control_enabled: true,
  unified_cloud_auth: true,
  billing_sdk_topup_enabled: true,
  billing_sdk_subscription_enabled: true
} satisfies RemoteConfig

const PENDING_OPERATION_ID = 'op-e2e-idle-tab'

const ACTIVE_STATUS = {
  is_active: true,
  has_funds: true,
  subscription_status: 'active',
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  billing_status: 'paid',
  max_seats: 1,
  occupied_seats: 1,
  team_credit_stop: null,
  scheduled_change: null,
  plan_slug: 'pro-monthly',
  renewal_date: '2099-02-20T10:00:00Z'
} satisfies BillingStatusResponse

const STATUS_WITH_PENDING_TOPUP = {
  ...ACTIVE_STATUS,
  pending_billing_op_id: PENDING_OPERATION_ID,
  pending_billing_op_type: 'topup'
} satisfies BillingStatusResponse

/** Renders as 12,660 total credits, the figure `creditsTile.spec.ts` proves. */
const FIRST_SESSION_BALANCE = {
  amount_micros: 6_000,
  currency: 'usd',
  effective_balance_micros: 6_000,
  cloud_credit_balance_micros: 5_000,
  prepaid_balance_micros: 1_000
} satisfies BillingBalanceResponse
const FIRST_SESSION_TOTAL = '12,660'

const SECOND_SESSION_BALANCE = {
  amount_micros: 3_000,
  currency: 'usd',
  effective_balance_micros: 3_000,
  cloud_credit_balance_micros: 2_000,
  prepaid_balance_micros: 1_000
} satisfies BillingBalanceResponse
const SECOND_SESSION_TOTAL = '6,330'

/** No `action_url`: the poller backs off from 1s instead of parking at 30s. */
const PENDING_TOPUP = {
  id: PENDING_OPERATION_ID,
  status: 'pending',
  started_at: '2026-09-20T00:00:00Z'
} satisfies BillingOpStatusResponse

/** The legacy personal balance read, which a rail-on load must not issue. */
const LEGACY_BALANCE_ROUTE = '/customers/balance'

interface BillingServer {
  status: BillingStatusResponse
  balance: BillingBalanceResponse
  /** Balance responses wait on this while it is set. */
  balanceGate: Promise<void> | null
}

interface OperationPoll {
  readonly request: Request
  /** Polls of the operation still unanswered when this one arrived. */
  readonly inFlightAtStart: number
}

interface BillingWire {
  /** Every status and balance read, on either rail, in request order. */
  readonly reads: Request[]
  readonly polls: OperationPoll[]
}

interface BootOptions {
  /** How long each poll is held open, so a second poller would overlap it. */
  pollHoldMs?: number
}

async function bootWithRailsOn(
  page: Page,
  server: BillingServer,
  { pollHoldMs = 0 }: BootOptions = {}
): Promise<BillingWire> {
  const ws = workspace('personal', 'owner')
  const reads: Request[] = []
  const polls: OperationPoll[] = []
  let pollsInFlight = 0

  await mockCloudBoot(page, {
    features: RAILS_ON,
    settings: { 'Comfy.TutorialCompleted': true }
  })
  await mockBilling(page, { workspaceId: ws.id })
  await mockWorkspace(page, ws, [])

  await page.route('**/api/billing/status', (route) => {
    reads.push(route.request())
    return route.fulfill(jsonRoute(server.status))
  })
  const answerBalance = async (route: Route) => {
    reads.push(route.request())
    if (server.balanceGate) await server.balanceGate
    return route.fulfill(jsonRoute(server.balance))
  }
  await page.route('**/api/billing/balance', answerBalance)
  await page.route(`**${LEGACY_BALANCE_ROUTE}`, answerBalance)
  await page.route(
    `**/api/billing/ops/${PENDING_OPERATION_ID}`,
    async (route) => {
      polls.push({ request: route.request(), inFlightAtStart: pollsInFlight })
      pollsInFlight++
      try {
        if (pollHoldMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, pollHoldMs))
        }
        await route.fulfill(jsonRoute(PENDING_TOPUP))
      } finally {
        pollsInFlight--
      }
    }
  )

  // The billing gate reads before `window.app` exists, so the handshake half
  // of the flags is answered on connect rather than seeded after boot.
  await new FeatureFlagHelper(page).serveServerFlagsOnHandshake(RAILS_ON)
  await bootCloud(page)
  return { reads, polls }
}

function transports(requests: Request[]): string[] {
  return requests.map((request) => request.resourceType())
}

function readsOf(reads: Request[], route: string): Request[] {
  return reads.filter((request) =>
    new URL(request.url()).pathname.endsWith(route)
  )
}

/** Holds every balance response until the returned release is called. */
function holdBalance(server: BillingServer): () => void {
  let release!: () => void
  server.balanceGate = new Promise((resolve) => (release = resolve))
  return () => {
    server.balanceGate = null
    release()
  }
}

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

/** Status has rendered into the panel, so any status-driven "0" would have too. */
async function expectStatusRendered(content: Locator) {
  await expect(content.getByText('Renews on Feb 20, 2099')).toBeVisible()
}

/**
 * Records every state the credits tile's total passes through, from inside
 * the page: a Playwright poll samples, and would miss a "0" shown for a frame.
 * An init script, so each reload starts its own record.
 */
async function recordTotalCreditStates(page: Page) {
  await page.addInitScript(() => {
    const states: string[] = []
    Object.defineProperty(window, '__totalCreditStates', { get: () => states })
    let label: Element | undefined
    const record = () => {
      if (!label?.isConnected) {
        label = [...document.querySelectorAll('div')].find(
          (el) =>
            el.childElementCount === 0 &&
            el.textContent.trim() === 'Total credits'
        )
      }
      const tile = label?.parentElement
      if (!tile) return
      const state = tile.querySelector('[data-pc-name="skeleton"]')
        ? 'loading'
        : tile.textContent
            .replace('Total credits', '')
            .replace('remaining', '')
            .trim()
      if (states.at(-1) !== state) states.push(state)
    }
    new MutationObserver(record).observe(document, {
      subtree: true,
      childList: true,
      characterData: true
    })
  })
}

function totalCreditStates(page: Page): Promise<string[]> {
  return page.evaluate(() => [
    ...(window as unknown as { __totalCreditStates: string[] })
      .__totalCreditStates
  ])
}

// Sign-out is a full navigation to /cloud/login. The static CI backend has no
// SPA fallback for that path, so it is answered with the app shell, which
// boots the router on the login page the way the cloud host does.
async function signOut(page: Page) {
  const appShell = await page.request.get(APP_URL)
  const html = await appShell.text()
  await page.route('**/cloud/login', (route) =>
    route.request().resourceType() === 'document'
      ? route.fulfill({ status: 200, contentType: 'text/html', body: html })
      : route.fallback()
  )
  await page.getByTestId(TestIds.user.currentUserButton).click()
  await page.getByTestId('logout-menu-item').click()
  await expect(page).toHaveURL(/\/cloud\/login/)
}

async function signInWithEmail(page: Page) {
  await new CloudAuthHelper(page).mockLiveEmailSignIn()
  // Sign-in provisions the customer before routing into the app.
  await page.route('**/customers', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 201, json: { id: 'test-customer-e2e' } })
      : route.fallback()
  )
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(CLOUD_SELF_EMAIL)
  await page.getByLabel('Password').fill('password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByTestId(TestIds.user.currentUserButton)).toBeVisible()
}

/**
 * Headless Chromium never hides a tab on its own, so the state a real
 * backgrounded tab reports is overridden and its events dispatched.
 */
async function setTabVisibility(page: Page, visibility: 'hidden' | 'visible') {
  await page.evaluate((next) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => next
    })
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => next === 'hidden'
    })
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event(next === 'visible' ? 'focus' : 'blur'))
  }, visibility)
}

test.describe('Billing SDK rails across a session', { tag: '@cloud' }, () => {
  test('issues the first status and balance reads of a load on the SDK transport', async ({
    page
  }) => {
    const wire = await bootWithRailsOn(page, {
      status: ACTIVE_STATUS,
      balance: FIRST_SESSION_BALANCE,
      balanceGate: null
    })

    await page.goto(APP_URL)
    await waitForCloudApp(page)

    await cloudAppExpect
      .poll(() => readsOf(wire.reads, '/api/billing/status').length)
      .toBeGreaterThan(0)
    await cloudAppExpect
      .poll(() => readsOf(wire.reads, '/api/billing/balance').length)
      .toBeGreaterThan(0)

    // The first of each, not just some: a legacy read that lands before the
    // rail resolves is exactly the ordering defect this row guards.
    expect(
      transports([
        readsOf(wire.reads, '/api/billing/status')[0],
        readsOf(wire.reads, '/api/billing/balance')[0]
      ])
    ).toEqual(['fetch', 'fetch'])
    expect(transports(wire.reads)).not.toContain('xhr')
    expect(readsOf(wire.reads, LEGACY_BALANCE_ROUTE)).toEqual([])
  })

  test('never shows the balance as 0 or blank across five reloads', async ({
    page
  }) => {
    test.setTimeout(120_000)
    const server: BillingServer = {
      status: ACTIVE_STATUS,
      balance: FIRST_SESSION_BALANCE,
      balanceGate: null
    }
    const wire = await bootWithRailsOn(page, server)
    await recordTotalCreditStates(page)
    await page.goto(APP_URL)
    await waitForCloudApp(page)

    for (let load = 1; load <= 5; load++) {
      await test.step(`load ${load}`, async () => {
        // Held so the tile mounts before the balance lands: the window where
        // a defaulted "0" would render.
        const releaseBalance = holdBalance(server)
        await page.reload()
        await waitForCloudApp(page)
        const content = await openPlanAndCredits(page)
        await expectStatusRendered(content)
        expect(await totalCreditStates(page)).toEqual(['loading'])

        releaseBalance()

        await expect(content.getByText(FIRST_SESSION_TOTAL)).toBeVisible()
        const states = await totalCreditStates(page)
        expect(new Set(states)).toEqual(
          new Set(['loading', FIRST_SESSION_TOTAL])
        )
        expect(states.at(-1)).toBe(FIRST_SESSION_TOTAL)
      })
    }
    expect(transports(wire.reads)).not.toContain('xhr')
  })

  test('reads the new session on the SDK transport after signing out and back in', async ({
    page
  }) => {
    test.setTimeout(90_000)
    const server: BillingServer = {
      status: ACTIVE_STATUS,
      balance: FIRST_SESSION_BALANCE,
      balanceGate: null
    }
    const wire = await bootWithRailsOn(page, server)
    await recordTotalCreditStates(page)
    await page.goto(APP_URL)
    await waitForCloudApp(page)

    const firstContent = await openPlanAndCredits(page)
    await expect(firstContent.getByText(FIRST_SESSION_TOTAL)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('settings-dialog')).toBeHidden()

    await signOut(page)

    server.balance = SECOND_SESSION_BALANCE
    const readsBeforeSignIn = wire.reads.length
    const statesBeforeSignIn = (await totalCreditStates(page)).length
    // Held so a first-session balance still in memory would be what shows.
    const releaseBalance = holdBalance(server)
    await signInWithEmail(page)

    const content = await openPlanAndCredits(page)
    await expectStatusRendered(content)
    releaseBalance()

    await expect(content.getByText(SECOND_SESSION_TOTAL)).toBeVisible()
    const statesAfterSignIn = (await totalCreditStates(page)).slice(
      statesBeforeSignIn
    )
    expect(statesAfterSignIn).not.toContain(FIRST_SESSION_TOTAL)
    expect(statesAfterSignIn.at(-1)).toBe(SECOND_SESSION_TOTAL)

    const readsAfterSignIn = wire.reads.slice(readsBeforeSignIn)
    expect(readsOf(readsAfterSignIn, '/api/billing/status')).not.toEqual([])
    expect(readsOf(readsAfterSignIn, '/api/billing/balance')).not.toEqual([])
    expect(transports(readsAfterSignIn)).not.toContain('xhr')
  })

  test('keeps one poller for a pending operation while the tab idles hidden', async ({
    page
  }) => {
    test.setTimeout(120_000)
    const wire = await bootWithRailsOn(
      page,
      {
        status: STATUS_WITH_PENDING_TOPUP,
        balance: FIRST_SESSION_BALANCE,
        balanceGate: null
      },
      { pollHoldMs: 500 }
    )

    await page.goto(APP_URL)
    await waitForCloudApp(page)
    await cloudAppExpect.poll(() => wire.polls.length).toBeGreaterThan(0)

    for (let cycle = 1; cycle <= 3; cycle++) {
      await test.step(`hide and return ${cycle}`, async () => {
        await setTabVisibility(page, 'hidden')
        const pollsWhenHidden = wire.polls.length
        // Idle until the poller's own timer fires once more while hidden.
        await cloudAppExpect
          .poll(() => wire.polls.length)
          .toBeGreaterThan(pollsWhenHidden)

        await setTabVisibility(page, 'visible')
        const pollsWhenShown = wire.polls.length
        await cloudAppExpect
          .poll(() => wire.polls.length)
          .toBeGreaterThan(pollsWhenShown)
      })
    }

    // A second poller would start on a return or a status re-read, at the
    // same moment as the first one's wake poll, and so overlap a held poll.
    expect(wire.polls.map((poll) => poll.inFlightAtStart)).toEqual(
      wire.polls.map(() => 0)
    )
    expect(transports(wire.polls.map((poll) => poll.request))).not.toContain(
      'xhr'
    )
  })
})
