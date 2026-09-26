import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type {
  BillingPlansResponse,
  BillingStatusResponse,
  Plan,
  PreviewSubscribeResponse
} from '@/platform/workspace/api/workspaceApi'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { SettingDialog } from '@e2e/fixtures/components/SettingDialog'
import { createWorkspaceBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import {
  mockWorkspaceTokenMint,
  workspace
} from '@e2e/fixtures/utils/workspaceMocks'

/**
 * Hosted billing destination — FE-2218, Layer C of the billing rollout.
 *
 * `hosted_billing_destination` decides where Billing & invoices and Plans and
 * pricing land, and nothing else does: on `stripe` the app opens the URL
 * `/billing/payment-portal` handed back and shows the in-app pricing table, on
 * `billing_web` it mints the contract's `/v1/payment-methods` and `/v1/pricing`
 * entries and never asks the server for a portal link.
 *
 * Drives a raw `page` so the cloud app boots against fully mocked endpoints,
 * the same pattern as creditsTile.spec.ts.
 *
 * The hosted origin is baked in at build time. `.github/actions/build-cloud-frontend`
 * supplies the value below; a locally served build needs the same
 * `VITE_BILLING_WEB_URL`, or the hosted case falls back to the provider page.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const BILLING_WEB_ORIGIN = 'https://billing-web.example'
const PROVIDER_PORTAL_URL = 'https://billing.example/portal'

const ACTIVE_BILLING_STATUS: BillingStatusResponse = {
  is_active: true,
  max_seats: 1,
  occupied_seats: 1,
  team_credit_stop: null,
  scheduled_change: null,
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  plan_slug: 'pro-monthly',
  billing_status: 'paid',
  renewal_date: '2099-02-20T12:00:00Z',
  has_funds: true
}

const STANDARD_YEARLY_PLAN: Plan = {
  slug: 'standard-yearly',
  tier: 'STANDARD',
  duration: 'ANNUAL',
  price_cents: 16_000,
  credits_cents: 4_200,
  max_seats: 1,
  availability: { available: true },
  seat_summary: {
    seat_count: 1,
    total_cost_cents: 16_000,
    total_credits_cents: 4_200
  }
}

const NEW_STANDARD_SUBSCRIPTION: PreviewSubscribeResponse = {
  allowed: true,
  transition_type: 'new_subscription',
  effective_at: '2026-07-21T00:00:00Z',
  is_immediate: true,
  cost_today_cents: 16_000,
  cost_next_period_cents: 16_000,
  credits_today_cents: 4_200,
  credits_next_period_cents: 4_200,
  new_plan: STANDARD_YEARLY_PLAN
}

interface CloudBootRequests {
  /** Every request the app made for a provider portal URL, in order. */
  portalRequests: Request[]
  /** Every request the app made for billing status, in order. */
  statusRequests: Request[]
}

async function mockCloudBoot(page: Page): Promise<CloudBootRequests> {
  const portalRequests: Request[] = []
  const statusRequests: Request[] = []

  await page.route('**/api/features', (r) =>
    r.fulfill(
      jsonRoute({ billing_control_enabled: true } satisfies RemoteConfig)
    )
  )
  await page.route('**/api/system_stats', (r) =>
    r.fulfill(jsonRoute(mockSystemStats))
  )
  await page.route('**/api/users', (r) =>
    r.fulfill(
      jsonRoute({
        storage: 'server',
        migrated: true,
        users: { 'test-user-e2e': 'E2E Test User' }
      })
    )
  )
  // TutorialCompleted suppresses the new-user template browser, whose modal
  // overlay would otherwise intercept the Settings click.
  await page.route('**/api/settings', (r) =>
    r.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
  )
  await page.route('**/api/userdata**', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/extensions', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/object_info', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/global_subgraphs', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/i18n', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/auth/session', (r) =>
    r.fulfill(jsonRoute({ token: 'mock-workspace-token' }))
  )
  await page.route('**/releases**', (r) => r.fulfill(jsonRoute([])))
  await mockWorkspaceTokenMint(page, workspace('personal', 'owner'))
  await page.route('**/api/workspaces', (r) =>
    r.fulfill(jsonRoute({ workspaces: [workspace('personal', 'owner')] }))
  )

  await page.route('**/api/billing/status', (r) => {
    statusRequests.push(r.request())
    return r.fulfill(jsonRoute(ACTIVE_BILLING_STATUS))
  })
  await page.route('**/api/billing/balance', (r) =>
    r.fulfill(jsonRoute({ amount_micros: 6000, currency: 'usd' }))
  )
  await page.route('**/customers/balance', (r) =>
    r.fulfill(jsonRoute({ amount_micros: 6000, currency: 'usd' }))
  )
  await page.route('**/api/billing/plans', (r) =>
    r.fulfill(jsonRoute({ plans: [] }))
  )
  await page.route('**/api/billing/capabilities', (r) => {
    if (r.request().method() !== 'GET') return r.fallback()
    return r.fulfill(
      jsonRoute(
        createWorkspaceBillingCapabilities(workspace('personal', 'owner'))
      )
    )
  })
  await page.route('**/api/billing/payment-portal', (r) => {
    portalRequests.push(r.request())
    return r.fulfill(jsonRoute({ url: PROVIDER_PORTAL_URL }))
  })

  return { portalRequests, statusRequests }
}

async function bootApp(page: Page, options: { blockPopups?: boolean } = {}) {
  const { blockPopups = false } = options
  await new CloudAuthHelper(page).mockAuth()
  await page.addInitScript((blockPopups) => {
    localStorage.setItem('Comfy.userId', 'test-user-e2e')
    const recordDestination = (url: string) => {
      document.documentElement.dataset.openedUrl = url
    }
    // A handle whose navigation is recorded rather than performed. Handing
    // back the live `window` would let the disowned-tab open -- blank tab,
    // null the opener, then assign `location.href` -- steer this page to the
    // hosted origin instead.
    const standInTab = new Proxy(window, {
      get: (target, property) =>
        property === 'location'
          ? {
              get href() {
                return document.documentElement.dataset.openedUrl ?? ''
              },
              set href(destination: string) {
                recordDestination(destination)
              }
            }
          : Reflect.get(target, property),
      // The tab is disowned before it navigates, and a stand-in that never
      // navigates has nothing to disown, so the write is swallowed rather
      // than reaching this page's own `window.opener`.
      set: () => true
    })
    // Records the destination instead of opening a tab the test would have to
    // dismiss. The handle follows the spec: a `noopener` open always yields
    // null, while a plain one returns a window and keeps the app's
    // portal-return refresh armed. `blockPopups` simulates the browser's own
    // popup blocker, which yields null regardless of `noopener`.
    window.open = (url, _target, features) => {
      if (url) recordDestination(String(url))
      if (blockPopups) return null
      return (features ?? '').includes('noopener') ? null : standInTab
    }
  }, blockPopups)
  await page.goto(APP_URL)
  await page.waitForFunction(() => !!window.app?.extensionManager, null, {
    timeout: 45_000
  })
}

function openedUrl(page: Page) {
  return page.locator('html').getAttribute('data-opened-url')
}

/** The avatar menu's Plans and pricing entry. */
async function clickPlansAndPricing(page: Page) {
  await page.getByRole('button', { name: 'Current user' }).click()
  await page.getByTestId('plans-pricing-menu-item').click()
}

const pricingHeading = (page: Page) =>
  page.getByRole('heading', { name: 'Choose a Plan' })

/**
 * The in-app pricing dialog's frame. Pushed synchronously by the click
 * handler, unlike its lazily imported contents, so its absence right after
 * the handler ran is a settled answer rather than a race.
 */
const pricingDialog = (page: Page) =>
  page.locator('[data-dialog-key="subscription-required"]')

/** The Standard tier's card action, whether it reads "Subscribe to" or "Change to". */
const standardTierButton = (page: Page) =>
  page.getByRole('button', { name: /Standard Yearly/ })

const confirmPaymentHeading = (page: Page) =>
  page.getByRole('heading', { name: 'Confirm your payment' })

/** `/api/billing/plans` and `/api/billing/preview-subscribe`, mocked for a
 * fresh Standard-yearly subscribe: the billing_web handoff never reaches
 * preview-subscribe, but the embedded fallback tests do. */
async function mockStandardPlan(page: Page): Promise<Request[]> {
  const previewRequests: Request[] = []
  await page.route('**/api/billing/plans', (r) =>
    r.fulfill(
      jsonRoute({
        plans: [STANDARD_YEARLY_PLAN]
      } satisfies BillingPlansResponse)
    )
  )
  await page.route('**/api/billing/preview-subscribe', (r) => {
    previewRequests.push(r.request())
    return r.fulfill(jsonRoute(NEW_STANDARD_SUBSCRIPTION))
  })
  return previewRequests
}

test.describe('Hosted billing destination (FE-2218)', { tag: '@cloud' }, () => {
  test('opens the provider portal while the destination is stripe', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const { portalRequests } = await mockCloudBoot(page)
    await bootApp(page)

    const settings = new SettingDialog(page)
    await settings.openFromToolbar()
    const content = await settings.openPlanAndCredits()
    await content.getByRole('button', { name: 'Billing & invoices' }).click()

    await expect.poll(() => openedUrl(page)).toBe(PROVIDER_PORTAL_URL)
    expect(portalRequests).toHaveLength(1)
  })

  test('mints the billing-web payment-methods entry with the active workspace while the destination is billing_web', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const { portalRequests } = await mockCloudBoot(page)
    await bootApp(page)
    await new FeatureFlagHelper(page).setServerFlagsPersistent({
      hosted_billing_destination: 'billing_web'
    })

    const settings = new SettingDialog(page)
    await settings.openFromToolbar()
    const content = await settings.openPlanAndCredits()
    await content.getByRole('button', { name: 'Billing & invoices' }).click()

    await expect
      .poll(() => openedUrl(page))
      .toBe(
        `${BILLING_WEB_ORIGIN}/v1/payment-methods?product=comfyui&return_to=comfyui_workspace&workspace=ws-personal`
      )
    expect(portalRequests).toHaveLength(0)
  })

  test('tells the customer and mints no portal session when the hosted payment-methods tab is blocked', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const { portalRequests } = await mockCloudBoot(page)
    await bootApp(page, { blockPopups: true })
    await new FeatureFlagHelper(page).setServerFlagsPersistent({
      hosted_billing_destination: 'billing_web'
    })

    const content = await openPlanAndCredits(page)
    await content.getByRole('button', { name: 'Billing & invoices' }).click()

    await expect(
      page.getByText(
        "Couldn't open the billing page. Allow pop-ups for this site and try again."
      )
    ).toBeVisible()
    expect(portalRequests).toHaveLength(0)
  })

  test('tells the customer and mints no portal session when the provider portal tab is blocked', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const { portalRequests } = await mockCloudBoot(page)
    await bootApp(page, { blockPopups: true })

    const content = await openPlanAndCredits(page)
    await content.getByRole('button', { name: 'Billing & invoices' }).click()

    await expect(
      page.getByText(
        "Couldn't open the billing page. Allow pop-ups for this site and try again."
      )
    ).toBeVisible()
    expect(portalRequests).toHaveLength(0)
  })

  test('refetches billing status when the hosted payment-methods tab regains focus', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const { statusRequests } = await mockCloudBoot(page)
    await bootApp(page)
    await new FeatureFlagHelper(page).setServerFlagsPersistent({
      hosted_billing_destination: 'billing_web'
    })

    const content = await openPlanAndCredits(page)
    await content.getByRole('button', { name: 'Billing & invoices' }).click()
    await expect
      .poll(() => openedUrl(page))
      .toBe(
        `${BILLING_WEB_ORIGIN}/v1/payment-methods?product=comfyui&return_to=comfyui_workspace&workspace=ws-personal`
      )

    const requestsBeforeReturn = statusRequests.length
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))

    await expect
      .poll(() => statusRequests.length)
      .toBeGreaterThan(requestsBeforeReturn)
  })

  /**
   * Plan selection stays in the app regardless of the destination: billing-web's
   * `/v1/pricing` has no personal/team tabs, cycle toggle, or credit slider
   * (G7), and a per-credit Team plan 400s there (FE-2642). Only a Subscribe
   * click inside this table hands off to billing-web — see the "Hosted
   * billing checkout handoff" describe below.
   */
  for (const destination of ['stripe', 'billing_web'] as const) {
    test(`opens the in-app pricing table from the avatar menu while the destination is ${destination}`, async ({
      page
    }) => {
      test.setTimeout(60_000)
      await mockCloudBoot(page)
      await bootApp(page)
      if (destination === 'billing_web') {
        await new FeatureFlagHelper(page).setServerFlagsPersistent({
          hosted_billing_destination: 'billing_web'
        })
      }

      await clickPlansAndPricing(page)

      await expect(pricingHeading(page)).toBeVisible()
      expect(await openedUrl(page)).toBeNull()
    })
  }
})

test.describe('Hosted billing checkout handoff', { tag: '@cloud' }, () => {
  test('opens the billing-web checkout entry with the selected plan and workspace while the destination is billing_web', async ({
    page
  }) => {
    test.setTimeout(60_000)
    await mockCloudBoot(page)
    const previewRequests = await mockStandardPlan(page)
    await bootApp(page)
    await new FeatureFlagHelper(page).setServerFlagsPersistent({
      hosted_billing_destination: 'billing_web'
    })

    await clickPlansAndPricing(page)
    await expect(pricingHeading(page)).toBeVisible()
    await standardTierButton(page).click()

    await expect
      .poll(() => openedUrl(page))
      .toBe(
        `${BILLING_WEB_ORIGIN}/v1/checkout?product=comfyui&return_to=comfyui_workspace&plan=standard-yearly&workspace=ws-personal`
      )
    expect(previewRequests).toHaveLength(0)
    await expect(pricingDialog(page)).toHaveCount(0)
  })

  test('falls back to the embedded confirm step when the checkout tab is blocked', async ({
    page
  }) => {
    test.setTimeout(60_000)
    await mockCloudBoot(page)
    await mockStandardPlan(page)
    await bootApp(page, { blockPopups: true })
    await new FeatureFlagHelper(page).setServerFlagsPersistent({
      hosted_billing_destination: 'billing_web'
    })

    await clickPlansAndPricing(page)
    await expect(pricingHeading(page)).toBeVisible()
    await standardTierButton(page).click()

    await expect(confirmPaymentHeading(page)).toBeVisible()
  })

  test('stays on the embedded confirm step and opens no tab while the destination is stripe', async ({
    page
  }) => {
    test.setTimeout(60_000)
    await mockCloudBoot(page)
    await mockStandardPlan(page)
    await bootApp(page)

    await clickPlansAndPricing(page)
    await expect(pricingHeading(page)).toBeVisible()
    await standardTierButton(page).click()

    await expect(confirmPaymentHeading(page)).toBeVisible()
    expect(await openedUrl(page)).toBeNull()
  })
})
