import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { maskEditorTest as test } from '@e2e/fixtures/helpers/MaskEditorHelper'

test.describe(
  'Impact Preview Bridge image setter',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test('saving a mask registers the new image through the extension setter', async ({
      comfyPage,
      maskEditor
    }) => {
      const dialog = await maskEditor.openDialog()
      await maskEditor.drawStrokeAndExpectPixels(dialog)

      const nodeId =
        await test.step('Install the Preview Bridge value accessor', async () => {
          return comfyPage.page.evaluate(() => {
            const node = window.app!.graph.nodes.find(
              (node) => node.type === 'LoadImage'
            )
            const image = node?.widgets?.find(
              (widget) => widget.name === 'image'
            )
            if (!node || !image)
              throw new Error('LoadImage image widget not found')

            let previewId = '$preview-before-mask'
            Object.defineProperty(image, 'value', {
              configurable: true,
              get: () => previewId,
              set: (value: unknown) => {
                if (typeof value !== 'string')
                  throw new Error('Expected image path')
                void Promise.resolve().then(() => {
                  node.properties.registeredMaskPath = value
                  previewId = '$preview-after-mask'
                })
              }
            })
            return String(node.id)
          })
        })

      await dialog.getByRole('button', { name: 'Save' }).click()
      await expect(dialog).toBeHidden()

      const prompt = await comfyPage.workflow.getExportedWorkflow({ api: true })
      expect(prompt[nodeId]).toBeDefined()

      expect(prompt[nodeId].inputs.image).toBe('$preview-after-mask')

      const node = await comfyPage.nodeOps.getNodeRefByType('LoadImage')
      await expect
        .poll(() => node.getProperty('properties'))
        .toMatchObject({
          registeredMaskPath: expect.stringMatching(
            /clipspace-painted-masked-\d+\.png \[input\]$/
          )
        })
    })
  }
)
