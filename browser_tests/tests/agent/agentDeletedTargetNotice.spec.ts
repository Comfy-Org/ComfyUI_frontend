import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { workflowSelectionTest } from '@e2e/fixtures/agentWorkflowSelectionFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { ConfirmDialog } from '@e2e/fixtures/components/ConfirmDialog'
import { ContextMenu } from '@e2e/fixtures/components/ContextMenu'
import { WorkflowsSidebarTab } from '@e2e/fixtures/components/SidebarTab'

const test = mergeTests(agentTest, workflowSelectionTest)

/**
 * The second workflow the fixture saves. The deleted first one took
 * `…000000000001`, so this asserts the replacement is a distinct document:
 * an id scheme derived from the listing's length would reissue the deleted
 * workflow's id here and hide a chat addressing the wrong workflow.
 */
const SECOND_SAVE_ID = 'a81718a4-02ae-41e6-ae85-000000000002'

test.describe(
  "Deleting the open chat's target workflow",
  { tag: ['@cloud', '@agent'] },
  () => {
    test('says the target workflow is no longer available', async ({
      page,
      workflowSelection
    }) => {
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      const panel = agentPanel.root
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

    /**
     * The notice is about the chat's workflow document, not about the path it
     * was saved at. Reviewers read "the target is gone" as a claim about the
     * path and asked whether a workflow saved there afterwards should clear it
     * or inherit the chat; this asserts the outcome that matters either way —
     * the chat's next turn carries the new workflow's own id, never the deleted
     * one, so no edit can land in a workflow the user did not choose.
     */
    test('gives a workflow saved at the deleted path its own identity', async ({
      page,
      workflowSelection
    }) => {
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      const panel = agentPanel.root
      const targetPicker = agentPanel.workflowPicker
      const composer = panel.getByRole('textbox', { includeHidden: true })

      await test.step('save a target, which takes the first cloud id', async () => {
        await targetPicker.click()
        await page
          .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
          .click()
        await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
        workflowSelection.finishSave(true)
        await expect(targetPicker).toHaveText('Unsaved Workflow')
      })

      await test.step('delete it, then save a new workflow at the same name', async () => {
        const workflowsTab = new WorkflowsSidebarTab(page)
        await workflowsTab.open()
        await workflowsTab
          .getPersistedItem('Unsaved Workflow')
          .click({ button: 'right' })
        await new ContextMenu(page).clickMenuItem('Delete')
        await new ConfirmDialog(page).delete.click()
        await expect(
          panel.getByText(enMessages.agent.targetWorkflowUnavailable)
        ).toBeVisible()

        await page
          .getByRole('button', {
            name: enMessages.sideToolbar.newBlankWorkflow,
            exact: true
          })
          .click()
        await targetPicker.click()
        await page.getByRole('menuitemradio').first().click()
        await expect.poll(() => workflowSelection.savedPaths.length).toBe(2)
        workflowSelection.finishSave(true)
      })

      await test.step('address the new workflow, not the deleted one', async () => {
        await expect(
          panel.getByText(enMessages.agent.targetWorkflowUnavailable)
        ).toBeHidden()
        await composer.fill('a turn for the replacement')
        await composer.press('Enter')
        await expect.poll(() => workflowSelection.postedMessages.length).toBe(1)
        expect(JSON.parse(workflowSelection.postedMessages[0])).toMatchObject({
          workflow_id: SECOND_SAVE_ID
        })
      })
    })
  }
)
