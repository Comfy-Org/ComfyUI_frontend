import { expect, mergeTests } from '@playwright/test'

import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import { unsafeStorageScope } from '@/platform/workflow/persistence/testUtils/storageScope'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  LONG_WORKSPACE_NAME,
  OFF_SCREEN_WORKSPACE_NAME,
  PERSONAL_WORKSPACE_NAME,
  TEAM_WORKSPACE_NAME,
  createManyWorkspacesResponse
} from '@e2e/fixtures/data/workspaceSwitcher'
import { identityPersistenceFixture } from '@e2e/fixtures/identityPersistenceFixture'
import { mockWorkspaceList } from '@e2e/fixtures/utils/workspaceMocks'
import { workspaceSwitcherTest } from '@e2e/fixtures/workspaceSwitcherFixture'

const test = mergeTests(workspaceSwitcherTest, identityPersistenceFixture)

// text-sm rows render a single 20px line; a wrapped name is 40px+.
const SINGLE_LINE_MAX_HEIGHT_PX = 28

test.describe('Workspace switcher', { tag: '@cloud' }, () => {
  test('renders a long team workspace name on a single line', async ({
    comfyPage,
    workspaceAuth
  }) => {
    const page = comfyPage.page

    await comfyPage.toast.closeToasts()
    await workspaceAuth.openSwitcherPanel()

    const longName = page.getByText(LONG_WORKSPACE_NAME)
    await expect(longName).toBeVisible()
    await expect
      .poll(async () => (await longName.boundingBox())?.height ?? Infinity)
      .toBeLessThan(SINGLE_LINE_MAX_HEIGHT_PX)
  })

  test('opens the switcher to the left of the profile menu without overlap', async ({
    comfyPage,
    workspaceAuth
  }) => {
    const page = comfyPage.page

    await comfyPage.toast.closeToasts()
    await workspaceAuth.openSwitcherPanel()

    const panel = page.getByTestId('workspace-switcher-panel')
    await expect(panel).toBeVisible()
    await expect(
      panel.getByText('Workspaces only affect which credits you use.')
    ).toHaveCount(0)

    const profileMenu = page.locator('.current-user-popover')
    await expect
      .poll(async () => {
        const [panelBox, profileBox] = await Promise.all([
          panel.boundingBox(),
          profileMenu.boundingBox()
        ])
        return (
          panelBox !== null &&
          profileBox !== null &&
          panelBox.x + panelBox.width <= profileBox.x
        )
      })
      .toBe(true)
  })

  test(
    'scrolls the list to reveal workspaces past the visible area',
    { tag: '@screenshot' },
    async ({ comfyPage, workspaceAuth }) => {
      const page = comfyPage.page

      await mockWorkspaceList(page, createManyWorkspacesResponse())

      // Workspace list is fetched once on boot; reload to pick up the override.
      await comfyPage.workflow.reloadAndWaitForApp()

      await comfyPage.toast.closeToasts()
      await workspaceAuth.openSwitcherPanel()

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
    comfyPage,
    workspaceAuth
  }) => {
    const page = comfyPage.page

    await comfyPage.toast.closeToasts()
    await workspaceAuth.openSwitcherPanel()

    await page.getByText('Create a workspace').click()

    await expect(
      page.getByText(
        'Workspaces keep your projects and files organized. Subscribe to a Team plan to invite members.'
      )
    ).toBeVisible()
    await expect(page.getByPlaceholder('Ex: Comfy Org')).toBeVisible()
  })

  test('refreshes billing capabilities after switching workspaces', async ({
    comfyPage,
    workspaceAuth
  }) => {
    const page = comfyPage.page

    await comfyPage.toast.closeToasts()
    await page.getByRole('button', { name: 'Current user' }).click()
    await expect(page.getByTestId('add-credits-button')).toBeVisible()
    await workspaceAuth.openSwitcherPanel()
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
    comfyPage,
    workspaceAuth
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
    await workspaceAuth.openSwitcherPanel()
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

    await workspaceAuth.openSwitcherPanel()
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

    await workspaceAuth.openSwitcherPanel()
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

  test('isolates workflow and Agent state after a workspace switch and reload', async ({
    comfyPage,
    identityPersistence,
    workspaceAuth
  }) => {
    test.slow()
    const page = comfyPage.page
    const agentPanel = new AgentPanel(page)
    const userId = 'test-user-e2e'
    const personalScope = unsafeStorageScope(`${userId}:ws-personal`)
    const teamScope = unsafeStorageScope(`${userId}:ws-team`)
    const personalThread = '11111111-1111-4111-8111-111111111111'
    const teamThread = '22222222-2222-4222-8222-222222222222'
    const personalTranscript = 'personal transcript sentinel'
    const teamTranscript = 'team transcript sentinel'
    const personalWorkflow = 'personal draft sentinel'
    const teamWorkflow = 'team draft sentinel'
    const personalBinding = 'personal-binding-sentinel'
    const teamBinding = 'team-binding-sentinel'
    const identityStates = [
      {
        userId,
        workspaceId: 'ws-personal',
        threadId: personalThread,
        transcript: personalTranscript,
        bindingId: personalBinding,
        tabPath: 'workflows/personal.json'
      },
      {
        userId,
        workspaceId: 'ws-team',
        threadId: teamThread,
        transcript: teamTranscript,
        bindingId: teamBinding,
        tabPath: 'workflows/team.json'
      }
    ]

    await test.step('Seed Agent state for both workspaces', async () => {
      await identityPersistence.mockAgentApi(identityStates)
      await page.route('**/api/features', (route) =>
        route.fulfill({
          json: {
            unified_cloud_auth: true,
            'agent-in-app-experience': true
          }
        })
      )
      await identityPersistence.seed(identityStates)
      await comfyPage.workflow.reloadAndWaitForApp()
    })

    await test.step('Establish the personal workspace state', async () => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.WorkflowTabsPosition',
        'Topbar'
      )
      await comfyPage.menu.topbar.saveWorkflow(personalWorkflow)
      await agentPanel.open()
      await expect(agentPanel.userMessages).toHaveText([personalTranscript])
      await expect(agentPanel.root.getByText(teamTranscript)).toHaveCount(0)
      await agentPanel.close()
    })

    await test.step('Switch to and establish the team workspace state', async () => {
      await workspaceAuth.openSwitcherPanel()
      await page
        .getByTestId('workspace-switcher-panel')
        .getByText(TEAM_WORKSPACE_NAME, { exact: true })
        .click()
      await comfyPage.waitForAppReady()

      await expect
        .poll(() => comfyPage.menu.topbar.getTabNames())
        .not.toContain(personalWorkflow)
      await comfyPage.menu.topbar.saveWorkflow(teamWorkflow)
      await agentPanel.open()
      await expect(agentPanel.userMessages).toHaveText([teamTranscript])
      await expect(agentPanel.root.getByText(personalTranscript)).toHaveCount(0)
      await agentPanel.close()
    })

    await test.step('Reload the team workspace and verify isolation', async () => {
      await comfyPage.workflow.reloadAndWaitForApp()
      await expect
        .poll(() => comfyPage.menu.topbar.getTabNames())
        .toContain(teamWorkflow)
      await expect
        .poll(() => comfyPage.menu.topbar.getTabNames())
        .not.toContain(personalWorkflow)
      await agentPanel.open()
      await expect(agentPanel.userMessages).toHaveText([teamTranscript])
      await agentPanel.close()

      const persistedBindings = await page.evaluate(
        ({ personalBindingKey, teamBindingKey }) => ({
          personal: localStorage.getItem(personalBindingKey),
          team: localStorage.getItem(teamBindingKey)
        }),
        {
          personalBindingKey:
            StorageKeys.agentWorkflowTabBindings(personalScope),
          teamBindingKey: StorageKeys.agentWorkflowTabBindings(teamScope)
        }
      )
      expect(persistedBindings.personal).toContain(personalBinding)
      expect(persistedBindings.personal).not.toContain(teamBinding)
      expect(persistedBindings.team).toContain(teamBinding)
      expect(persistedBindings.team).not.toContain(personalBinding)
    })
  })
})
