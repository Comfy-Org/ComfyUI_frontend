import type {
  BillingBalanceResponse,
  BillingOpStatusResponse,
  BillingPlansResponse,
  PaymentPortalResponse,
  Plan,
  ResubscribeResponse
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
import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

import type { BillingStatusResponse } from '@/platform/workspace/api/workspaceApi'

/**
 * Resubscribe and the payment portal across the billing SDK rail — FE-2477.
 *
 * Comfy-Org/ComfyUI_frontend#17853 put cancel, resubscribe **and** the payment
 * portal on the same rail, and `cancelSubscriptionSdkRail.spec.ts` covered
 * cancel only. Neither of the other two had a browser case on either rail.
 *
 * Both rails POST the same routes, so the recorded request is what separates
 * them — only the SDK transport sends an `Idempotency-Key`. The portal is the
 * exception and deliberately so: `openPaymentPortal` is a plain POST outside
 * the operation lifecycle, so it carries no key on either rail, and the
 * transport is what tells the two apart.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const PROVIDER_PORTAL_URL = 'https://billing.example/portal'

/**
 * Six rows, which is the fixture gap #17853's evidence run recorded: the
 * reactivate button reads the catalog to name the plan being resumed, so a
 * one-row or empty `plans` response never renders it.
 */
const PLAN_CATALOG = {
  current_plan_slug: 'pro-monthly',
  plans: (
    [
      ['pro-monthly', 'PRO', 'MONTHLY', 2_000, 800],
      ['pro-annual', 'PRO', 'ANNUAL', 19_200, 8_600],
      ['standard-monthly', 'STANDARD', 'MONTHLY', 4_000, 1_600],
      ['standard-annual', 'STANDARD', 'ANNUAL', 38_400, 17_200],
      ['creator-monthly', 'CREATOR', 'MONTHLY', 8_000, 3_200],
      ['creator-annual', 'CREATOR', 'ANNUAL', 76_800, 34_400]
    ] as const
  ).map(
    ([slug, tier, duration, price_cents, credits_cents]) =>
      ({
        slug,
        tier,
        duration,
        price_cents,
        credits_cents,
        max_seats: 1,
        availability: { available: true },
        seat_summary: {
          seat_count: 1,
          total_cost_cents: price_cents,
          total_credits_cents: credits_cents
        }
      }) satisfies Plan
  )
} satisfies BillingPlansResponse

const CANCELLED_STATUS: BillingStatusResponse = {
  is_active: true,
  has_funds: true,
  subscription_status: 'canceled',
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

interface LifecycleRoutes {
  /** Every POST to the resubscribe route, in order. */
  readonly resubscribeRequests: Request[]
  /** Every POST to the payment-portal route, in order. */
  readonly portalRequests: Request[]
  /** Answers the next resubscribe with a 404, as a closed backend gate does. */
  refuseResubscribe: () => void
  /** Answers the next portal request with a 404. */
  refusePortal: () => void
}

interface CloudBootOptions {
  /**
   * The value served for `billing_sdk_subscription_enabled` on `/api/features`,
   * the channel the staged rollout publishes on. Always sent, so a row that
   * leaves the rail off pins it off rather than inheriting the live default.
   *
   * #18141 made `/api/features` the primary channel and demoted the websocket
   * handshake to fallback (`resolveFlag`: `remoteConfigValue ??
   * api.getServerFeature(...)`). Seeding only the handshake leaves
   * `remoteConfigValue` undefined, so the rows below would still pass — but on
   * the fallback channel rather than the one production prefers. Both are
   * served here so neither alone is what the assertions rest on.
   */
  railOnFeatures?: boolean
}

async function mockCloudBoot(
  page: Page,
  { railOnFeatures = false }: CloudBootOptions = {}
): Promise<LifecycleRoutes> {
  const resubscribeRequests: Request[] = []
  const portalRequests: Request[] = []
  let resubscribeNotFound = false
  let portalNotFound = false

  await page.route('**/api/features', (r) =>
    r.fulfill(
      jsonRoute({
        unified_cloud_auth: true,
        billing_sdk_subscription_enabled: railOnFeatures
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

  await page.route('**/api/billing/status', (r) =>
    r.fulfill(jsonRoute(CANCELLED_STATUS))
  )
  await page.route('**/api/billing/balance', (r) =>
    r.fulfill(
      jsonRoute({
        amount_micros: 0,
        currency: 'usd'
      } satisfies BillingBalanceResponse)
    )
  )
  await page.route('**/api/billing/plans', (r) =>
    r.fulfill(jsonRoute(PLAN_CATALOG))
  )
  await page.route('**/api/billing/capabilities', (r) => {
    if (r.request().method() !== 'GET') return r.fallback()
    return r.fulfill(
      jsonRoute(
        createWorkspaceBillingCapabilities(workspace('personal', 'owner'))
      )
    )
  })
  await page.route('**/customers/balance', (r) =>
    r.fulfill(
      jsonRoute({
        amount_micros: 0,
        currency: 'usd'
      } satisfies BillingBalanceResponse)
    )
  )

  // Both lifecycle routes answer POST only. A regression to GET would
  // otherwise be served the success fixture and pass every assertion below,
  // since none of them reads the method.
  await page.route('**/api/billing/subscription/resubscribe', async (r) => {
    resubscribeRequests.push(r.request())
    if (r.request().method() !== 'POST') {
      await r.fulfill({ status: 405, body: '' })
      return
    }
    if (resubscribeNotFound) {
      resubscribeNotFound = false
      await r.fulfill({ status: 404, body: '' })
      return
    }
    await r.fulfill(
      jsonRoute({
        billing_op_id: 'op-resubscribe-1',
        status: 'pending'
      } satisfies ResubscribeResponse)
    )
  })
  await page.route('**/api/billing/payment-portal', async (r) => {
    portalRequests.push(r.request())
    if (r.request().method() !== 'POST') {
      await r.fulfill({ status: 405, body: '' })
      return
    }
    if (portalNotFound) {
      portalNotFound = false
      await r.fulfill({ status: 404, body: '' })
      return
    }
    await r.fulfill(
      jsonRoute({ url: PROVIDER_PORTAL_URL } satisfies PaymentPortalResponse)
    )
  })
  // Both rails poll the same operation route; it settles on the first read.
  await page.route('**/api/billing/ops/**', (r) =>
    r.fulfill(
      jsonRoute({
        id: 'op-resubscribe-1',
        status: 'succeeded',
        started_at: '2026-09-20T00:00:00Z',
        completed_at: '2026-09-20T00:00:05Z'
      } satisfies BillingOpStatusResponse)
    )
  )

  return {
    resubscribeRequests,
    portalRequests,
    refuseResubscribe: () => {
      resubscribeNotFound = true
    },
    refusePortal: () => {
      portalNotFound = true
    }
  }
}

interface AppBootOptions {
  /** Every `window.open` is refused, as a browser blocking the popup does. */
  blockPopups?: boolean
}

async function bootApp(
  page: Page,
  { blockPopups = false }: AppBootOptions = {}
) {
  await new CloudAuthHelper(page).mockAuth()
  await page.addInitScript((refuseEveryOpen: boolean) => {
    localStorage.setItem('Comfy.userId', 'test-user-e2e')
    const recordDestination = (url: string) => {
      const opened = document.documentElement.dataset.openedUrls
      document.documentElement.dataset.openedUrls = opened
        ? `${opened} ${url}`
        : url
    }
    // A handle whose navigation is recorded rather than performed, as in
    // hostedBillingDestination.spec.ts: handing back the live `window` would
    // let a disowned-tab open steer this page instead.
    const standInTab = new Proxy(window, {
      get: (target, property) =>
        property === 'location'
          ? {
              get href() {
                return ''
              },
              set href(destination: string) {
                recordDestination(destination)
              }
            }
          : Reflect.get(target, property),
      set: () => true
    })
    window.open = (url, _target, features) => {
      if (url) recordDestination(String(url))
      if (refuseEveryOpen) return null
      return (features ?? '').includes('noopener') ? null : standInTab
    }
  }, blockPopups)
  await page.goto(APP_URL)
  await page.waitForFunction(() => !!window.app?.extensionManager, null, {
    timeout: 45_000
  })
}

/** Settings ▸ Workspace ▸ Plan & Credits, where both actions live. */
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

async function openedUrls(page: Page): Promise<string[]> {
  const recorded = await page.locator('html').getAttribute('data-opened-urls')
  return recorded ? recorded.split(' ') : []
}

/** The SDK transport sends this header; the legacy axios client never does. */
function idempotencyKey(request: Request): string | undefined {
  return request.headers()['idempotency-key']
}

/** Which transport issued the request, and so which rail served it. */
function transport(request: Request): string {
  return request.resourceType()
}

/**
 * Seeds the websocket handshake, the fallback channel since #18141. Paired with
 * `railOnFeatures` so both channels agree; these rows act on a click rather
 * than at boot, so the flag lands before the request either way.
 */
async function enableSdkRail(page: Page) {
  await new FeatureFlagHelper(page).setServerFlagsPersistent({
    billing_sdk_subscription_enabled: true
  })
}

test.describe(
  'Resubscribe and payment portal rail (FE-2477)',
  { tag: '@cloud' },
  () => {
    test.describe('resubscribe', () => {
      test('keeps the legacy call while the rail is off', async ({ page }) => {
        test.setTimeout(60_000)
        const routes = await mockCloudBoot(page)
        await bootApp(page)

        const panel = await openPlanAndCredits(page)
        await panel.getByRole('button', { name: 'Resume subscription' }).click()

        await expect.poll(() => routes.resubscribeRequests.length).toBe(1)
        const [issued] = routes.resubscribeRequests
        expect(issued.method()).toBe('POST')
        expect(transport(issued)).toBe('xhr')
        expect(idempotencyKey(issued)).toBeUndefined()
      })

      test('issues through the SDK transport while the rail is on', async ({
        page
      }) => {
        test.setTimeout(60_000)
        const routes = await mockCloudBoot(page, { railOnFeatures: true })
        await bootApp(page)
        await enableSdkRail(page)

        const panel = await openPlanAndCredits(page)
        await panel.getByRole('button', { name: 'Resume subscription' }).click()

        await expect.poll(() => routes.resubscribeRequests.length).toBe(1)
        const [issued] = routes.resubscribeRequests
        expect(transport(issued)).toBe('fetch')
        expect(idempotencyKey(issued)).toBeTruthy()
        expect(issued.postDataJSON()).toMatchObject({
          idempotency_key: idempotencyKey(issued)
        })
      })

      test('falls back to the legacy call when the SDK route answers 404', async ({
        page
      }) => {
        test.setTimeout(60_000)
        const routes = await mockCloudBoot(page, { railOnFeatures: true })
        await bootApp(page)
        await enableSdkRail(page)
        routes.refuseResubscribe()

        const panel = await openPlanAndCredits(page)
        await panel.getByRole('button', { name: 'Resume subscription' }).click()

        await expect.poll(() => routes.resubscribeRequests.length).toBe(2)
        const [sdkAttempt, legacyAttempt] = routes.resubscribeRequests
        expect(transport(sdkAttempt)).toBe('fetch')
        expect(idempotencyKey(sdkAttempt)).toBeTruthy()
        expect(transport(legacyAttempt)).toBe('xhr')
        expect(idempotencyKey(legacyAttempt)).toBeUndefined()
      })
    })

    test.describe('payment portal', () => {
      test('keeps the legacy call while the rail is off', async ({ page }) => {
        test.setTimeout(60_000)
        const routes = await mockCloudBoot(page)
        await bootApp(page)

        const panel = await openPlanAndCredits(page)
        await panel.getByRole('button', { name: 'Billing & invoices' }).click()

        await expect.poll(() => routes.portalRequests.length).toBe(1)
        expect(transport(routes.portalRequests[0])).toBe('xhr')
        expect(idempotencyKey(routes.portalRequests[0])).toBeUndefined()
        await expect.poll(() => openedUrls(page)).toContain(PROVIDER_PORTAL_URL)
      })

      test('issues through the SDK transport, and carries no idempotency key by design', async ({
        page
      }) => {
        test.setTimeout(60_000)
        const routes = await mockCloudBoot(page, { railOnFeatures: true })
        await bootApp(page)
        await enableSdkRail(page)

        const panel = await openPlanAndCredits(page)
        await panel.getByRole('button', { name: 'Billing & invoices' }).click()

        await expect.poll(() => routes.portalRequests.length).toBe(1)
        const [issued] = routes.portalRequests
        expect(transport(issued)).toBe('fetch')
        // A plain POST outside the operation lifecycle: no key is the contract,
        // not an omission. Asserted so a later change that adds one is noticed.
        expect(idempotencyKey(issued)).toBeUndefined()
        await expect.poll(() => openedUrls(page)).toContain(PROVIDER_PORTAL_URL)
      })

      test('falls back to the legacy call when the SDK route answers 404', async ({
        page
      }) => {
        test.setTimeout(60_000)
        const routes = await mockCloudBoot(page, { railOnFeatures: true })
        await bootApp(page)
        await enableSdkRail(page)
        routes.refusePortal()

        const panel = await openPlanAndCredits(page)
        await panel.getByRole('button', { name: 'Billing & invoices' }).click()

        await expect.poll(() => routes.portalRequests.length).toBe(2)
        const [sdkAttempt, legacyAttempt] = routes.portalRequests
        expect(transport(sdkAttempt)).toBe('fetch')
        expect(transport(legacyAttempt)).toBe('xhr')
        await expect.poll(() => openedUrls(page)).toContain(PROVIDER_PORTAL_URL)
      })

      /**
       * The cascade #17922 added. `manageSubscription` tries three
       * destinations in order and each one opens a different page, so a
       * browser refusing the first says nothing about the next: the rail is
       * still asked, and the legacy call after it. A refused open must not be
       * read as "the portal is handled".
       */
      test('asks the next destination when the browser refuses the tab', async ({
        page
      }) => {
        test.setTimeout(60_000)
        const routes = await mockCloudBoot(page, { railOnFeatures: true })
        await bootApp(page, { blockPopups: true })
        await enableSdkRail(page)

        const panel = await openPlanAndCredits(page)
        await panel.getByRole('button', { name: 'Billing & invoices' }).click()

        // The rail answered and its tab was refused, so the legacy call runs.
        await expect.poll(() => routes.portalRequests.length).toBe(2)
        expect(transport(routes.portalRequests[0])).toBe('fetch')
        expect(transport(routes.portalRequests[1])).toBe('xhr')
        await expect
          .poll(
            async () =>
              (await openedUrls(page)).filter(
                (destination) => destination === PROVIDER_PORTAL_URL
              ).length
          )
          .toBe(2)
      })
    })
  }
)
