import { zExchangeTokenRequest } from '@comfyorg/ingest-types/zod'
import { expect } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  makeWorkspaceTokenResponse,
  mockTeamWorkspace
} from '@e2e/fixtures/data/workspaceAuthFixtures'
import { WorkspaceAuthHelper } from '@e2e/fixtures/helpers/WorkspaceAuthHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const test = comfyPageFixture.extend<{ workspaceAuth: WorkspaceAuthHelper }>({
  page: async ({ page }, use) => {
    const helper = new WorkspaceAuthHelper(page)
    await helper.mockWorkspaceRoutes()
    await use(page)
  },
  workspaceAuth: async ({ page }, use) => {
    await use(new WorkspaceAuthHelper(page))
  }
})

test.describe('Workspace auth refresh', { tag: '@cloud' }, () => {
  test('transient token refresh failure preserves the active workspace session', async ({
    comfyPage,
    workspaceAuth
  }) => {
    const page = comfyPage.page
    const expiresInMs = 5 * 60 * 1000 - 500
    let teamMints = 0

    await workspaceAuth.mockTokenRoute((route) => {
      const body = zExchangeTokenRequest.parse(route.request().postDataJSON())
      if (body.workspace_id !== mockTeamWorkspace.id) return route.fallback()
      teamMints++
      if (teamMints === 1) {
        return route.fulfill(
          jsonRoute(
            makeWorkspaceTokenResponse(
              mockTeamWorkspace,
              'original-token',
              expiresInMs
            )
          )
        )
      }
      return route.fulfill({
        status: 500,
        json: { message: 'Internal Server Error' }
      })
    })
    const probeAuthorizations: (string | undefined)[] = []
    await page.route('**/api/workspace-auth-probe', (route) => {
      probeAuthorizations.push(route.request().headers()['authorization'])
      return route.fulfill(jsonRoute({}))
    })
    const failedRefresh = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/auth/token' &&
        response.status() === 500
    )

    await comfyPage.toast.closeToasts()
    await workspaceAuth.openSwitcherPanel()
    await page
      .getByTestId('workspace-switcher-panel')
      .getByText('Team Workspace')
      .click()

    await test.step('the refresh of the team token fails transiently', async () => {
      await failedRefresh
      await comfyPage.waitForAppReady()
    })

    await test.step('the team session keeps serving requests', async () => {
      await page.evaluate(() =>
        window.app!.api.fetchApi('/workspace-auth-probe')
      )
      expect(probeAuthorizations).toEqual(['Bearer original-token'])
      expect(
        await page.evaluate(() =>
          sessionStorage.getItem('Comfy.Workspace.Current')
        )
      ).toContain(mockTeamWorkspace.id)
    })
  })

  test('permanent auth failure (ACCESS_DENIED) clears the workspace session', async ({
    comfyPage,
    workspaceAuth
  }) => {
    const page = comfyPage.page

    // TOKEN_REFRESH_BUFFER_MS is 5 minutes. Setting expiresInMs just below the
    // buffer means scheduleTokenRefresh computes delay ≈ 0 and fires immediately.
    const expiresInMs = 5 * 60 * 1000 - 500
    let callCount = 0

    await workspaceAuth.mockTokenRoute((route) => {
      callCount++
      if (callCount === 1) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            makeWorkspaceTokenResponse(
              mockTeamWorkspace,
              'original-token',
              expiresInMs
            )
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
    await workspaceAuth.openSwitcherPanel()
    await page
      .getByTestId('workspace-switcher-panel')
      .getByText('Team Workspace')
      .click()

    // Wait for both the switch (callCount=1) and the immediate refresh (callCount=2)
    // to complete. The refresh fires at delay≈0 so token may already be cleared
    // before we can assert the intermediate 'original-token' state.
    await expect
      .poll(() => callCount, { timeout: 5000 })
      .toBeGreaterThanOrEqual(2)

    // A 403 ACCESS_DENIED response must clear the workspace session entirely.
    await expect(async () => {
      expect(
        await page.evaluate(() =>
          sessionStorage.getItem('Comfy.Workspace.Token')
        )
      ).toBeNull()
      expect(
        await page.evaluate(() =>
          sessionStorage.getItem('Comfy.Workspace.Current')
        )
      ).toBeNull()
    }).toPass({ timeout: 5000 })
  })
})
