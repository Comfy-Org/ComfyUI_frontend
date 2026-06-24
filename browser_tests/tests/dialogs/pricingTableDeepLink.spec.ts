import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type {
  Member,
  WorkspaceWithRole
} from '@/platform/workspace/api/workspaceApi'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'

/**
 * The `?pricing=` deep link opens the pricing table on app load, gated to the
 * original owner (canManageSubscriptionLifecycle). Drives a raw `page` so the
 * cloud app boots against fully mocked endpoints, like the survey-gate spec.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

// CloudAuthHelper.mockAuth() signs in as this email; the original-owner gate
// matches it against the members self-row.
const SELF_EMAIL = 'e2e@test.comfy.org'

function jsonRoute(body: unknown) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body)
  }
}

async function mockCloudBoot(page: Page) {
  // `/api/features` is the remote-config source; enable team workspaces so the
  // unified pricing table (and the lifecycle gate) are live.
  await page.route('**/api/features', (r) =>
    r.fulfill(
      jsonRoute({ team_workspaces_enabled: true } satisfies RemoteConfig)
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
  await page.route('**/api/user', (r) =>
    r.fulfill(jsonRoute({ status: 'active' }))
  )
  // Disable the experimental Asset API: with it on (cloud default) the
  // unmocked asset endpoints 403 and workflow restore throws uncaught,
  // aborting the GraphCanvas onMounted chain before the deep-link loader.
  await page.route('**/api/settings', (r) =>
    r.fulfill(jsonRoute({ 'Comfy.Assets.UseAssetAPI': false }))
  )
  await page.route('**/api/settings/**', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/userdata**', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/extensions', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/object_info', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/global_subgraphs', (r) => r.fulfill(jsonRoute({})))
  // Queue/prompt status: a missing exec_info throws on boot and aborts the
  // GraphCanvas onMounted chain before the deep-link loader runs.
  await page.route('**/api/prompt', (r) =>
    r.fulfill(jsonRoute({ exec_info: { queue_remaining: 0 } }))
  )
  await page.route('**/api/queue', (r) =>
    r.fulfill(jsonRoute({ queue_running: [], queue_pending: [] }))
  )
  await page.route('**/api/i18n', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/auth/session', (r) =>
    r.fulfill(jsonRoute({ token: 'mock-workspace-token' }))
  )
  await page.route('**/releases**', (r) => r.fulfill(jsonRoute([])))
}

async function mockBilling(page: Page) {
  // Minimal valid shapes so the billing facade resolves while the dialog mounts.
  await page.route('**/api/billing/status', (r) =>
    r.fulfill(
      jsonRoute({
        is_active: true,
        has_funds: true,
        subscription_status: 'active',
        subscription_tier: 'pro',
        subscription_duration: 'MONTHLY',
        billing_status: 'paid'
      })
    )
  )
  await page.route('**/api/billing/balance', (r) =>
    r.fulfill(jsonRoute({ amount_micros: 0, currency: 'usd' }))
  )
  await page.route('**/api/billing/plans', (r) =>
    r.fulfill(jsonRoute({ plans: [] }))
  )
  await page.route('**/customers/cloud-subscription-status', (r) =>
    r.fulfill(jsonRoute({ is_active: false }))
  )
  await page.route('**/customers/balance', (r) =>
    r.fulfill(jsonRoute({ amount_micros: 0, currency: 'usd' }))
  )
}

function workspace(
  type: 'personal' | 'team',
  role: 'owner' | 'member'
): WorkspaceWithRole {
  return {
    id: `ws-${type}`,
    name: type === 'team' ? 'My Team' : 'Personal Workspace',
    type,
    role,
    created_at: '2026-01-01T00:00:00Z',
    joined_at: '2026-01-01T00:00:00Z'
  }
}

async function mockWorkspace(
  page: Page,
  ws: WorkspaceWithRole,
  members: Member[]
) {
  await page.route('**/api/workspaces', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await route.fulfill(jsonRoute({ workspaces: [ws] }))
  })
  await page.route('**/api/auth/token', (r) =>
    r.fulfill(
      jsonRoute({
        token: 'mock-workspace-token',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        workspace: { id: ws.id, name: ws.name, type: ws.type },
        role: ws.role,
        permissions: []
      })
    )
  )
  await page.route('**/api/workspace/members**', (r) =>
    r.fulfill(
      jsonRoute({
        members,
        pagination: { offset: 0, limit: 50, total: members.length }
      })
    )
  )
}

async function bootCloud(page: Page) {
  const auth = new CloudAuthHelper(page)
  await auth.mockAuth()
  // Pre-select the mock user to skip the user-select screen.
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.userId', 'test-user-e2e')
  })
}

const pricingHeading = (page: Page) =>
  page.getByRole('heading', { name: 'Choose a Plan' })

function member(
  overrides: Partial<Member> & Pick<Member, 'email' | 'role'>
): Member {
  return {
    id: `user-${overrides.email}`,
    name: overrides.email,
    joined_at: '2026-01-01T00:00:00Z',
    is_original_owner: false,
    ...overrides
  }
}

test.describe('Pricing table deep link', { tag: '@cloud' }, () => {
  test('opens the pricing table for a personal owner', async ({ page }) => {
    test.setTimeout(60_000)
    await mockCloudBoot(page)
    await mockBilling(page)
    await mockWorkspace(page, workspace('personal', 'owner'), [])
    await bootCloud(page)

    await page.goto(`${APP_URL}/?pricing=1`)

    await expect(pricingHeading(page)).toBeVisible({ timeout: 45_000 })
    await expect(page).not.toHaveURL(/[?&]pricing=/)
  })

  test('opens on the Team tab for ?pricing=team', async ({ page }) => {
    test.setTimeout(60_000)
    await mockCloudBoot(page)
    await mockBilling(page)
    await mockWorkspace(page, workspace('personal', 'owner'), [])
    await bootCloud(page)

    await page.goto(`${APP_URL}/?pricing=team`)

    await expect(pricingHeading(page)).toBeVisible({ timeout: 45_000 })
    await expect(
      page.getByRole('button', { name: 'For Teams' })
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('opens for a team original owner', async ({ page }) => {
    test.setTimeout(60_000)
    await mockCloudBoot(page)
    await mockBilling(page)
    await mockWorkspace(page, workspace('team', 'owner'), [
      member({ email: SELF_EMAIL, role: 'owner', is_original_owner: true })
    ])
    await bootCloud(page)

    await page.goto(`${APP_URL}/?pricing=1`)

    await expect(pricingHeading(page)).toBeVisible({ timeout: 45_000 })
  })

  test('is a silent no-op for a team member', async ({ page }) => {
    test.setTimeout(60_000)
    await mockCloudBoot(page)
    await mockBilling(page)
    await mockWorkspace(page, workspace('team', 'member'), [
      member({
        email: 'creator@test.comfy.org',
        role: 'owner',
        is_original_owner: true
      }),
      member({ email: SELF_EMAIL, role: 'member' })
    ])
    await bootCloud(page)

    await page.goto(`${APP_URL}/?pricing=1`)

    await page.waitForFunction(() => !!window.app?.extensionManager, null, {
      timeout: 45_000
    })
    await expect(page).not.toHaveURL(/[?&]pricing=/)
    await expect(pricingHeading(page)).toBeHidden()
  })
})
