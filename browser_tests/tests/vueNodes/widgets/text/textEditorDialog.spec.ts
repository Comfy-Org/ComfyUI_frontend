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

    test('accepts an extension completion with native undo and redo', async ({
      comfyPage
    }) => {
      const node = comfyPage.vueNodes
        .getNodeByTitle('CLIP Text Encode (Prompt)')
        .first()
      const widget = node.getByRole('textbox', { name: 'text' })
      const dialog = new TextEditorDialog(comfyPage.page)

      await test.step('register targeted completions and open the expanded editor', async () => {
        await comfyPage.page.evaluate(() => {
          window.app!.registerExtension({
            name: 'test.WidgetCompletion',
            widgetAugmentations: [
              {
                id: 'tags',
                kind: 'text-completion',
                target: { nodeType: 'CLIPTextEncode', widgetName: 'text' },
                suggest: () => ['blue eyes', 'blue hair']
              }
            ]
          })
        })
        await widget.fill('')
        await widget.hover()
        await node
          .getByRole('group', { name: 'Actions' })
          .getByRole('button', { name: 'Expand' })
          .click()
      })

      await test.step('navigate and accept without leaving the textarea', async () => {
        await dialog.editor.pressSequentially('blue')
        await expect(
          dialog.root.getByRole('option', { selected: true })
        ).toHaveText('blue eyes')
        await dialog.editor.press('ArrowDown')
        await expect(
          dialog.root.getByRole('option', { selected: true })
        ).toHaveText('blue hair')
        await dialog.editor.press('Enter')
        await expect(dialog.editor).toHaveValue('blue hair')
        await expect(dialog.editor).toBeFocused()
        await expect(dialog.root.getByRole('listbox')).toBeHidden()
      })

      await test.step('undo and redo the insertion through the native editor', async () => {
        await dialog.editor.press('ControlOrMeta+z')
        await expect(dialog.editor).toHaveValue('blue')
        await dialog.editor.press('ControlOrMeta+Shift+z')
        await expect(dialog.editor).toHaveValue('blue hair')
        await dialog.close()
        await expect(widget).toHaveValue('blue hair')
      })
    })

    test('accepts an imported prompt tag with native undo and redo', async ({
      comfyPage
    }) => {
      const node = comfyPage.vueNodes
        .getNodeByTitle('CLIP Text Encode (Prompt)')
        .first()
      const widget = node.getByRole('textbox', { name: 'text' })
      const dialog = new TextEditorDialog(comfyPage.page)

      await test.step('import a catalog in the expanded prompt editor', async () => {
        await widget.fill('')
        await widget.hover()
        await node
          .getByRole('group', { name: 'Actions' })
          .getByRole('button', { name: 'Expand' })
          .click()
        await dialog.root.getByLabel('Import prompt tags').setInputFiles({
          name: 'tags.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('blue_eyes,20\nblue_hair,10')
        })
        await expect(
          dialog.root.getByText('2 tags loaded for this session', {
            exact: true
          })
        ).toBeVisible()
      })

      await test.step('navigate and accept without leaving the textarea', async () => {
        await dialog.editor.pressSequentially('blue')
        await expect(
          dialog.root.getByRole('option', { selected: true })
        ).toHaveText('blue eyes')
        await dialog.editor.press('ArrowDown')
        await expect(
          dialog.root.getByRole('option', { selected: true })
        ).toHaveText('blue hair')
        await dialog.editor.press('Enter')
        await expect(dialog.editor).toHaveValue('blue hair')
        await expect(dialog.editor).toBeFocused()
        await expect(dialog.root.getByRole('listbox')).toBeHidden()
      })

      await test.step('undo and redo the insertion through the native editor', async () => {
        await dialog.editor.press('ControlOrMeta+z')
        await expect(dialog.editor).toHaveValue('blue')
        await dialog.editor.press('ControlOrMeta+Shift+z')
        await expect(dialog.editor).toHaveValue('blue hair')
        await dialog.close()
        await expect(widget).toHaveValue('blue hair')
      })
    })

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
