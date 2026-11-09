import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  HOST_PERSONAL_WORKSPACE,
  HOST_TEAM_WORKSPACE,
  agentFullscreenDesktopTest as test
} from '@e2e/fixtures/agentFullscreenDesktopFixture'

test.describe(
  'Agent full screen inside a Desktop host',
  { tag: ['@agent', '@ui'] },
  () => {
    test('covers the window and leaves the graph inert', async ({
      agentFullscreen,
      page
    }) => {
      const viewport = page.viewportSize()

      await agentFullscreen.enter()

      await expect
        .poll(() => agentFullscreen.panel.dockedPanel.boundingBox())
        .toEqual({ x: 0, y: 0, ...viewport })
      await expect(agentFullscreen.workspace).toHaveJSProperty('inert', true)
      await expect(agentFullscreen.sidebar).toBeVisible()
    })

    test('lists the host workspaces without offering to create one', async ({
      agentFullscreen
    }) => {
      await agentFullscreen.enter()

      await agentFullscreen.accountMenuButton.click()

      await expect(
        agentFullscreen.workspaceOption(HOST_PERSONAL_WORKSPACE.name)
      ).toBeChecked()
      await expect(
        agentFullscreen.workspaceOption(HOST_TEAM_WORKSPACE.name)
      ).not.toBeChecked()
      await expect(
        agentFullscreen.accountMenuItem(
          enMessages.agent.account.createWorkspace
        )
      ).toHaveCount(0)
      await expect(
        agentFullscreen.accountMenu.getByText(
          enMessages.workspaceSwitcher.scopeCaption
        )
      ).toBeVisible()
    })

    test('switches the host workspace without reloading', async ({
      agentFullscreen,
      hostAuth
    }) => {
      await agentFullscreen.enter()
      const loadsBeforeSwitch = hostAuth.navigations
      await agentFullscreen.accountMenuButton.click()

      await agentFullscreen.workspaceOption(HOST_TEAM_WORKSPACE.name).click()

      await expect
        .poll(() => hostAuth.switches)
        .toEqual([HOST_TEAM_WORKSPACE.id])
      await expect(agentFullscreen.accountMenuButton).toHaveText(
        new RegExp(HOST_TEAM_WORKSPACE.name)
      )
      expect(hostAuth.navigations).toBe(loadsBeforeSwitch)
    })

    test('signs the host out from Log out and returns to the dock', async ({
      agentFullscreen,
      hostAuth
    }) => {
      await agentFullscreen.enter()
      await agentFullscreen.accountMenuButton.click()

      await agentFullscreen
        .accountMenuItem(enMessages.agent.account.logOut)
        .click()

      await expect.poll(() => hostAuth.signOuts).toBe(1)
      await agentFullscreen.expectPresentation('docked')
      await expect(agentFullscreen.sidebar).toHaveCount(0)
    })
  }
)
