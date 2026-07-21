import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import type {
  BillingBalanceResponse,
  BillingOpStatusResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  ErrorResponse,
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
const BOOT_SETTINGS = {
  'Comfy.Assets.UseAssetAPI': false,
  'Comfy.TutorialCompleted': true
}

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

const ACTIVE_STANDARD_STATUS = {
  is_active: true,
  subscription_status: 'active',
  subscription_tier: 'STANDARD',
  subscription_duration: 'ANNUAL',
  plan_slug: 'standard-annual',
  billing_status: 'paid',
  has_funds: true,
  renewal_date: '2099-02-20T00:00:00Z',
  team_credit_stop: null
} satisfies BillingStatusResponse

const ACTIVE_CREATOR_STATUS = {
  ...ACTIVE_STANDARD_STATUS,
  subscription_tier: 'CREATOR',
  plan_slug: 'creator-annual'
} satisfies BillingStatusResponse

const BILLING_BALANCE = {
  amount_micros: 0,
  currency: 'USD'
} satisfies BillingBalanceResponse

const TEAM_WITH_CREATOR_PLANS = {
  current_plan_slug: 'team_per_credit_annual',
  plans: [CREATOR_ANNUAL_PLAN]
} satisfies BillingPlansResponse

const STANDARD_WITH_CREATOR_PLANS = {
  current_plan_slug: 'standard-annual',
  plans: [STANDARD_ANNUAL_PLAN, CREATOR_ANNUAL_PLAN]
} satisfies BillingPlansResponse

const CREATOR_WITH_CREATOR_PLANS = {
  ...STANDARD_WITH_CREATOR_PLANS,
  current_plan_slug: 'creator-annual'
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

const IMMEDIATE_CREATOR_UPGRADE = {
  allowed: true,
  transition_type: 'upgrade',
  effective_at: '2026-07-20T00:00:00Z',
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
    period_end: '2026-07-20T00:00:00Z'
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

const IMMEDIATE_SUBSCRIBED_RESPONSE = {
  billing_op_id: 'creator-upgrade',
  status: 'subscribed',
  effective_at: '2026-07-20T00:00:00Z'
} satisfies SubscribeResponse

const PAYMENT_METHOD_REQUIRED_RESPONSE = {
  billing_op_id: 'creator-downgrade-payment-method',
  status: 'needs_payment_method',
  payment_method_url: 'https://pay.test/method'
} satisfies SubscribeResponse

const UNEXPECTED_OPERATION_RESPONSE = {
  id: PAYMENT_METHOD_REQUIRED_RESPONSE.billing_op_id,
  status: 'failed',
  error_message: 'Payment page was not opened',
  started_at: '2026-07-20T00:00:00Z',
  completed_at: '2026-07-20T00:00:01Z'
} satisfies BillingOpStatusResponse

const TRANSIENT_STATUS_ERROR = {
  code: 'billing_status_unavailable',
  message: 'Billing status is temporarily unavailable'
} satisfies ErrorResponse

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
  const statusRefreshRequests: Request[] = []
  const balanceRefreshRequests: Request[] = []
  let subscribeCompleted = false
  let releasePostSubscribeRefresh = () => {}
  const postSubscribeRefreshGate = new Promise<void>((resolve) => {
    releasePostSubscribeRefresh = resolve
  })

  await page.route('**/api/billing/status', async (route) => {
    if (subscribeCompleted) {
      statusRefreshRequests.push(route.request())
      await postSubscribeRefreshGate
    }
    return route.fulfill(jsonRoute(ACTIVE_TEAM_STATUS))
  })
  await page.route('**/api/billing/balance', async (route) => {
    if (subscribeCompleted) {
      balanceRefreshRequests.push(route.request())
      await postSubscribeRefreshGate
    }
    return route.fulfill(jsonRoute(BILLING_BALANCE))
  })
  await page.route('**/api/billing/plans', (route) =>
    route.fulfill(jsonRoute(TEAM_WITH_CREATOR_PLANS))
  )
  await page.route('**/api/billing/preview-subscribe', (route) =>
    route.fulfill(jsonRoute(SCHEDULED_CREATOR_DOWNGRADE))
  )
  await page.route('**/api/billing/subscribe', (route) => {
    subscribeRequests.push(route.request())
    subscribeCompleted = true
    return route.fulfill(jsonRoute(SUBSCRIBED_RESPONSE))
  })

  return {
    subscribeRequests,
    statusRefreshRequests,
    balanceRefreshRequests,
    releasePostSubscribeRefresh
  }
}

async function mockImmediateCreatorUpgradeWithTransientStatusFailure(
  page: Page
) {
  const subscribeRequests: Request[] = []
  const statusRefreshRequests: Request[] = []
  let subscribeCompleted = false

  await page.route('**/api/billing/status', (route) => {
    if (!subscribeCompleted) {
      return route.fulfill(jsonRoute(ACTIVE_STANDARD_STATUS))
    }

    statusRefreshRequests.push(route.request())
    if (statusRefreshRequests.length === 1) {
      return route.fulfill({
        ...jsonRoute(TRANSIENT_STATUS_ERROR),
        status: 500
      })
    }
    return route.fulfill(jsonRoute(ACTIVE_CREATOR_STATUS))
  })
  await page.route('**/api/billing/balance', (route) =>
    route.fulfill(jsonRoute(BILLING_BALANCE))
  )
  await page.route('**/api/billing/plans', (route) =>
    route.fulfill(
      jsonRoute(
        subscribeCompleted
          ? CREATOR_WITH_CREATOR_PLANS
          : STANDARD_WITH_CREATOR_PLANS
      )
    )
  )
  await page.route('**/api/billing/preview-subscribe', (route) =>
    route.fulfill(jsonRoute(IMMEDIATE_CREATOR_UPGRADE))
  )
  await page.route('**/api/billing/subscribe', (route) => {
    subscribeRequests.push(route.request())
    subscribeCompleted = true
    return route.fulfill(jsonRoute(IMMEDIATE_SUBSCRIBED_RESPONSE))
  })

  return { subscribeRequests, statusRefreshRequests }
}

async function mockPopupBlockedCreatorDowngrade(page: Page) {
  const subscribeRequests: Request[] = []
  const statusRefreshRequests: Request[] = []
  const balanceRefreshRequests: Request[] = []
  const operationPollRequests: Request[] = []
  let subscribeCompleted = false

  await page.route('**/api/billing/status', (route) => {
    if (subscribeCompleted) statusRefreshRequests.push(route.request())
    return route.fulfill(jsonRoute(ACTIVE_TEAM_STATUS))
  })
  await page.route('**/api/billing/balance', (route) => {
    if (subscribeCompleted) balanceRefreshRequests.push(route.request())
    return route.fulfill(jsonRoute(BILLING_BALANCE))
  })
  await page.route('**/api/billing/plans', (route) =>
    route.fulfill(jsonRoute(TEAM_WITH_CREATOR_PLANS))
  )
  await page.route('**/api/billing/preview-subscribe', (route) =>
    route.fulfill(jsonRoute(SCHEDULED_CREATOR_DOWNGRADE))
  )
  await page.route('**/api/billing/subscribe', (route) => {
    subscribeRequests.push(route.request())
    subscribeCompleted = true
    return route.fulfill(jsonRoute(PAYMENT_METHOD_REQUIRED_RESPONSE))
  })
  await page.route(
    `**/api/billing/ops/${PAYMENT_METHOD_REQUIRED_RESPONSE.billing_op_id}`,
    (route) => {
      operationPollRequests.push(route.request())
      return route.fulfill(jsonRoute(UNEXPECTED_OPERATION_RESPONSE))
    }
  )

  return {
    subscribeRequests,
    statusRefreshRequests,
    balanceRefreshRequests,
    operationPollRequests
  }
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
  let statusRefreshRequests: Request[]
  let balanceRefreshRequests: Request[]
  let releasePostSubscribeRefresh: () => void

  test.beforeEach(async ({ page }) => {
    await setupCloudApp(page, workspace('team', 'owner'), [
      member({ email: SELF_EMAIL, role: 'owner', is_original_owner: true })
    ])
    const downgradeMock = await mockScheduledCreatorDowngrade(page)
    subscribeRequests = downgradeMock.subscribeRequests
    statusRefreshRequests = downgradeMock.statusRefreshRequests
    balanceRefreshRequests = downgradeMock.balanceRefreshRequests
    releasePostSubscribeRefresh = downgradeMock.releasePostSubscribeRefresh
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

    try {
      const successHeading = page.getByRole('heading', {
        name: "You're all set"
      })
      await expect(successHeading).toBeVisible()
      await expect.poll(() => statusRefreshRequests.length).toBe(1)
      await expect.poll(() => balanceRefreshRequests.length).toBe(1)
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
    } finally {
      releasePostSubscribeRefresh()
    }
  })
})

test.describe(
  'Billing reconciliation after plan changes',
  { tag: '@cloud' },
  () => {
    test.describe('after a transient status failure', () => {
      let subscribeRequests: Request[]
      let statusRefreshRequests: Request[]

      test.beforeEach(async ({ page }) => {
        await setupCloudApp(page, workspace('personal', 'owner'), [])
        const upgradeMock =
          await mockImmediateCreatorUpgradeWithTransientStatusFailure(page)
        subscribeRequests = upgradeMock.subscribeRequests
        statusRefreshRequests = upgradeMock.statusRefreshRequests
      })

      test('keeps the success view while status retries, then reopens with the reconciled plan', async ({
        page
      }) => {
        test.slow()
        await page.goto(`${APP_URL}/?pricing=personal`)

        const changePlan = page.getByRole('button', {
          name: 'Change to Creator Yearly'
        })
        await expect(changePlan).toBeVisible({ timeout: 45_000 })
        await changePlan.click()

        await expect(
          page.getByRole('heading', { name: 'Confirm your upgrade' })
        ).toBeVisible()
        const subscribeResponse = page.waitForResponse(
          (response) =>
            response.url().endsWith('/api/billing/subscribe') &&
            response.request().method() === 'POST'
        )
        await page.getByRole('button', { name: 'Confirm upgrade' }).click()

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
        await expect.poll(() => statusRefreshRequests.length).toBe(2)
        await expect(successHeading).toBeVisible()

        await successView.getByRole('button', { name: 'Close' }).click()
        await page.getByRole('button', { name: 'Current user' }).click()
        await page.getByTestId('plans-pricing-menu-item').click()

        await expect(pricingHeading(page)).toBeVisible()
        await expect(
          page.getByRole('button', { name: 'For Personal' })
        ).toHaveAttribute('aria-pressed', 'true')
        await expect(
          page.getByRole('button', { name: 'Current Plan', exact: true })
        ).toBeDisabled()
        await expect(changePlan).toBeHidden()
      })
    })

    test.describe('when the payment popup is blocked', () => {
      let subscribeRequests: Request[]
      let statusRefreshRequests: Request[]
      let balanceRefreshRequests: Request[]
      let operationPollRequests: Request[]

      test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
          window.open = () => null
        })
        await setupCloudApp(page, workspace('team', 'owner'), [
          member({ email: SELF_EMAIL, role: 'owner', is_original_owner: true })
        ])
        const downgradeMock = await mockPopupBlockedCreatorDowngrade(page)
        subscribeRequests = downgradeMock.subscribeRequests
        statusRefreshRequests = downgradeMock.statusRefreshRequests
        balanceRefreshRequests = downgradeMock.balanceRefreshRequests
        operationPollRequests = downgradeMock.operationPollRequests
      })

      test('reconciles status and balance without polling', async ({
        page
      }) => {
        test.slow()
        await page.goto(`${APP_URL}/?pricing=personal`)

        const subscribeResponse = page.waitForResponse(
          (response) =>
            response.url().endsWith('/api/billing/subscribe') &&
            response.request().method() === 'POST'
        )
        await page
          .getByRole('button', { name: 'Change to Creator Yearly' })
          .click()

        expect((await subscribeResponse).status()).toBe(200)
        expect(subscribeRequests).toHaveLength(1)

        const blockedPopupToast = page
          .locator('.p-toast-message.p-toast-message-error')
          .filter({ hasText: 'Failed to change plan' })
        await expect(blockedPopupToast).toContainText(
          "Couldn't open the payment page — please try again"
        )
        await expect
          .poll(() => ({
            status: statusRefreshRequests.length,
            balance: balanceRefreshRequests.length,
            operationPolls: operationPollRequests.length
          }))
          .toEqual({ status: 1, balance: 1, operationPolls: 0 })
      })
    })
  }
)
