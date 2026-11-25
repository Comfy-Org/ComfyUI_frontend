import type { Locator, Page } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { assetPath } from '@e2e/fixtures/utils/paths'

const EXR_FILENAME = 'test_upload_image.exr'
const PREVIEW_ID = '3f2c9a4e-8d1b-4c6f-9e7a-5b0d2c1f8a63'
const PREVIEW_CONTENT_PATH = `/assets/${PREVIEW_ID}/content`

async function routeUploadPreviewId(page: Page, previewId?: string) {
  await page.route('**/upload/image', async (route) => {
    const response = await route.fetch()
    const { asset, ...body } = await response.json()
    const { preview_id: _, ...rest } = asset ?? {}
    await route.fulfill({
      response,
      json: {
        ...body,
        asset: previewId ? { ...rest, preview_id: previewId } : rest
      }
    })
  })
  await page.route(`**${PREVIEW_CONTENT_PATH}*`, (route) =>
    route.fulfill({ path: assetPath('test_upload_image.png') })
  )
}

function waitForUpload(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.url().includes('/upload/image') && response.status() === 200
  )
}

async function uploadFromPicker(comfyPage: ComfyPage, node: Locator) {
  const upload = waitForUpload(comfyPage.page)
  await node
    .locator('input[type="file"]')
    .setInputFiles(assetPath(EXR_FILENAME))
  await upload
}

async function captureOpenedUrl(page: Page) {
  await page.evaluate(() => {
    window.open = (url) => {
      document.body.dataset.openedUrl = String(url)
      return null
    }
  })
  return () => page.evaluate(() => document.body.dataset.openedUrl ?? '')
}

test.describe('Load Image EXR upload preview', { tag: '@widget' }, () => {
  test(
    'shows the stored preview on a Vue node and acts on the EXR',
    { tag: '@vue-nodes' },
    async ({ comfyPage, comfyFiles }) => {
      await routeUploadPreviewId(comfyPage.page, PREVIEW_ID)
      await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
      const node = comfyPage.vueNodes.getNodeByTitle('Load Image')
      const image = node.getByTestId('main-image')
      comfyFiles.deleteAfterTest({ filename: EXR_FILENAME, type: 'input' })

      const dimensions = node.getByText(/^\d+ x \d+$/)
      await uploadFromPicker(comfyPage, node)
      await expect(image).toHaveAttribute(
        'src',
        new RegExp(PREVIEW_CONTENT_PATH)
      )
      await expect(dimensions).toBeVisible()

      const nodeImage = (mark?: 'stale') =>
        comfyPage.page.evaluate((mark) => {
          const img = window.app?.graph.nodes.find(
            (n) => n.type === 'LoadImage'
          )?.imgs?.[0]
          if (mark && img) img.dataset.stale = mark
          if (!img?.complete || !img.naturalWidth) return 'loading'
          return img.dataset.stale ?? img.dataset.testid ?? 'replaced'
        }, mark)
      await nodeImage('stale')
      await uploadFromPicker(comfyPage, node)
      await expect.poll(() => nodeImage()).toBe('main-image')
      await expect(dimensions).toBeVisible()

      await comfyPage.contextMenu.openForVueNode(node)
      const download = comfyPage.page.waitForEvent('download')
      await comfyPage.contextMenu.clickMenuItemExact('Save Image')
      expect((await download).suggestedFilename()).toBe(EXR_FILENAME)

      const openedUrl = await captureOpenedUrl(comfyPage.page)
      await comfyPage.contextMenu.openForVueNode(node)
      await comfyPage.contextMenu.clickMenuItemExact('Open Image')
      await expect.poll(openedUrl).toContain(`filename=${EXR_FILENAME}`)
    }
  )
})
