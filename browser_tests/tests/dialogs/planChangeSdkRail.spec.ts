import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import type {
  BillingOpStatusResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  Plan,
  PreviewSubscribeResponse,
  SubscribeResponse
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import {
  cloudAppExpect,
  cloudAppFixture as test
} from '@e2e/fixtures/cloudAppFixture'
import { createWorkspaceBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockWorkspace, workspace } from '@e2e/fixtures/utils/workspaceMocks'

/**
 * Changing plan across the billing SDK rail — FE-2216.
 *
 * Both rails quote through `POST /billing/preview-subscribe` and commit through
 * `POST /billing/subscribe`, so the recorded requests are what separate them:
 * only the SDK transport sends an `Idempotency-Key`, and only on the write —
 * the quote is a read the backend happens to shape as a POST, so it carries
 * none on either rail. What separates the two quotes is the transport that
 * issued them: the SDK runs on `fetch`, the workspace client on axios' XHR.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const BOOT_FEATURES = {
  billing_control_enabled: true,
  unified_cloud_auth: true
} satisfies RemoteConfig

const STANDARD_ANNUAL_PLAN = {
  slug: 'standard-annual',
  tier: 'STANDARD',
  duration: 'ANNUAL',
  price_cents: 19_200,
  credits_cents: 4_200,
  max_seats: 1,
  availability: { available: true },
  seat_summary: {
    seat_count: 1,
    total_cost_cents: 19_200,
    total_credits_cents: 4_200
  }
} satisfies Plan

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

const ACTIVE_STANDARD_STATUS = {
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
  occupied_seats: 1
} satisfies BillingStatusResponse

const PLANS = {
  current_plan_slug: 'standard-annual',
  plans: [STANDARD_ANNUAL_PLAN, CREATOR_ANNUAL_PLAN]
} satisfies BillingPlansResponse

const CREATOR_UPGRADE_QUOTE = {
  allowed: true,
  transition_type: 'upgrade',
  effective_at: '2026-09-16T00:00:00Z',
  is_immediate: true,
  cost_today_cents: 14_400,
  cost_next_period_cents: 33_600,
  credits_today_cents: 3_200,
  credits_next_period_cents: 7_400,
  current_plan: {
    slug: STANDARD_ANNUAL_PLAN.slug,
    tier: STANDARD_ANNUAL_PLAN.tier,
    duration: STANDARD_ANNUAL_PLAN.duration,
    price_cents: STANDARD_ANNUAL_PLAN.price_cents,
    credits_cents: STANDARD_ANNUAL_PLAN.credits_cents,
    seat_summary: STANDARD_ANNUAL_PLAN.seat_summary,
    period_end: '2099-02-20T00:00:00Z'
  },
  new_plan: {
    slug: CREATOR_ANNUAL_PLAN.slug,
    tier: CREATOR_ANNUAL_PLAN.tier,
    duration: CREATOR_ANNUAL_PLAN.duration,
    price_cents: CREATOR_ANNUAL_PLAN.price_cents,
    credits_cents: CREATOR_ANNUAL_PLAN.credits_cents,
    seat_summary: CREATOR_ANNUAL_PLAN.seat_summary
  }
} satisfies PreviewSubscribeResponse

const CHANGE_OPERATION_ID = 'op-plan-change'

const SUBSCRIBED_RESPONSE = {
  billing_op_id: CHANGE_OPERATION_ID,
  status: 'subscribed',
  effective_at: '2026-09-16T00:00:00Z'
} satisfies SubscribeResponse

const SETTLED_OPERATION = {
  id: CHANGE_OPERATION_ID,
  status: 'succeeded',
  started_at: '2026-09-16T00:00:00Z',
  completed_at: '2026-09-16T00:00:05Z'
} satisfies BillingOpStatusResponse

interface PlanChangeRoutes {
  /** Every POST the app made to the quote route, in order. */
  readonly previewRequests: Request[]
  /** Every POST the app made to the subscribe route, in order. */
  readonly subscribeRequests: Request[]
  /** Answers the next subscribe with a 404, as a closed backend gate does. */
  respondNotFound: () => void
}

// The deep-link loader runs at the tail of GraphCanvas onMounted, so the boot
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

async function setupPlanChange(page: Page): Promise<PlanChangeRoutes> {
  const ws = workspace('personal', 'owner')
  const previewRequests: Request[] = []
  const subscribeRequests: Request[] = []
  let notFound = false

  await mockCloudBoot(page, {
    features: BOOT_FEATURES,
    settings: { 'Comfy.TutorialCompleted': true }
  })
  await mockGraphBootExtras(page)
  await mockBilling(page, {
    workspaceId: ws.id,
    billingStatus: ACTIVE_STANDARD_STATUS,
    billingCapabilities: createWorkspaceBillingCapabilities(ws)
  })
  await mockWorkspace(page, ws, [])

  await page.route('**/api/billing/plans', (route) =>
    route.fulfill(jsonRoute(PLANS))
  )
  await page.route('**/api/billing/preview-subscribe', (route) => {
    previewRequests.push(route.request())
    return route.fulfill(jsonRoute(CREATOR_UPGRADE_QUOTE))
  })
  await page.route('**/api/billing/subscribe', async (route) => {
    subscribeRequests.push(route.request())
    if (notFound) {
      notFound = false
      await route.fulfill({ status: 404, body: '' })
      return
    }
    await route.fulfill(jsonRoute(SUBSCRIBED_RESPONSE))
  })
  // Only the SDK rail polls a `subscribed` response; the legacy path reports
  // success straight from the body.
  await page.route(`**/api/billing/ops/${CHANGE_OPERATION_ID}`, (route) =>
    route.fulfill(jsonRoute(SETTLED_OPERATION))
  )

  await bootCloud(page)
  return {
    previewRequests,
    subscribeRequests,
    respondNotFound: () => {
      notFound = true
    }
  }
}

/** The SDK transport sends this header; the legacy axios client never does. */
function idempotencyKey(request: Request): string | undefined {
  return request.headers()['idempotency-key']
}

/**
 * Which transport issued a request, and so which rail served it: the SDK's
 * runs on `fetch`, the legacy workspace client on axios' XHR adapter. The
 * quote carries no idempotency key on either rail, so this is what tells the
 * two quotes apart.
 */
function transport(request: Request): string {
  return request.resourceType()
}

/**
 * The `?pricing=` deep link quotes the plan as the dialog opens, from the same
 * `onMounted` that assigns `window.app`, so the rail has to be chosen before
 * the page loads rather than after it.
 */
async function enableSdkRail(page: Page) {
  await new FeatureFlagHelper(page).seedServerFlags({
    billing_sdk_subscription_enabled: true
  })
}

async function openCreatorUpgrade(page: Page) {
  await page.goto(`${APP_URL}/?pricing=creator&cycle=yearly`)
  await cloudAppExpect(
    page.getByRole('heading', { name: 'Confirm your upgrade' })
  ).toBeVisible()
}

const confirmButton = (page: Page) =>
  page.getByRole('button', { name: 'Confirm upgrade' })

const successHeading = (page: Page) =>
  page.getByRole('heading', { name: "You're all set" })

test.describe('Plan change rail (FE-2216)', { tag: '@cloud' }, () => {
  test('keeps the legacy calls while the SDK rail is off', async ({ page }) => {
    test.setTimeout(60_000)
    const routes = await setupPlanChange(page)

    await openCreatorUpgrade(page)
    await confirmButton(page).click()

    await expect(successHeading(page)).toBeVisible()
    expect(routes.subscribeRequests).toHaveLength(1)
    expect(idempotencyKey(routes.subscribeRequests[0])).toBeUndefined()
    expect(routes.previewRequests.length).toBeGreaterThan(0)
    expect(idempotencyKey(routes.previewRequests[0])).toBeUndefined()
    expect(transport(routes.previewRequests[0])).toBe('xhr')
    expect(transport(routes.subscribeRequests[0])).toBe('xhr')
  })

  test('issues through the SDK transport while the rail is on', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await setupPlanChange(page)
    await enableSdkRail(page)
    await openCreatorUpgrade(page)

    await confirmButton(page).click()

    await expect(successHeading(page)).toBeVisible()
    expect(routes.subscribeRequests).toHaveLength(1)
    const [issued] = routes.subscribeRequests
    expect(issued.method()).toBe('POST')
    expect(idempotencyKey(issued)).toBeTruthy()
    expect(issued.postDataJSON()).toMatchObject({
      plan_slug: 'creator-annual',
      idempotency_key: idempotencyKey(issued)
    })
    expect(transport(issued)).toBe('fetch')
    // The quote is a read the SDK sends no key for, so the transport is what
    // shows the rail served it.
    const quote = routes.previewRequests.at(-1)!
    expect(transport(quote)).toBe('fetch')
    expect(idempotencyKey(quote)).toBeUndefined()
  })

  test('falls back to the legacy call when the SDK route answers 404', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const routes = await setupPlanChange(page)
    await enableSdkRail(page)
    await openCreatorUpgrade(page)
    routes.respondNotFound()

    await confirmButton(page).click()

    await expect(successHeading(page)).toBeVisible()
    await expect.poll(() => routes.subscribeRequests.length).toBe(2)
    const [sdkAttempt, legacyAttempt] = routes.subscribeRequests
    expect(idempotencyKey(sdkAttempt)).toBeTruthy()
    expect(idempotencyKey(legacyAttempt)).toBeUndefined()
    expect(transport(sdkAttempt)).toBe('fetch')
    expect(transport(legacyAttempt)).toBe('xhr')
  })
})
