import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { ErrorResponse } from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type {
  BillingPlansResponse,
  BillingStatusResponse
} from '@/platform/workspace/api/workspaceApi'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { createWorkspaceBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { createPlan } from '@e2e/fixtures/data/billingPlans'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

/**
 * Which billing-portal origins the outstanding-payment recovery will open.
 *
 * A plan change refused with `SUBSCRIPTION_PAYMENT_REQUIRED` hands the customer
 * to the portal session the server mints. Comfy's Stripe Billing Portal is
 * served from the configured custom domain, so the origin check has to admit it
 * — and must still refuse a look-alike host that merely starts with it, which
 * is the property a prefix or suffix match would silently lose (#19892).
 *
 * Drives a raw `page` against fully mocked endpoints, the same pattern as
 * hostedBillingDestination.spec.ts.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

/** The custom domain production serves Billing Portal sessions from. */
const CUSTOM_DOMAIN_PORTAL =
  'https://checkout.comfy.org/p/session?secret=e2e_portal_session'
/** Starts with the custom domain and is not it. */
const LOOK_ALIKE_PORTAL = 'https://checkout.comfy.org.evil.test/p/session'

const PAYMENT_REQUIRED = {
  code: 'SUBSCRIPTION_PAYMENT_REQUIRED',
  message: 'Update your payment method before changing plans'
} satisfies ErrorResponse

const PERSONAL = workspace('personal', 'owner')

const ACTIVE_PRO_STATUS: BillingStatusResponse = {
  is_active: true,
  has_funds: true,
  subscription_status: 'active',
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  plan_slug: 'pro-monthly',
  billing_status: 'paid',
  renewal_date: '2099-02-20T12:00:00Z',
  max_seats: 1,
  occupied_seats: 1,
  team_credit_stop: null,
  scheduled_change: null
}

const STANDARD_YEARLY_PLAN = createPlan({
  slug: 'standard-yearly',
  tier: 'STANDARD',
  duration: 'ANNUAL',
  priceCents: 16_000,
  monthlyCredits: 4_200
})

/**
 * Records the destination instead of opening a tab the test would have to
 * dismiss. The handle stays truthy so the app reads the open as succeeding
 * rather than as popup-blocked.
 */
async function recordPortalOpens(page: Page) {
  await page.addInitScript(() => {
    const opened: string[] = []
    Object.defineProperty(window, '__portalOpens', { get: () => opened })
    window.open = (url?: string | URL) => {
      if (url) opened.push(String(url))
      return window
    }
  })
  return () =>
    page.evaluate(() => [
      ...(window as unknown as { __portalOpens: string[] }).__portalOpens
    ])
}

/**
 * A plan change the server refuses for an outstanding payment, with `portalUrl`
 * as the portal session it then mints.
 */
async function setupRefusedPlanChange(page: Page, portalUrl: string) {
  const portalOpens = await recordPortalOpens(page)
  await mockCloudBoot(page, {
    // TutorialCompleted suppresses the new-user template browser, whose modal
    // overlay would otherwise intercept the avatar-menu click.
    features: { billing_control_enabled: true } satisfies RemoteConfig,
    settings: { 'Comfy.TutorialCompleted': true }
  })
  await page.route('**/api/billing/status', (r) =>
    r.fulfill(jsonRoute(ACTIVE_PRO_STATUS))
  )
  await page.route('**/api/billing/balance', (r) =>
    r.fulfill(jsonRoute({ amount_micros: 6000, currency: 'usd' }))
  )
  await page.route('**/customers/balance', (r) =>
    r.fulfill(jsonRoute({ amount_micros: 6000, currency: 'usd' }))
  )
  await page.route('**/api/billing/capabilities', (r) => {
    if (r.request().method() !== 'GET') return r.fallback()
    return r.fulfill(jsonRoute(createWorkspaceBillingCapabilities(PERSONAL)))
  })
  await page.route('**/api/billing/plans', (r) =>
    r.fulfill(
      jsonRoute({
        plans: [STANDARD_YEARLY_PLAN]
      } satisfies BillingPlansResponse)
    )
  )
  await page.route('**/api/billing/preview-subscribe', (r) =>
    r.fulfill({ ...jsonRoute(PAYMENT_REQUIRED), status: 402 })
  )
  await page.route('**/api/billing/payment-portal', (r) =>
    r.fulfill(jsonRoute({ url: portalUrl }))
  )
  await bootCloud(page)
  return portalOpens
}

/** The avatar menu's Plans and pricing entry, then the Standard tier's action. */
async function changeToStandardYearly(page: Page) {
  await page.goto(APP_URL)
  await page.waitForFunction(() => !!window.app?.extensionManager, null, {
    timeout: 45_000
  })
  await page.getByRole('button', { name: 'Current user' }).click()
  await page.getByTestId('plans-pricing-menu-item').click()
  await expect(
    page.getByRole('heading', { name: 'Choose a Plan' })
  ).toBeVisible({ timeout: 45_000 })
  await page.getByRole('button', { name: /Standard Yearly/ }).click()
}

test.describe('Billing portal origin (#19892)', { tag: '@cloud' }, () => {
  test('opens the custom-domain portal session the server mints', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const portalOpens = await setupRefusedPlanChange(page, CUSTOM_DOMAIN_PORTAL)

    await changeToStandardYearly(page)

    await expect.poll(() => portalOpens()).toEqual([CUSTOM_DOMAIN_PORTAL])
  })

  test('opens nothing and reports the refusal for a look-alike portal host', async ({
    page,
    toast
  }) => {
    test.setTimeout(60_000)
    const portalOpens = await setupRefusedPlanChange(page, LOOK_ALIKE_PORTAL)

    await changeToStandardYearly(page)

    // The customer still gets the server's own guidance, which is what tells
    // them what to do; the rejected host never reaches a tab.
    await expect(toast.withText(PAYMENT_REQUIRED.message)).toBeVisible()
    expect(await portalOpens()).toEqual([])
  })
})
