import { expect } from '@playwright/test'

import { agentTurnLockTest as test } from '@e2e/fixtures/agentTurnLockFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { AgentTemplates } from '@e2e/tests/agent/agentTemplates'

test.use({ connectWebSocketToServer: false })

test.describe(
  'PM-2126: opening a template while an agent turn is running',
  { tag: ['@cloud', '@ui'] },
  () => {
    test('switches the panel to the template tab without a load-failure toast while the turn keeps running', async ({
      turnLock,
      page,
      toast
    }) => {
      const templates = new AgentTemplates(page)
      const topbar = new Topbar(page)

      await test.step('agent turn is running', async () => {
        await turnLock.openOnBlankWorkflow()
        await turnLock.startTurn('add an audio output node')
        await expect(turnLock.stopButton).toBeVisible()
      })

      await test.step('template opens in a new tab and the panel follows it', async () => {
        const opened = await templates.openFirstTemplate()
        await templates.expectTemplateOpened(opened)
        await expect(toast.toastErrors).toHaveCount(0)
        await expect(turnLock.stopButton).toHaveCount(0)
        await expect(turnLock.sendButton).toBeVisible()
        await expect(turnLock.userBubbles).toHaveCount(0)
      })

      await test.step('returning to the original tab shows the turn still running', async () => {
        await topbar.getTab(0).click()
        await expect(turnLock.stopButton).toBeVisible()
        await expect(turnLock.userBubbles).toHaveText([
          'add an audio output node'
        ])
        await expect(turnLock.workingRow).toBeVisible()
      })
    })
  }
)
