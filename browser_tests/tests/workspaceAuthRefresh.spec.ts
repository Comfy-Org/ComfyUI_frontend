import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { WorkspaceWithRole } from '@/platform/workspace/api/workspaceApi'
import type { WorkspaceTokenResponse } from '@/platform/workspace/stores/workspaceAuthStore'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

const mockRemoteConfig: RemoteConfig = { team_workspaces_enabled: true }

const mockPersonalWorkspace: WorkspaceWithRole = {
  id: 'ws-personal',
  name: 'Personal Workspace',
  type: 'personal',
  created_at: '2026-01-01T00:00:00Z',
  joined_at: '2026-01-01T00:00:00Z',
  role: 'owner'
}

const mockTeamWorkspace: WorkspaceWithRole = {
  id: 'ws-team',
  name: 'Team Workspace',
  type: 'team',
  created_at: '2026-01-02T00:00:00Z',
  joined_at: '2026-01-02T00:00:00Z',
  role: 'member'
}

function makeTokenResponse(
  workspace: WorkspaceWithRole,
  token: string,
  expiresInMs = 60 * 60 * 1000
): WorkspaceTokenResponse {
  return {
    token,
    expires_at: new Date(Date.now() + expiresInMs).toISOString(),
    workspace: {
      id: workspace.id,
      name: workspace.name,
      type: workspace.type
    },
    role: workspace.role,
    permissions: []
  }
}

// On app boot, teamWorkspaceStore.initialize() auto-selects Personal Workspace
// (personal type, no prior localStorage) and calls switchWorkspace → /api/auth/token.
// This default stub absorbs that init call so per-test mocks only see explicit switches.
const defaultTokenResponse = makeTokenResponse(mockPersonalWorkspace, 'init-token')

const test = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    await page.route('**/api/features', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRemoteConfig)
      })
    )

    await page.route('**/api/workspaces', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback()
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          workspaces: [mockPersonalWorkspace, mockTeamWorkspace]
        })
      })
    })

    // Default stub for the init-time auto-switch. Per-test mocks added later
    // take priority (Playwright matches routes LIFO) and handle explicit switches.
    await page.route('**/api/auth/token', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(defaultTokenResponse)
      })
    )

    await use(page)
  }
})

// Opens the profile popover then the workspace-switcher panel.
// useWorkspaceSwitch skips switchWorkspace when the target is already active,
// so always switch to a workspace other than the auto-selected Personal one.
async function openSwitcherPanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Current user' }).click()
  await page.getByTestId('workspace-switcher-trigger').click()
}

test.describe('Workspace auth refresh', { tag: '@cloud' }, () => {
  test('token is persisted to sessionStorage after switching workspace', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    // Override: explicit switch to Team Workspace returns a specific token.
    await page.route('**/api/auth/token', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeTokenResponse(mockTeamWorkspace, 'team-token'))
      })
    )

    await comfyPage.toast.closeToasts()
    await openSwitcherPanel(page)
    await page.getByText('Team Workspace').click()

    await expect
      .poll(
        () =>
          page.evaluate(() => sessionStorage.getItem('Comfy.Workspace.Token')),
        { timeout: 5000 }
      )
      .toBe('team-token')

    const expiresAt = await page.evaluate(() =>
      sessionStorage.getItem('Comfy.Workspace.ExpiresAt')
    )
    expect(Number(expiresAt)).toBeGreaterThan(Date.now())
  })

  test('switching back to personal workspace replaces sessionStorage token', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    let callCount = 0
    await page.route('**/api/auth/token', (route) => {
      callCount++
      const body =
        callCount === 1
          ? makeTokenResponse(mockTeamWorkspace, 'team-token')
          : makeTokenResponse(mockPersonalWorkspace, 'personal-token')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body)
      })
    })

    await comfyPage.toast.closeToasts()

    // Switch to Team (not the auto-selected Personal)
    await openSwitcherPanel(page)
    await page.getByText('Team Workspace').click()

    await expect
      .poll(
        () => page.evaluate(() => sessionStorage.getItem('Comfy.Workspace.Token')),
        { timeout: 5000 }
      )
      .toBe('team-token')

    // Switch back to Personal — different from current, so switchWorkspace fires
    await openSwitcherPanel(page)
    await page.getByText('Personal Workspace').click()

    await expect
      .poll(
        () =>
          page.evaluate(() => sessionStorage.getItem('Comfy.Workspace.Token')),
        { timeout: 5000 }
      )
      .toBe('personal-token')

    expect(
      await page.evaluate(() =>
        sessionStorage.getItem('Comfy.Workspace.Current')
      )
    ).toContain('ws-personal')
  })

  test('transient token refresh failure preserves the active workspace session', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    // TOKEN_REFRESH_BUFFER_MS is 5 minutes. Setting expiresInMs just below the
    // buffer means scheduleTokenRefresh computes delay ≈ 0 and fires immediately.
    const expiresInMs = 5 * 60 * 1000 - 500
    let callCount = 0

    await page.route('**/api/auth/token', (route) => {
      callCount++
      if (callCount === 1) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            makeTokenResponse(mockTeamWorkspace, 'original-token', expiresInMs)
          )
        })
      }
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' })
      })
    })

    await comfyPage.toast.closeToasts()
    await openSwitcherPanel(page)
    await page.getByText('Team Workspace').click()

    await expect
      .poll(
        () =>
          page.evaluate(() => sessionStorage.getItem('Comfy.Workspace.Token')),
        { timeout: 5000 }
      )
      .toBe('original-token')

    // The scheduled refresh fires immediately (token expires within buffer window).
    // Wait for the second route call (the failing refresh) to complete, then verify
    // the token is preserved — a transient 500 must not clear the session.
    await expect.poll(() => callCount, { timeout: 5000 }).toBe(2)

    expect(
      await page.evaluate(() => sessionStorage.getItem('Comfy.Workspace.Token'))
    ).toBe('original-token')
  })

  test('permanent auth failure (ACCESS_DENIED) clears the workspace session', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    // TOKEN_REFRESH_BUFFER_MS is 5 minutes. Setting expiresInMs just below the
    // buffer means scheduleTokenRefresh computes delay ≈ 0 and fires immediately.
    const expiresInMs = 5 * 60 * 1000 - 500
    let callCount = 0

    await page.route('**/api/auth/token', (route) => {
      callCount++
      if (callCount === 1) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            makeTokenResponse(mockTeamWorkspace, 'original-token', expiresInMs)
          )
        })
      }
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Access denied' })
      })
    })

    await comfyPage.toast.closeToasts()
    await openSwitcherPanel(page)
    await page.getByText('Team Workspace').click()

    await expect
      .poll(
        () =>
          page.evaluate(() => sessionStorage.getItem('Comfy.Workspace.Token')),
        { timeout: 5000 }
      )
      .toBe('original-token')

    // The scheduled refresh fires immediately (token expires within buffer window).
    // A 403 ACCESS_DENIED response must clear the workspace session entirely.
    await expect
      .poll(
        () => page.evaluate(() => sessionStorage.getItem('Comfy.Workspace.Token')),
        { timeout: 5000 }
      )
      .toBeNull()

    expect(
      await page.evaluate(() =>
        sessionStorage.getItem('Comfy.Workspace.Current')
      )
    ).toBeNull()
  })
})
