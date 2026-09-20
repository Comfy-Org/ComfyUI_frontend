import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { workflowSelectionTest } from '@e2e/fixtures/agentWorkflowSelectionFixture'

const test = mergeTests(agentTest, workflowSelectionTest)

// PM-1321 (parent) / PM-1322 (tab switch) / PM-1415 (tab creation): New Chat
// used to keep whatever tab the previous chat was pinned to instead of
// picking up the tab now on screen, so "in this workflow" could silently act
// on a tab the user had already left. AgentPanelRoot.vue's onNewChat() now
// re-targets to workflowStore.activeWorkflow, the same way onSelectHistory()
// re-derives its target instead of carrying the old one forward.
// Supersedes the repro-only PR #18080, whose test asserted a blank "select a
// workflow" target after New Chat; the accepted PM-1321 acceptance criteria
// call for the tab on screen, not a blank state.
test.describe(
  'New chat targets the workflow tab on screen',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('PM-1322: retargets to a tab the user switched to', async ({
      page,
      workflowSelection
    }, testInfo) => {
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

      // Pin this chat's target to tab A ("Unsaved Workflow").
      await targetPicker.click()
      await page
        .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
        .click()
      await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
      workflowSelection.finishSave(true)
      await expect(targetPicker).toHaveText('Unsaved Workflow')

      // Open a second workflow tab (B), then switch back to A so B is just
      // another open tab rather than the newest/active one.
      await page
        .getByRole('button', {
          name: enMessages.sideToolbar.newBlankWorkflow,
          exact: true
        })
        .click()
      const tabs = page.getByTestId('workflow-tab')
      await expect(tabs).toHaveCount(2)
      const activeTab = page.locator('.workflow-tabs .p-togglebutton-checked')
      await tabs.first().click()
      await expect(activeTab).toHaveText('Unsaved Workflow')

      // A pinned target surviving a plain tab switch is intentional (asserted
      // elsewhere in agentWorkflowSelection.spec.ts); it is not the bug here.
      await expect(targetPicker).toHaveText('Unsaved Workflow')

      // Now bring tab B on screen and start a new chat from there.
      await tabs.last().click()
      await expect(activeTab).toHaveText('Unsaved Workflow (2)')
      const panelBeforeNewChat = await panel.screenshot({
        path: testInfo.outputPath('before-new-chat.png')
      })
      await panel
        .getByRole('button', { name: enMessages.agent.newChat })
        .click()
      const composer = panel.getByRole('textbox', { includeHidden: true })
      await expect(composer).toHaveText('')
      await expect(activeTab).toHaveText('Unsaved Workflow (2)')
      await expect(targetPicker).toHaveText('Unsaved Workflow (2)')

      await testInfo.attach('before-new-chat', {
        body: panelBeforeNewChat,
        contentType: 'image/png'
      })
      await testInfo.attach('after-new-chat', {
        body: await panel.screenshot({
          path: testInfo.outputPath('after-new-chat.png')
        }),
        contentType: 'image/png'
      })
    })

    test('PM-1415: retargets to a tab created for this session', async ({
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

      // Pin this chat's target to the only tab open so far.
      await targetPicker.click()
      await page
        .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
        .click()
      await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
      workflowSelection.finishSave(true)
      await expect(targetPicker).toHaveText('Unsaved Workflow')

      // Create a brand new, still-unsaved tab - it becomes the one on screen.
      await page
        .getByRole('button', {
          name: enMessages.sideToolbar.newBlankWorkflow,
          exact: true
        })
        .click()
      const activeTab = page.locator('.workflow-tabs .p-togglebutton-checked')
      await expect(activeTab).toHaveText('Unsaved Workflow (2)')

      await panel
        .getByRole('button', { name: enMessages.agent.newChat })
        .click()
      const composer = panel.getByRole('textbox', { includeHidden: true })
      await expect(composer).toHaveText('')
      await expect(targetPicker).toHaveText('Unsaved Workflow (2)')
    })
  }
)
