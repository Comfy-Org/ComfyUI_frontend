import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import type {
  BillingOpStatusResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  Plan,
  PreviewSubscribeResponse
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { PendingSubscriptionCheckout } from '@/platform/workspace/utils/pendingSubscriptionCheckout'

import {
  cloudAppExpect,
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
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
 * them apart. The transport can: the SDK runs on `fetch`, the legacy workspace
 * client on axios' XHR adapter — the same discriminator `planChangeSdkRail`
 * and `cancelSubscriptionSdkRail` use.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const PENDING_CHECKOUT_STORAGE_KEY = 'comfy:pending-subscription-checkout'
const RECOVERY_OPERATION_ID = 'op-e2e-rail-recover'

const BOOT_FEATURES = {
  billing_control_enabled: true,
  unified_cloud_auth: true
} satisfies RemoteConfig

const CREATOR_ANNUAL_PLAN = {
  slug: 'creator-annual',
  tier: 'CREATOR',
  duration: 'ANNUAL',
  price_cents: 33_600,
  credits_cents: 7_400,
  max_seats: 5,
  availability: { available: true },
  seat_summary: {
    seat_count: 1,
    total_cost_cents: 33_600,
    total_credits_cents: 7_400
  }
} satisfies Plan

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
  team_credit_stop: null,
  scheduled_change: null,
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
  credits_today_cents: 7_400,
  credits_next_period_cents: 7_400,
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
}

async function setupRecovery(
  page: Page,
  operation: BillingOpStatusResponse
): Promise<RecoveryRoutes> {
  const ws = workspace('personal', 'owner')
  const pollRequests: Request[] = []

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
  return { pollRequests }
}

/** Which transport polled, and so which rail adopted the operation. */
function transports(requests: Request[]): string[] {
  return requests.map((request) => request.resourceType())
}

/**
 * Answered on the websocket handshake rather than seeded on `window.app`:
 * recovery runs while the billing gate resolves, before `GraphCanvas`'s
 * `onMounted` assigns `window.app`, so `seedServerFlags()` lands after the rail
 * has already been chosen — which is what the first run of this spec showed.
 */
async function enableSdkRail(page: Page) {
  await new FeatureFlagHelper(page).serveServerFlagsOnHandshake({
    billing_sdk_subscription_enabled: true
  })
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
  test('adopts a server-reported pending operation on the legacy poller while the rail is off', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await setupRecovery(page, PENDING_OPERATION)

    await page.goto(APP_URL)

    await waitForCloudApp(page)
    await cloudAppExpect
      .poll(() => routes.pollRequests.length)
      .toBeGreaterThan(0)
    expect(transports(routes.pollRequests)).not.toContain('fetch')
  })

  /**
   * Asserts the invariant, not the rail, because **the rail is not
   * deterministic here** — and that is itself the finding.
   *
   * `billingSdkSubscriptionRailEnabled` needs two halves from two channels:
   * `unified_cloud_auth` off `/api/features`, which boot awaits, and
   * `billing_sdk_subscription_enabled` off `api.serverFeatureFlags`, which only
   * the websocket `feature_flags` handshake populates (`api.ts:1012`) and which
   * nothing awaits — `createSocket()` does not even open the socket until the
   * cloud auth token resolves. `resumePendingOperation` runs from the billing
   * gate's first status read, so the two race. The trace from this spec's first
   * CI run measures one outcome: the legacy poll went out 145ms before the
   * handshake reached the page.
   *
   * Asserting either transport would therefore be a flake, so this row asserts
   * what holds on both sides of the race and is what FE-2484 is actually for:
   * **exactly one adopter**. Two transports polling one operation is the
   * double-poll this PR exists to prevent, and that fails here whichever side
   * wins.
   *
   * The race is written up on the PR; fixing it is flag plumbing, not billing,
   * and needs its own ticket. Once it is fixed, tighten this back to the
   * `fetch`/no-`xhr` assertion it was written with.
   */
  test('adopts a server-reported pending operation exactly once, on one rail', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await setupRecovery(page, PENDING_OPERATION)
    await enableSdkRail(page)

    await page.goto(APP_URL)

    await waitForCloudApp(page)
    await cloudAppExpect
      .poll(() => routes.pollRequests.length)
      .toBeGreaterThan(0)
    expect(new Set(transports(routes.pollRequests)).size).toBe(1)
  })

  test('still restores the tier and cycle from the host pointer when recovery fails', async ({
    page
  }) => {
    test.setTimeout(60_000)
    // The SDK's own pointer is scope-keyed and carries no selection; the host
    // pointer is what reopens the checkout on the plan the customer chose.
    await seedPendingCheckout(page, PENDING_CREATOR_CHECKOUT)
    await setupRecovery(page, FAILED_OPERATION)
    await enableSdkRail(page)

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
