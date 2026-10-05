import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { zUploadImageResponse } from '@comfyorg/ingest-types/zod'

import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { maskEditorTest as test } from '@e2e/fixtures/helpers/MaskEditorHelper'

const NODE_TYPE = 'DevToolsPreviewBridge'

test.describe(
  'Impact Preview Bridge image setter',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test('saving a mask registers the new image through the extension setter', async ({
      comfyPage,
      comfyFiles,
      maskEditor
    }) => {
      const subfolder = `preview-bridge-${randomUUID()}`
      await comfyPage.page.route('**/upload/image', async (route) => {
        const body = route.request().postDataBuffer()
        assert(body)
        const multipart = await new Response(new Uint8Array(body), {
          headers: { 'Content-Type': route.request().headers()['content-type'] }
        }).formData()
        multipart.set('subfolder', subfolder)
        const headers = new Headers(route.request().headers())
        headers.delete('content-type')
        headers.delete('content-length')
        const response = await comfyPage.request.post(route.request().url(), {
          headers: Object.fromEntries(headers),
          multipart
        })
        const uploaded = zUploadImageResponse
          .required()
          .parse(await response.json())
        comfyFiles.deleteAfterTest({
          filename: uploaded.name,
          subfolder: uploaded.subfolder,
          type: uploaded.type
        })
        await route.fulfill({ response })
      })

      const { dialog, node } =
        await test.step('Open the mask editor with the original preview', async () => {
          await comfyPage.workflow.loadWorkflow('widgets/preview_bridge')
          const dialog = await maskEditor.openDialog(NODE_TYPE)
          const node = await comfyPage.nodeOps.getNodeRefByType(NODE_TYPE)
          const image = await node.getWidgetByName('image')
          await expect.poll(() => image.getValue()).toBe('$preview-before-mask')
          return { dialog, node }
        })

      await test.step('Draw and save a mask', async () => {
        await maskEditor.drawStrokeAndExpectPixels(dialog)
        await comfyPage.nextFrame()
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
