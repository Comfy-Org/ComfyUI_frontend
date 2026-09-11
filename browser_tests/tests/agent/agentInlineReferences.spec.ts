import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import {
  inlineReferencesTest as test,
  referenceNode,
  referenceWorkflow
} from '@e2e/fixtures/agentInlineReferencesFixture'
import { assetPath } from '@e2e/fixtures/utils/paths'

test.use({
  connectWebSocketToServer: false,
  nodeDefinitions: { ColorBalance: referenceNode },
  permissions: ['clipboard-read', 'clipboard-write']
})

test(
  'keeps inline node and asset removal synchronized with the upper rows and Undo',
  { tag: ['@cloud', '@ui'] },
  async ({ page, workflowSelection, assetUpload }) => {
    await page.locator('#comfy-file-input').setInputFiles({
      name: 'Portrait study.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(referenceWorkflow))
    })
    await page
      .getByRole('button', { name: enMessages.agent.askComfyAgent })
      .click()
    const panel = page.locator('#agent-panel-root')
    const editor = panel.getByRole('textbox')
    await panel
      .getByRole('button', { name: enMessages.agent.switchWorkflow })
      .click()
    await page.getByRole('menuitemradio', { name: /Portrait study/ }).click()
    await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
    workflowSelection.finishSave(true)
    await editor.fill('Adjust @')
    await panel
      .getByRole('menuitem', { name: enMessages.agent.nodes, exact: true })
      .click()
    await panel.getByRole('menuitem', { name: /Color balance/ }).click()
    await expect(editor).toHaveText('Adjust Color balance #12 ')
    await editor.pressSequentially('to match ')
    await panel
      .getByTestId('agent-file-input')
      .setInputFiles(assetPath('test_upload_image.png'))
    const text = 'Adjust Color balance #12 to match test_upload_image.png '
    await expect(editor).toHaveText(text)
    await expect(
      panel.getByRole('button', { name: enMessages.agent.send, exact: true })
    ).toBeDisabled()
    await panel
      .getByTestId('composer-asset-section')
      .getByRole('button', { name: enMessages.agent.remove, exact: true })
      .click()
    assetUpload.finish()
    await expect(editor.getByTestId('asset-reference-chip')).toHaveCount(0)
    await editor.press('ControlOrMeta+z')
    await expect(editor).toHaveText(text)
    await expect(
      panel.getByRole('button', { name: enMessages.agent.send, exact: true })
    ).toBeEnabled()
    await panel
      .getByRole('button', { name: 'Remove Color balance #12 reference' })
      .click()
    await expect(editor).toHaveText('Adjust  to match test_upload_image.png ')
    await expect(panel.getByTestId('composer-node-section')).toHaveCount(0)
    await editor.press('ControlOrMeta+z')
    await expect(editor).toHaveText(text)
    await expect(panel.getByTestId('composer-node-section')).toHaveText(
      'Color balance'
    )

    await editor.press('ControlOrMeta+a')
    await editor.press('ControlOrMeta+c')
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(
        'Adjust @[Node: Color balance #12] to match @[Image: test_upload_image.png] '
      )
    await editor.press('ArrowRight')
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
      .getByRole('menuitemradio', { name: 'Unsaved Workflow (2)', exact: true })
      .click()
    await expect.poll(() => workflowSelection.savedPaths.length).toBe(2)
    workflowSelection.finishSave(true)
    await expect(editor.getByTestId('node-reference-chip')).toHaveCount(0)
    await editor.press('ControlOrMeta+a')
    await editor.press('Backspace')
    await editor.press('ControlOrMeta+v')
    await expect(editor).toHaveText(
      'Adjust @[Node: Color balance #12] to match @[Image: test_upload_image.png] '
    )
    await expect(editor.getByTestId('node-reference-chip')).toHaveCount(0)
    await expect(editor.getByTestId('asset-reference-chip')).toHaveCount(0)
    await expect(panel.getByTestId('composer-node-section')).toHaveCount(0)
    await expect(panel.getByTestId('composer-asset-section')).toHaveCount(0)
    await expect(
      panel.getByRole('button', { name: enMessages.agent.switchWorkflow })
    ).toHaveText('Unsaved Workflow (2)')
  }
)
