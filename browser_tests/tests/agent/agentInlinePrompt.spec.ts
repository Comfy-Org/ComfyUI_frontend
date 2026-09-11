import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { promptHistoryTest as test } from '@e2e/fixtures/agentPromptHistoryFixture'

test.use({ connectWebSocketToServer: false })

test(
  'preserves inline workflow references through Send, history and Edit',
  { tag: ['@cloud', '@ui'] },
  async ({ page, workflowSelection, promptHistory }) => {
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
    await page
      .getByRole('button', {
        name: enMessages.sideToolbar.newBlankWorkflow,
        exact: true
      })
      .click()
    await panel
      .getByRole('button', { name: enMessages.agent.switchWorkflow })
      .click()
    await page
      .getByRole('menuitemradio', { name: /Unsaved Workflow \(3\)/ })
      .click()
    await expect.poll(() => workflowSelection.savedPaths.length).toBe(3)
    workflowSelection.finishSave(true)
    await expect(editor).toHaveText(text)
    await panel
      .getByRole('button', { name: enMessages.agent.send, exact: true })
      .click()
    await expect.poll(() => promptHistory.requests.length).toBe(1)
    expect(promptHistory.requests[0]).toMatchObject({
      content:
        'Before [Unsaved Workflow](workflow://a81718a4-02ae-41e6-ae85-000000000001) between [Unsaved Workflow (2)](workflow://a81718a4-02ae-41e6-ae85-000000000002) while saving after',
      workflow_id: 'a81718a4-02ae-41e6-ae85-000000000003',
      workflow_references: [
        {
          workflow_id: 'a81718a4-02ae-41e6-ae85-000000000001',
          name: 'Unsaved Workflow'
        },
        {
          workflow_id: 'a81718a4-02ae-41e6-ae85-000000000002',
          name: 'Unsaved Workflow (2)'
        }
      ]
    })
    await expect(editor).toBeEmpty()
    await expect(panel.getByTestId('user-message-bubble')).toHaveText(text)
    await expect(
      panel.getByRole('button', { name: enMessages.agent.stop, exact: true })
    ).toBeVisible()
    await panel.getByRole('button', { name: enMessages.agent.newChat }).click()
    await expect(panel.getByTestId('user-message-bubble')).toHaveCount(0)
    const historyReads = promptHistory.historyReads()
    await panel
      .getByRole('button', { name: enMessages.agent.showChatHistory })
      .click()
    await panel
      .getByRole('button', { name: 'Inline reference round trip', exact: true })
      .click()
    await expect
      .poll(() => promptHistory.historyReads())
      .toBeGreaterThan(historyReads)
    await expect(panel.getByTestId('user-message-bubble')).toHaveText(text)
    await expect(
      panel
        .getByTestId('user-message-bubble')
        .getByTestId('workflow-reference-chip')
    ).toHaveCount(2)
    await panel
      .getByRole('button', { name: enMessages.agent.stop, exact: true })
      .click()
    await panel
      .getByRole('button', { name: enMessages.g.edit, exact: true })
      .click()
    await expect(editor).toHaveText(text)
    await expect(chips).toHaveCount(2)
    await editor.press('ControlOrMeta+a')
    await editor.press('ArrowRight')
    await editor.pressSequentially(' again')
    await expect(editor).toHaveText(`${text} again`)
    await panel
      .getByRole('button', { name: enMessages.agent.send, exact: true })
      .click()
    await expect.poll(() => promptHistory.requests.length).toBe(2)
    expect(promptHistory.requests[1]).toMatchObject({
      content: `${promptHistory.requests[0].content} again`,
      workflow_id: promptHistory.requests[0].workflow_id,
      workflow_references: promptHistory.requests[0].workflow_references
    })
    await expect(panel.getByTestId('user-message-bubble').last()).toHaveText(
      `${text} again`
    )
    await panel
      .getByRole('button', { name: enMessages.agent.stop, exact: true })
      .click()
    await expect(
      panel.getByRole('button', { name: enMessages.agent.stop, exact: true })
    ).toHaveCount(0)
  }
)
