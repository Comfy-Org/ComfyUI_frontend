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
  SubscribeResponse,
  TeamCreditStops
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type {
  Member,
  WorkspaceWithRole
} from '@/platform/workspace/api/workspaceApi'

import {
  cloudAppExpect,
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
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
 * billing-management capability. Drives a raw `page` so the
 * cloud app boots against fully mocked endpoints, like the survey-gate spec.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

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

const TEAM_CREDIT_STOPS = {
  default_stop_index: 2,
  stops: [
    {
      id: 'team_200',
      credits: 42_200,
      monthly: { list_price_cents: 20_000, price_cents: 20_000 },
      yearly: { list_price_cents: 20_000, price_cents: 20_000 }
    },
    {
      id: 'team_400',
      credits: 84_400,
      monthly: { list_price_cents: 40_000, price_cents: 39_000 },
      yearly: { list_price_cents: 40_000, price_cents: 38_000 }
    },
    {
      id: 'team_700',
      credits: 147_700,
      monthly: { list_price_cents: 70_000, price_cents: 66_500 },
      yearly: { list_price_cents: 70_000, price_cents: 63_000 }
    },
    {
      id: 'team_1400',
      credits: 295_400,
      monthly: { list_price_cents: 140_000, price_cents: 129_500 },
      yearly: { list_price_cents: 140_000, price_cents: 119_000 }
    },
    {
      id: 'team_2500',
      credits: 527_500,
      monthly: { list_price_cents: 250_000, price_cents: 225_000 },
      yearly: { list_price_cents: 250_000, price_cents: 200_000 }
    }
  ]
} satisfies TeamCreditStops

const TEAM_CATALOG_PLANS = {
  plans: [],
  team_credit_stops: TEAM_CREDIT_STOPS
} satisfies BillingPlansResponse

const TEAM_SUBSCRIBED_RESPONSE = {
  billing_op_id: 'team-deep-link',
  status: 'subscribed',
  effective_at: '2026-07-21T00:00:00Z'
} satisfies SubscribeResponse

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
    await setupCloudApp(page, workspace('personal', 'owner'), [])

    await page.goto(`${APP_URL}/?pricing=1`)

    await cloudAppExpect(pricingHeading(page)).toBeVisible()
    await expect(page).not.toHaveURL(/[?&]pricing=/)
  })

  test('opens on the Team tab for ?pricing=team', async ({ page }) => {
    await setupCloudApp(page, workspace('personal', 'owner'), [])

    await page.goto(`${APP_URL}/?pricing=team`)

    await cloudAppExpect(pricingHeading(page)).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'For Teams' })
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('opens for a team original owner', async ({ page }) => {
    await setupCloudApp(page, workspace('team', 'owner'), [
      member({ email: SELF_EMAIL, role: 'owner', is_original_owner: true })
    ])

    await page.goto(`${APP_URL}/?pricing=1`)

    await cloudAppExpect(pricingHeading(page)).toBeVisible()
  })

  test('is a silent no-op for a team member', async ({ page }) => {
    await setupCloudApp(page, workspace('team', 'member'), [
      member({
        email: 'creator@test.comfy.org',
        role: 'owner',
        is_original_owner: true
      }),
      member({ email: SELF_EMAIL, role: 'member' })
    ])

    await page.goto(`${APP_URL}/?pricing=1`)

    await waitForCloudApp(page)
    await expect(page).not.toHaveURL(/[?&]pricing=/)
    await expect(pricingHeading(page)).toBeHidden()
  })

  test('opens a selected personal plan for an owner without subscribing', async ({
    page
  }) => {
    const subscribeRequests: Request[] = []
    await setupCloudApp(page, workspace('personal', 'owner'), [])
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
      return route.fulfill(jsonRoute(IMMEDIATE_SUBSCRIBED_RESPONSE))
    })

    await page.goto(`${APP_URL}/?pricing=creator&cycle=yearly`)

    await cloudAppExpect(
      page.getByRole('heading', { name: 'Confirm your payment' })
    ).toBeVisible()
    expect(subscribeRequests).toHaveLength(0)
    await expect(page).not.toHaveURL(/[?&](pricing|cycle)=/)
  })

  test('cleans orphaned pricing params without opening the table', async ({
    page
  }) => {
    await setupCloudApp(page, workspace('personal', 'owner'), [])

    await page.goto(`${APP_URL}/?keep=1&stop=team_700&cycle=yearly`)

    await waitForCloudApp(page)
    await expect(page).toHaveURL(/[?&]keep=1(?:&|$)/)
    await expect(page).not.toHaveURL(/[?&](pricing|stop|cycle)=/)
    await expect(pricingHeading(page)).toBeHidden()
  })

  test('denies a selected personal plan for a member', async ({ page }) => {
    await setupCloudApp(page, workspace('team', 'member'), [
      member({
        email: 'creator@test.comfy.org',
        role: 'owner',
        is_original_owner: true
      }),
      member({ email: SELF_EMAIL, role: 'member' })
    ])

    await page.goto(`${APP_URL}/?keep=1&pricing=creator&cycle=yearly`)

    await waitForCloudApp(page)
    await expect(page).toHaveURL(/[?&]keep=1(?:&|$)/)
    await expect(page).not.toHaveURL(/[?&](pricing|cycle)=/)
    await expect(
      page.getByRole('heading', { name: 'Confirm your payment' })
    ).toBeHidden()
  })

  test('opens a catalog-resolved Team stop and only subscribes after confirm', async ({
    page
  }) => {
    const subscribeRequests: Request[] = []
    await setupCloudApp(page, workspace('team', 'owner'), [
      member({ email: SELF_EMAIL, role: 'owner', is_original_owner: true })
    ])
    await page.route('**/api/billing/plans', (route) =>
      route.fulfill(jsonRoute(TEAM_CATALOG_PLANS))
    )
    await page.route('**/api/billing/subscribe', (route) => {
      subscribeRequests.push(route.request())
      return route.fulfill(jsonRoute(TEAM_SUBSCRIBED_RESPONSE))
    })

    await page.goto(
      `${APP_URL}/?keep=1&pricing=team&stop=team_700&cycle=yearly`
    )

    await cloudAppExpect(
      page.getByRole('heading', { name: 'Confirm your payment' })
    ).toBeVisible()
    const confirmationDialog = page.getByRole('dialog')
    await expect(
      confirmationDialog.getByText('$630', { exact: true }).last()
    ).toBeVisible()
    await expect(
      confirmationDialog.getByText('1,772,400', { exact: true })
    ).toBeVisible()
    expect(subscribeRequests).toHaveLength(0)
    await expect(page).toHaveURL(/[?&]keep=1(?:&|$)/)
    await expect(page).not.toHaveURL(/[?&](pricing|stop|cycle)=/)

    await page.getByRole('button', { name: 'Subscribe to Team Plan' }).click()

    await expect.poll(() => subscribeRequests.length).toBe(1)
    expect(subscribeRequests[0].postDataJSON()).toMatchObject({
      plan_slug: 'team_per_credit_annual',
      team_credit_stop_id: 'team_700',
      billing_cycle: 'yearly'
    })
  })

  test('allows a promoted owner to open selected Team confirmation', async ({
    page
  }) => {
    await setupCloudApp(page, workspace('team', 'owner'), [
      member({
        email: 'creator@test.comfy.org',
        role: 'owner',
        is_original_owner: true
      }),
      member({ email: SELF_EMAIL, role: 'owner', is_original_owner: false })
    ])
    await page.route('**/api/billing/plans', (route) =>
      route.fulfill(jsonRoute(TEAM_CATALOG_PLANS))
    )

    await page.goto(`${APP_URL}/?pricing=team&stop=team_400&cycle=monthly`)

    await cloudAppExpect(
      page.getByRole('heading', { name: 'Confirm your payment' })
    ).toBeVisible()
    await expect(page.getByText('$390', { exact: true })).toBeVisible()
  })

  test('denies selected Team confirmation for a member and cleans the URL', async ({
    page
  }) => {
    await setupCloudApp(page, workspace('team', 'member'), [
      member({
        email: 'creator@test.comfy.org',
        role: 'owner',
        is_original_owner: true
      }),
      member({ email: SELF_EMAIL, role: 'member' })
    ])

    await page.goto(
      `${APP_URL}/?keep=1&pricing=team&stop=team_700&cycle=yearly`
    )

    await waitForCloudApp(page)
    await expect(page).toHaveURL(/[?&]keep=1(?:&|$)/)
    await expect(page).not.toHaveURL(/[?&](pricing|stop|cycle)=/)
    await expect(
      page.getByRole('heading', { name: 'Confirm your payment' })
    ).toBeHidden()
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
    await page.goto(`${APP_URL}/?pricing=personal`)

    const changePlan = page.getByRole('button', {
      name: 'Change to Creator Yearly'
    })
    await cloudAppExpect(changePlan).toBeVisible()

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
        await page.goto(`${APP_URL}/?pricing=personal`)

        const changePlan = page.getByRole('button', {
          name: 'Change to Creator Yearly'
        })
        await cloudAppExpect(changePlan).toBeVisible()
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
