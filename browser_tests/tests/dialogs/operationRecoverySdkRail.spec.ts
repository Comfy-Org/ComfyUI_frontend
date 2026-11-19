import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import type {
  BillingOpStatusResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  PreviewSubscribeResponse
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { PendingSubscriptionCheckout } from '@/platform/billing/utils/pendingSubscriptionCheckout'

import {
  cloudAppExpect,
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import { createPlan } from '@e2e/fixtures/data/billingPlans'
import { billingClient } from '@e2e/fixtures/utils/billingClient'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockWorkspace, workspace } from '@e2e/fixtures/utils/workspaceMocks'

/**
 * Recovering a pending operation across the billing SDK rail — FE-2485.
 *
 * `checkoutRecovery.spec.ts` covers the legacy path; nothing exercised
 * `lifecycle.recover()` in a browser on either rail, though recovery is the
 * path a customer takes after a redirect checkout, a reload mid-payment, or a
 * flag flip while an operation is pending.
 *
 * Both rails poll `GET /api/billing/ops/{id}`, so the request body cannot tell
 * them apart. The client that polled can, through `billingClient`.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const PENDING_CHECKOUT_STORAGE_KEY = 'comfy:pending-subscription-checkout'
const RECOVERY_OPERATION_ID = 'op-e2e-rail-recover'

const BOOT_FEATURES = {
  billing_control_enabled: true
} satisfies RemoteConfig

const CREATOR_ANNUAL_PLAN = createPlan({
  slug: 'creator-annual',
  tier: 'CREATOR',
  duration: 'ANNUAL',
  priceCents: 33_600,
  monthlyCredits: 7_400,
  maxSeats: 5
})

/** The server naming the operation it still has open for this scope. */
const STATUS_WITH_PENDING_SUBSCRIPTION = {
  is_active: true,
  subscription_status: 'active',
  subscription_tier: 'STANDARD',
  subscription_duration: 'ANNUAL',
  plan_slug: 'standard-annual',
  billing_rail: 'stripe',
  billing_status: 'paid',
  has_funds: true,
  renewal_date: '2099-02-20T00:00:00Z',
  ended_at: null,
  team_credit_stop: null,
  scheduled_change: null,
  next_charge: null,
  max_seats: 1,
  occupied_seats: 1,
  pending_billing_op_id: RECOVERY_OPERATION_ID,
  pending_billing_op_type: 'subscription'
} satisfies BillingStatusResponse

const NEW_CREATOR_SUBSCRIPTION = {
  allowed: true,
  transition_type: 'new_subscription',
  effective_at: '2026-09-21T00:00:00Z',
  is_immediate: true,
  cost_today_cents: 33_600,
  cost_next_period_cents: 33_600,
  credits_today_cents: CREATOR_ANNUAL_PLAN.credits_cents,
  credits_next_period_cents: CREATOR_ANNUAL_PLAN.credits_cents,
  new_plan: CREATOR_ANNUAL_PLAN
} satisfies PreviewSubscribeResponse

const FAILED_OPERATION = {
  id: RECOVERY_OPERATION_ID,
  status: 'failed',
  error_message: 'Payment was not completed',
  started_at: '2026-09-20T00:00:00Z',
  completed_at: '2026-09-20T00:00:01Z'
} satisfies BillingOpStatusResponse

const PENDING_OPERATION = {
  id: RECOVERY_OPERATION_ID,
  status: 'pending',
  action_url: 'https://pay.stripe.example/authorize/op-e2e-rail-recover',
  started_at: '2026-09-20T00:00:00Z'
} satisfies BillingOpStatusResponse

// ownerUid matches the mocked Firebase uid (CloudAuthHelper) and workspaceId
// the personal workspace the boot mocks resolve as active.
const PENDING_CREATOR_CHECKOUT = {
  operationId: RECOVERY_OPERATION_ID,
  workspaceId: workspace('personal', 'owner').id,
  ownerUid: 'test-user-e2e',
  selection: {
    planMode: 'personal',
    tierKey: 'creator',
    billingCycle: 'yearly'
  }
} satisfies Omit<PendingSubscriptionCheckout, 'attemptedAt'>

// The recovery loader runs at the tail of GraphCanvas onMounted, so the boot
// chain must not throw before it.
async function mockGraphBootExtras(page: Page) {
  await page.route('**/api/settings/**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({}))
  })
  await page.route('**/api/assets**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({ assets: [], total: 0, has_more: false }))
  })
  await page.route('**/api/prompt', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({ exec_info: { queue_remaining: 0 } }))
  })
  await page.route('**/api/queue', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({ queue_running: [], queue_pending: [] }))
  })
}

interface RecoveryRoutes {
  /** Every poll of the pending operation, in order, with its transport. */
  readonly pollRequests: Request[]
  /** Every hosted-action URL the rail offered, in order. */
  readonly hostedOpens: () => Promise<string[]>
}

async function setupRecovery(
  page: Page,
  operation: BillingOpStatusResponse
): Promise<RecoveryRoutes> {
  const ws = workspace('personal', 'owner')
  const pollRequests: Request[] = []

  // `billingSdkStore.openHostedAction` offers a pending operation's hosted step
  // by opening it, off the lifecycle rather than a click. Recording the call
  // instead of letting it through keeps the popup out of network isolation and
  // makes the offer assertable; the truthy return keeps the popup-blocked
  // toast path unentered, which is a different behaviour than the one here.
  await page.addInitScript(() => {
    const opened: string[] = []
    Object.defineProperty(window, '__hostedOpens', { get: () => opened })
    window.open = (url?: string | URL) => {
      opened.push(String(url))
      return window
    }
  })

  await mockCloudBoot(page, {
    features: BOOT_FEATURES,
    settings: { 'Comfy.TutorialCompleted': true }
  })
  await mockGraphBootExtras(page)
  await mockBilling(page, { workspaceId: ws.id })
  await mockWorkspace(page, ws, [])

  await page.route('**/api/billing/status', (route) =>
    route.fulfill(jsonRoute(STATUS_WITH_PENDING_SUBSCRIPTION))
  )
  await page.route('**/api/billing/plans', (route) =>
    route.fulfill(
      jsonRoute({ plans: [CREATOR_ANNUAL_PLAN] } satisfies BillingPlansResponse)
    )
  )
  await page.route('**/api/billing/preview-subscribe', (route) =>
    route.fulfill(jsonRoute(NEW_CREATOR_SUBSCRIPTION))
  )
  await page.route(`**/api/billing/ops/${RECOVERY_OPERATION_ID}`, (route) => {
    pollRequests.push(route.request())
    return route.fulfill(jsonRoute(operation))
  })

  await bootCloud(page)
  return {
    pollRequests,
    hostedOpens: () =>
      page.evaluate(() => [
        ...(
          window as unknown as {
            __hostedOpens: string[]
          }
        ).__hostedOpens
      ])
  }
}

// sessionStorage must be seeded before any app code runs; attemptedAt is
// stamped in the init script so the entry is always fresher than the 24h cap.
async function seedPendingCheckout(
  page: Page,
  entry: Omit<PendingSubscriptionCheckout, 'attemptedAt'>
) {
  await page.addInitScript(
    ({ key, seeded }) => {
      sessionStorage.setItem(
        key,
        JSON.stringify({ ...seeded, attemptedAt: Date.now() - 60_000 })
      )
    },
    { key: PENDING_CHECKOUT_STORAGE_KEY, seeded: entry }
  )
}

function readPendingCheckout(page: Page) {
  return page.evaluate(
    (key) => sessionStorage.getItem(key),
    PENDING_CHECKOUT_STORAGE_KEY
  )
}

const confirmPaymentHeading = (page: Page) =>
  page.getByRole('heading', { name: 'Confirm your payment' })

test.describe('Operation recovery rail (FE-2485)', { tag: '@cloud' }, () => {
  /**
   * Asserts **exactly one adopter** first, and the rail second.
   *
   * The invariant is the one FE-2484 is actually about: two transports polling
   * one operation is the double-poll this PR exists to prevent. It is also the
   * stronger claim, because it holds no matter which rail wins.
   */
  test('adopts a server-reported pending operation exactly once, on one rail', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await setupRecovery(page, PENDING_OPERATION)

    await page.goto(APP_URL)

    await waitForCloudApp(page)
    await cloudAppExpect
      .poll(() => routes.pollRequests.length)
      .toBeGreaterThan(0)
    expect(new Set(routes.pollRequests.map(billingClient)).size).toBe(1)
    expect(routes.pollRequests.map(billingClient)).not.toContain('legacy')

    await cloudAppExpect
      .poll(() => routes.pollRequests.length)
      .toBeGreaterThan(1)
    expect(await routes.hostedOpens()).toEqual([])
  })

  test.describe('with billing_new_ux_enabled off', () => {
    test.use({ billingNewUx: false })

    test('still restores the tier and cycle from the host pointer when recovery fails', async ({
      page
    }) => {
      test.setTimeout(60_000)
      await seedPendingCheckout(page, PENDING_CREATOR_CHECKOUT)
      await setupRecovery(page, FAILED_OPERATION)

      await page.goto(APP_URL)

      await cloudAppExpect(confirmPaymentHeading(page)).toBeVisible()
      const checkoutDialog = page.getByRole('dialog')
      await expect(
        checkoutDialog.getByRole('button', { name: 'Subscribe to Creator' })
      ).toBeVisible()
      await expect(
        checkoutDialog.getByText('$336 Billed yearly').filter({ visible: true })
      ).toBeVisible()
      await expect.poll(() => readPendingCheckout(page)).toBeNull()
    })
  })
})
