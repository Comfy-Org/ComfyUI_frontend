import type { Page } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { assetPath } from '@e2e/fixtures/utils/paths'

const EXR_FILENAME = 'test_upload_image.exr'
const PREVIEW_ID = '3f2c9a4e-8d1b-4c6f-9e7a-5b0d2c1f8a63'
const PREVIEW_CONTENT_PATH = `/assets/${PREVIEW_ID}/content`

/**
 * Stands in for a backend that stores a preview for an uploaded EXR: the
 * upload response carries the preview's id and the preview is a PNG.
 */
async function serveStoredPreview(page: Page) {
  await page.route('**/upload/image', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    await route.fulfill({
      response,
      json: { ...body, asset: { ...body.asset, preview_id: PREVIEW_ID } }
    })
  })
  await page.route(`**${PREVIEW_CONTENT_PATH}*`, (route) =>
    route.fulfill({ path: assetPath('test_upload_image.png') })
  )
}

test.describe('Load Image EXR upload preview', { tag: '@widget' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await serveStoredPreview(comfyPage.page)
  })

  test(
    'shows the stored preview on a Vue node uploaded from its picker',
    { tag: '@vue-nodes' },
    async ({ comfyPage, comfyFiles }) => {
      await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
      const node = comfyPage.vueNodes.getNodeByTitle('Load Image')
      const uploadResponse = comfyPage.page.waitForResponse(
        (response) =>
          response.url().includes('/upload/image') && response.status() === 200
      )

      await node
        .locator('input[type="file"]')
        .setInputFiles(assetPath(EXR_FILENAME))
      comfyFiles.deleteAfterTest({ filename: EXR_FILENAME, type: 'input' })
      await uploadResponse

      const image = node.getByTestId('main-image')
      await expect(image).toHaveAttribute(
        'src',
        new RegExp(PREVIEW_CONTENT_PATH)
      )
      await expect
        .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0)
    }
  )

  test('shows the stored preview on a canvas node uploaded from its button', async ({
    comfyPage,
    comfyFiles
  }) => {
    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
    const [loadImageNode] =
      await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    const uploadWidget = await loadImageNode.getWidgetByName('upload')
    const uploadResponse = comfyPage.page.waitForResponse(
      (response) =>
        response.url().includes('/upload/image') && response.status() === 200
    )

    const chooser = comfyPage.page.waitForEvent('filechooser')
    await uploadWidget.click()
    await (await chooser).setFiles(assetPath(EXR_FILENAME))
    comfyFiles.deleteAfterTest({ filename: EXR_FILENAME, type: 'input' })
    await uploadResponse

    await expect
      .poll(() =>
        comfyPage.page.evaluate((nodeId) => {
          const img = window.app?.graph.getNodeById(nodeId)?.imgs?.[0]
          return img?.naturalWidth ? img.src : undefined
        }, loadImageNode.id)
      )
      .toContain(PREVIEW_CONTENT_PATH)

    const nodeCenter =
      await comfyPage.canvasOps.getNodeCenterByTitle('Load Image')
    if (!nodeCenter) throw new Error('Load Image node must be on the canvas')
    await comfyPage.page.mouse.click(nodeCenter.x, nodeCenter.y, {
      button: 'right'
    })
    const download = comfyPage.page.waitForEvent('download')
    await comfyPage.contextMenu.clickMenuItemExact('Save Image')
    expect((await download).suggestedFilename()).toBe(EXR_FILENAME)

    await comfyPage.page.mouse.click(nodeCenter.x, nodeCenter.y, {
      button: 'right'
    })
    await comfyPage.page.evaluate(() => {
      window.open = (url) => {
        document.body.dataset.openedUrl = String(url)
        return null
      }
    })
    await comfyPage.contextMenu.clickMenuItemExact('Open Image')
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => document.body.dataset.openedUrl ?? '')
      )
      .toContain(`filename=${EXR_FILENAME}`)
  })
})
