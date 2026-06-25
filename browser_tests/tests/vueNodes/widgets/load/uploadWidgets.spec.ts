import type { UploadImageResponse } from '@comfyorg/ingest-types'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Vue Upload Widgets', { tag: '@vue-nodes' }, () => {
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
