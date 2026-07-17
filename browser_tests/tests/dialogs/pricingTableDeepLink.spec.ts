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
 * The `?pricing=` deep link opens the pricing table on app load, gated to the
 * original owner (canManageSubscriptionLifecycle). Drives a raw `page` so the
 * cloud app boots against fully mocked endpoints, like the survey-gate spec.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

// CloudAuthHelper.mockAuth() signs in as this email; the original-owner gate
// matches it against the members self-row.
const SELF_EMAIL = 'e2e@test.comfy.org'

// billing_control_enabled routes personal workspaces to the unified pricing
// table asserted here; without it they fall back to the legacy table.
const BOOT_FEATURES = {
  team_workspaces_enabled: true,
  billing_control_enabled: true
} satisfies RemoteConfig
// Disable the experimental Asset API: with it on (cloud default) the unmocked
// asset endpoints 403 and workflow restore throws uncaught, aborting the
// GraphCanvas onMounted chain before the deep-link loader.
const BOOT_SETTINGS = { 'Comfy.Assets.UseAssetAPI': false }

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
