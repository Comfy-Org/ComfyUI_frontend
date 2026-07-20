import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import type {
  BillingPlansResponse,
  BillingStatusResponse,
  Plan,
  PreviewSubscribeResponse,
  SubscribeResponse
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type {
  Member,
  WorkspaceWithRole
} from '@/platform/workspace/api/workspaceApi'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import {
  member,
  mockWorkspace,
  workspace
} from '@e2e/fixtures/utils/workspaceMocks'

/**
 * The `?pricing=` deep link opens the pricing table on app load, gated to the
 * original owner (canManageSubscriptionLifecycle). Drives a raw `page` so the
 * cloud app boots against fully mocked endpoints, like the survey-gate spec.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

// CloudAuthHelper.mockAuth() signs in as this email; the original-owner gate
// matches it against the members self-row.
const SELF_EMAIL = 'e2e@test.comfy.org'

// consolidated_billing_enabled routes personal workspaces to the unified
// pricing table asserted here; without it they fall back to the legacy table.
const BOOT_FEATURES = {
  team_workspaces_enabled: true,
  consolidated_billing_enabled: true,
  billing_control_enabled: true
} satisfies RemoteConfig
// Disable the experimental Asset API: with it on (cloud default) the unmocked
// asset endpoints 403 and workflow restore throws uncaught, aborting the
// GraphCanvas onMounted chain before the deep-link loader.
const BOOT_SETTINGS = { 'Comfy.Assets.UseAssetAPI': false }

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

const ACTIVE_TEAM_STATUS = {
  is_active: true,
  subscription_status: 'active',
  subscription_tier: 'TEAM',
  subscription_duration: 'ANNUAL',
  plan_slug: 'team_per_credit_annual',
  billing_status: 'paid',
  has_funds: true,
  renewal_date: '2099-02-20T00:00:00Z',
  team_credit_stop: {
    id: 'team_700',
    credits_monthly: 147_700,
    stop_usd: 700
  }
} satisfies BillingStatusResponse

const TEAM_WITH_CREATOR_PLANS = {
  current_plan_slug: 'team_per_credit_annual',
  plans: [CREATOR_ANNUAL_PLAN]
} satisfies BillingPlansResponse

const SCHEDULED_CREATOR_DOWNGRADE = {
  allowed: true,
  transition_type: 'downgrade',
  effective_at: '2099-02-20T00:00:00Z',
  is_immediate: false,
  cost_today_cents: 0,
  cost_next_period_cents: 33_600,
  credits_today_cents: 0,
  credits_next_period_cents: 7_400,
  new_plan: {
    ...CREATOR_ANNUAL_PLAN,
    seat_summary: CREATOR_ANNUAL_PLAN.seat_summary
  }
} satisfies PreviewSubscribeResponse

const SUBSCRIBED_RESPONSE = {
  billing_op_id: 'existing-creator-downgrade',
  status: 'subscribed',
  effective_at: '2099-02-20T00:00:00Z'
} satisfies SubscribeResponse

// The deep-link loader runs at the tail of GraphCanvas onMounted, so the boot
// chain must not throw before it: a missing settings subpath, prompt exec_info,
// or queue status each abort that chain.
async function mockGraphBootExtras(page: Page) {
  // Boot only reads these; fall back on any write so an unexpected POST/PUT
  // surfaces instead of being masked by a blanket 200.
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

async function setupCloudApp(
  page: Page,
  ws: WorkspaceWithRole,
  members: Member[]
) {
  await mockCloudBoot(page, {
    features: BOOT_FEATURES,
    settings: BOOT_SETTINGS
  })
  await mockGraphBootExtras(page)
  await mockBilling(page)
  await mockWorkspace(page, ws, members)
  await bootCloud(page)
}

async function mockScheduledCreatorDowngrade(page: Page) {
  const subscribeRequests: Request[] = []

  await page.route('**/api/billing/status', (route) =>
    route.fulfill(jsonRoute(ACTIVE_TEAM_STATUS))
  )
  await page.route('**/api/billing/plans', (route) =>
    route.fulfill(jsonRoute(TEAM_WITH_CREATOR_PLANS))
  )
  await page.route('**/api/billing/preview-subscribe', (route) =>
    route.fulfill(jsonRoute(SCHEDULED_CREATOR_DOWNGRADE))
  )
  await page.route('**/api/billing/subscribe', (route) => {
    subscribeRequests.push(route.request())
    return route.fulfill(jsonRoute(SUBSCRIBED_RESPONSE))
  })

  return subscribeRequests
}

const pricingHeading = (page: Page) =>
  page.getByRole('heading', { name: 'Choose a Plan' })

test.describe('Pricing table deep link', { tag: '@cloud' }, () => {
  test('opens the pricing table for a personal owner', async ({ page }) => {
    test.slow()
    await setupCloudApp(page, workspace('personal', 'owner'), [])

    await page.goto(`${APP_URL}/?pricing=1`)

    await expect(pricingHeading(page)).toBeVisible({ timeout: 45_000 })
    await expect(page).not.toHaveURL(/[?&]pricing=/)
  })

  test('opens on the Team tab for ?pricing=team', async ({ page }) => {
    test.slow()
    await setupCloudApp(page, workspace('personal', 'owner'), [])

    await page.goto(`${APP_URL}/?pricing=team`)

    await expect(pricingHeading(page)).toBeVisible({ timeout: 45_000 })
    await expect(
      page.getByRole('button', { name: 'For Teams' })
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('opens for a team original owner', async ({ page }) => {
    test.slow()
    await setupCloudApp(page, workspace('team', 'owner'), [
      member({ email: SELF_EMAIL, role: 'owner', is_original_owner: true })
    ])

    await page.goto(`${APP_URL}/?pricing=1`)

    await expect(pricingHeading(page)).toBeVisible({ timeout: 45_000 })
  })

  test('is a silent no-op for a team member', async ({ page }) => {
    test.slow()
    await setupCloudApp(page, workspace('team', 'member'), [
      member({
        email: 'creator@test.comfy.org',
        role: 'owner',
        is_original_owner: true
      }),
      member({ email: SELF_EMAIL, role: 'member' })
    ])

    await page.goto(`${APP_URL}/?pricing=1`)

    await page.waitForFunction(() => !!window.app?.extensionManager, null, {
      timeout: 45_000
    })
    await expect(page).not.toHaveURL(/[?&]pricing=/)
    await expect(pricingHeading(page)).toBeHidden()
  })
})

test.describe('Scheduled Team downgrade', { tag: '@cloud' }, () => {
  let subscribeRequests: Request[]

  test.beforeEach(async ({ page }) => {
    await setupCloudApp(page, workspace('team', 'owner'), [
      member({ email: SELF_EMAIL, role: 'owner', is_original_owner: true })
    ])
    subscribeRequests = await mockScheduledCreatorDowngrade(page)
  })

  test('shows the existing success view when subscribe replays 200', async ({
    page
  }) => {
    test.slow()
    await page.goto(`${APP_URL}/?pricing=personal`)

    const changePlan = page.getByRole('button', {
      name: 'Change to Creator Yearly'
    })
    await expect(changePlan).toBeVisible({ timeout: 45_000 })

    const subscribeResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/billing/subscribe') &&
        response.request().method() === 'POST'
    )
    await changePlan.click()

    expect((await subscribeResponse).status()).toBe(200)
    expect(subscribeRequests).toHaveLength(1)
    expect(subscribeRequests[0].postDataJSON()).toMatchObject({
      plan_slug: 'creator-annual'
    })

    const successHeading = page.getByRole('heading', {
      name: "You're all set"
    })
    await expect(successHeading).toBeVisible()
    const successView = successHeading.locator('..').locator('..')
    await expect(
      successView.getByText('Your plan has been successfully updated.', {
        exact: false
      })
    ).toBeVisible()
    await expect(
      successView.getByText('Creator', { exact: true })
    ).toBeVisible()
    await expect(successView.getByText('$28', { exact: true })).toBeVisible()
    await expect(
      successView.getByText('7,400 / month', { exact: true })
    ).toBeVisible()
    await expect(
      successView.getByRole('button', { name: 'Close' })
    ).toBeVisible()
    await expect(changePlan).toBeHidden()
  })
})
