import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import type {
  BillingBalanceResponse,
  BillingOpStatusResponse,
  BillingPlansResponse,
  PaymentPortalResponse,
  ResubscribeResponse
} from '@comfyorg/ingest-types'

import type { BillingStatusResponse } from '@comfyorg/billing-core'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { createWorkspaceBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { createPlan } from '@e2e/fixtures/data/billingPlans'
import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { billingClient } from '@e2e/fixtures/utils/billingClient'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockWebSessionServer } from '@e2e/fixtures/utils/webSessionMocks'
import {
  mockWorkspaceList,
  mockWorkspaceTokenMint,
  workspace
} from '@e2e/fixtures/utils/workspaceMocks'

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
 * client that sent it, which `billingClient` reads, tells the two apart.
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
      ['pro-monthly', 'PRO', 'MONTHLY', 2_000, 21_100],
      ['pro-annual', 'PRO', 'ANNUAL', 19_200, 21_100],
      ['standard-monthly', 'STANDARD', 'MONTHLY', 4_000, 4_200],
      ['standard-annual', 'STANDARD', 'ANNUAL', 38_400, 4_200],
      ['creator-monthly', 'CREATOR', 'MONTHLY', 8_000, 7_400],
      ['creator-annual', 'CREATOR', 'ANNUAL', 76_800, 7_400]
    ] as const
  ).map(([slug, tier, duration, priceCents, monthlyCredits]) =>
    createPlan({ slug, tier, duration, priceCents, monthlyCredits })
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
  ended_at: null,
  team_credit_stop: null,
  scheduled_change: null,
  next_charge: null,
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

async function mockCloudBoot(page: Page): Promise<LifecycleRoutes> {
  const resubscribeRequests: Request[] = []
  const portalRequests: Request[] = []
  let resubscribeNotFound = false
  let portalNotFound = false

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

test.describe(
  'Resubscribe and payment portal rail (FE-2477)',
  { tag: '@cloud' },
  () => {
    test.describe('resubscribe', () => {
      test('issues through the SDK transport while the rail is on', async ({
        page
      }) => {
        test.setTimeout(60_000)
        const routes = await mockCloudBoot(page)
        await bootApp(page)

        const panel = await openPlanAndCredits(page)
        await panel.getByRole('button', { name: 'Resume subscription' }).click()

        await expect.poll(() => routes.resubscribeRequests.length).toBe(1)
        const [issued] = routes.resubscribeRequests
        expect(billingClient(issued)).toBe('sdk')
        expect(idempotencyKey(issued)).toBeTruthy()
        expect(issued.postDataJSON()).toMatchObject({
          idempotency_key: idempotencyKey(issued)
        })
      })

      test('falls back to the legacy call when the SDK route answers 404', async ({
        page
      }) => {
        test.setTimeout(60_000)
        const routes = await mockCloudBoot(page)
        await bootApp(page)
        routes.refuseResubscribe()

        const panel = await openPlanAndCredits(page)
        await panel.getByRole('button', { name: 'Resume subscription' }).click()

        await expect.poll(() => routes.resubscribeRequests.length).toBe(2)
        const [sdkAttempt, legacyAttempt] = routes.resubscribeRequests
        expect(billingClient(sdkAttempt)).toBe('sdk')
        expect(idempotencyKey(sdkAttempt)).toBeTruthy()
        expect(billingClient(legacyAttempt)).toBe('legacy')
        expect(idempotencyKey(legacyAttempt)).toBeUndefined()
      })
    })

    test.describe('payment portal', () => {
      test('issues through the SDK transport, and carries no idempotency key by design', async ({
        page
      }) => {
        test.setTimeout(60_000)
        const routes = await mockCloudBoot(page)
        await bootApp(page)

        const panel = await openPlanAndCredits(page)
        await panel.getByRole('button', { name: 'Billing & invoices' }).click()

        await expect.poll(() => routes.portalRequests.length).toBe(1)
        const [issued] = routes.portalRequests
        expect(billingClient(issued)).toBe('sdk')
        expect(idempotencyKey(issued)).toBeUndefined()
        await expect.poll(() => openedUrls(page)).toContain(PROVIDER_PORTAL_URL)
      })

      test('falls back to the legacy call when the SDK route answers 404', async ({
        page
      }) => {
        test.setTimeout(60_000)
        const routes = await mockCloudBoot(page)
        await bootApp(page)
        routes.refusePortal()

        const panel = await openPlanAndCredits(page)
        await panel.getByRole('button', { name: 'Billing & invoices' }).click()

        await expect.poll(() => routes.portalRequests.length).toBe(2)
        const [sdkAttempt, legacyAttempt] = routes.portalRequests
        expect(billingClient(sdkAttempt)).toBe('sdk')
        expect(billingClient(legacyAttempt)).toBe('legacy')
        await expect.poll(() => openedUrls(page)).toContain(PROVIDER_PORTAL_URL)
      })

      /**
       * A pop-up blocker refuses this page, not one destination, so the portal
       * tab is reserved before any portal session is minted: a refused
       * reservation tells the customer why and asks neither transport.
       */
      test('mints no portal session when the browser refuses the tab', async ({
        page,
        toast
      }) => {
        test.setTimeout(60_000)
        const routes = await mockCloudBoot(page)
        await bootApp(page, { blockPopups: true })

        const panel = await openPlanAndCredits(page)
        await panel.getByRole('button', { name: 'Billing & invoices' }).click()

        await expect(
          toast.withText(
            "Couldn't open the billing page. Allow pop-ups for this site and try again."
          )
        ).toBeVisible()
        expect(routes.portalRequests).toHaveLength(0)
      })
    })
  }
)
