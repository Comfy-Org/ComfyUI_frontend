import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Vue multiline text editor in the properties panel',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test('edits the widget live from the Text tab, with one undo for the session', async ({
      comfyPage
    }) => {
      const node = comfyPage.vueNodes
        .getNodeByTitle('CLIP Text Encode (Prompt)')
        .first()
      const widget = node.getByRole('textbox', { name: 'text' })
      const panel = comfyPage.menu.propertiesPanel.root
      const editor = panel.getByTestId('text-editor-panel-textarea')
      const panelWidth = () =>
        panel.evaluate((element) => element.getBoundingClientRect().width)
      const original = await widget.inputValue()

      await test.step('the actions show on hover, not on focus alone', async () => {
        const actions = node.getByRole('group', { name: 'Actions' })
        await widget.click()
        await comfyPage.page.mouse.move(0, 0)
        await expect(actions).toHaveCSS('opacity', '0')

        await widget.hover()
        await expect(actions).toHaveCSS('opacity', '1')
      })

      await test.step('Expand opens the Text tab at a readable width, focused at the start', async () => {
        await node.getByRole('button', { name: 'Expand' }).click()

        await expect(panel.getByRole('tab', { name: 'Text' })).toHaveAttribute(
          'aria-selected',
          'true'
        )
        await expect(editor).toBeFocused()
        await expect(editor).toHaveJSProperty('selectionStart', 0)
        await expect.poll(panelWidth).toBeGreaterThanOrEqual(540)
      })

      await test.step('typing updates the node, also after a click mid-edit', async () => {
        await editor.pressSequentially('dusk, ', { delay: 80 })
        await editor.click({ position: { x: 4, y: 4 } })
        await editor.pressSequentially('golden ', { delay: 80 })

        await expect(widget).toHaveValue(`dusk, golden ${original}`)
      })

      await test.step('the Parameters tab gets its own width back', async () => {
        await panel.getByRole('tab', { name: 'Parameters' }).click()

        await expect.poll(panelWidth).toBeLessThan(400)
      })

      await test.step('one undo on the canvas reverts the whole edit', async () => {
        await comfyPage.keyboard.undo()

        await expect(widget).toHaveValue(original)
      })
    })
  }
)
