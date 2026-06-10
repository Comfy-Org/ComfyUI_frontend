import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'

// Drives a raw `page` (not the `comfyPage` fixture) so the cloud app boots
// against fully mocked endpoints; `comfyPage` would try to reach the OSS
// devtools backend during setup.

/**
 * Credits tile (Settings ▸ Workspace ▸ Plan & Credits) — DES-247 / FE-964.
 *
 * The credits tile only lives inside the authenticated cloud app, which the
 * shared `comfyPage` fixture can't boot (it expects the OSS devtools backend).
 * Instead this drives a raw page: mock Firebase auth + every boot endpoint so
 * the cloud app initializes against fully stubbed data, with a single personal
 * workspace that routes the billing facade through the legacy `/customers/*`
 * endpoints (mocked with an active Pro subscription). The tile should then
 * render its total / progress bar / monthly+additional breakdown / add-credits.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const jsonRoute = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body)
})

async function mockCloudBoot(page: Page) {
  // Frontend-origin boot endpoints (proxied to the backend in production).
  await page.route('**/api/features', (r) => r.fulfill(jsonRoute({})))
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
  await page.route('**/api/settings', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/userdata**', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/extensions', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/object_info', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/global_subgraphs', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/i18n', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/auth/session', (r) =>
    r.fulfill(jsonRoute({ token: 'mock-workspace-token' }))
  )
  await page.route('**/releases**', (r) => r.fulfill(jsonRoute([])))

  // Workspace list — a single personal workspace keeps the billing facade on
  // the legacy `/customers/*` path.
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

  // Legacy billing (api.comfy.org/customers/*).
  await page.route('**/customers/cloud-subscription-status', (r) =>
    r.fulfill(
      jsonRoute({
        is_active: true,
        subscription_tier: 'PRO',
        subscription_duration: 'MONTHLY',
        renewal_date: '2099-02-20T00:00:00Z',
        end_date: null
      })
    )
  )
  await page.route('**/customers/balance', (r) =>
    r.fulfill(
      jsonRoute({
        amount_micros: 6000, // -> 12,660 total credits
        currency: 'usd',
        effective_balance_micros: 6000,
        cloud_credit_balance_micros: 5000, // -> 10,550 monthly remaining
        prepaid_balance_micros: 1000 // -> 2,110 additional
      })
    )
  )
}

test.describe('Credits tile (Plan & Credits)', { tag: '@cloud' }, () => {
  test('renders the unified tile with breakdown and add-credits', async ({
    page
  }) => {
    test.setTimeout(60_000)

    await mockCloudBoot(page)

    const auth = new CloudAuthHelper(page)
    await auth.mockAuth()

    // Enable team workspaces (the Workspace settings panel hosts the Plan &
    // Credits tab) and pre-select the mock user to skip the user-select screen.
    // `ff:` overrides are read by the dev build the e2e runs on.
    await page.addInitScript(() => {
      localStorage.setItem('ff:team_workspaces_enabled', 'true')
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
    await dialog
      .locator('nav')
      .getByRole('button', { name: 'Workspace' })
      .click()

    const content = dialog.getByRole('main')

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
  })
})
