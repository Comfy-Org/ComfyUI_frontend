import { expect } from '@playwright/test'

import {
  LONG_WORKSPACE_NAME,
  OFF_SCREEN_WORKSPACE_NAME,
  PERSONAL_WORKSPACE_NAME,
  TEAM_WORKSPACE_NAME,
  createManyWorkspacesResponse
} from '@e2e/fixtures/data/workspaceSwitcher'
import { mockWorkspaceList } from '@e2e/fixtures/utils/workspaceMocks'
import { workspaceSwitcherTest as test } from '@e2e/fixtures/workspaceSwitcherFixture'

// text-sm rows render a single 20px line; a wrapped name is 40px+.
const SINGLE_LINE_MAX_HEIGHT_PX = 28

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
    await expect(
      panel.getByText('Workspaces only affect which credits you use.')
    ).toHaveCount(0)

    const profileMenu = page.locator('.current-user-popover')
    const panelBox = await panel.boundingBox()
    const profileBox = await profileMenu.boundingBox()
    expect(panelBox).not.toBeNull()
    expect(profileBox).not.toBeNull()
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(profileBox!.x)
  })

  test(
    'scrolls the list to reveal workspaces past the visible area',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const page = comfyPage.page

      await mockWorkspaceList(page, createManyWorkspacesResponse())

      // Workspace list is fetched once on boot; reload to pick up the override.
      await comfyPage.workflow.reloadAndWaitForApp()

      await comfyPage.toast.closeToasts()
      await page.getByRole('button', { name: 'Current user' }).click()
      await page.getByTestId('workspace-switcher-trigger').click()

      const list = page.getByTestId('workspace-switcher-list')
      await expect(list).toBeVisible()
      const offScreenRow = list.getByText(OFF_SCREEN_WORKSPACE_NAME)

      // toBeInViewport() passes via window scroll too, so drive a real wheel
      // scroll to assert the list itself scrolls.
      await expect(offScreenRow).not.toBeInViewport()

      await list.hover()
      await page.mouse.wheel(0, 2000)

      await expect
        .poll(() => list.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(0)
      await expect
        .poll(() => page.evaluate(() => document.scrollingElement?.scrollTop))
        .toBe(0)
      await expect(offScreenRow).toBeInViewport()

      await comfyPage.expectScreenshot(list, 'workspace-switcher-scrolled.png')
    }
  )

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

  test('refreshes billing capabilities after switching workspaces', async ({
    comfyPage
  }) => {
    const page = comfyPage.page

    await comfyPage.toast.closeToasts()
    await page.getByRole('button', { name: 'Current user' }).click()
    await expect(page.getByTestId('add-credits-button')).toBeVisible()
    await page.getByTestId('workspace-switcher-trigger').click()
    await page
      .getByTestId('workspace-switcher-panel')
      .getByText(LONG_WORKSPACE_NAME, { exact: true })
      .click()
    await comfyPage.waitForAppReady()

    await page.getByRole('button', { name: 'Current user' }).click()
    // Only a capability read the mock resolved for the target workspace's
    // bearer token renders this button; an idle, pending, aborted, denied or
    // unavailable read cannot — unlike the absent add-credits button below.
    await expect(
      page.getByTestId('upgrade-to-add-credits-button')
    ).toBeVisible()
    await expect(page.getByTestId('add-credits-button')).toHaveCount(0)
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
