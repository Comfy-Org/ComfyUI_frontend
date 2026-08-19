import { expect } from '@playwright/test'
import type { APIRequestContext, Page, Route } from '@playwright/test'

import type {
  BillingPlansResponse,
  BillingStatusResponse,
  Plan
} from '@/platform/workspace/api/workspaceApi'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { CommandHelper } from '@e2e/fixtures/helpers/CommandHelper'

/**
 * Billing mocks are cross-origin (app on localhost, ingest on its own
 * origin), so every fulfill carries CORS headers and answers OPTIONS
 * preflights.
 */
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
  priceCents: number
): Plan {
  return {
    slug,
    tier,
    duration,
    price_cents: priceCents,
    credits_cents: 4200,
    max_seats: 1,
    availability: { available: true },
    seat_summary: {
      seat_count: 1,
      total_cost_cents: priceCents,
      total_credits_cents: 4200
    }
  }
}

const plansResponse: BillingPlansResponse = {
  plans: [
    makePlan('standard-yearly', 'STANDARD', 'ANNUAL', 1600),
    makePlan('creator-yearly', 'CREATOR', 'ANNUAL', 2800),
    makePlan('pro-yearly', 'PRO', 'ANNUAL', 8000)
  ]
}

function billingStatus(planSlug?: string): BillingStatusResponse {
  return {
    is_active: planSlug !== undefined,
    has_funds: true,
    subscription_status: planSlug ? 'active' : undefined,
    subscription_tier: planSlug ? 'STANDARD' : undefined,
    subscription_duration: planSlug ? 'ANNUAL' : undefined,
    billing_status: 'paid',
    plan_slug: planSlug,
    max_seats: 1,
    occupied_seats: 1,
    team_credit_stop: null
  }
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

/**
 * Boots the app with a mocked Firebase session and opens Plan & Credits.
 * window.open is stubbed; the opened URL lands in dataset.openedUrl.
 */
async function bootToPlansSection(page: Page, request: APIRequestContext) {
  // Multi-user servers show a user-select screen unless a user id is seeded.
  const usersResponse = await request.get(`${APP_URL}/api/users`)
  const usersBody = (await usersResponse.json()) as {
    users?: Record<string, string>
  }
  const userId = Object.keys(usersBody.users ?? {})[0]

  await page.addInitScript((id) => {
    if (id) localStorage.setItem('Comfy.userId', id)
    window.open = (url) => {
      document.documentElement.dataset.openedUrl = String(url)
      return window
    }
  }, userId)

  const auth = new CloudAuthHelper(page)
  await auth.mockAuth()

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

    // The embedded credits tile reads the LEGACY rail off-cloud; flipping these
    // with `subscribed` lets the test assert the tile reacts to the reconcile.
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
    await page.route('**/api/billing/balance', (r) =>
      fulfillJson(r, { amount_micros: 0, currency: 'usd' })
    )
    await page.route('**/api/billing/subscribe', async (r) => {
      if (r.request().method() === 'POST') {
        subscribed = true
        subscribeRequests.push({
          url: r.request().url(),
          body: r.request().postDataJSON()
        })
      }
      await fulfillJson(r, {
        status: 'needs_payment_method',
        payment_method_url: 'https://checkout.stripe.com/c/pay/test-session',
        billing_op_id: 'op-e2e-1'
      })
    })
    await page.route('**/api/billing/ops/**', (r) =>
      fulfillJson(r, { status: 'succeeded' })
    )

    const dialog = await bootToPlansSection(page, request)

    const chooseStandard = dialog.getByRole('button', {
      name: 'Choose Standard'
    })
    await expect(chooseStandard).toBeEnabled()
    await expect(dialog.getByText('12,660')).toHaveCount(0)
    await chooseStandard.click()

    // The subscribe goes to the workspace rail on the ingest origin, never the
    // legacy checkout shortlink.
    await expect.poll(() => subscribeRequests.length).toBe(1)
    expect(subscribeRequests[0].body).toMatchObject({
      plan_slug: 'standard-yearly',
      billing_cycle: 'yearly'
    })
    expect(new URL(subscribeRequests[0].url).origin).not.toBe(
      new URL(APP_URL).origin
    )

    // The backend-returned Stripe page opens (window.open is stubbed).
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.dataset.openedUrl)
      )
      .toBe('https://checkout.stripe.com/c/pay/test-session')

    // Op-polling reconciles and the subscribed card flips to disabled Current.
    const currentPlan = dialog.getByRole('button', { name: 'Current Plan' })
    await expect(currentPlan).toBeVisible({ timeout: 30_000 })
    await expect(currentPlan).toBeDisabled()
    await expect(
      dialog.getByRole('button', { name: 'Choose Creator' })
    ).toBeEnabled()

    // The embedded credits tile re-renders from the reconciled legacy balance
    // (6000 micros -> 12,660 credits), proving the reconcile reaches the tile.
    await expect(dialog.getByText('12,660').first()).toBeVisible({
      timeout: 15_000
    })

    expect(legacyCheckoutRequests).toEqual([])
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

    // 1px tolerance for subpixel rounding.
    await expect
      .poll(() => section.evaluate((el) => el.scrollWidth - el.clientWidth))
      .toBeLessThanOrEqual(1)
  })
})
