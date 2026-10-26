import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TextEditorDialog } from '@e2e/fixtures/components/TextEditorDialog'
import { expectElementScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

test.describe(
  'Vue multiline text editor dialog',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test(
      'edits the widget live and leaves the same text on close',
      { tag: '@screenshot' },
      async ({ comfyPage }) => {
        const node = comfyPage.vueNodes
          .getNodeByTitle('CLIP Text Encode (Prompt)')
          .first()
        const widget = node.getByRole('textbox', { name: 'text' })
        const widgetBehindDialog = node.getByRole('textbox', {
          name: 'text',
          includeHidden: true
        })
        const actions = node.getByRole('group', { name: 'Actions' })
        const dialog = new TextEditorDialog(comfyPage.page)
        const original = await widget.inputValue()
        const edited = `at ${original}, dusk`

        await test.step('the actions show on hover, not on focus alone', async () => {
          await widget.click()
          await comfyPage.canvasOps.moveMouseToEmptyArea()
          await expect(actions).toHaveCSS('opacity', '0')

          await widget.hover()
          await expect(actions).toHaveCSS('opacity', '1')
        })

        await test.step('the expand button opens a titled, focused editor', async () => {
          await actions.getByRole('button', { name: 'Expand' }).click()

          await expect(dialog.root).toHaveAccessibleName(
            'text · CLIP Text Encode (Prompt)'
          )
          await expect(dialog.editor).toBeFocused()
          await expectElementScreenshot(dialog.root, 'text-editor-dialog.png')
        })

        await test.step('typing updates the node while the editor is open', async () => {
          await comfyPage.page.keyboard.type('at ')
          await expect(widgetBehindDialog).toHaveValue(`at ${original}`)

          await dialog.editor.click()
          await dialog.editor.press('Control+End')
          await dialog.editor.pressSequentially(', dusk', { delay: 80 })

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
      }
    )

    test('opens long text scrolled to the top', async ({ comfyPage }) => {
      const node = comfyPage.vueNodes
        .getNodeByTitle('CLIP Text Encode (Prompt)')
        .first()
      const widget = node.getByRole('textbox', { name: 'text' })
      const dialog = new TextEditorDialog(comfyPage.page)

      await test.step('prepare an overflowing prompt', async () => {
        await widget.fill(
          Array.from({ length: 60 }, (_, line) => `line ${line + 1}`).join('\n')
        )
      })

      await test.step('open the editor at the start of the prompt', async () => {
        await widget.hover()
        await node
          .getByRole('group', { name: 'Actions' })
          .getByRole('button', { name: 'Expand' })
          .click()

        await expect(dialog.editor).toBeFocused()
        await expect
          .poll(() =>
            dialog.editor.evaluate((el) => el.scrollHeight > el.clientHeight)
          )
          .toBe(true)
        await expect(dialog.editor).toHaveJSProperty('scrollTop', 0)
        await expect(dialog.editor).toHaveJSProperty('selectionStart', 0)
      })
    })
  }
)
