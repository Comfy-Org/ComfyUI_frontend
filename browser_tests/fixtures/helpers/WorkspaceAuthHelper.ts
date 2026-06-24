import { expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import {
  defaultWorkspaceTokenResponse,
  mockPersonalWorkspace,
  mockTeamWorkspace,
  mockWorkspacesRemoteConfig
} from '@e2e/fixtures/data/workspaceAuthFixtures'

export class WorkspaceAuthHelper {
  constructor(private readonly page: Page) {}

  async mockWorkspaceRoutes(): Promise<void> {
    await this.page.route('**/api/features', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockWorkspacesRemoteConfig)
      })
    )

    await this.page.route('**/api/workspaces', async (route) => {
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

    // Default stub for the init-time auto-switch. Per-test mocks added via
    // mockTokenRoute() take priority (Playwright matches routes LIFO).
    await this.page.route('**/api/auth/token', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(defaultWorkspaceTokenResponse)
      })
    )
  }

  async mockTokenRoute(
    handler: (route: Route) => void | Promise<void>
  ): Promise<void> {
    await this.page.route('**/api/auth/token', handler)
  }

  // Opens the profile popover then the workspace-switcher panel.
  // useWorkspaceSwitch skips switchWorkspace when the target is already active,
  // so always switch to a workspace other than the auto-selected Personal one.
  async openSwitcherPanel(): Promise<void> {
    await this.page.keyboard.press('Escape')
    await this.page.getByRole('button', { name: 'Current user' }).click()
    await this.page.getByTestId('workspace-switcher-trigger').click()
    await expect(
      this.page.getByTestId('workspace-switcher-panel')
    ).toBeVisible()
  }
}
