import { expect } from '@playwright/test'

import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { PersistedThinkingEntry } from '@/workbench/extensions/agent/schemas/agentApiSchema'

test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

const cutRound: PersistedThinkingEntry = {
  text: 'Picking an upscaler, then',
  truncated: true
}
const wholeRound: PersistedThinkingEntry = { text: 'Reading the workflow.' }

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
      await expect(agentPanel.thinkingShortenedNotices).toHaveText([
        enMessages.agent.thinkingShortened
      ])
      await expect(agentPanel.activityRows.last()).toContainText(cutRound.text)
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
