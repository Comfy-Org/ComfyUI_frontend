import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Vue widget augmentations',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test('shows a live hint and applies a text action with native undo', async ({
      comfyPage
    }) => {
      const node = comfyPage.vueNodes
        .getNodeByTitle('CLIP Text Encode (Prompt)')
        .first()
      const widget = node.getByRole('textbox', { name: 'text' })
      const normalize = node.getByRole('button', { name: 'Normalize tags' })

      await test.step('register a tag count hint and a Normalize tags action', async () => {
        await comfyPage.page.evaluate(() => {
          const tags = (value: string) =>
            value
              .split(',')
              .map((tag) => tag.trim().toLowerCase())
              .filter(Boolean)
          window.app!.registerExtension({
            name: 'test.WidgetTextActions',
            widgetAugmentations: [
              {
                id: 'tag-count',
                kind: 'hint',
                target: { nodeType: 'CLIPTextEncode', widgetName: 'text' },
                text: (value: string) => `${tags(value).length} tags`
              },
              {
                id: 'normalize',
                kind: 'text-action',
                label: 'Normalize tags',
                target: { nodeType: 'CLIPTextEncode', widgetName: 'text' },
                transform: (value: string) => tags(value).join(', ')
              }
            ]
          })
        })
      })

      await test.step('the hint follows the text as it is typed', async () => {
        await widget.fill('')
        await widget.pressSequentially('Blue Eyes,  RED hair , ', {
          delay: 60
        })
        await expect(node.getByText('2 tags')).toBeVisible()
      })

      await test.step('Normalize tags rewrites the text in place', async () => {
        await normalize.click()
        await expect(widget).toHaveValue('blue eyes, red hair')
        await expect(node.getByText('2 tags')).toBeVisible()
      })

      await test.step('native undo restores the typed text', async () => {
        await widget.press('ControlOrMeta+z')
        await expect(widget).toHaveValue('Blue Eyes,  RED hair , ')
      })
    })

    test('browses directories, commits a file, and cancels with Escape', async ({
      comfyPage
    }) => {
      const node = comfyPage.vueNodes.getNodeByTitle('Save Image').first()
      const field = node.getByRole('button', { name: 'filename_prefix' })
      const fieldBehindDialog = node.getByRole('button', {
        name: 'filename_prefix',
        includeHidden: true
      })
      const dialog = comfyPage.page.getByRole('dialog', { name: 'Choose path' })
      const draft = dialog.getByRole('combobox')
      const options = dialog.getByRole('option')
      const openPathDialog = async () => {
        const box = await field.boundingBox()
        if (!box) throw new Error('filename_prefix field has no box')
        await field.click({
          position: { x: box.width - 16, y: box.height / 2 }
        })
      }

      await test.step('register an in-memory path provider', async () => {
        await comfyPage.page.evaluate(() => {
          const directory = (value: string) => ({
            label: value,
            value,
            kind: 'directory' as const
          })
          const file = (label: string, value: string) => ({
            label,
            value,
            kind: 'file' as const
          })
          window.app!.registerExtension({
            name: 'test.PathCompletion',
            widgetAugmentations: [
              {
                id: 'output-paths',
                kind: 'path-completion',
                target: {
                  nodeType: 'SaveImage',
                  widgetName: 'filename_prefix'
                },
                suggest: async (value: string) => ({
                  status: 'ready' as const,
                  items: value.startsWith('renders/')
                    ? [
                        file('portrait', 'renders/portrait'),
                        file('landscape', 'renders/landscape')
                      ]
                    : [directory('renders/'), file('ComfyUI', 'ComfyUI')]
                }),
                parent: (value: string) =>
                  value.slice(0, value.lastIndexOf('/', value.length - 2) + 1)
              }
            ]
          })
        })
        await comfyPage.nodeOps.panToNode(
          await comfyPage.nodeOps.getNodeRefByType('SaveImage')
        )
        await expect(field).toHaveText('ComfyUI')
        await expect(field).toBeInViewport()
      })

      await test.step('Escape closes the dialog without changing the widget', async () => {
        await openPathDialog()
        await expect(draft).toBeFocused()
        await expect(options).toHaveText(['renders/', 'ComfyUI'])
        await draft.pressSequentially('-draft', { delay: 60 })
        await draft.press('Escape')
        await expect(dialog).toBeHidden()
        await expect(field).toHaveText('ComfyUI')
      })

      await test.step('Tab completes a directory without committing it', async () => {
        await openPathDialog()
        await draft.press('Tab')
        await expect(draft).toHaveValue('renders/')
        await expect(options).toHaveText(['portrait', 'landscape'])
        await expect(fieldBehindDialog).toHaveText('ComfyUI')
      })

      await test.step('choosing a file commits it and closes the dialog', async () => {
        await options.filter({ hasText: 'landscape' }).click()
        await expect(dialog).toBeHidden()
        await expect(field).toHaveText('renders/landscape')
      })

      await test.step('one undo on the canvas restores the previous path', async () => {
        await comfyPage.canvasOps.moveMouseToEmptyArea()
        await comfyPage.keyboard.undo()
        await expect(field).toHaveText('ComfyUI')
      })
    })
  }
)
