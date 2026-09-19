import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import type {
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

/** The six routes `useBillingReadRail` serves, in the order they are listed. */
const READ_ROUTES = [
  '/api/billing/status',
  '/api/billing/balance',
  '/api/billing/plans',
  '/api/billing/capabilities',
  '/api/billing/payment-methods',
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

const BALANCE = { amount_micros: 12_660_000, currency: 'usd' }

/**
 * Beyond Number.MAX_SAFE_INTEGER, sent as raw JSON: written as a JS literal the
 * digits would be lost before the app ever saw them, which is the rounding this
 * row exists to prove the reader refuses.
 */
const UNSAFE_BALANCE_BODY =
  '{"amount_micros":9007199254740993,"currency":"usd"}'

function eventsPage(page: number): BillingEventsResponse {
  return {
    events: [
      {
        event_id: `evt-${page}`,
        event_type: 'api_usage',
        createdAt: '2026-09-20T00:00:00Z',
        amount: 100,
        params: { api_name: `node-on-page-${page}` }
      }
    ],
    page,
    limit: 10,
    total: 20,
    totalPages: 2
  } as unknown as BillingEventsResponse
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
}

async function mockCloudBoot(
  page: Page,
  { unsafeBalance = false }: BootOptions = {}
): Promise<ReadRoutes> {
  const reads: Request[] = []
  const eventPages: (string | null)[] = []

  const record = (request: Request) => {
    if (READ_ROUTES.some((route) => request.url().includes(route))) {
      reads.push(request)
    }
  }

  await page.route('**/api/features', (r) =>
    r.fulfill(jsonRoute({ unified_cloud_auth: true }))
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

async function enableReadRail(page: Page) {
  await new FeatureFlagHelper(page).setServerFlagsPersistent({
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
    await expect(content.getByText('node-on-page-1')).toBeVisible()
    await expect.poll(() => routesRead(routes.reads).size).toBe(6)
    expect(routes.reads.map(transport)).not.toContain('fetch')
  })

  test('serves every read on the SDK transport while the rail is on, rendering the same values', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await mockCloudBoot(page)
    await bootApp(page)
    await enableReadRail(page)

    const content = await openPlanAndCredits(page)

    // Identical to the legacy row above: the int64 projections must not move
    // a rendered number.
    await expect(content.getByText('Total credits')).toBeVisible()
    await expect(content.getByText('12,660')).toBeVisible()
    await expect(content.getByText('node-on-page-1')).toBeVisible()
    await expect.poll(() => routesRead(routes.reads).size).toBe(6)
    // One read going out on the legacy client would mean a surface reading a
    // backend the rail did not settle.
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
    await mockCloudBoot(page, { unsafeBalance: true })
    await bootApp(page)
    await enableReadRail(page)

    const content = await openPlanAndCredits(page)

    await expect(content.getByText('Total credits')).toBeVisible()
    // 9007199254740993 micros rounds to ...992 through a double. Neither that
    // nor its dollar rendering may appear.
    await expect(content.getByText('9,007,199,254')).toBeHidden()
  })

  test('issues its own request for the second page of the usage log', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await mockCloudBoot(page)
    await bootApp(page)
    await enableReadRail(page)

    const content = await openPlanAndCredits(page)
    await expect(content.getByText('node-on-page-1')).toBeVisible()

    await content.getByRole('button', { name: 'Next Page' }).click()

    // The reader is scoped and paged: page 2 must not be served page 1's
    // in-flight answer.
    await expect(content.getByText('node-on-page-2')).toBeVisible()
    await expect.poll(() => routes.eventPages).toContain('2')
  })
})
