import { expect } from '@playwright/test'
import type { APIRequestContext, Page, Route } from '@playwright/test'

import type {
  BillingBalanceResponse,
  BillingOpStatusResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  Plan,
  PreviewSubscribeResponse,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'

// The GET /api/users contract (comfy server, not the ingest billing API): a
// user map keyed by id. Typed locally so a mock can't drift from the shape the
// app reads (ComfyApi.getUserConfig).
interface ComfyUsersResponse {
  storage: 'server' | 'browser'
  migrated?: boolean
  users: Record<string, string>
}

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { CommandHelper } from '@e2e/fixtures/helpers/CommandHelper'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,x-api-key'
}

async function fulfillJson(route: Route, body: unknown) {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS })
    return
  }
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(body)
  })
}

function makePlan(
  slug: string,
  tier: Plan['tier'],
  duration: Plan['duration'],
  priceCents: number,
  creditsCents: number
): Plan {
  return {
    slug,
    tier,
    duration,
    price_cents: priceCents,
    credits_cents: creditsCents,
    max_seats: 1,
    availability: { available: true },
    seat_summary: {
      seat_count: 1,
      total_cost_cents: priceCents,
      total_credits_cents: creditsCents
    }
  }
}

const standardYearly = makePlan(
  'standard-yearly',
  'STANDARD',
  'ANNUAL',
  1600,
  50_400
)
const creatorYearly = makePlan(
  'creator-yearly',
  'CREATOR',
  'ANNUAL',
  2800,
  88_800
)

const plansResponse: BillingPlansResponse = {
  plans: [
    standardYearly,
    creatorYearly,
    makePlan('pro-yearly', 'PRO', 'ANNUAL', 8000, 253_200)
  ]
}

function billingStatus(
  planSlug?: string,
  cancelAt?: string
): BillingStatusResponse {
  return {
    is_active: planSlug !== undefined,
    has_funds: true,
    subscription_status: planSlug
      ? cancelAt
        ? 'canceled'
        : 'active'
      : undefined,
    subscription_tier: planSlug ? 'STANDARD' : undefined,
    subscription_duration: planSlug ? 'ANNUAL' : undefined,
    billing_status: 'paid',
    plan_slug: planSlug,
    cancel_at: cancelAt,
    max_seats: 1,
    occupied_seats: 1,
    team_credit_stop: null
  }
}

function previewPlan(
  plan: Plan,
  periodEnd?: string
): PreviewSubscribeResponse['new_plan'] {
  return {
    slug: plan.slug,
    tier: plan.tier,
    duration: plan.duration,
    price_cents: plan.price_cents,
    credits_cents: plan.credits_cents,
    seat_summary: plan.seat_summary,
    period_end: periodEnd
  }
}

const newSubscriptionPreview: PreviewSubscribeResponse = {
  allowed: true,
  transition_type: 'new_subscription',
  is_immediate: true,
  effective_at: '2026-08-25T10:00:00Z',
  cost_today_cents: 1600,
  amount_due_cents: 1600,
  currency: 'usd',
  cost_next_period_cents: 1600,
  renewal_amount_cents: 24_000,
  renewal_at: '2027-08-25T00:00:00Z',
  credits_today_cents: 50_400,
  credits_next_period_cents: 50_400,
  new_plan: previewPlan(standardYearly, '2027-08-25T00:00:00Z')
}

const PRORATION_AT = '2026-08-25T10:00:00Z'
const CURRENT_PERIOD_END = '2026-09-30T00:00:00Z'

const upgradePreview: PreviewSubscribeResponse = {
  allowed: true,
  transition_type: 'upgrade',
  is_immediate: true,
  effective_at: PRORATION_AT,
  proration_at: PRORATION_AT,
  cost_today_cents: 1234,
  amount_due_cents: 1234,
  currency: 'usd',
  cost_next_period_cents: 2800,
  renewal_amount_cents: 42_000,
  renewal_at: '2027-08-25T00:00:00Z',
  credits_today_cents: 88_800,
  credits_next_period_cents: 88_800,
  current_plan: previewPlan(standardYearly, CURRENT_PERIOD_END),
  new_plan: previewPlan(creatorYearly, '2027-08-25T00:00:00Z')
}

async function mockLegacyReads(page: Page) {
  await page.route('**/customers/**', (r) =>
    fulfillJson(
      r,
      r.request().url().includes('balance')
        ? { amount_micros: 0, currency: 'usd' }
        : { is_active: false }
    )
  )
  await page.route('**/api/billing/status', (r) =>
    fulfillJson(r, billingStatus())
  )
  await page.route('**/api/billing/balance', (r) =>
    fulfillJson(r, { amount_micros: 0, currency: 'usd' })
  )
}

// FE-1584: off-cloud billing reads need a hydrated wallet + token.
async function mockWorkspaceBootstrap(
  page: Page,
  role: 'owner' | 'member' = 'owner'
) {
  const personal = workspace('personal', role)
  await page.route('**/api/workspaces', (r) =>
    fulfillJson(r, { workspaces: [personal] })
  )
  await page.route('**/api/auth/token', (r) =>
    fulfillJson(r, {
      token: 'mock-workspace-token',
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      workspace: { id: personal.id, name: personal.name, type: personal.type },
      role: personal.role,
      permissions: []
    })
  )
  await page.route('**/api/workspace/members**', (r) =>
    fulfillJson(r, {
      members: [],
      pagination: { offset: 0, limit: 50, total: 0 }
    })
  )
}

// A multi-user server boots to a user-selection screen unless a real user id is
// seeded, and a fresh CI server has no users at all — find or create one (this
// drives a raw page, so it cannot reuse ComfyPage.setupUser; mirror its status
// guards so a server error surfaces here, not as a later opaque boot hang).
async function seedComfyUser(
  request: APIRequestContext
): Promise<string | undefined> {
  const usersResponse = await request.get(`${APP_URL}/api/users`)
  if (!usersResponse.ok())
    throw new Error(`GET /api/users failed: ${usersResponse.status()}`)
  const usersBody = (await usersResponse.json()) as ComfyUsersResponse
  const existing = Object.keys(usersBody.users ?? {})[0]
  if (existing) return existing
  const created = await request.post(`${APP_URL}/api/users`, {
    data: { username: 'plans-subscribe-e2e' }
  })
  if (!created.ok())
    throw new Error(`POST /api/users failed: ${created.status()}`)
  return (await created.json()) as string
}

async function openPlanCredits(page: Page, userId: string | undefined) {
  await page.addInitScript((id) => {
    if (id) localStorage.setItem('Comfy.userId', id)
    window.open = (url) => {
      document.documentElement.dataset.openedUrl = String(url)
      return window
    }
  }, userId)

  await page.goto(APP_URL)
  await page.waitForFunction(() => !!window.app?.extensionManager, null, {
    timeout: 45_000
  })

  await new CommandHelper(page).executeCommand('Comfy.ShowSettingsDialog')
  const dialog = page.getByTestId('settings-dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Plan & Credits' }).click()
  return dialog
}

async function bootToPlansSection(page: Page, request: APIRequestContext) {
  const userId = await seedComfyUser(request)
  await mockWorkspaceBootstrap(page)
  await new CloudAuthHelper(page).mockAuth()
  return openPlanCredits(page, userId)
}

test.describe('Local plans section subscribe', () => {
  test('subscribes via the workspace rail and flips the card to Current', async ({
    page,
    request
  }) => {
    test.setTimeout(90_000)

    let subscribed = false
    const subscribeRequests: { url: string; body: unknown }[] = []
    const legacyCheckoutRequests: string[] = []

    page.on('request', (request) => {
      if (request.url().includes('/customers/cloud-subscription-checkout')) {
        legacyCheckoutRequests.push(request.url())
      }
    })

    await page.route('**/customers/**', (r) =>
      fulfillJson(
        r,
        r.request().url().includes('balance')
          ? { amount_micros: subscribed ? 6000 : 0, currency: 'usd' }
          : subscribed
            ? {
                is_active: true,
                subscription_status: 'active',
                subscription_tier: 'STANDARD',
                subscription_duration: 'ANNUAL',
                renewal_date: '2099-01-01T00:00:00Z',
                has_funds: true
              }
            : { is_active: false }
      )
    )
    await page.route('**/api/billing/plans', (r) =>
      fulfillJson(r, plansResponse)
    )
    await page.route('**/api/billing/status', (r) =>
      fulfillJson(r, billingStatus(subscribed ? 'standard-yearly' : undefined))
    )
    await page.route('**/api/billing/balance', (r) => {
      const balance: BillingBalanceResponse = {
        amount_micros: subscribed ? 6000 : 0,
        currency: 'usd'
      }
      return fulfillJson(r, balance)
    })
    const billingPosts: string[] = []
    await page.route('**/api/billing/preview-subscribe', async (r) => {
      if (r.request().method() === 'POST') billingPosts.push('preview')
      await fulfillJson(r, newSubscriptionPreview)
    })
    await page.route('**/api/billing/subscribe', async (r) => {
      if (r.request().method() === 'POST') {
        billingPosts.push('subscribe')
        subscribed = true
        subscribeRequests.push({
          url: r.request().url(),
          body: r.request().postDataJSON()
        })
      }
      // Typed from the contract so a schema change can't leave this green
      // against a payload production would reject.
      const response: SubscribeResponse = {
        status: 'needs_payment_method',
        payment_method_url: 'https://checkout.stripe.com/c/pay/test-session',
        billing_op_id: 'op-e2e-1'
      }
      await fulfillJson(r, response)
    })
    const opStatus: BillingOpStatusResponse = {
      id: 'op-e2e-1',
      status: 'succeeded',
      started_at: '2026-01-01T00:00:00Z',
      completed_at: '2026-01-01T00:00:05Z'
    }
    await page.route('**/api/billing/ops/**', (r) => fulfillJson(r, opStatus))

    const dialog = await bootToPlansSection(page, request)

    const chooseStandard = dialog.getByRole('button', {
      name: 'Choose Standard'
    })
    await expect(chooseStandard).toBeEnabled()
    await expect(dialog.getByText('12,660')).toHaveCount(0)
    await chooseStandard.click()

    const checkout = page.getByTestId('settings-plan-checkout')
    await expect(checkout.getByText('Confirm your payment')).toBeVisible()
    await expect(checkout.getByText('50,400')).toBeVisible()
    expect(subscribeRequests).toEqual([])
    await checkout
      .getByRole('button', { name: 'Subscribe to Standard' })
      .click()

    await expect.poll(() => subscribeRequests.length).toBe(1)
    expect(billingPosts).toEqual(['preview', 'subscribe'])
    expect(subscribeRequests[0].body).toMatchObject({
      plan_slug: 'standard-yearly'
    })
    expect(subscribeRequests[0].body).not.toHaveProperty('billing_cycle')
    expect(new URL(subscribeRequests[0].url).origin).not.toBe(
      new URL(APP_URL).origin
    )

    // The backend-returned Stripe page opens (window.open is stubbed).
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.dataset.openedUrl)
      )
      .toBe('https://checkout.stripe.com/c/pay/test-session')

    await expect(checkout.getByText("You're all set")).toBeVisible({
      timeout: 30_000
    })
    await checkout.getByRole('button', { name: 'Close' }).last().click()
    const currentPlan = dialog.getByRole('button', { name: 'Current Plan' })
    await expect(currentPlan).toBeVisible({ timeout: 30_000 })
    await expect(currentPlan).toBeDisabled()
    await expect(
      dialog.getByRole('button', { name: 'Choose Creator' })
    ).toBeEnabled()

    await expect(dialog.getByText('12,660').first()).toBeVisible({
      timeout: 15_000
    })

    expect(legacyCheckoutRequests).toEqual([])
  })

  test('previews a plan change and echoes the server proration on subscribe', async ({
    page,
    request
  }) => {
    test.setTimeout(90_000)

    let subscribed = false
    const billingPosts: string[] = []
    const subscribeBodies: Record<string, unknown>[] = []

    await mockLegacyReads(page)
    await page.route('**/api/billing/plans', (r) =>
      fulfillJson(r, plansResponse)
    )
    await page.route('**/api/billing/status', (r) =>
      fulfillJson(
        r,
        billingStatus(subscribed ? 'creator-yearly' : 'standard-yearly')
      )
    )
    await page.route('**/api/billing/preview-subscribe', async (r) => {
      if (r.request().method() === 'POST') billingPosts.push('preview')
      await fulfillJson(r, upgradePreview)
    })
    await page.route('**/api/billing/subscribe', async (r) => {
      if (r.request().method() === 'POST') {
        billingPosts.push('subscribe')
        subscribed = true
        subscribeBodies.push(r.request().postDataJSON())
      }
      const response: SubscribeResponse = {
        status: 'subscribed',
        billing_op_id: 'op-e2e-change'
      }
      await fulfillJson(r, response)
    })

    const dialog = await bootToPlansSection(page, request)

    await expect(
      dialog.getByRole('button', { name: 'Current Plan' })
    ).toBeDisabled()
    await dialog.getByRole('button', { name: 'Choose Creator' }).click()

    const checkout = page.getByTestId('settings-plan-checkout')
    await expect(checkout.getByText('Confirm your upgrade')).toBeVisible()
    await expect(checkout.getByText('Total due today')).toBeVisible()
    await expect(checkout.getByText('$12.34')).toBeVisible()
    await expect(checkout.getByText('88,800')).toBeVisible()
    expect(subscribeBodies).toEqual([])

    await checkout.getByRole('button', { name: 'Confirm upgrade' }).click()

    await expect.poll(() => subscribeBodies.length).toBe(1)
    expect(billingPosts).toEqual(['preview', 'subscribe'])
    expect(subscribeBodies[0]).toMatchObject({
      plan_slug: 'creator-yearly',
      proration_at: PRORATION_AT,
      confirm_reactivation: false
    })

    await expect(checkout.getByText("You're all set")).toBeVisible({
      timeout: 30_000
    })
    await checkout.getByRole('button', { name: 'Close' }).last().click()

    await expect(
      dialog.getByRole('button', { name: 'Current Plan' })
    ).toBeDisabled({ timeout: 30_000 })
    await expect(
      dialog.getByRole('button', { name: 'Choose Standard' })
    ).toBeEnabled()
  })

  test('requires reactivation consent before a cancelled subscriber changes plan', async ({
    page,
    request
  }) => {
    test.setTimeout(90_000)

    let subscribed = false
    const subscribeBodies: Record<string, unknown>[] = []

    await mockLegacyReads(page)
    await page.route('**/api/billing/plans', (r) =>
      fulfillJson(r, plansResponse)
    )
    await page.route('**/api/billing/status', (r) =>
      fulfillJson(
        r,
        subscribed
          ? billingStatus('creator-yearly')
          : billingStatus('standard-yearly', CURRENT_PERIOD_END)
      )
    )
    await page.route('**/api/billing/preview-subscribe', (r) =>
      fulfillJson(r, upgradePreview)
    )
    await page.route('**/api/billing/subscribe', async (r) => {
      if (r.request().method() === 'POST') {
        subscribed = true
        subscribeBodies.push(r.request().postDataJSON())
      }
      const response: SubscribeResponse = {
        status: 'subscribed',
        billing_op_id: 'op-e2e-reactivate'
      }
      await fulfillJson(r, response)
    })

    const dialog = await bootToPlansSection(page, request)
    await dialog.getByRole('button', { name: 'Choose Creator' }).click()

    const checkout = page.getByTestId('settings-plan-checkout')
    await expect(
      checkout.getByText('Reactivating your subscription')
    ).toBeVisible()
    const confirm = checkout.getByRole('button', {
      name: 'Confirm & reactivate — $12.34 today'
    })
    await expect(confirm).toBeDisabled()
    await checkout
      .getByRole('checkbox', {
        name: "I understand I'll be charged $12.34 today"
      })
      .check()
    await expect(confirm).toBeEnabled()
    await confirm.click()

    await expect.poll(() => subscribeBodies.length).toBe(1)
    expect(subscribeBodies[0]).toMatchObject({
      plan_slug: 'creator-yearly',
      confirm_reactivation: true,
      proration_at: PRORATION_AT
    })
    await expect(checkout.getByText("You're all set")).toBeVisible({
      timeout: 30_000
    })
  })

  test('recovers from a failed plans fetch via retry', async ({
    page,
    request
  }) => {
    test.setTimeout(90_000)

    let plansAvailable = false
    await mockLegacyReads(page)
    await page.route('**/api/billing/plans', async (r) => {
      if (r.request().method() === 'OPTIONS') {
        await r.fulfill({ status: 204, headers: CORS_HEADERS })
        return
      }
      if (!plansAvailable) {
        await r.fulfill({
          status: 500,
          contentType: 'application/json',
          headers: CORS_HEADERS,
          body: '{}'
        })
        return
      }
      await fulfillJson(r, plansResponse)
    })

    const dialog = await bootToPlansSection(page, request)

    await expect(
      dialog.getByText("We couldn't load your plan details.")
    ).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: 'Choose Standard' })
    ).toHaveCount(0)

    plansAvailable = true
    await dialog.getByRole('button', { name: 'Try again' }).click()

    await expect(
      dialog.getByRole('button', { name: 'Choose Standard' })
    ).toBeEnabled()
    await expect(
      dialog.getByText("We couldn't load your plan details.")
    ).toHaveCount(0)
  })

  test('keeps the plans section within the viewport at mobile width', async ({
    page,
    request
  }) => {
    test.setTimeout(90_000)

    await mockLegacyReads(page)
    await page.route('**/api/billing/plans', (r) =>
      fulfillJson(r, plansResponse)
    )

    const dialog = await bootToPlansSection(page, request)

    const section = dialog.getByTestId('settings-plans-section')
    await expect(
      section.getByRole('button', { name: 'Choose Standard' })
    ).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })

    await expect
      .poll(() => section.evaluate((el) => el.scrollWidth - el.clientWidth))
      .toBeLessThanOrEqual(1)
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth
        )
      )
      .toBeLessThanOrEqual(1)
  })

  test('requests the plan catalog when the Plan & Credits tab opens', async ({
    page,
    request
  }) => {
    test.setTimeout(90_000)

    let planRequests = 0
    await mockLegacyReads(page)
    await page.route('**/api/billing/plans', (r) => {
      if (r.request().method() !== 'OPTIONS') planRequests += 1
      return fulfillJson(r, plansResponse)
    })

    const dialog = await bootToPlansSection(page, request)

    // The cards can only be right if they came from the catalog, so prove the
    // fetch actually fired rather than trusting the render.
    await expect(
      dialog.getByRole('button', { name: 'Choose Standard' })
    ).toBeEnabled()
    await expect.poll(() => planRequests).toBeGreaterThan(0)
  })

  test('refuses checkout for a workspace member who cannot manage billing', async ({
    page,
    request
  }) => {
    test.setTimeout(90_000)

    const subscribeRequests: unknown[] = []
    await mockLegacyReads(page)
    await page.route('**/api/billing/plans', (r) =>
      fulfillJson(r, plansResponse)
    )
    await page.route('**/api/billing/subscribe', (r) => {
      if (r.request().method() === 'POST')
        subscribeRequests.push(r.request().postDataJSON())
      return fulfillJson(r, { status: 'subscribed', billing_op_id: 'op-none' })
    })

    const userId = await seedComfyUser(request)
    await mockWorkspaceBootstrap(page, 'member')
    await new CloudAuthHelper(page).mockAuth()

    const dialog = await openPlanCredits(page, userId)

    const chooseStandard = dialog.getByRole('button', {
      name: 'Choose Standard'
    })
    await expect(chooseStandard).toBeEnabled()
    await chooseStandard.click()

    await expect(
      page.getByText('Only the workspace owner can change the plan.')
    ).toBeVisible({ timeout: 15_000 })
    expect(subscribeRequests).toEqual([])
  })

  test('does not offer the plans section without a signed-in session', async ({
    page,
    request
  }) => {
    test.setTimeout(90_000)

    await mockLegacyReads(page)
    await page.route('**/api/billing/plans', (r) =>
      fulfillJson(r, plansResponse)
    )

    const userId = await seedComfyUser(request)
    await mockWorkspaceBootstrap(page)
    // No CloudAuthHelper.mockAuth(): there is no Firebase session at all.

    await page.addInitScript((id) => {
      if (id) localStorage.setItem('Comfy.userId', id)
    }, userId)
    await page.goto(APP_URL)
    await page.waitForFunction(() => !!window.app?.extensionManager, null, {
      timeout: 45_000
    })
    await new CommandHelper(page).executeCommand('Comfy.ShowSettingsDialog')
    const dialog = page.getByTestId('settings-dialog')
    await expect(dialog).toBeVisible()

    // Signed out, the whole Plan & Credits entry is absent, so the sign-in-first
    // gate inside the launcher is unreachable from here — the section is the
    // gate. The launcher's own gate is unit-covered
    // (useSettingsPlansCheckout.test.ts, 'routes an api-key-only user through
    // sign-in before subscribing').
    await expect(
      dialog.getByRole('button', { name: 'Plan & Credits' })
    ).toHaveCount(0)
  })
})
