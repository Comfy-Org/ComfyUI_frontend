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
  /** Every hosted-action URL the rail offered, in order. */
  readonly hostedOpens: () => Promise<string[]>
}

interface RecoveryOptions {
  /**
   * Serves `billing_sdk_subscription_enabled` on `/api/features`, the channel
   * the staged rollout publishes on. Boot awaits it (`main.ts:56`), so unlike
   * the websocket handshake it is readable before the billing gate picks a
   * rail for recovery.
   */
  railOnFeatures?: boolean
}

async function setupRecovery(
  page: Page,
  operation: BillingOpStatusResponse,
  { railOnFeatures = false }: RecoveryOptions = {}
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
    features: railOnFeatures
      ? { ...BOOT_FEATURES, billing_sdk_subscription_enabled: true }
      : BOOT_FEATURES,
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
        ...((window as Window & { __hostedOpens?: string[] }).__hostedOpens ??
          [])
      ])
  }
}

/** Which transport polled, and so which rail adopted the operation. */
function transports(requests: Request[]): string[] {
  return requests.map((request) => request.resourceType())
}

/**
 * The websocket half of the flag, paired with `railOnFeatures` so both
 * channels agree. Answered on the handshake rather than seeded on
 * `window.app`: recovery runs while the billing gate resolves, before
 * `GraphCanvas`'s `onMounted` assigns `window.app`, so `seedServerFlags()`
 * lands after the rail has already been chosen — which is what the first run
 * of this spec showed.
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

    // The legacy rail leaves the parked hosted step on its pointer for a
    // surface to put behind a button; it opens nothing on its own. Pinned
    // because the SDK row above does the opposite, and the difference is
    // customer-visible.
    expect(await routes.hostedOpens()).toEqual([])
  })

  /**
   * Asserts **exactly one adopter** first, and the rail second.
   *
   * The invariant is the one FE-2484 is actually about: two transports polling
   * one operation is the double-poll this PR exists to prevent. It is also the
   * stronger claim, because it holds no matter which rail wins.
   *
   * The rail assertion was previously omitted, because
   * `billingSdkSubscriptionRailEnabled` drew its two halves from two channels:
   * `unified_cloud_auth` off `/api/features`, which boot awaits, and
   * `billing_sdk_subscription_enabled` off `api.serverFeatureFlags`, which only
   * the websocket `feature_flags` handshake populates (`api.ts:1012`) and which
   * nothing awaits. `resumePendingOperation` runs from the billing gate's first
   * status read, so the two raced — this spec's first CI run measured the
   * legacy poll going out 145ms before the handshake landed.
   *
   * #18141 moved that flag onto `/api/features` as its primary channel, so
   * with `railOnFeatures` both halves are readable before the gate chooses and
   * the race is gone from this spec.
   *
   * **This makes the test deterministic, not production.** Anonymous
   * `/api/features` returns a concrete `false` for this key
   * (`cloud@main:common/featuregates/flags.go:591`), so a real boot still
   * resolves `false` and its first reads still go legacy. The FE-2487 evidence
   * caveat stands.
   */
  test('adopts a server-reported pending operation exactly once, on one rail', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await setupRecovery(page, PENDING_OPERATION, {
      railOnFeatures: true
    })
    await enableSdkRail(page)

    await page.goto(APP_URL)

    await waitForCloudApp(page)
    await cloudAppExpect
      .poll(() => routes.pollRequests.length)
      .toBeGreaterThan(0)
    // Exactly one adopter, and it is the SDK: the second assertion is only
    // sound because the flag now arrives on a channel boot awaits.
    expect(new Set(transports(routes.pollRequests)).size).toBe(1)
    expect(transports(routes.pollRequests)).not.toContain('xhr')

    // Adopting on this rail also *offers* the parked hosted step, unprompted,
    // at boot — the legacy row below records that the legacy rail does not.
    // Once per operation, not once per poll.
    await expect
      .poll(() => routes.hostedOpens())
      .toEqual([PENDING_OPERATION.action_url])
  })

  test('still restores the tier and cycle from the host pointer when recovery fails', async ({
    page
  }) => {
    test.setTimeout(60_000)
    // The SDK's own pointer is scope-keyed and carries no selection; the host
    // pointer is what reopens the checkout on the plan the customer chose.
    await seedPendingCheckout(page, PENDING_CREATOR_CHECKOUT)
    await setupRecovery(page, FAILED_OPERATION, { railOnFeatures: true })
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
