import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { screenshotRegion } from '@e2e/fixtures/utils/screenshotRegion'

test.describe(
  'Save Image and WEBM preview',
  { tag: ['@screenshot', '@widget', '@vue-nodes'] },
  () => {
    test('Can preview both SaveImage and SaveWEBM outputs', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'widgets/save_image_and_animated_webp'
      )

      await comfyPage.runButton.click()

      const saveImageNode = comfyPage.vueNodes.getNodeByTitle('Save Image')
      const saveWebmNode = comfyPage.vueNodes.getNodeByTitle('Save WEBM')

      await expect(saveImageNode.locator('.image-preview img')).toBeVisible({
        timeout: 30000
      })

      await expect(saveWebmNode.locator('.video-preview video')).toBeVisible({
        timeout: 30000
      })

      await expect(comfyPage.page).toHaveScreenshot(
        'save-image-and-webm-preview.png',
        { clip: await screenshotRegion([saveImageNode, saveWebmNode]) }
      )
    })
  }
)
