import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { workflowSelectionTest } from '@e2e/fixtures/agentWorkflowSelectionFixture'

const test = mergeTests(agentTest, workflowSelectionTest)

test(
  'edits workflow references in place and restores their positions',
  { tag: ['@cloud', '@ui'] },
  async ({ page, workflowSelection }, testInfo) => {
    await page
      .getByRole('button', { name: enMessages.agent.askComfyAgent })
      .click()
    await page
      .getByRole('button', {
        name: enMessages.sideToolbar.newBlankWorkflow,
        exact: true
      })
      .click()
    const panel = page.locator('#agent-panel-root')
    const editor = panel.getByRole('textbox')
    const chips = editor.getByTestId('workflow-reference-chip')
    await expect(page.getByTestId('workflow-tab')).toHaveCount(2)
    await editor.fill('Before @ after')
    await expect(editor).toHaveText('Before @ after')
    await editor.press('ArrowLeft')
    await editor.press('ArrowLeft')
    await editor.press('ArrowLeft')
    await editor.press('ArrowLeft')
    await editor.press('ArrowLeft')
    await editor.press('ArrowLeft')
    await panel
      .getByRole('menuitem', { name: enMessages.agent.workflows, exact: true })
      .click()
    await panel
      .getByRole('menuitem', {
        name: `Unsaved Workflow ${enMessages.agent.unsavedWorkflow}`,
        exact: true
      })
      .click()
    await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
    await editor.pressSequentially(' while saving')
    workflowSelection.finishSave(true)
    await expect(editor).toHaveText(
      'Before Unsaved Workflow while saving after'
    )
    await expect(chips).toHaveCount(1)

    await editor.pressSequentially('between @')
    await panel
      .getByRole('menuitem', { name: enMessages.agent.workflows, exact: true })
      .click()
    await panel
      .getByRole('menuitem', {
        name: `Unsaved Workflow (2) ${enMessages.agent.unsavedWorkflow}`,
        exact: true
      })
      .click()
    await expect.poll(() => workflowSelection.savedPaths.length).toBe(2)
    workflowSelection.finishSave(true)
    const text =
      'Before Unsaved Workflow between Unsaved Workflow (2) while saving after'
    await expect(editor).toHaveText(text)
    await editor.press('ArrowLeft')
    await editor.press('Backspace')
    await expect(chips).toHaveCount(1)
    await editor.press('ControlOrMeta+z')
    await expect(chips).toHaveCount(2)
    await expect(editor).toHaveText(text)

    await panel
      .getByRole('button', { name: enMessages.g.close, exact: true })
      .click()
    await page
      .getByRole('button', { name: enMessages.agent.askComfyAgent })
      .click()
    await expect(editor).toHaveText(text)
    await expect(chips).toHaveCount(2)
    await testInfo.attach('inline-workflow-tokens', {
      body: await panel.getByTestId('composer-inline-input').screenshot({
        path: testInfo.outputPath('inline-workflow-tokens.png')
      }),
      contentType: 'image/png'
    })
  }
)
