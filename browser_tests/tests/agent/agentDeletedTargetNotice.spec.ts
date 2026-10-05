import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { workflowSelectionTest } from '@e2e/fixtures/agentWorkflowSelectionFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { ConfirmDialog } from '@e2e/fixtures/components/ConfirmDialog'
import { ContextMenu } from '@e2e/fixtures/components/ContextMenu'
import { WorkflowsSidebarTab } from '@e2e/fixtures/components/SidebarTab'

const test = mergeTests(agentTest, workflowSelectionTest)

test.describe(
  "Deleting the open chat's target workflow",
  { tag: ['@cloud', '@agent'] },
  () => {
    test('says the target workflow is no longer available', async ({
      page,
      workflowSelection
    }) => {
      const agentPanel = new AgentPanel(page)
      const panel = await agentPanel.open()
      const targetPicker = agentPanel.workflowPicker
      const unavailable = panel.getByText(
        enMessages.agent.targetWorkflowUnavailable
      )

      await test.step('pick an unsaved target and save it', async () => {
        await targetPicker.click()
        await page
          .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
          .click()
        await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
        workflowSelection.finishSave(true)
        await expect(targetPicker).toHaveText('Unsaved Workflow')
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
      })

      await test.step('show the target as unavailable', async () => {
        await expect(unavailable).toBeVisible()
        await expect(targetPicker).toHaveText(
          enMessages.agent.selectWorkflowForAgent
        )
      })
    })
  }
)
