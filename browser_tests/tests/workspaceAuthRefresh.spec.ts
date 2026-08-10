import { expect } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  makeWorkspaceTokenResponse,
  mockTeamWorkspace
} from '@e2e/fixtures/data/workspaceAuthFixtures'
import { WorkspaceAuthHelper } from '@e2e/fixtures/helpers/WorkspaceAuthHelper'

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
  test('token is persisted to sessionStorage after switching workspace', async ({
    comfyPage,
    workspaceAuth
  }) => {
    const page = comfyPage.page

    await workspaceAuth.mockTokenRoute((route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          makeWorkspaceTokenResponse(mockTeamWorkspace, 'team-token')
        )
      })
    )

    await comfyPage.toast.closeToasts()
    await workspaceAuth.openSwitcherPanel()
    await page
      .getByTestId('workspace-switcher-panel')
      .getByText('Team Workspace')
      .click()

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

  test('transient token refresh failure preserves the active workspace session', async ({
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
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' })
      })
    })

    await comfyPage.toast.closeToasts()
    await workspaceAuth.openSwitcherPanel()
    await page
      .getByTestId('workspace-switcher-panel')
      .getByText('Team Workspace')
      .click()

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
    await expect
      .poll(() => callCount, { timeout: 5000 })
      .toBeGreaterThanOrEqual(2)

    expect(
      await page.evaluate(() => sessionStorage.getItem('Comfy.Workspace.Token'))
    ).toBe('original-token')
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
    await expect
      .poll(
        () =>
          page.evaluate(() => sessionStorage.getItem('Comfy.Workspace.Token')),
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
