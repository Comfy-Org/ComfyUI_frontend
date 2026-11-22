import { expect } from '@playwright/test'

import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import {
  cutRound,
  wholeRound
} from '@e2e/fixtures/data/agent/agentThinkingShortened'

test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test(
  'BE-24672: tells the reader a reloaded reasoning trace was shortened',
  { tag: ['@cloud', '@ui'] },
  async ({ agentPanel, promptHistory, workflowSelection }) => {
    await test.step('completes a turn the server stored with a cut round', async () => {
      await agentPanel.open()
      await agentPanel.chooseWorkflow()
      await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
      workflowSelection.finishSave(true)
      await agentPanel.sendMessage('Upscale it')
      await expect.poll(() => promptHistory.requests.length).toBe(1)

      promptHistory.completeLatestTurn({
        text: 'Done.',
        thinking: [wholeRound, cutRound]
      })
      await agentPanel.stopButton.click()
    })

    await test.step('reloads the persisted transcript', async () => {
      await agentPanel.reload()
    })

    await test.step('names the shortening once, on the round that was cut', async () => {
      await agentPanel.openWorkSummary()
      await expect(agentPanel.thinkingShortenedNotices).toHaveCount(1)
      await expect(
        agentPanel.thinkingShortenedNoticeIn(cutRound.text)
      ).toHaveText(enMessages.agent.thinkingShortened)
      await expect(
        agentPanel.thinkingShortenedNoticeIn(wholeRound.text)
      ).toHaveCount(0)
    })
  }
)

test(
  'BE-24672: stays silent when the reloaded reasoning trace is whole',
  { tag: ['@cloud', '@ui'] },
  async ({ agentPanel, promptHistory, workflowSelection }) => {
    await test.step('completes a turn the server stored whole', async () => {
      await agentPanel.open()
      await agentPanel.chooseWorkflow()
      await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
      workflowSelection.finishSave(true)
      await agentPanel.sendMessage('Upscale it')
      await expect.poll(() => promptHistory.requests.length).toBe(1)

      promptHistory.completeLatestTurn({
        text: 'Done.',
        thinking: [wholeRound]
      })
      await agentPanel.stopButton.click()
    })

    await test.step('reloads the persisted transcript', async () => {
      await agentPanel.reload()
    })

    await test.step('shows the round with no shortening notice', async () => {
      await agentPanel.openWorkSummary()
      await expect(agentPanel.activityRows.last()).toContainText(
        wholeRound.text
      )
      await expect(agentPanel.thinkingShortenedNotices).toHaveCount(0)
    })
  }
)
