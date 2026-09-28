import { expect } from '@playwright/test'

import type {
  AgentMessage,
  AgentThreadListResponse
} from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'
import { unsafeStorageScope } from '@/platform/workflow/persistence/testUtils/storageScope'

import {
  LONG_WORKSPACE_NAME,
  OFF_SCREEN_WORKSPACE_NAME,
  PERSONAL_WORKSPACE_NAME,
  TEAM_WORKSPACE_NAME,
  createManyWorkspacesResponse
} from '@e2e/fixtures/data/workspaceSwitcher'
import { mockWorkspaceList } from '@e2e/fixtures/utils/workspaceMocks'
import { workspaceSwitcherTest as test } from '@e2e/fixtures/workspaceSwitcherFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

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

  test('isolates workflow and Agent state after a workspace switch and reload', async ({
    comfyPage
  }) => {
    test.slow()
    const page = comfyPage.page
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

    const messages = new Map<string, AgentMessage[]>([
      [
        personalThread,
        [
          {
            id: 'personal-message',
            thread_id: personalThread,
            turn_id: '11111111-1111-4111-8111-111111111112',
            seq: 1,
            role: 'user',
            status: 'complete',
            content: { text: personalTranscript }
          }
        ]
      ],
      [
        teamThread,
        [
          {
            id: 'team-message',
            thread_id: teamThread,
            turn_id: '22222222-2222-4222-8222-222222222223',
            seq: 1,
            role: 'user',
            status: 'complete',
            content: { text: teamTranscript }
          }
        ]
      ]
    ])
    const threads: AgentThreadListResponse = {
      threads: [
        {
          id: personalThread,
          title: 'Personal thread sentinel',
          preview: personalTranscript,
          workflow_id: personalBinding,
          status: 'active',
          message_count: 1,
          created_at: '2026-09-28T00:00:00Z',
          updated_at: '2026-09-28T00:00:00Z',
          last_message_at: '2026-09-28T00:00:00Z'
        },
        {
          id: teamThread,
          title: 'Team thread sentinel',
          preview: teamTranscript,
          workflow_id: teamBinding,
          status: 'active',
          message_count: 1,
          created_at: '2026-09-28T00:00:00Z',
          updated_at: '2026-09-28T00:00:00Z',
          last_message_at: '2026-09-28T00:00:00Z'
        }
      ],
      pagination: { offset: 0, limit: 100, total: 2, has_more: false }
    }
    await page.route('**/api/agent/threads', (route) =>
      route.fulfill(jsonRoute(threads))
    )
    await page.route('**/api/agent/threads/*/messages', (route) => {
      const threadId = new URL(route.request().url()).pathname.split('/').at(-2)
      return route.fulfill(jsonRoute(messages.get(threadId ?? '') ?? []))
    })
    await page.route('**/api/features', (route) =>
      route.fulfill(
        jsonRoute({
          unified_cloud_auth: true,
          'agent-in-app-experience': true
        })
      )
    )
    await page.evaluate(
      ({
        personalThreadKey,
        teamThreadKey,
        personalBindingKey,
        teamBindingKey,
        personalThread,
        teamThread,
        personalBinding,
        teamBinding
      }) => {
        localStorage.setItem(personalThreadKey, personalThread)
        localStorage.setItem(teamThreadKey, teamThread)
        localStorage.setItem(
          personalBindingKey,
          JSON.stringify({ [personalBinding]: 'workflows/personal.json' })
        )
        localStorage.setItem(
          teamBindingKey,
          JSON.stringify({ [teamBinding]: 'workflows/team.json' })
        )
      },
      {
        personalThreadKey: StorageKeys.agentThread(personalScope),
        teamThreadKey: StorageKeys.agentThread(teamScope),
        personalBindingKey: StorageKeys.agentWorkflowTabBindings(personalScope),
        teamBindingKey: StorageKeys.agentWorkflowTabBindings(teamScope),
        personalThread,
        teamThread,
        personalBinding,
        teamBinding
      }
    )
    await comfyPage.workflow.reloadAndWaitForApp()

    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )
    await comfyPage.menu.topbar.saveWorkflow(personalWorkflow)
    await page
      .getByRole('button', { name: enMessages.agent.entryButton, exact: true })
      .click()
    const panel = page.locator('#agent-panel-root')
    await expect(panel.getByTestId('user-message-bubble')).toHaveText([
      personalTranscript
    ])
    await expect(panel.getByText(teamTranscript)).toHaveCount(0)

    await page.getByRole('button', { name: 'Current user' }).click()
    await page.getByTestId('workspace-switcher-trigger').click()
    await page
      .getByTestId('workspace-switcher-panel')
      .getByText(TEAM_WORKSPACE_NAME, { exact: true })
      .click()
    await comfyPage.waitForAppReady()

    await expect
      .poll(() => comfyPage.menu.topbar.getTabNames())
      .not.toContain(personalWorkflow)
    await comfyPage.menu.topbar.saveWorkflow(teamWorkflow)
    await expect(panel.getByTestId('user-message-bubble')).toHaveText([
      teamTranscript
    ])
    await expect(panel.getByText(personalTranscript)).toHaveCount(0)

    await comfyPage.workflow.reloadAndWaitForApp()
    await expect
      .poll(() => comfyPage.menu.topbar.getTabNames())
      .toContain(teamWorkflow)
    await expect
      .poll(() => comfyPage.menu.topbar.getTabNames())
      .not.toContain(personalWorkflow)
    await expect(panel.getByTestId('user-message-bubble')).toHaveText([
      teamTranscript
    ])

    const persistedBindings = await page.evaluate(
      ({ personalBindingKey, teamBindingKey }) => ({
        personal: localStorage.getItem(personalBindingKey),
        team: localStorage.getItem(teamBindingKey)
      }),
      {
        personalBindingKey: StorageKeys.agentWorkflowTabBindings(personalScope),
        teamBindingKey: StorageKeys.agentWorkflowTabBindings(teamScope)
      }
    )
    expect(persistedBindings.personal).toContain(personalBinding)
    expect(persistedBindings.personal).not.toContain(teamBinding)
    expect(persistedBindings.team).toContain(teamBinding)
    expect(persistedBindings.team).not.toContain(personalBinding)
  })
})
