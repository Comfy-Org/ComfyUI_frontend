import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TextEditorDialog } from '@e2e/fixtures/components/TextEditorDialog'

test.describe(
  'Vue multiline text editor dialog',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test('edits the widget live and leaves the same text on close', async ({
      comfyPage
    }) => {
      const node = comfyPage.vueNodes
        .getNodeByTitle('CLIP Text Encode (Prompt)')
        .first()
      const widget = node.getByRole('textbox', { name: 'text' })
      const widgetBehindDialog = node.getByRole('textbox', {
        name: 'text',
        includeHidden: true
      })
      const dialog = new TextEditorDialog(comfyPage.page)
      const original = await widget.inputValue()
      const edited = `${original}, at dusk`

      await test.step('the expand button opens a titled, focused editor', async () => {
        await widget.hover()
        await node.getByRole('button', { name: 'Expand' }).click()

        await expect(dialog.root).toHaveAccessibleName(
          'text · CLIP Text Encode (Prompt)'
        )
        await expect(dialog.editor).toBeFocused()
      })

      await test.step('typing updates the node while the editor is open', async () => {
        await comfyPage.page.keyboard.type(', at')
        await expect(widgetBehindDialog).toHaveValue(`${original}, at`)

        await dialog.editor.click()
        await dialog.editor.press('Control+End')
        await dialog.editor.pressSequentially(' dusk', { delay: 80 })

        await expect(widgetBehindDialog).toHaveValue(edited)
      })

      await test.step('closing keeps the text and marks the workflow modified', async () => {
        await dialog.close()

        await expect(widget).toHaveValue(edited)
        await expect
          .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
          .toBe(true)
      })

      await test.step('one undo on the canvas reverts the whole edit', async () => {
        await comfyPage.keyboard.undo()

        await expect(widget).toHaveValue(original)
      })
    })
  }
)
