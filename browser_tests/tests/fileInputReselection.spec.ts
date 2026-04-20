import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('File input same-file reselection', () => {
  test('should allow uploading the same file twice via LoadImage node', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/load_image_with_ksampler')

    const loadImageNodes =
      await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    const loadImageNode = loadImageNodes[0]
    const uploadWidget = await loadImageNode.getWidget(1)
    const fileWidget = await loadImageNode.getWidget(0)

    // First upload
    const firstUpload = comfyPage.page.waitForResponse(
      (resp) => resp.url().includes('/upload/') && resp.status() === 200,
      { timeout: 10_000 }
    )
    const firstChooser = comfyPage.page.waitForEvent('filechooser')
    await uploadWidget.click()
    await (await firstChooser).setFiles(
      comfyPage.assetPath('test_upload_image.png')
    )
    await firstUpload

    await expect
      .poll(() => fileWidget.getValue(), {
        message: 'First upload should set widget value'
      })
      .toContain('test_upload_image')

    // Second upload of the SAME file — before the fix, the hidden input
    // retained the previous value and onchange did not fire.
    const secondUpload = comfyPage.page.waitForResponse(
      (resp) => resp.url().includes('/upload/') && resp.status() === 200,
      { timeout: 10_000 }
    )
    const secondChooser = comfyPage.page.waitForEvent('filechooser')
    await uploadWidget.click()
    await (await secondChooser).setFiles(
      comfyPage.assetPath('test_upload_image.png')
    )
    await secondUpload

    await expect
      .poll(() => fileWidget.getValue(), {
        message: 'Second upload of the same file should still set widget value'
      })
      .toContain('test_upload_image')
  })
})
