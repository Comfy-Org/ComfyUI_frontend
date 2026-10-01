import type { UploadImageResponse } from '@comfyorg/ingest-types'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { WidgetSelectDropdownFixture } from '@e2e/fixtures/components/WidgetSelectDropdown'
import { TestIds } from '@e2e/fixtures/selectors'
import { assetPath } from '@e2e/fixtures/utils/paths'

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

      await WidgetSelectDropdownFixture.fromTrigger(
        selectedImageButton
      ).selectOption('example.png')

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

  test('uploads an EXR image', async ({ comfyPage, comfyFiles }) => {
    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')

    const [loadImageNode] =
      await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    const imageWidget = await loadImageNode.getWidgetByName('image')
    const node = comfyPage.vueNodes.getNodeByTitle('Load Image')
    const filename = 'test_upload_image.exr'
    const uploadResponse = comfyPage.page.waitForResponse(
      (response) =>
        response.url().includes('/upload/image') && response.status() === 200
    )

    await node.locator('input[type="file"]').setInputFiles(assetPath(filename))
    comfyFiles.deleteAfterTest({ filename, type: 'input' })
    await uploadResponse

    await expect.poll(() => imageWidget.getValue()).toBe(filename)
    await expect(
      node.getByRole('button', { name: filename, exact: true })
    ).toBeVisible()
    await expect(node.getByTestId(TestIds.errors.imageLoadError)).toBeHidden()
  })

  test('rejects an extensionless video and still uploads a valid one', async ({
    comfyPage
  }) => {
    await comfyPage.menu.topbar.newWorkflowButton.click()
    await comfyPage.nextFrame()
    await comfyPage.searchBoxV2.addNode('Load Video')

    const [loadVideoNode] =
      await comfyPage.nodeOps.getNodeRefsByType('LoadVideo')
    expect(loadVideoNode, 'Load Video node was added').toBeDefined()
    const videoWidget = await loadVideoNode.getWidgetByName('file')
    const rejectionToasts = comfyPage.page.getByText(
      'Video files need a filename extension. Rename the file (for example, clip.mp4) and try again.',
      { exact: true }
    )
    let uploadRequests = 0
    await comfyPage.page.route('**/upload/image', async (route) => {
      uploadRequests += 1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ name: 'clip.mp4' })
      })
    })

    await test.step('claim a rejected canvas paste without creating an empty node', async () => {
      await comfyPage.canvas.focus()
      await loadVideoNode.click('title')
      await comfyPage.page.evaluate(() => {
        const dataTransfer = new DataTransfer()
        dataTransfer.items.add(
          new File(['video'], 'extensionless', { type: 'video/mp4' })
        )
        document.activeElement?.dispatchEvent(
          new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true
          })
        )
      })

      await expect(rejectionToasts).toHaveCount(1)
      await expect(rejectionToasts.first()).toBeVisible()
      expect(uploadRequests).toBe(0)
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)
    })

    const fileInput = comfyPage.vueNodes
      .getNodeByTitle('Load Video')
      .locator('input[type="file"]')

    await test.step('reject the extensionless video with actionable feedback', async () => {
      await fileInput.setInputFiles({
        name: 'extensionless',
        mimeType: 'video/mp4',
        buffer: Buffer.from('video')
      })

      await expect(rejectionToasts).toHaveCount(2)
      await expect(rejectionToasts.last()).toBeVisible()
      expect(uploadRequests).toBe(0)
    })

    await test.step('upload a valid video through the same control', async () => {
      await fileInput.setInputFiles({
        name: 'clip.mp4',
        mimeType: 'video/mp4',
        buffer: Buffer.from('video')
      })

      await expect.poll(() => videoWidget.getValue()).toBe('clip.mp4')
      expect(uploadRequests).toBe(1)
    })
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
