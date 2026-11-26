import type { Locator } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { createLargePng } from '@e2e/fixtures/data/largePng'
import { TestIds } from '@e2e/fixtures/selectors'

const FILENAME = 'full_resolution_toggle.png'

function shownImage(image: Locator) {
  return image.evaluate((img: HTMLImageElement) => ({
    source: img.src.startsWith('blob:') ? 'display copy' : img.src,
    width: img.complete ? img.naturalWidth : 0,
    height: img.complete ? img.naturalHeight : 0
  }))
}

const displayCopy = { source: 'display copy', width: 1024, height: 512 }
const original = {
  source: expect.stringContaining(`filename=${FILENAME}`),
  width: 2048,
  height: 1024
}

test.describe(
  'Full-resolution image preview toggle',
  { tag: ['@node', '@vue-nodes'] },
  () => {
    test('switches a single image between the display copy and the original', async ({
      comfyPage,
      comfyFiles
    }) => {
      comfyFiles.deleteAfterTest({ filename: FILENAME, type: 'input' })
      const upload = await comfyPage.page.request.post(
        `${comfyPage.url}/api/upload/image`,
        {
          multipart: {
            image: {
              name: FILENAME,
              mimeType: 'image/png',
              buffer: createLargePng(2048, 1024)
            },
            overwrite: 'true',
            type: 'input'
          }
        }
      )
      expect(upload.ok()).toBe(true)
      await comfyPage.workflow.loadWorkflow('widgets/load_image_widget', {
        nodes: {
          10: { widgets_values: [FILENAME, 'image'] }
        }
      })
      const node = comfyPage.vueNodes.getNodeByTitle('Load Image')
      const image = node.getByTestId(TestIds.node.mainImage)

      await test.step('Shows the downscaled display copy by default', async () => {
        await expect
          .poll(() => shownImage(image), { timeout: 15_000 })
          .toEqual(displayCopy)
        expect(await comfyPage.workflow.isCurrentWorkflowModified()).toBe(false)
      })

      await test.step('Show Full Resolution renders the original', async () => {
        await comfyPage.contextMenu.openForVueNode(node)
        await comfyPage.contextMenu.clickMenuItemExact('Show Full Resolution')
        await expect.poll(() => shownImage(image)).toEqual(original)
        expect(await comfyPage.workflow.isCurrentWorkflowModified()).toBe(true)
      })

      await test.step('The choice survives saving and reloading the workflow', async () => {
        const saved = await comfyPage.workflow.getExportedWorkflow()
        await comfyPage.workflow.loadGraphData(saved)
        await expect.poll(() => shownImage(image)).toEqual(original)
      })

      await test.step('Show Downscaled Preview returns to the display copy', async () => {
        await comfyPage.contextMenu.openForVueNode(node)
        await comfyPage.contextMenu.clickMenuItemExact(
          'Show Downscaled Preview'
        )
        await expect.poll(() => shownImage(image)).toEqual(displayCopy)
      })

      await test.step('Turning off downscaling globally renders the original without the toggle', async () => {
        await comfyPage.settings.setSetting(
          'Comfy.Node.DownscaleImagePreviews',
          false
        )
        await expect.poll(() => shownImage(image)).toEqual(original)
        await comfyPage.contextMenu.openForVueNode(node)
        await expect(
          comfyPage.contextMenu.menuItem('Show Full Resolution')
        ).toBeHidden()
      })
    })
  }
)
