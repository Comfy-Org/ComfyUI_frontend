import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { workflowSelectionTest } from '@e2e/fixtures/agentWorkflowSelectionFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { ConfirmDialog } from '@e2e/fixtures/components/ConfirmDialog'
import { ContextMenu } from '@e2e/fixtures/components/ContextMenu'
import { WorkflowsSidebarTab } from '@e2e/fixtures/components/SidebarTab'
import { Topbar } from '@e2e/fixtures/components/Topbar'

const test = mergeTests(agentTest, workflowSelectionTest)

test.describe(
  "Deleting the open chat's target workflow",
  { tag: ['@cloud', '@agent'] },
  () => {
    test('follows the replacement tab instead of reporting the target as gone', async ({
      page,
      workflowSelection
    }) => {
      const agentPanel = new AgentPanel(page)
      const panel = await agentPanel.open()
      const topbar = new Topbar(page)
      const unavailable = panel.getByText(
        enMessages.agent.targetWorkflowUnavailable
      )

      await test.step('save the active workflow', async () => {
        const saving = topbar.saveWorkflowAs('Unsaved Workflow')
        await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
        workflowSelection.finishSave(true)
        await saving
        await expect(unavailable).toBeHidden()
      })

      await test.step('delete the target from the Workflows sidebar', async () => {
        const workflowsTab = new WorkflowsSidebarTab(page)
        await workflowsTab.open()
        await workflowsTab
          .getPersistedItem('Unsaved Workflow')
          .click({ button: 'right' })
        await new ContextMenu(page).clickMenuItem('Delete')
        await new ConfirmDialog(page).delete.click()
        await expect(
          workflowsTab.getPersistedItem('Unsaved Workflow')
        ).toHaveCount(0)
      })

      await test.step('follow the replacement tab without a notice', async () => {
        await expect(topbar.getActiveTab()).toContainText(
          'Unsaved Workflow (2)'
        )
        await expect(unavailable).toBeHidden()
        await agentPanel.composer.fill('Ask on replacement')
        await expect(agentPanel.sendButton).toBeEnabled()
      })
    })
  }
)
