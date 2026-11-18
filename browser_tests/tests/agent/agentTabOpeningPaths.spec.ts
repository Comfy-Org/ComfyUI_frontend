import { expect } from '@playwright/test'

import { agentTurnLockTest as test } from '@e2e/fixtures/agentTurnLockFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { CommandHelper } from '@e2e/fixtures/helpers/CommandHelper'
import { AgentTemplates } from '@e2e/tests/agent/agentTemplates'

test.use({ connectWebSocketToServer: false })

test.describe(
  'Agent panel follows tab-opening paths',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('N6-01 N6-12: follows an opened template to its new-chat screen while a turn keeps running in the original tab', async ({
      turnLock,
      page,
      toast
    }) => {
      const templates = new AgentTemplates(page)
      const topbar = new Topbar(page)

      await test.step('agent turn is running on the first tab', async () => {
        await turnLock.openOnBlankWorkflow()
        await turnLock.startTurn('add an audio output node')
        await expect(turnLock.stopButton).toBeVisible()
      })

      await test.step('opening a template switches the panel to its new-chat screen', async () => {
        const opened = await templates.openFirstTemplate()
        await templates.expectTemplateOpened(opened)
        await expect(toast.toastErrors).toHaveCount(0)
        await expect(topbar.tabs).toHaveCount(2)
        await expect(topbar.getTab(1).and(topbar.getActiveTab())).toBeVisible()
        await expect(turnLock.stopButton).toHaveCount(0)
        await expect(turnLock.sendButton).toBeVisible()
        await expect(turnLock.userBubbles).toHaveCount(0)
        await expect(turnLock.agentPanel.suggestedPrompts.first()).toBeVisible()
      })

      await test.step('returning to the original tab shows the running turn intact', async () => {
        await topbar.getTab(0).click()
        await expect(topbar.getTab(0).and(topbar.getActiveTab())).toBeVisible()
        await expect(turnLock.stopButton).toBeVisible()
        await expect(turnLock.userBubbles).toHaveText([
          'add an audio output node'
        ])
        await expect(turnLock.workingRow).toBeVisible()
      })
    })

    test('N6-05 N6-12: follows a duplicated workflow tab to its new-chat screen while a turn keeps running in the original tab', async ({
      turnLock,
      page
    }) => {
      const topbar = new Topbar(page)
      const commands = new CommandHelper(page)

      await test.step('agent turn is running on the first tab', async () => {
        await turnLock.openOnBlankWorkflow()
        await turnLock.startTurn('add an audio output node')
        await expect(turnLock.stopButton).toBeVisible()
      })

      await test.step('duplicating the workflow opens a new tab and switches the panel to its new-chat screen', async () => {
        await commands.executeCommand('Comfy.DuplicateWorkflow')
        await expect(topbar.tabs).toHaveCount(2)
        await expect(topbar.getTab(1).and(topbar.getActiveTab())).toBeVisible()
        await expect(turnLock.stopButton).toHaveCount(0)
        await expect(turnLock.sendButton).toBeVisible()
        await expect(turnLock.userBubbles).toHaveCount(0)
        await expect(turnLock.agentPanel.suggestedPrompts.first()).toBeVisible()
      })

      await test.step('returning to the original tab shows the running turn intact', async () => {
        await topbar.getTab(0).click()
        await expect(topbar.getTab(0).and(topbar.getActiveTab())).toBeVisible()
        await expect(turnLock.stopButton).toBeVisible()
        await expect(turnLock.userBubbles).toHaveText([
          'add an audio output node'
        ])
        await expect(turnLock.workingRow).toBeVisible()
      })
    })
  }
)
