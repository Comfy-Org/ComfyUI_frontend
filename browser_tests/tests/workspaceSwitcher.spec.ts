import { expect } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { WorkspaceWithRole } from '@/platform/workspace/api/workspaceApi'
import type { WorkspaceTokenResponse } from '@/platform/workspace/stores/workspaceAuthStore'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

const PERSONAL_WORKSPACE_NAME = 'Personal Workspace'
const LONG_WORKSPACE_NAME =
  'Quantum Renaissance Collective for Hyperdimensional Latent Diffusion Research and Experimental Workflow Engineering'
const TEAM_WORKSPACE_NAME = 'Team Workspace'

// text-sm rows render a single 20px line; a wrapped name is 40px+.
const SINGLE_LINE_MAX_HEIGHT_PX = 28

const mockRemoteConfig: RemoteConfig = {
  team_workspaces_enabled: true,
  unified_cloud_auth: true
}

const mockListWorkspacesResponse: { workspaces: WorkspaceWithRole[] } = {
  workspaces: [
    {
      id: 'ws-personal',
      name: PERSONAL_WORKSPACE_NAME,
      type: 'personal',
      created_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z',
      role: 'owner'
    },
    {
      id: 'ws-team-long',
      name: LONG_WORKSPACE_NAME,
      type: 'team',
      created_at: '2026-01-02T00:00:00Z',
      joined_at: '2026-01-02T00:00:00Z',
      role: 'member'
    },
    {
      id: 'ws-team',
      name: TEAM_WORKSPACE_NAME,
      type: 'team',
      created_at: '2026-01-03T00:00:00Z',
      joined_at: '2026-01-03T00:00:00Z',
      role: 'owner'
    }
  ]
}

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
        body: JSON.stringify(mockListWorkspacesResponse)
      })
    })

    await page.route('**/api/auth/token', async (route) => {
      const requestBody = route.request().postDataJSON() as {
        workspace_id?: string
      }
      const workspaceId = requestBody.workspace_id ?? 'ws-personal'
      const workspace = mockListWorkspacesResponse.workspaces.find(
        ({ id }) => id === workspaceId
      )
      if (!workspace) {
        await route.fulfill({ status: 404 })
        return
      }

      const response: WorkspaceTokenResponse = {
        token: `mock-workspace-token-${workspace.id}`,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        workspace: {
          id: workspace.id,
          name: workspace.name,
          type: workspace.type
        },
        role: workspace.role,
        permissions: []
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      })
    })

    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ status: 204 })
    )

    await use(page)
  }
})

test.describe('Workspace switcher', { tag: '@cloud' }, () => {
  test('renders a long team workspace name on a single line', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    await comfyPage.toast.closeToasts()
    await page.getByRole('button', { name: 'Current user' }).click()
    await page.getByText(PERSONAL_WORKSPACE_NAME).click()

    const longName = page.getByText(LONG_WORKSPACE_NAME)
    await expect(longName).toBeVisible()

    const box = await longName.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeLessThan(SINGLE_LINE_MAX_HEIGHT_PX)
  })

  test('opens the switcher to the left of the profile menu without overlap', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    await comfyPage.toast.closeToasts()
    await page.getByRole('button', { name: 'Current user' }).click()
    await page.getByTestId('workspace-switcher-trigger').click()

    const panel = page.getByTestId('workspace-switcher-panel')
    await expect(panel).toBeVisible()

    const profileMenu = page.locator('.current-user-popover')
    const panelBox = await panel.boundingBox()
    const profileBox = await profileMenu.boundingBox()
    expect(panelBox).not.toBeNull()
    expect(profileBox).not.toBeNull()
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(profileBox!.x)
  })

  test('opens the create-workspace dialog with DES-246 copy', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    await comfyPage.toast.closeToasts()
    await page.getByRole('button', { name: 'Current user' }).click()
    await page.getByTestId('workspace-switcher-trigger').click()

    await page.getByText('Create a workspace').click()

    await expect(
      page.getByText(
        'Workspaces keep your projects and files organized. Subscribe to a Team plan to invite members.'
      )
    ).toBeVisible()
    await expect(page.getByPlaceholder('Ex: Comfy Org')).toBeVisible()
  })

  test('isolates all open workflow tabs between workspaces', async ({
    comfyPage
  }) => {
    test.slow()
    const page = comfyPage.page
    const suffix = Date.now().toString(36)
    const personalWorkflows = [`personal-a-${suffix}`, `personal-b-${suffix}`]
    const teamWorkflows = [`team-a-${suffix}`, `team-b-${suffix}`]

    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )
    await comfyPage.menu.topbar.saveWorkflow(personalWorkflows[0])
    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await comfyPage.menu.topbar.saveWorkflow(personalWorkflows[1])

    await comfyPage.toast.closeToasts()
    await page.getByRole('button', { name: 'Current user' }).click()
    await page.getByTestId('workspace-switcher-trigger').click()
    await page
      .getByTestId('workspace-switcher-panel')
      .getByText(TEAM_WORKSPACE_NAME, { exact: true })
      .click()
    await comfyPage.waitForAppReady()

    await expect
      .poll(() => comfyPage.menu.topbar.getTabNames())
      .not.toEqual(expect.arrayContaining(personalWorkflows))
    await comfyPage.menu.topbar.saveWorkflow(teamWorkflows[0])
    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await comfyPage.menu.topbar.saveWorkflow(teamWorkflows[1])

    await page.getByRole('button', { name: 'Current user' }).click()
    await page.getByTestId('workspace-switcher-trigger').click()
    await page
      .getByTestId('workspace-switcher-panel')
      .getByText(PERSONAL_WORKSPACE_NAME, { exact: true })
      .click()
    await comfyPage.waitForAppReady()

    await expect
      .poll(() => comfyPage.menu.topbar.getTabNames())
      .toEqual(personalWorkflows)
    await expect(comfyPage.menu.topbar.getActiveTab()).toContainText(
      personalWorkflows[1]
    )

    await comfyPage.workflow.reloadAndWaitForApp()
    await expect
      .poll(() => comfyPage.menu.topbar.getTabNames())
      .toEqual(personalWorkflows)

    await page.getByRole('button', { name: 'Current user' }).click()
    await page.getByTestId('workspace-switcher-trigger').click()
    await page
      .getByTestId('workspace-switcher-panel')
      .getByText(TEAM_WORKSPACE_NAME, { exact: true })
      .click()
    await comfyPage.waitForAppReady()

    await expect
      .poll(() => comfyPage.menu.topbar.getTabNames())
      .toEqual(teamWorkflows)
    await expect(comfyPage.menu.topbar.getActiveTab()).toContainText(
      teamWorkflows[1]
    )

    await comfyPage.workflow.reloadAndWaitForApp()
    await expect
      .poll(() => comfyPage.menu.topbar.getTabNames())
      .toEqual(teamWorkflows)
  })
})
