import { expect } from '@playwright/test'

import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'

test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test(
  'names the loaded skill in a reloaded work summary',
  { tag: ['@cloud', '@ui'] },
  async ({ agentPanel, promptHistory, workflowSelection }) => {
    await test.step('completes a turn that loaded a named skill', async () => {
      await agentPanel.open()
      await agentPanel.chooseWorkflow()
      await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
      workflowSelection.finishSave(true)
      await agentPanel.sendMessage('Use the comfy-director skill')
      await expect.poll(() => promptHistory.requests.length).toBe(1)

      const loadSkillCall = {
        id: 'call-load-skill',
        tool_call_id: 'call-load-skill',
        tool_name: 'load_skill',
        status: 'success' as const,
        duration_ms: 310,
        skill: 'comfy-director'
      }
      promptHistory.completeLatestTurn({
        text: 'Loaded it.',
        tool_calls: [loadSkillCall]
      })
      await agentPanel.stopButton.click()
    })

    await test.step('reloads the persisted transcript', async () => {
      await agentPanel.reload()
    })

    await test.step('names the skill in the restored work summary', async () => {
      await agentPanel.openWorkSummary()
      await expect(agentPanel.activityRows).toHaveText([
        'Loaded comfy-director'
      ])
    })
  }
)
