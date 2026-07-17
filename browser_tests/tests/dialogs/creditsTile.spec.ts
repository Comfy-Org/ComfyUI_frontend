import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { BillingStatusResponse } from '@/platform/workspace/api/workspaceApi'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
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
 * the cloud app initializes against fully stubbed data. With team workspaces
 * enabled the facade routes a personal workspace through the workspace
 * `/api/billing/*` endpoints (mocked with an active Pro subscription); the
 * legacy `/customers/*` shapes are mocked too for the flag-off path. The tile
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
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  renewal_date: '2099-02-20T12:00:00Z',
  has_funds: true
}

async function mockCloudBoot(page: Page) {
  // Frontend-origin boot endpoints (proxied to the backend in production).
  // `/api/features` is the remote-config source: production builds resolve
  // `teamWorkspacesEnabled` from it (the `ff:` localStorage override is
  // dev-only), and the flag gates the Workspace settings panel.
  await page.route('**/api/features', (r) =>
    r.fulfill(
      jsonRoute({ team_workspaces_enabled: true } satisfies RemoteConfig)
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

  // Legacy billing (flag-off path, api.comfy.org/customers/*).
  await page.route('**/customers/cloud-subscription-status', (r) =>
    r.fulfill(
      jsonRoute({
        is_active: true,
        subscription_tier: 'PRO',
        subscription_duration: 'MONTHLY',
        renewal_date: '2099-02-20T12:00:00Z',
        end_date: null
      })
    )
  )
  await page.route('**/customers/balance', (r) =>
    r.fulfill(balanceRoute(DEFAULT_BALANCE))
  )

  // Workspace billing (flag-on path) — a personal workspace now routes through
  // `/api/billing/*`.
  await page.route('**/api/billing/status', (r) =>
    r.fulfill(jsonRoute(mockBillingStatus))
  )
  await page.route('**/api/billing/balance', (r) =>
    r.fulfill(balanceRoute(DEFAULT_BALANCE))
  )
  await page.route('**/api/billing/plans', (r) =>
    r.fulfill(jsonRoute({ plans: [] }))
  )
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

/** Boots the mocked cloud app and opens Settings ▸ Workspace ▸ Plan & Credits. */
async function openPlanAndCredits(page: Page) {
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
  await dialog.locator('nav').getByRole('button', { name: 'Workspace' }).click()

  return dialog.getByRole('main')
}

test.describe('Credits tile (Plan & Credits)', { tag: '@cloud' }, () => {
  test('renders the unified tile with breakdown and add-credits', async ({
    page
  }) => {
    test.setTimeout(60_000)

    await mockCloudBoot(page)

    const content = await openPlanAndCredits(page)

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
