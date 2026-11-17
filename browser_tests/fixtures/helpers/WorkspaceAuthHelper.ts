import { expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import {
  defaultWorkspaceTokenResponse,
  mockPersonalWorkspace,
  mockTeamWorkspace,
  mockWorkspacesRemoteConfig
} from '@e2e/fixtures/data/workspaceAuthFixtures'
import { mockWebSessionServer } from '@e2e/fixtures/utils/webSessionMocks'
import { mockWorkspaceList } from '@e2e/fixtures/utils/workspaceMocks'

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

    await mockWorkspaceList(this.page, [
      mockPersonalWorkspace,
      mockTeamWorkspace
    ])

    await this.page.route('**/api/auth/token', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(defaultWorkspaceTokenResponse)
      })
    )

    await mockWebSessionServer(this.page)
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
