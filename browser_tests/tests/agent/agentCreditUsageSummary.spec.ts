import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'

test.describe.configure({ timeout: 120_000 })
test.use({
  workflowSelectionFeatures: {
    'agent-credit-usage-summary': 'treatment'
  }
})

test(
  'shows server-reported Agent credits when a turn completes',
  { tag: ['@cloud', '@ui'] },
  async ({ page, promptHistory, workflowSelection }) => {
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
    await agentPanel.workflowPicker.click()
    await page
      .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
      .click()
    await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
    workflowSelection.finishSave(true)

    await agentPanel.composer.fill('Add a KSampler node.')
    await agentPanel.sendButton.click()
    await expect.poll(() => promptHistory.requests.length).toBe(1)
    await promptHistory.finishLatestTurn('Done.', 6038)

    const liveUsage = agentPanel.root.getByTestId('agent-credit-usage')
    await expect(liveUsage).toHaveText('Agent used 1.27 credits')
  }
)
