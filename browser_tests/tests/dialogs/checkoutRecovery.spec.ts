import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import type {
  BillingOpStatusResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  ErrorResponse,
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
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockWorkspace, workspace } from '@e2e/fixtures/utils/workspaceMocks'

/**
 * A redirect checkout persists its pending billing operation in sessionStorage
 * before leaving the app. On the next boot `resumePendingPricingFlow()`
 * reconciles that operation: a terminal failure reopens checkout for the
 * persisted selection, success stays silent, and an entry for another user or
 * workspace is dropped without reconciliation. Drives a raw `page` against
 * fully mocked endpoints, like the pricing deep-link spec.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const PENDING_CHECKOUT_STORAGE_KEY = 'comfy:pending-subscription-checkout'
const RECOVERY_OPERATION_ID = 'op-e2e-recover'

const BOOT_FEATURES = {
  billing_control_enabled: true
} satisfies RemoteConfig
// Disable the experimental Asset API: with it on (cloud default) the unmocked
// asset endpoints 403 and workflow restore throws uncaught, aborting the
// GraphCanvas onMounted chain before the recovery loader.
const BOOT_SETTINGS = {
  'Comfy.Assets.UseAssetAPI': false,
  'Comfy.TutorialCompleted': true
}

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

const LEGACY_ACTIVE_STANDARD_STATUS = {
  is_active: true,
  subscription_status: 'active',
  subscription_tier: 'STANDARD',
  subscription_duration: 'ANNUAL',
  plan_slug: 'standard-annual',
  billing_status: 'paid',
  has_funds: true,
  renewal_date: '2099-02-20T00:00:00Z',
  team_credit_stop: null,
  max_seats: 1,
  occupied_seats: 1,
  billing_rail: 'legacy_stripe'
} satisfies BillingStatusResponse & { billing_rail: 'legacy_stripe' }

const NEW_CREATOR_SUBSCRIPTION = {
  allowed: true,
  transition_type: 'new_subscription',
  effective_at: '2026-07-21T00:00:00Z',
  is_immediate: true,
  cost_today_cents: 33_600,
  cost_next_period_cents: 33_600,
  credits_today_cents: 7_400,
  credits_next_period_cents: 7_400,
  new_plan: CREATOR_ANNUAL_PLAN
} satisfies PreviewSubscribeResponse

const FAILED_RECOVERY_OPERATION = {
  id: RECOVERY_OPERATION_ID,
  status: 'failed',
  error_message: 'Payment was not completed',
  started_at: '2026-07-20T00:00:00Z',
  completed_at: '2026-07-20T00:00:01Z'
} satisfies BillingOpStatusResponse

const SUCCEEDED_RECOVERY_OPERATION = {
  id: RECOVERY_OPERATION_ID,
  status: 'succeeded',
  started_at: '2026-07-20T00:00:00Z',
  completed_at: '2026-07-20T00:00:01Z'
} satisfies BillingOpStatusResponse

// The recovery loader runs at the tail of GraphCanvas onMounted, so the boot
// chain must not throw before it: a missing settings subpath, prompt exec_info,
// or queue status each abort that chain.
async function mockGraphBootExtras(page: Page) {
  await page.route('**/api/settings/**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({}))
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

async function setupCloudApp(page: Page) {
  await mockCloudBoot(page, {
    features: BOOT_FEATURES,
    settings: BOOT_SETTINGS
  })
  await mockGraphBootExtras(page)
  await mockBilling(page)
  await mockWorkspace(page, workspace('personal', 'owner'), [])
  await bootCloud(page)
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

function trackBillingOpRequests(page: Page) {
  const operationPollRequests: Request[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/billing/ops/')) {
      operationPollRequests.push(request)
    }
  })
  return operationPollRequests
}

const confirmPaymentHeading = (page: Page) =>
  page.getByRole('heading', { name: 'Confirm your payment' })

test.describe('Redirect checkout recovery', { tag: '@cloud' }, () => {
  test('reopens checkout for the attempted plan when reconciliation fails', async ({
    page
  }) => {
    const subscribeRequests: Request[] = []
    const operationPollRequests: Request[] = []
    await seedPendingCheckout(page, PENDING_CREATOR_CHECKOUT)
    await setupCloudApp(page)
    await page.route('**/api/billing/status', (route) =>
      route.fulfill(jsonRoute(LEGACY_ACTIVE_STANDARD_STATUS))
    )
    await page.route('**/api/billing/plans', (route) =>
      route.fulfill(
        jsonRoute({
          plans: [CREATOR_ANNUAL_PLAN]
        } satisfies BillingPlansResponse)
      )
    )
    await page.route('**/api/billing/preview-subscribe', (route) =>
      route.fulfill(jsonRoute(NEW_CREATOR_SUBSCRIPTION))
    )
    await page.route('**/api/billing/subscribe', (route) => {
      subscribeRequests.push(route.request())
      return route.fulfill({
        ...jsonRoute({
          code: 'unexpected_subscribe',
          message: 'Recovered checkouts must not auto-subscribe'
        } satisfies ErrorResponse),
        status: 500
      })
    })
    await page.route(`**/api/billing/ops/${RECOVERY_OPERATION_ID}`, (route) => {
      operationPollRequests.push(route.request())
      return route.fulfill(jsonRoute(FAILED_RECOVERY_OPERATION))
    })

    await page.goto(APP_URL)

    await cloudAppExpect(confirmPaymentHeading(page)).toBeVisible()
    const checkoutDialog = page.getByRole('dialog')
    await expect(
      checkoutDialog.getByRole('button', { name: 'Subscribe to Creator' })
    ).toBeVisible()
    await expect(
      checkoutDialog.getByText('$336 Billed yearly').filter({ visible: true })
    ).toBeVisible()
    expect(operationPollRequests.length).toBeGreaterThan(0)
    expect(subscribeRequests).toHaveLength(0)
    await expect.poll(() => readPendingCheckout(page)).toBeNull()
  })

  test('stays silent when reconciliation succeeds', async ({ page }) => {
    const operationPollRequests: Request[] = []
    await seedPendingCheckout(page, PENDING_CREATOR_CHECKOUT)
    await setupCloudApp(page)
    await page.route(`**/api/billing/ops/${RECOVERY_OPERATION_ID}`, (route) => {
      operationPollRequests.push(route.request())
      return route.fulfill(jsonRoute(SUCCEEDED_RECOVERY_OPERATION))
    })

    await page.goto(APP_URL)

    await waitForCloudApp(page)
    await cloudAppExpect
      .poll(() => operationPollRequests.length)
      .toBeGreaterThan(0)
    await expect.poll(() => readPendingCheckout(page)).toBeNull()
    await expect(confirmPaymentHeading(page)).toBeHidden()
    await expect(
      page.getByRole('heading', { name: 'Choose a Plan' })
    ).toBeHidden()
  })

  test('drops an entry for another user without reconciling', async ({
    page
  }) => {
    await seedPendingCheckout(page, {
      ...PENDING_CREATOR_CHECKOUT,
      ownerUid: 'someone-else'
    })
    await setupCloudApp(page)
    const operationPollRequests = trackBillingOpRequests(page)

    await page.goto(APP_URL)

    await waitForCloudApp(page)
    await cloudAppExpect.poll(() => readPendingCheckout(page)).toBeNull()
    expect(operationPollRequests).toHaveLength(0)
    await expect(confirmPaymentHeading(page)).toBeHidden()
    await expect(
      page.getByRole('heading', { name: 'Choose a Plan' })
    ).toBeHidden()
  })
})
