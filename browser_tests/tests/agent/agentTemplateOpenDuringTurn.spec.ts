import { expect } from '@playwright/test'

import { agentTurnLockTest as test } from '@e2e/fixtures/agentTurnLockFixture'
import { AgentTemplates } from '@e2e/tests/agent/agentTemplates'

test.use({ connectWebSocketToServer: false })

test.describe(
  'PM-2126: opening a template while an agent turn is running',
  { tag: ['@cloud', '@ui'] },
  () => {
    test('opens the template without the load-failure toast', async ({
      turnLock,
      page,
      toast
    }) => {
      const templates = new AgentTemplates(page)

      await test.step('agent turn is running', async () => {
        await turnLock.openOnBlankWorkflow()
        await turnLock.startTurn('add an audio output node')
        await expect(turnLock.stopButton).toBeVisible()
      })

      await test.step('template opens fully while the turn keeps running', async () => {
        const opened = await templates.openFirstTemplate()
        await templates.expectTemplateOpened(opened)
        await expect(toast.toastErrors).toHaveCount(0)
        await expect(turnLock.stopButton).toBeVisible()
      })
    })
  }
)
