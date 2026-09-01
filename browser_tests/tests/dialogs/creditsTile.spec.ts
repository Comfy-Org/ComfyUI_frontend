import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type {
  BillingOpStatusResponse,
  BillingStatusResponse,
  CreateTopupResponse
} from '@/platform/workspace/api/workspaceApi'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { createWorkspaceBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'
import {
  mockWorkspaceTokenMint,
  workspace
} from '@e2e/fixtures/utils/workspaceMocks'

// Drives a raw `page` (not the `comfyPage` fixture) so the cloud app boots
// against fully mocked endpoints; `comfyPage` would try to reach the OSS
// devtools backend during setup.

/**
 * Credits tile (Settings ▸ Workspace ▸ Plan & Credits) — DES-247 / FE-964.
 *
 * The credits tile only lives inside the authenticated cloud app, which the
 * shared `comfyPage` fixture can't boot (it expects the OSS devtools backend).
 * Instead this drives a raw page: mock Firebase auth + every boot endpoint so
 * the cloud app initializes against fully stubbed data. The facade routes a
 * personal workspace through the workspace `/api/billing/*` endpoints (mocked
 * with an active Pro subscription). The tile
 * should then render its total / progress bar / monthly+additional breakdown /
 * add-credits.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const jsonRoute = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body)
})

// Legacy `/customers/balance` and workspace `/api/billing/balance` share the
// same response shape, so one body fulfills both endpoints.
const balanceRoute = (balance: {
  amount: number
  monthly: number
  prepaid: number
}) =>
  jsonRoute({
    amount_micros: balance.amount,
    currency: 'usd',
    effective_balance_micros: balance.amount,
    cloud_credit_balance_micros: balance.monthly,
    prepaid_balance_micros: balance.prepaid
  })

// 6000 -> 12,660 total; 5000 -> 10,550 monthly remaining; 1000 -> 2,110 extra.
const DEFAULT_BALANCE = { amount: 6000, monthly: 5000, prepaid: 1000 }

const mockBillingStatus: BillingStatusResponse = {
  is_active: true,
  max_seats: 1,
  occupied_seats: 1,
  team_credit_stop: null,
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  renewal_date: '2099-02-20T12:00:00Z',
  has_funds: true
}

const freeBillingStatus: BillingStatusResponse = {
  is_active: false,
  max_seats: 1,
  occupied_seats: 1,
  team_credit_stop: null,
  subscription_tier: 'FREE',
  has_funds: true
}

const endedPersonalBillingStatus: BillingStatusResponse = {
  is_active: false,
  max_seats: 1,
  occupied_seats: 1,
  team_credit_stop: null,
  subscription_status: 'ended',
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  plan_slug: 'pro-monthly',
  billing_status: 'inactive',
  has_funds: true
}

const pastDueBillingStatus: BillingStatusResponse = {
  ...mockBillingStatus,
  is_active: false,
  plan_slug: 'pro-monthly',
  billing_status: 'payment_failed'
}

async function mockCloudBoot(
  page: Page,
  billingControlEnabled = true,
  billingStatus = mockBillingStatus
) {
  // Frontend-origin boot endpoints (proxied to the backend in production).
  // `/api/features` is the remote-config source for the billing UX rollout.
  await page.route('**/api/features', (r) =>
    r.fulfill(
      jsonRoute({
        billing_control_enabled: billingControlEnabled
      } satisfies RemoteConfig)
    )
  )
  await page.route('**/api/system_stats', (r) =>
    r.fulfill(jsonRoute(mockSystemStats))
  )
  // Include the mock user so the multi-user select screen auto-selects it
  // (paired with the `Comfy.userId` localStorage seed below).
  await page.route('**/api/users', (r) =>
    r.fulfill(
      jsonRoute({
        storage: 'server',
        migrated: true,
        users: { 'test-user-e2e': 'E2E Test User' }
      })
    )
  )
  // Non-empty settings with a completed tutorial keep the cloud app from
  // booting as a new user, whose Workflow Templates dialog would otherwise
  // auto-open and intercept the Settings click behind its modal backdrop.
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
  await mockWorkspaceTokenMint(page, workspace('personal', 'owner'))
  await page.route('**/releases**', (r) => r.fulfill(jsonRoute([])))

  // Single personal workspace.
  await page.route('**/api/workspaces', (r) =>
    r.fulfill(
      jsonRoute({
        workspaces: [
          {
            id: 'ws-personal',
            name: 'Personal Workspace',
            type: 'personal',
            role: 'owner'
          }
        ]
      })
    )
  )

  await page.route('**/customers/balance', (r) =>
    r.fulfill(balanceRoute(DEFAULT_BALANCE))
  )

  // Workspace billing (flag-on path) — a personal workspace now routes through
  // `/api/billing/*`.
  await page.route('**/api/billing/status', (r) =>
    r.fulfill(jsonRoute(billingStatus))
  )
  await page.route('**/api/billing/payment-portal', (r) =>
    r.fulfill(jsonRoute({ url: 'https://billing.example/portal' }))
  )
  await page.route('**/api/billing/balance', (r) =>
    r.fulfill(balanceRoute(DEFAULT_BALANCE))
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
}

async function mockBalance(
  page: Page,
  balance: { amount: number; monthly: number; prepaid: number }
) {
  await page.unroute('**/customers/balance')
  await page.unroute('**/api/billing/balance')
  await page.route('**/customers/balance', (r) =>
    r.fulfill(balanceRoute(balance))
  )
  await page.route('**/api/billing/balance', (r) =>
    r.fulfill(balanceRoute(balance))
  )
}

async function openSettings(page: Page) {
  const auth = new CloudAuthHelper(page)
  await auth.mockAuth()

  // Pre-select the mock user to skip the user-select screen.
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.userId', 'test-user-e2e')
  })

  await page.goto(APP_URL)
  await page.waitForFunction(() => !!window.app?.extensionManager, null, {
    timeout: 45_000
  })

  // Open Settings ▸ Workspace.
  await page
    .getByRole('button', { name: /^Settings/ })
    .first()
    .click()
  const dialog = page.getByTestId('settings-dialog')
  await expect(dialog).toBeVisible()

  return dialog
}

/** Boots the mocked cloud app and opens Settings ▸ Workspace ▸ Plan & Credits. */
async function openPlanAndCredits(page: Page) {
  const dialog = await openSettings(page)
  await dialog
    .locator('nav')
    .getByRole('button', { name: 'Plan & Credits' })
    .click()

  return dialog.getByRole('main')
}

test.describe('Credits tile (Plan & Credits)', { tag: '@cloud' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.open = (url) => {
        document.documentElement.dataset.openedUrl = String(url)
        return window
      }
    })
  })

  test('opens Billing & invoices for a paid owner without a duplicate invoice link', async ({
    page
  }) => {
    test.setTimeout(60_000)

    await mockCloudBoot(page)

    const content = await openPlanAndCredits(page)
    await expect(
      content.getByRole('button', { name: 'Invoice history' })
    ).toHaveCount(0)
    await content.getByRole('button', { name: 'Billing & invoices' }).click()

    await expect
      .poll(() => page.locator('html').getAttribute('data-opened-url'))
      .toBe('https://billing.example/portal')
  })

  test('opens Billing & invoices for a Free owner without a subscription', async ({
    page
  }) => {
    test.setTimeout(60_000)

    await mockCloudBoot(page, true, freeBillingStatus)

    const content = await openPlanAndCredits(page)
    await expect(content.getByRole('heading', { name: 'Free' })).toBeVisible()
    await content.getByRole('button', { name: 'Billing & invoices' }).click()

    await expect
      .poll(() => page.locator('html').getAttribute('data-opened-url'))
      .toBe('https://billing.example/portal')
  })

  test('keeps Billing & invoices available after a Personal subscription ends', async ({
    page
  }) => {
    test.setTimeout(60_000)

    await mockCloudBoot(page, true, endedPersonalBillingStatus)

    const content = await openPlanAndCredits(page)
    await expect(content.getByText('Your subscription has ended')).toBeVisible()
    await content.getByRole('button', { name: 'Billing & invoices' }).click()

    await expect
      .poll(() => page.locator('html').getAttribute('data-opened-url'))
      .toBe('https://billing.example/portal')
  })

  test('keeps billing management available for a past-due subscription', async ({
    page
  }) => {
    test.setTimeout(60_000)

    await mockCloudBoot(page, true, pastDueBillingStatus)

    const content = await openPlanAndCredits(page)
    await expect(
      content.getByRole('button', { name: 'Billing & invoices' })
    ).toBeVisible()
    await expect(
      content.getByRole('button', { name: 'Change plan' })
    ).toHaveCount(0)

    await content.getByRole('button', { name: 'More Options' }).click()
    await expect(page.getByText('Cancel plan', { exact: true })).toBeVisible()
  })

  test('keeps V1 workspace navigation when billing controls are disabled', async ({
    page
  }) => {
    test.setTimeout(60_000)

    await mockCloudBoot(page, false)
    const dialog = await openSettings(page)
    const nav = dialog.locator('nav')

    await expect(
      nav.getByRole('button', { name: 'Workspace', exact: true })
    ).toHaveCount(0)
    await expect(
      nav.getByRole('button', { name: 'Plan & Credits', exact: true })
    ).toBeVisible()
    await expect(
      nav.getByRole('button', { name: 'Members', exact: true })
    ).toBeVisible()

    await nav
      .getByRole('button', { name: 'Plan & Credits', exact: true })
      .click()
    const content = dialog.getByRole('main')
    await expect(
      content.getByRole('button', { name: 'Activity', exact: true })
    ).toBeVisible()
  })

  test('renders the unified tile with breakdown and add-credits', async ({
    page
  }) => {
    test.setTimeout(60_000)

    await mockCloudBoot(page)

    const content = await openPlanAndCredits(page)
    await expect(
      page
        .getByRole('dialog')
        .locator('nav')
        .getByRole('button', { name: 'Members', exact: true })
    ).toBeVisible()

    // Total + remaining suffix (Pro monthly allowance = 21,100; remaining
    // 10,550 -> used 10,550).
    await expect(content.getByText('Total credits')).toBeVisible()
    await expect(content.getByText('12,660')).toBeVisible()

    // Monthly usage bar header + used / left-of-total labels.
    await expect(content.getByText('Monthly', { exact: true })).toBeVisible()
    await expect(content.getByText(/Refills Feb/)).toBeVisible()
    await expect(content.getByText('10,550 used')).toBeVisible()
    await expect(content.getByText('10,550 left of 21,100')).toBeVisible()

    // Additional credits row + subtitle.
    await expect(content.getByText('Additional credits')).toBeVisible()
    await expect(content.getByText('2,110')).toBeVisible()
    await expect(content.getByText('Used after monthly runs out')).toBeVisible()

    // Permission-gated add-credits action (personal owner can top up).
    await expect(
      content.getByRole('button', { name: 'Add credits' })
    ).toBeVisible()

    // Narrow container (DES-247 responsive variants): drop the used/remaining
    // labels and the breakdown subtitle, compact the monthly summary numbers.
    await page.setViewportSize({ width: 360, height: 800 })
    await expect(content.getByText('10,550 used')).toBeHidden()
    await expect(content.getByText('remaining', { exact: true })).toBeHidden()
    await expect(content.getByText('Used after monthly runs out')).toBeHidden()
    await expect(content.getByText('10,550 left of 21,100')).toBeHidden()
    await expect(content.getByText('11K left of 21K')).toBeVisible()
  })

  test('renders the depleted-credit empty states', async ({ page }) => {
    test.setTimeout(60_000)

    await mockCloudBoot(page)
    // Monthly allowance fully spent; additional credits keep generation going.
    await mockBalance(page, { amount: 1000, monthly: 0, prepaid: 1000 })

    const content = await openPlanAndCredits(page)

    // 0-monthly state: depletion notice + IN USE badge on additional credits.
    await expect(
      content.getByText('Monthly credits are used up. Refills Feb 20')
    ).toBeVisible()
    await expect(
      content.getByText("You're now spending additional credits.")
    ).toBeVisible()
    await expect(content.getByText('In use')).toBeVisible()
    await expect(content.getByText('0 left of 21,100')).toBeVisible()

    // Drain the remaining additional credits and refresh the tile: the
    // out-of-credits notice takes over and the badge drops.
    await mockBalance(page, { amount: 0, monthly: 0, prepaid: 0 })
    await content.getByRole('button', { name: 'Refresh credits' }).click()

    await expect(
      content.getByText("You're out of credits. Credits refill Feb 20")
    ).toBeVisible()
    await expect(
      content.getByText('Add more credits to continue generating.')
    ).toBeVisible()
    await expect(content.getByText('In use')).toBeHidden()
    await expect(
      content.getByRole('button', { name: 'Add credits' })
    ).toBeVisible()
  })
})

test.describe('Top-up 3DS verification', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  let operationPollRequests: Request[]
  let topupDialog: TopUpCreditsDialog

  test.beforeEach(async ({ page }) => {
    operationPollRequests = []
    await page.addInitScript(() => {
      window.open = (url, target, features) => {
        document.documentElement.dataset.openedUrl = String(url)
        document.documentElement.dataset.openedTarget = target ?? ''
        document.documentElement.dataset.openedFeatures = features ?? ''
        return window
      }
    })
    await mockCloudBoot(page)
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
    await page.route('**/api/billing/topup', (route) =>
      route.fulfill(
        jsonRoute({
          billing_op_id: 'topup-3ds-operation',
          topup_id: 'topup-3ds-operation',
          status: 'pending',
          amount_cents: 5000
        } satisfies CreateTopupResponse)
      )
    )
    await page.route('**/api/billing/ops/topup-3ds-operation', (route) => {
      operationPollRequests.push(route.request())
      return route.fulfill(
        jsonRoute({
          id: 'topup-3ds-operation',
          status: 'pending',
          started_at: '2026-07-31T00:00:00Z',
          action_url: 'https://verify.example/topup-3ds'
        } satisfies BillingOpStatusResponse)
      )
    })

    const content = await openPlanAndCredits(page)
    topupDialog = new TopUpCreditsDialog(page)
    await content.getByRole('button', { name: 'Add credits' }).click()
    await topupDialog.waitForVisible()
  })

  test('opens verification when the top-up operation requires authentication', async ({
    page
  }) => {
    await topupDialog.root.getByRole('button', { name: 'Add credits' }).click()

    await expect(
      topupDialog.root.getByRole('heading', { name: 'Confirm' })
    ).toBeVisible()
    await expect(
      topupDialog.root.getByRole('button', { name: 'Back' })
    ).toBeEnabled()
    expect(operationPollRequests).toHaveLength(0)

    await topupDialog.root.getByRole('button', { name: 'Pay $50.00' }).click()

    await expect(
      topupDialog.root.getByRole('button', { name: 'Back' })
    ).toBeDisabled()
    await expect.poll(() => operationPollRequests.length).toBeGreaterThan(0)
    const verificationButton = topupDialog.root.getByRole('button', {
      name: 'Complete verification'
    })
    await expect(verificationButton).toBeVisible()

    await verificationButton.click()

    await expect
      .poll(() => page.locator('html').getAttribute('data-opened-url'))
      .toBe('https://verify.example/topup-3ds')
    await expect(page.locator('html')).toHaveAttribute(
      'data-opened-target',
      '_blank'
    )
    await expect(page.locator('html')).toHaveAttribute(
      'data-opened-features',
      'noopener,noreferrer'
    )
  })
})
