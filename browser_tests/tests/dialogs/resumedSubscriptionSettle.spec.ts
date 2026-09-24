import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import type {
  BillingOpStatusResponse,
  BillingStatusResponse,
  Plan,
  PreviewSubscribeResponse,
  SavedPaymentMethod
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { cloudAppFixture as test } from '@e2e/fixtures/cloudAppFixture'
import { createWorkspaceBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { member, workspace } from '@e2e/fixtures/utils/workspaceMocks'

/**
 * A subscription operation this tab reattached to after a reload has no
 * checkout left to report it. Both rails must settle a subscribe the same
 * way: re-read the billing status and toast.
 *
 * The transport tells the rails apart: the SDK runs on `fetch`, the legacy
 * workspace client on axios' XHR adapter.
 */
type Rail = 'sdk' | 'legacy'

const RAIL_FEATURES: Record<Rail, RemoteConfig> = {
  sdk: {
    billing_control_enabled: true,
    unified_cloud_auth: true,
    billing_sdk_subscription_enabled: true
  },
  legacy: {
    billing_control_enabled: true,
    unified_cloud_auth: true
  }
}

const RAIL_TRANSPORT: Record<Rail, string> = { sdk: 'fetch', legacy: 'xhr' }

const OPERATION_ID = 'op-e2e-resumed-subscription'
const HOSTED_URL = 'https://pay.stripe.example/invoice/op-e2e-resumed'
const STARTED_AT = '2026-09-20T00:00:00Z'

const AWAITING_VERIFICATION = {
  id: OPERATION_ID,
  started_at: STARTED_AT,
  status: 'pending',
  phase: 'awaiting_invoice_payment',
  authentication_state: 'requires_action',
  action_url: HOSTED_URL
} satisfies BillingOpStatusResponse

/** The bank accepted the challenge; the provider has not settled yet. */
const VERIFIED_PROCESSING = {
  id: OPERATION_ID,
  started_at: STARTED_AT,
  status: 'pending',
  phase: 'in_progress',
  authentication_state: 'processing'
} satisfies BillingOpStatusResponse

const SUCCEEDED = {
  id: OPERATION_ID,
  started_at: STARTED_AT,
  status: 'succeeded',
  completed_at: '2026-09-20T00:01:00Z'
} satisfies BillingOpStatusResponse

const CREATOR_ANNUAL_PLAN = {
  slug: 'creator-annual',
  tier: 'CREATOR',
  duration: 'ANNUAL',
  price_cents: 33_600,
  credits_cents: 7_400,
  max_seats: 1,
  availability: { available: true },
  seat_summary: {
    seat_count: 1,
    total_cost_cents: 33_600,
    total_credits_cents: 7_400
  }
} satisfies Plan

const UPGRADE_TO_CREATOR = {
  allowed: true,
  transition_type: 'upgrade',
  effective_at: '2026-09-21T00:00:00Z',
  is_immediate: true,
  cost_today_cents: 33_600,
  cost_next_period_cents: 33_600,
  credits_today_cents: 7_400,
  credits_next_period_cents: 7_400,
  new_plan: CREATOR_ANNUAL_PLAN
} satisfies PreviewSubscribeResponse

const ACTIVE_STANDARD = {
  is_active: true,
  has_funds: true,
  subscription_status: 'active',
  subscription_tier: 'STANDARD',
  subscription_duration: 'ANNUAL',
  plan_slug: 'standard-annual',
  billing_status: 'paid',
  renewal_date: '2099-02-20T00:00:00Z',
  max_seats: 1,
  occupied_seats: 1,
  team_credit_stop: null,
  scheduled_change: null
} satisfies BillingStatusResponse

const SAVED_CARD = {
  id: 'pm-1',
  type: 'card',
  brand: 'visa',
  last4: '4242',
  is_default: true
} satisfies SavedPaymentMethod

interface ResumeRoutes {
  readonly subscribeRequests: Request[]
  readonly statusRequests: Request[]
  readonly pollRequests: Request[]
  setOperation: (next: BillingOpStatusResponse) => void
  hostedOpens: () => Promise<string[]>
}

async function setupResume(page: Page, rail: Rail): Promise<ResumeRoutes> {
  const ws = workspace('personal', 'owner')
  const subscribeRequests: Request[] = []
  const statusRequests: Request[] = []
  const pollRequests: Request[] = []
  let current: BillingOpStatusResponse = AWAITING_VERIFICATION
  let subscribeOpen = false

  // Recorded rather than loaded: network isolation blocks the provider origin.
  await page.addInitScript(() => {
    const opened: string[] = []
    Object.defineProperty(window, '__hostedOpens', { get: () => opened })
    window.open = (url?: string | URL) => {
      opened.push(String(url))
      return window
    }
  })
  await setupCloudApp(page, {
    workspace: ws,
    members: [
      member({
        email: CLOUD_SELF_EMAIL,
        role: 'owner',
        is_original_owner: true
      })
    ],
    features: RAIL_FEATURES[rail],
    billingCapabilities: createWorkspaceBillingCapabilities(ws)
  })
  await page.route('**/api/settings', (route) =>
    route.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
  )
  if (rail === 'sdk') {
    await new FeatureFlagHelper(page).serveServerFlagsOnHandshake({
      billing_sdk_subscription_enabled: true
    })
  }

  await page.route('**/api/billing/payment-methods', (route) =>
    route.fulfill(jsonRoute([SAVED_CARD]))
  )
  await page.route('**/api/billing/plans', (route) =>
    route.fulfill(
      jsonRoute({
        current_plan_slug: 'standard-annual',
        plans: [CREATOR_ANNUAL_PLAN]
      })
    )
  )
  await page.route('**/api/billing/preview-subscribe', (route) =>
    route.fulfill(jsonRoute(UPGRADE_TO_CREATOR))
  )
  await page.route('**/api/billing/status', (route) => {
    statusRequests.push(route.request())
    return route.fulfill(
      jsonRoute(
        subscribeOpen && current.status === 'pending'
          ? {
              ...ACTIVE_STANDARD,
              pending_billing_op_id: OPERATION_ID,
              pending_billing_op_type: 'subscription'
            }
          : ACTIVE_STANDARD
      )
    )
  })
  await page.route('**/api/billing/subscribe', (route) => {
    subscribeRequests.push(route.request())
    subscribeOpen = true
    return route.fulfill(
      jsonRoute({
        billing_op_id: OPERATION_ID,
        status: 'needs_payment_method',
        payment_method_url: HOSTED_URL
      })
    )
  })
  await page.route(`**/api/billing/ops/${OPERATION_ID}`, (route) => {
    pollRequests.push(route.request())
    return route.fulfill(jsonRoute(current))
  })

  return {
    subscribeRequests,
    statusRequests,
    pollRequests,
    setOperation: (next) => {
      current = next
    },
    hostedOpens: () =>
      page.evaluate(() => [
        ...((window as Window & { __hostedOpens?: string[] }).__hostedOpens ??
          [])
      ])
  }
}

/** A customer coming back to this tab: every pending operation is polled now. */
async function returnToTab(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
}

function transports(requests: Request[]): string[] {
  return requests.map((request) => request.resourceType())
}

async function reloadWhileProcessing(page: Page, routes: ResumeRoutes) {
  const pollsBeforeReload = routes.pollRequests.length
  await page.reload()
  await expect
    .poll(() => routes.pollRequests.length, { timeout: 45_000 })
    .toBeGreaterThan(pollsBeforeReload)
}

async function expectResumedSubscribeSettles(page: Page, rail: Rail) {
  const routes = await setupResume(page, rail)
  await page.goto(`${APP_URL}/?pricing=creator&cycle=yearly`)
  await expect(
    page.getByRole('heading', { name: 'Confirm your upgrade' })
  ).toBeVisible({ timeout: 45_000 })
  await page.getByRole('button', { name: 'Confirm upgrade' }).click()
  await expect.poll(() => routes.hostedOpens()).toEqual([HOSTED_URL])

  routes.setOperation(VERIFIED_PROCESSING)
  await reloadWhileProcessing(page, routes)

  const statusReadsBeforeSettle = routes.statusRequests.length
  routes.setOperation(SUCCEEDED)
  await returnToTab(page)

  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Subscription updated successfully' })
  ).toBeVisible({ timeout: 45_000 })
  const statusReadsAfterSettle = routes.statusRequests.slice(
    statusReadsBeforeSettle
  )
  expect(statusReadsAfterSettle.length).toBeGreaterThan(0)
  expect(new Set(transports(statusReadsAfterSettle))).toEqual(
    new Set([RAIL_TRANSPORT[rail]])
  )
  expect(new Set(transports(routes.pollRequests))).toEqual(
    new Set([RAIL_TRANSPORT[rail]])
  )
  expect(routes.subscribeRequests).toHaveLength(1)
}

test.describe('Resumed subscription settle', { tag: '@cloud' }, () => {
  test('reports a subscribe that settles after a reload on the SDK rail', async ({
    page
  }) => {
    test.setTimeout(120_000)
    await expectResumedSubscribeSettles(page, 'sdk')
  })

  test('reports a subscribe that settles after a reload on the legacy rail', async ({
    page
  }) => {
    test.setTimeout(120_000)
    await expectResumedSubscribeSettles(page, 'legacy')
  })
})
