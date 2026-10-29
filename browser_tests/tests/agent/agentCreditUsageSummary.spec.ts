import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'

// PM-1440: a user must see the Agent credits charged for a completed turn,
// including after the transcript is rebuilt from persisted conversation rows.
test.describe.configure({ timeout: 120_000 })

test(
  'shows server-reported Agent credits live and after reload',
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

    const historyReadsBeforeReload = promptHistory.historyReads()
    await page.reload()
    await expect
      .poll(() => promptHistory.historyReads())
      .toBeGreaterThan(historyReadsBeforeReload)
    await expect(page.locator('#agent-panel-root')).toBeVisible({
      timeout: 30_000
    })
    await expect(
      page.locator('#agent-panel-root').getByTestId('agent-credit-usage')
    ).toHaveText('Agent used 1.27 credits')
  }
)
