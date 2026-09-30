import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { workflowSelectionTest } from '@e2e/fixtures/agentWorkflowSelectionFixture'
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
      await page
        .getByRole('button', {
          name: enMessages.agent.entryButton,
          exact: true
        })
        .click()
      const panel = page.locator('#agent-panel-root')
      const targetPicker = panel.getByRole('button', {
        name: enMessages.agent.switchWorkflow
      })
      await targetPicker.click()
      await page
        .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
        .click()
      await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
      workflowSelection.finishSave(true)
      await expect(targetPicker).toHaveText('Unsaved Workflow')
      const unavailable = panel.getByText(
        enMessages.agent.targetWorkflowUnavailable
      )
      await expect(unavailable).toBeHidden()

      const workflowsTab = new WorkflowsSidebarTab(page)
      await workflowsTab.open()
      await workflowsTab
        .getPersistedItem('Unsaved Workflow')
        .click({ button: 'right' })
      await new ContextMenu(page).clickMenuItem('Delete')
      await new ConfirmDialog(page).delete.click()

      await expect(unavailable).toBeVisible()
      await expect(targetPicker).toHaveText(
        enMessages.agent.selectWorkflowForAgent
      )
    })
  }
)
