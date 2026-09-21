import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { maskEditorTest as test } from '@e2e/fixtures/helpers/MaskEditorHelper'

const NODE_TYPE = 'DevToolsPreviewBridge'

test.describe(
  'Impact Preview Bridge image setter',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test('saving a mask registers the new image through the extension setter', async ({
      comfyPage,
      maskEditor
    }) => {
      const { dialog, node } =
        await test.step('Open the mask editor with the original preview', async () => {
          const dialog = await maskEditor.openDialog(
            'widgets/preview_bridge',
            NODE_TYPE
          )
          const node = await comfyPage.nodeOps.getNodeRefByType(NODE_TYPE)
          const image = await node.getWidgetByName('image')
          await expect.poll(() => image.getValue()).toBe('$preview-before-mask')
          return { dialog, node }
        })

      await test.step('Draw and save a mask', async () => {
        await maskEditor.drawStrokeAndExpectPixels(dialog)
        await dialog.getByRole('button', { name: 'Save' }).click()
        await expect(dialog).toBeHidden()
      })

      await test.step('Verify the new preview ID and registered mask path', async () => {
        const prompt = await comfyPage.workflow.getExportedWorkflow({
          api: true
        })
        expect(prompt[node.id]).toBeDefined()
        expect(prompt[node.id].inputs.image).toBe('$preview-after-mask')

        await expect
          .poll(() => node.getProperty('properties'))
          .toMatchObject({
            registeredMaskPath: expect.stringMatching(
              /clipspace-painted-masked-\d+\.png \[input\]$/
            )
          })
      })
    })
  }
)
