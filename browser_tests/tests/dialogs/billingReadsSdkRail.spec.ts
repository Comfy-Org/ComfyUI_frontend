import { expect } from '@playwright/test'
import type { Locator, Page, Request } from '@playwright/test'
import type {
  BillingBalanceResponse,
  BillingEventsResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  SavedPaymentMethod
} from '@comfyorg/ingest-types'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { createWorkspaceBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { createPlan } from '@e2e/fixtures/data/billingPlans'
import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { billingClient } from '@e2e/fixtures/utils/billingClient'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { expectElementScreenshot } from '@e2e/fixtures/utils/screenshotRegion'
import { mockWebSessionServer } from '@e2e/fixtures/utils/webSessionMocks'
import {
  mockWorkspaceList,
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
 * client that sent each read can, through `billingClient`, the same
 * discriminator the write-rail specs use.
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
  ended_at: null,
  team_credit_stop: null,
  scheduled_change: null,
  next_charge: null,
  plan_slug: 'pro-monthly',
  renewal_date: '2099-02-20T10:00:00Z'
}

const PRO_MONTHLY_PLAN = createPlan({
  slug: 'pro-monthly',
  tier: 'PRO',
  duration: 'MONTHLY',
  priceCents: 2_000,
  monthlyCredits: 2_110
})

const PLANS = {
  current_plan_slug: 'pro-monthly',
  plans: [PRO_MONTHLY_PLAN]
} satisfies BillingPlansResponse

const SAVED_CARD = {
  id: 'pm_e2e_visa',
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
  balanceDown?: () => boolean
}

async function mockCloudBoot(
  page: Page,
  { unsafeBalance = false, balanceDown = () => false }: BootOptions = {}
): Promise<ReadRoutes> {
  const reads: Request[] = []
  const eventPages: (string | null)[] = []

  const record = (request: Request) => {
    if (READ_ROUTES.some((route) => request.url().includes(route))) {
      reads.push(request)
    }
  }

  await page.route('**/api/features', (r) => r.fulfill(jsonRoute({})))
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
  await page.route('**/api/settings', (r) =>
    r.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
  )
  await page.route('**/api/userdata**', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/extensions', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/object_info', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/global_subgraphs', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/i18n', (r) => r.fulfill(jsonRoute({})))
  await mockWebSessionServer(page)
  await page.route('**/releases**', (r) => r.fulfill(jsonRoute([])))
  await mockWorkspaceTokenMint(page, workspace('personal', 'owner'))
  await mockWorkspaceList(page, [workspace('personal', 'owner')])

  await page.route('**/api/billing/status', (r) => {
    record(r.request())
    return r.fulfill(jsonRoute(ACTIVE_STATUS))
  })
  await page.route('**/api/billing/balance', (r) => {
    record(r.request())
    if (balanceDown()) {
      return r.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Balance temporarily unavailable' })
      })
    }
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

function routesRead(reads: Request[]): Set<string> {
  return new Set(
    READ_ROUTES.filter((route) =>
      reads.some((request) => request.url().includes(route))
    )
  )
}

test.describe('Billing reads rail (FE-2476)', { tag: '@cloud' }, () => {
  test('serves reads on the SDK transport while the rail is on, rendering the same values', async ({
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
    expect(routes.reads.map(billingClient)).not.toContain('legacy')
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
      unsafeBalance: true
    })
    await bootApp(page)

    const content = await openPlanAndCredits(page)

    await expect(content.getByText('Total credits')).toBeVisible()

    await expect
      .poll(() =>
        routes.reads
          .filter((request) => request.url().includes('/api/billing/balance'))
          .map(billingClient)
      )
      .toContain('sdk')

    await expect(content.getByText('9,007,199,254')).toBeHidden()
  })

  test(
    'shows a failed balance read as unavailable, then recovers on Try again',
    { tag: '@screenshot' },
    async ({ page }) => {
      test.setTimeout(60_000)
      let down = true
      await mockCloudBoot(page, { balanceDown: () => down })
      await bootApp(page)

      const content = await openPlanAndCredits(page)
      const tile = content.getByTestId('credits-tile')

      await expect(tile.getByTestId('credits-total-unavailable')).toHaveText(
        '—'
      )
      await expect(tile.getByText("Couldn't load your balance.")).toBeVisible()
      await expect(tile.getByText('0', { exact: true })).toBeHidden()
      await expectElementScreenshot(
        tile,
        'credits-tile-balance-unavailable.png'
      )

      down = false
      await tile.getByRole('button', { name: 'Try again' }).click()

      await expect(tile.getByText('12,660')).toBeVisible()
      await expect(tile.getByTestId('credits-total-unavailable')).toBeHidden()
    }
  )

  test('issues its own request for the second page of the usage log', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await mockCloudBoot(page)
    await bootApp(page)

    const content = await openActivity(await openPlanAndCredits(page))
    await expect(content.getByText('node-on-page-1')).toBeVisible()

    await content.getByRole('button', { name: 'Next', exact: true }).click()

    await expect(content.getByText('node-on-page-2')).toBeVisible()
    await expect.poll(() => routes.eventPages).toContain('2')

    await expect
      .poll(() =>
        routes.reads
          .filter(
            (request) =>
              request.url().includes('/api/billing/events') &&
              new URL(request.url()).searchParams.get('page') === '2'
          )
          .map(billingClient)
      )
      .toEqual(['sdk'])
  })
})
