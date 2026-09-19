import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { workflowSelectionTest } from '@e2e/fixtures/agentWorkflowSelectionFixture'

const test = mergeTests(agentTest, workflowSelectionTest)

test.describe(
  'PM-1322: New chat keeps the previous chat target workflow',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('binds a new chat to the tab on screen, not the last chat target', async ({
      page,
      workflowSelection
    }, testInfo) => {
      await page
        .getByRole('button', { name: enMessages.agent.askComfyAgent })
        .click()
      const panel = page.locator('#agent-panel-root')
      const targetPicker = panel.getByRole('button', {
        name: enMessages.agent.switchWorkflow
      })

      // Pin this chat's target to tab A ("Unsaved Workflow"), the only tab
      // open so far.
      await targetPicker.click()
      await page
        .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
        .click()
      await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
      workflowSelection.finishSave(true)
      await expect(targetPicker).toHaveText('Unsaved Workflow')

      // Open a second workflow tab (B) and make it the one on screen.
      await page
        .getByRole('button', {
          name: enMessages.sideToolbar.newBlankWorkflow,
          exact: true
        })
        .click()
      const tabs = page.getByTestId('workflow-tab')
      await expect(tabs).toHaveCount(2)
      const activeTab = page.locator('.workflow-tabs .p-togglebutton-checked')
      await expect(activeTab).toHaveText('Unsaved Workflow (2)')

      // A pinned target surviving a plain tab switch is intentional (asserted
      // elsewhere in agentWorkflowSelection.spec.ts); it is not the bug here.
      await expect(targetPicker).toHaveText('Unsaved Workflow')

      // Start a new chat while tab B is the one visible on screen.
      await panel
        .getByRole('button', { name: enMessages.agent.newChat })
        .click()
      const composer = panel.getByRole('textbox', { includeHidden: true })
      await expect(composer).toHaveText('')
      await expect(activeTab).toHaveText('Unsaved Workflow (2)')

      await testInfo.attach('new-chat-target-after-tab-switch', {
        body: await panel.screenshot({
          path: testInfo.outputPath('new-chat-target-after-tab-switch.png')
        }),
        contentType: 'image/png'
      })

      // PM-1322: onNewChat() (AgentPanelRoot.vue) never calls
      // agentPanelStore.resetWorkflowTarget(), unlike onSelectHistory() just
      // above it in the same file. So the target chip keeps showing tab A
      // ("Unsaved Workflow") for the new chat instead of prompting again for
      // whichever tab is actually on screen (tab B) -- telling the agent to
      // act "in this workflow" would silently act on tab A.
      test.fail()
      await expect(targetPicker).toHaveText(
        enMessages.agent.selectWorkflowForAgent
      )
    })
  }
)
