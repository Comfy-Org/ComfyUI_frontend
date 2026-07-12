import type { UploadImageResponse } from '@comfyorg/ingest-types'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Vue Upload Widgets', { tag: '@vue-nodes' }, () => {
  test.describe('media selection', { tag: '@widget' }, () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
    })

    test('keeps a selected image loaded when it is selected again', async ({
      comfyPage
    }) => {
      const loadImageNodes =
        await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
      expect(loadImageNodes, 'Workflow has one Load Image node').toHaveLength(1)
      const [loadImageNode] = loadImageNodes

      const imageWidget = await loadImageNode.getWidgetByName('image')
      await expect.poll(() => imageWidget.getValue()).toBe('example.png')

      const node = comfyPage.vueNodes.getNodeByTitle('Load Image')
      const imageLoadError = node.getByTestId(TestIds.errors.imageLoadError)
      const selectedImageButton = node.getByRole('button', {
        name: 'example.png',
        exact: true
      })
      await expect(selectedImageButton).toBeVisible()
      await expect(imageLoadError).toBeHidden()

      await selectedImageButton.click()

      const menu = comfyPage.page.getByTestId('form-dropdown-menu')
      await expect(menu).toBeVisible()
      await menu.getByText('example.png', { exact: true }).click()
      await expect(menu).toBeHidden()

      await expect(selectedImageButton).toBeFocused()
      await expect(selectedImageButton).toBeVisible()
      await expect.poll(() => imageWidget.getValue()).toBe('example.png')
      await expect(imageLoadError).toBeHidden()
    })
  })

  test('should hide canvas-only upload buttons', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('widgets/all_load_widgets')

    await expect(
      comfyPage.page.getByText('choose file to upload', { exact: true })
    ).toBeHidden()

    await expect
      .poll(() =>
        comfyPage.page.getByTestId(TestIds.errors.imageLoadError).count()
      )
      .toBeGreaterThan(0)
    await expect
      .poll(() =>
        comfyPage.page.getByTestId(TestIds.errors.videoLoadError).count()
      )
      .toBeGreaterThan(0)
  })

  test('shows a spinner during upload', async ({ comfyPage }) => {
    let releaseUpload: () => void = () => {}
    const uploadResponse: UploadImageResponse = { name: 'spinner-test.png' }

    await comfyPage.page.route('**/upload/image', async (route) => {
      await new Promise<void>((resolve) => {
        releaseUpload = resolve
      })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(uploadResponse)
      })
    })
    for (const nodeName of ['Load Image', 'Load Video', 'Load Audio']) {
      await test.step(`for ${nodeName}`, async () => {
        await comfyPage.menu.topbar.newWorkflowButton.click()
        await comfyPage.nextFrame()
        await comfyPage.searchBoxV2.addNode(nodeName)

        const node = comfyPage.vueNodes.getNodeByTitle(nodeName)
        const fileInput = node.locator('input[type="file"]')
        const spinner = node.getByRole('status')

        await expect(spinner).toBeHidden()
        await fileInput.setInputFiles({
          name: 'spinner-test.png',
          mimeType: 'image/png',
          buffer: Buffer.from('test')
        })

        await expect(spinner).toBeVisible()
        releaseUpload()
        await expect(spinner).toBeHidden()
      })
    }
  })
})
