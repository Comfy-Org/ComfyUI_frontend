import { expect } from '@playwright/test'
import type { Locator, Page, Request } from '@playwright/test'
import type {
  BillingBalanceResponse,
  BillingEventsResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  Plan,
  SavedPaymentMethod
} from '@comfyorg/ingest-types'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { createWorkspaceBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import {
  mockWorkspaceTokenMint,
  workspace
} from '@e2e/fixtures/utils/workspaceMocks'

/**
 * The six billing reads across the SDK reader rail — FE-2476.
 *
 * Comfy-Org/ComfyUI_frontend#17940 (status, balance), #17942 (plans), #17946
 * (capabilities, saved payment methods) and #18047 (billing events) moved every
 * billing read onto the SDK readers behind `useBillingReadRail`, and none of
 * the four shipped a browser spec. The int64 → number projections
 * (`safeInt64.asSafeNumber`, `projectBillingStatus`, `projectBillingPlans`) are
 * unit-tested but had never been exercised against a rendered surface.
 *
 * Both rails GET the same six routes, so the URL cannot separate them. The
 * transport can: the SDK runs on `fetch`, the legacy workspace client on axios'
 * XHR adapter — the same discriminator the write-rail specs use.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

/**
 * The reads Settings ▸ Plan & Credits drives: four on the Credits tab and the
 * billing events on Activity.
 *
 * The sixth reader on the rail, saved payment methods, is not read by this
 * panel — the top-up dialog reads it for its saved-card note, so it belongs to
 * `topUpSdkRail.spec.ts` rather than here. Asserting it from this flow would
 * mean driving a dialog this spec has no other reason to open.
 */
const READ_ROUTES = [
  '/api/billing/status',
  '/api/billing/balance',
  '/api/billing/plans',
  '/api/billing/capabilities',
  '/api/billing/events'
] as const

const ACTIVE_STATUS: BillingStatusResponse = {
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
}

const PRO_MONTHLY_PLAN = {
  slug: 'pro-monthly',
  tier: 'PRO',
  duration: 'MONTHLY',
  price_cents: 2_000,
  credits_cents: 2_110,
  max_seats: 1,
  availability: { available: true },
  seat_summary: {
    seat_count: 1,
    total_cost_cents: 2_000,
    total_credits_cents: 2_110
  }
} satisfies Plan

const PLANS = {
  current_plan_slug: 'pro-monthly',
  plans: [PRO_MONTHLY_PLAN]
} satisfies BillingPlansResponse

const SAVED_CARD = {
  id: 'pm-1',
  type: 'card',
  brand: 'visa',
  last4: '4242',
  is_default: true
} satisfies SavedPaymentMethod

/**
 * The credits tile renders a breakdown, not the bare amount, so the response
 * has to carry the monthly and prepaid halves too — the same shape and the same
 * numbers `creditsTile.spec.ts` proves: 6000 -> 12,660 total.
 */
const BALANCE = {
  amount_micros: 6_000,
  currency: 'usd',
  effective_balance_micros: 6_000,
  cloud_credit_balance_micros: 5_000,
  prepaid_balance_micros: 1_000
} satisfies BillingBalanceResponse

/**
 * Beyond Number.MAX_SAFE_INTEGER, sent as raw JSON: written as a JS literal the
 * digits would be lost before the app ever saw them, which is the rounding this
 * row exists to prove the reader refuses.
 */
const UNSAFE_BALANCE_BODY =
  '{"amount_micros":9007199254740993,"currency":"usd",' +
  '"effective_balance_micros":9007199254740993,' +
  '"cloud_credit_balance_micros":5000,"prepaid_balance_micros":1000}'

function eventsPage(page: number): BillingEventsResponse {
  return {
    events: [
      {
        event_id: `evt-${page}`,
        // Only `api_usage_completed` renders `params.api_name`; the table has
        // no branch for a bare `api_usage`.
        event_type: 'api_usage_completed',
        createdAt: '2026-09-20T00:00:00Z',
        params: { api_name: `node-on-page-${page}` }
      }
    ],
    page,
    limit: 10,
    total: 20,
    totalPages: 2
  }
}

interface ReadRoutes {
  /** Every GET to one of the six read routes, in order. */
  readonly reads: Request[]
  /** Every page number the events route was asked for, in order. */
  readonly eventPages: (string | null)[]
}

interface BootOptions {
  /** Answers the balance with a value outside the safe-integer range. */
  unsafeBalance?: boolean
  /**
   * Serves `billing_sdk_topup_enabled: true` on `/api/features`, the channel
   * the staged rollout publishes on. Boot awaits that response
   * (`main.ts:56`), so unlike the websocket handshake it is readable before
   * the billing gate issues its first reads.
   */
  readRailOnFeatures?: boolean
}

async function mockCloudBoot(
  page: Page,
  { unsafeBalance = false, readRailOnFeatures = false }: BootOptions = {}
): Promise<ReadRoutes> {
  const reads: Request[] = []
  const eventPages: (string | null)[] = []

  const record = (request: Request) => {
    if (READ_ROUTES.some((route) => request.url().includes(route))) {
      reads.push(request)
    }
  }

  await page.route('**/api/features', (r) =>
    r.fulfill(
      jsonRoute({
        unified_cloud_auth: true,
        ...(readRailOnFeatures ? { billing_sdk_topup_enabled: true } : {})
      })
    )
  )
  await page.route('**/api/system_stats', (r) =>
    r.fulfill(jsonRoute(mockSystemStats))
  )
  await page.route('**/api/users', (r) =>
    r.fulfill(
      jsonRoute({
        storage: 'server',
        migrated: true,
        users: { 'test-user-e2e': 'E2E Test User' }
      })
    )
  )
  // TutorialCompleted suppresses the new-user template browser, whose modal
  // overlay would otherwise intercept clicks on the settings dialog.
  await page.route('**/api/settings', (r) =>
    r.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
  )
  await page.route('**/api/userdata**', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/extensions', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/object_info', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/global_subgraphs', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/i18n', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/auth/session', (r) =>
    r.fulfill(jsonRoute({ token: 'mock-workspace-token' }))
  )
  await page.route('**/releases**', (r) => r.fulfill(jsonRoute([])))
  await mockWorkspaceTokenMint(page, workspace('personal', 'owner'))
  await page.route('**/api/workspaces', (r) =>
    r.fulfill(jsonRoute({ workspaces: [workspace('personal', 'owner')] }))
  )

  await page.route('**/api/billing/status', (r) => {
    record(r.request())
    return r.fulfill(jsonRoute(ACTIVE_STATUS))
  })
  await page.route('**/api/billing/balance', (r) => {
    record(r.request())
    return unsafeBalance
      ? r.fulfill({
          contentType: 'application/json',
          body: UNSAFE_BALANCE_BODY
        })
      : r.fulfill(jsonRoute(BALANCE))
  })
  await page.route('**/api/billing/plans', (r) => {
    record(r.request())
    return r.fulfill(jsonRoute(PLANS))
  })
  await page.route('**/api/billing/capabilities', (r) => {
    if (r.request().method() !== 'GET') return r.fallback()
    record(r.request())
    return r.fulfill(
      jsonRoute(
        createWorkspaceBillingCapabilities(workspace('personal', 'owner'))
      )
    )
  })
  await page.route('**/api/billing/payment-methods', (r) => {
    record(r.request())
    return r.fulfill(jsonRoute([SAVED_CARD] satisfies SavedPaymentMethod[]))
  })
  await page.route('**/api/billing/events**', (r) => {
    record(r.request())
    const requested = new URL(r.request().url()).searchParams.get('page')
    eventPages.push(requested)
    return r.fulfill(jsonRoute(eventsPage(Number(requested ?? 1))))
  })
  await page.route('**/customers/balance', (r) => r.fulfill(jsonRoute(BALANCE)))

  return { reads, eventPages }
}

async function bootApp(page: Page) {
  await new CloudAuthHelper(page).mockAuth()
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.userId', 'test-user-e2e')
  })
  await page.goto(APP_URL)
  await page.waitForFunction(() => !!window.app?.extensionManager, null, {
    timeout: 45_000
  })
}

/** Settings ▸ Workspace ▸ Plan & Credits, which drives all six reads. */
async function openPlanAndCredits(page: Page) {
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

/**
 * The usage log lives behind the panel's Activity tab; the Credits tab it opens
 * on never mounts `UsageLogsTable`, so the events read does not go out until
 * this click.
 */
async function openActivity(content: Locator) {
  // `exact`, or this also matches the panel's "Full usage activity" button.
  await content.getByRole('button', { name: 'Activity', exact: true }).click()
  return content
}

/** Which transport issued the request, and so which rail served it. */
function transport(request: Request): string {
  return request.resourceType()
}

function routesRead(reads: Request[]): Set<string> {
  return new Set(
    READ_ROUTES.filter((route) =>
      reads.some((request) => request.url().includes(route))
    )
  )
}

/**
 * The websocket half of the flag, paired with `readRailOnFeatures` so the two
 * channels agree. Answered on the handshake rather than set after boot: the
 * billing gate issues its first reads while resolving auth and workspace,
 * before `GraphCanvas`'s `onMounted` assigns `window.app`, so a flag set any
 * later would miss them.
 */
async function enableReadRail(page: Page) {
  await new FeatureFlagHelper(page).serveServerFlagsOnHandshake({
    billing_sdk_topup_enabled: true
  })
}

test.describe('Billing reads rail (FE-2476)', { tag: '@cloud' }, () => {
  test('serves every read on the legacy client while the rail is off', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await mockCloudBoot(page)
    await bootApp(page)

    const content = await openPlanAndCredits(page)

    await expect(content.getByText('Total credits')).toBeVisible()
    await expect(content.getByText('12,660')).toBeVisible()

    await openActivity(content)

    await expect(content.getByText('node-on-page-1')).toBeVisible()
    await expect
      .poll(() => routesRead(routes.reads).size)
      .toBe(READ_ROUTES.length)
    expect(routes.reads.map(transport)).not.toContain('fetch')
  })

  /**
   * `not.toContain('xhr')`: with the flag on `/api/features` there is no race
   * left to tolerate.
   *
   * This row used to assert only `toContain('fetch')`, because the flag was
   * reachable solely on the websocket `feature_flags` handshake
   * (`api.ts:1012`), which nothing awaits — `createSocket()` does not open the
   * socket until the cloud auth token resolves, so the billing gate's status,
   * balance, plans and capabilities reads went out first and CI recorded the
   * split on one load:
   *
   *     ["xhr", "xhr", "xhr", "xhr", "fetch", "fetch", "fetch"]
   *
   * #18141 moved these flags onto `/api/features` as their primary channel,
   * and boot awaits that response at `main.ts:56`. So the flag is readable
   * before the first billing read rather than 145ms after it, and every read
   * — boot included — belongs on the rail. `mockCloudBoot` now serves it
   * there; the handshake is seeded as well so neither channel alone is what
   * the assertion rests on.
   *
   * If this row goes red on `xhr`, that is a finding about the ordering of
   * `refreshRemoteConfig` against the billing gate, not a flake to loosen.
   */
  test('serves reads on the SDK transport while the rail is on, rendering the same values', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await mockCloudBoot(page, { readRailOnFeatures: true })
    await enableReadRail(page)
    await bootApp(page)

    const content = await openPlanAndCredits(page)

    // Identical to the legacy row above: the int64 projections must not move
    // a rendered number.
    await expect(content.getByText('Total credits')).toBeVisible()
    await expect(content.getByText('12,660')).toBeVisible()

    await openActivity(content)

    await expect(content.getByText('node-on-page-1')).toBeVisible()
    await expect
      .poll(() => routesRead(routes.reads).size)
      .toBe(READ_ROUTES.length)
    expect(routes.reads.map(transport)).not.toContain('xhr')
  })

  /**
   * The path that silently swallows a rounded amount today: a balance beyond
   * `Number.MAX_SAFE_INTEGER` cannot be projected, so the read fails rather
   * than rendering a number that is off by an unknown amount.
   */
  test('refuses a balance outside the safe-integer range instead of rounding it', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await mockCloudBoot(page, {
      unsafeBalance: true,
      readRailOnFeatures: true
    })
    await enableReadRail(page)
    await bootApp(page)

    const content = await openPlanAndCredits(page)

    await expect(content.getByText('Total credits')).toBeVisible()

    // The absence below only means anything if the SDK reader is what asked:
    // a balance never requested, or requested on the legacy client, would
    // render nothing here for reasons that have nothing to do with int64.
    await expect
      .poll(() =>
        routes.reads
          .filter((request) => request.url().includes('/api/billing/balance'))
          .map(transport)
      )
      .toContain('fetch')

    // 9007199254740993 micros rounds to ...992 through a double. Neither that
    // nor its dollar rendering may appear.
    await expect(content.getByText('9,007,199,254')).toBeHidden()
  })

  test('issues its own request for the second page of the usage log', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await mockCloudBoot(page, { readRailOnFeatures: true })
    await enableReadRail(page)
    await bootApp(page)

    const content = await openActivity(await openPlanAndCredits(page))
    await expect(content.getByText('node-on-page-1')).toBeVisible()

    await content.getByRole('button', { name: 'Next Page' }).click()

    // The reader is scoped and paged: page 2 must not be served page 1's
    // in-flight answer.
    await expect(content.getByText('node-on-page-2')).toBeVisible()
    await expect.poll(() => routes.eventPages).toContain('2')

    // Page 2 is fetched by the *same* rail, not just fetched. Both rails serve
    // this fixture identically, so the rendered row and the recorded page
    // number above are both satisfied by a legacy paging request — the
    // transport is the only thing that separates them, and the boot-time
    // assertion cannot speak for a request made after a click.
    await expect
      .poll(() =>
        routes.reads
          .filter(
            (request) =>
              request.url().includes('/api/billing/events') &&
              new URL(request.url()).searchParams.get('page') === '2'
          )
          .map(transport)
      )
      .toEqual(['fetch'])
  })
})
