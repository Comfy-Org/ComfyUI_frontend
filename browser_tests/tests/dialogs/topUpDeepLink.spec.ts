import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

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
 * The `?topup=1` deep link opens the credit top-up dialog on app load, gated
 * to users who can top up (personal users and team owners). Drives a raw
 * `page` so the cloud app boots against fully mocked endpoints, like the
 * pricing-table deep-link spec.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const SELF_EMAIL = 'e2e@test.comfy.org'

// consolidated_billing_enabled routes personal workspaces to the workspace
// top-up dialog asserted here; without it they fall back to the legacy dialog.
const BOOT_FEATURES = {
  team_workspaces_enabled: true,
  consolidated_billing_enabled: true
} satisfies RemoteConfig
// Disable the experimental Asset API: with it on (cloud default) the unmocked
// asset endpoints 403 and workflow restore throws uncaught, aborting the
// GraphCanvas onMounted chain before the deep-link loader.
const BOOT_SETTINGS = { 'Comfy.Assets.UseAssetAPI': false }

// The deep-link loader runs at the tail of GraphCanvas onMounted, so the boot
// chain must not throw before it: a missing settings subpath, prompt exec_info,
// or queue status each abort that chain.
async function mockGraphBootExtras(page: Page) {
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

const topUpHeading = (page: Page) =>
  page.getByRole('heading', { name: 'Add more credits' })

test.describe('Top-up deep link', { tag: '@cloud' }, () => {
  test('opens the top-up dialog for a personal owner', async ({ page }) => {
    test.slow()
    await setupCloudApp(page, workspace('personal', 'owner'), [])

    await page.goto(`${APP_URL}/?topup=1`)

    await expect(topUpHeading(page)).toBeVisible({ timeout: 45_000 })
    await expect(page).not.toHaveURL(/[?&]topup=/)
  })

  test('opens the top-up dialog for a team owner', async ({ page }) => {
    test.slow()
    await setupCloudApp(page, workspace('team', 'owner'), [
      member({ email: SELF_EMAIL, role: 'owner', is_original_owner: true })
    ])

    await page.goto(`${APP_URL}/?topup=1`)

    await expect(topUpHeading(page)).toBeVisible({ timeout: 45_000 })
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

    await page.goto(`${APP_URL}/?topup=1`)

    await page.waitForFunction(() => !!window.app?.extensionManager, null, {
      timeout: 45_000
    })
    await expect(page).not.toHaveURL(/[?&]topup=/)
    await expect(topUpHeading(page)).toBeHidden()
  })
})
