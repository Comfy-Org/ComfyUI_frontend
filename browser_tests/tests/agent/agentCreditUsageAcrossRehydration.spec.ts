import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'

test.describe.configure({ timeout: 120_000 })
test.use({
  workflowSelectionFeatures: {
    'agent-credit-usage-summary': 'treatment'
  },
  serverTurnIds: 'distinct'
})

test(
  'keeps the reported Agent credits when the chat is reopened from history',
  { tag: ['@cloud', '@ui'] },
  async ({ page, promptHistory }) => {
    await expect(
      page.getByTestId('integrated-tab-bar-actions')
    ).toHaveAttribute('data-agent-gate-settled', 'true', { timeout: 8_000 })
    const agentPanel = new AgentPanel(page)
    await agentPanel.open()
    await page
      .getByRole('button', {
        name: enMessages.sideToolbar.newBlankWorkflow,
        exact: true
      })
      .click()

    const prompt = 'Add a KSampler node.'
    await agentPanel.composer.fill(prompt)
    await agentPanel.sendButton.click()
    await expect.poll(() => promptHistory.requests.length).toBe(1)
    await promptHistory.finishLatestTurn('Done.', 6038)

    const liveUsage = agentPanel.root.getByTestId('agent-credit-usage')
    await expect(liveUsage).toHaveText('Agent used 1.27 credits')

    const historyReadsBefore = promptHistory.historyReads()
    await agentPanel.newChatButton.click()
    await expect(liveUsage).toHaveCount(0)
    await agentPanel.openChatFromHistory('Inline reference round trip')
    await expect
      .poll(() => promptHistory.historyReads())
      .toBeGreaterThan(historyReadsBefore)

    await expect(agentPanel.userMessageBubbles).toHaveText([prompt])
    await expect(liveUsage).toHaveText('Agent used 1.27 credits')
  }
)
