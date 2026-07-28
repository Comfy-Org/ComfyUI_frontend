import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type {
  AutoReloadResponse,
  UpdateAutoReloadRequest,
  WorkspaceWithRole
} from '@/platform/workspace/api/workspaceApi'
import type { WorkspaceTokenResponse } from '@/platform/workspace/stores/workspaceAuthStore'

import {
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const workspaces = [
  {
    id: 'ws-personal',
    name: 'Personal Workspace',
    type: 'personal',
    role: 'owner',
    created_at: '2026-01-01T00:00:00Z',
    joined_at: '2026-01-01T00:00:00Z'
  },
  {
    id: 'ws-team',
    name: 'My Team',
    type: 'team',
    role: 'owner',
    created_at: '2026-01-02T00:00:00Z',
    joined_at: '2026-01-02T00:00:00Z'
  }
] satisfies WorkspaceWithRole[]

const persistedByWorkspace: Record<string, AutoReloadResponse> = {
  'ws-personal': {
    configured: true,
    enabled: true,
    threshold_credits: 1000,
    reload_credits: 5000,
    monthly_budget_cents: 50_000,
    spent_this_cycle_cents: 2500
  },
  'ws-team': {
    configured: true,
    enabled: true,
    threshold_credits: 3000,
    reload_credits: 7000,
    monthly_budget_cents: null,
    spent_this_cycle_cents: 0
  }
}

function workspaceIdFromAuth(request: Request) {
  const authorization = request.headers().authorization
  expect(authorization).toMatch(/^Bearer (mock-workspace-token|token-ws-)/)
  return authorization === 'Bearer token-ws-team' ? 'ws-team' : 'ws-personal'
}

async function openWorkspaceSettings(page: Page) {
  await page
    .getByRole('button', { name: /^Settings/ })
    .first()
    .click()
  const dialog = page.getByTestId('settings-dialog')
  await expect(dialog).toBeVisible()
  await dialog.locator('nav').getByRole('button', { name: 'Workspace' }).click()
  return dialog
}

test.describe('Auto-reload persistence', { tag: '@cloud' }, () => {
  test.beforeEach(async ({ page }) => {
    await mockCloudBoot(page, {
      features: {
        team_workspaces_enabled: true,
        billing_control_enabled: true
      } satisfies RemoteConfig,
      settings: {
        'Comfy.Assets.UseAssetAPI': false,
        'Comfy.TutorialCompleted': true
      }
    })
    await mockBilling(page)
    await bootCloud(page)

    await page.route('**/api/workspaces', (route) =>
      route.fulfill(jsonRoute({ workspaces }))
    )
    await page.route('**/api/auth/token', async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}') as {
        workspace_id?: string
      }
      const workspaceId = body.workspace_id ?? 'ws-personal'
      const selected = workspaces.find(({ id }) => id === workspaceId)!
      const response: WorkspaceTokenResponse = {
        token: `token-${workspaceId}`,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        workspace: {
          id: selected.id,
          name: selected.name,
          type: selected.type
        },
        role: selected.role,
        permissions: []
      }
      await route.fulfill(jsonRoute(response))
    })
    await page.route('**/api/workspace/members**', (route) =>
      route.fulfill(
        jsonRoute({
          members: [],
          pagination: { offset: 0, limit: 50, total: 0 }
        })
      )
    )
    await page.route('**/api/billing/auto-reload', async (route) => {
      const request = route.request()
      const workspaceId = workspaceIdFromAuth(request)
      if (request.method() === 'GET') {
        await route.fulfill(jsonRoute(persistedByWorkspace[workspaceId]))
        return
      }

      expect(request.method()).toBe('PUT')
      const payload = JSON.parse(
        request.postData() ?? '{}'
      ) as UpdateAutoReloadRequest
      expect(payload).toEqual({
        enabled: false,
        threshold_credits: 1000,
        reload_credits: 5000,
        monthly_budget_cents: 50_000
      })
      persistedByWorkspace[workspaceId] = {
        configured: true,
        ...payload,
        spent_this_cycle_cents: 2500
      }
      await route.fulfill(jsonRoute(persistedByWorkspace[workspaceId]))
    })

    await page.goto(APP_URL)
    await waitForCloudApp(page)
  })

  test('uses authenticated GET/PUT and rehydrates after reload and workspace switch', async ({
    page
  }) => {
    test.setTimeout(90_000)
    let dialog = await openWorkspaceSettings(page)
    await expect(dialog.getByText('5,000', { exact: true })).toBeVisible()

    await dialog
      .getByRole('switch', { name: 'Enable credit auto-reload' })
      .click()
    await expect(dialog.getByText('Off', { exact: true })).toBeVisible()

    await page.reload()
    await waitForCloudApp(page)
    dialog = await openWorkspaceSettings(page)
    await expect(dialog.getByText('Off', { exact: true })).toBeVisible()
    await expect(dialog.getByText('5,000', { exact: true })).toBeVisible()

    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Current user' }).click()
    await page.getByText('Personal Workspace', { exact: true }).click()
    await page.getByText('My Team', { exact: true }).click()
    await waitForCloudApp(page)

    dialog = await openWorkspaceSettings(page)
    await expect(dialog.getByText('7,000', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Enabled', { exact: true })).toBeVisible()
  })
})
