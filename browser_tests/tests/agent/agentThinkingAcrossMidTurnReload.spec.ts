import { expect } from '@playwright/test'

import {
  LATE_THINKING_EVENT,
  LATE_THINKING_TEXT,
  PERSISTED_AFTER_TOOL_TEXT,
  TURN_THINKING_TEXT,
  agentTurnLockTest as test
} from '@e2e/fixtures/agentTurnLockFixture'

test.describe.configure({ timeout: 180_000 })
test.use({ connectWebSocketToServer: false })

test(
  'restores the thinking from before a mid-turn reload when the turn finishes',
  {
    tag: ['@cloud', '@ui'],
    annotation: {
      type: 'source',
      description: 'https://linear.app/comfyorg/issue/FRONT-3659'
    }
  },
  async ({ turnLock, getAgentSocket }) => {
    const prompt = 'add an audio output node'

    await test.step('narrate a round, then reload mid-turn', async () => {
      await turnLock.openOnBlankWorkflow()
      await turnLock.startTurn(prompt)

      await turnLock.agentPanel.reload()
      await expect(turnLock.userBubbles).toHaveText([prompt])
      await expect(turnLock.stopButton).toBeVisible()
    })

    const socket =
      await test.step('narrate another round after the reload', async () => {
        await turnLock.waitForRecoveryExhausted()

        const live = await getAgentSocket()
        turnLock.push(live, LATE_THINKING_EVENT)
        await expect(turnLock.panel.getByText(LATE_THINKING_TEXT)).toBeVisible()
        return live
      })

    await test.step('finishing the turn shows both rounds beside the tool call', async () => {
      turnLock.finishTurn(socket)

      await expect(turnLock.sendButton).toBeVisible({ timeout: 30_000 })

      await turnLock.agentPanel.openWorkSummary()
      await expect(turnLock.agentPanel.activityRows).toHaveText([
        TURN_THINKING_TEXT,
        /Add node/,
        LATE_THINKING_TEXT
      ])
      await expect(
        turnLock.panel.getByText(PERSISTED_AFTER_TOOL_TEXT)
      ).toBeVisible()
    })
  }
)
