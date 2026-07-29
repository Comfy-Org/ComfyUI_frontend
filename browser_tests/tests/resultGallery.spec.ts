import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('MediaLightbox', { tag: ['@slow', '@vue-nodes'] }, () => {
  async function runAndOpenGallery(comfyPage: ComfyPage) {
    await comfyPage.workflow.loadWorkflow(
      'widgets/save_image_and_animated_webp'
    )
    await comfyPage.runButton.click()

    // Wait for SaveImage node to produce output
    const saveImageNode = comfyPage.vueNodes.getNodeByTitle('Save Image')
    await expect(saveImageNode.locator('.image-preview img')).toBeVisible({
      timeout: 30_000
    })

    // Open Assets sidebar tab and wait for it to load
    await comfyPage.page.locator('.assets-tab-button').click()
    await comfyPage.page
      .locator('.sidebar-content-container')
      .waitFor({ state: 'visible' })

    // Wait for a generated previewable asset to appear
    const assetCard = comfyPage.menu.assetsTab.assetCards
      .filter({ has: comfyPage.page.locator('img, video') })
      .first()

    await expect(assetCard).toBeVisible({ timeout: 30_000 })

    await assetCard.hover()
    await assetCard.getByRole('button', { name: 'More options' }).click()
    await comfyPage.menu.assetsTab.contextMenuItem('Inspect asset').click()

    const { root } = comfyPage.mediaLightbox
    await expect(root).toBeVisible()
  }

  test('opens gallery and shows dialog with close button', async ({
    comfyPage
  }) => {
    await runAndOpenGallery(comfyPage)
    await expect(comfyPage.mediaLightbox.closeButton).toBeVisible()
  })

  test('closes gallery on Escape key', async ({ comfyPage }) => {
    await runAndOpenGallery(comfyPage)

    await comfyPage.page.keyboard.press('Escape')
    await expect(comfyPage.mediaLightbox.root).toBeHidden()
  })

  test('closes gallery when clicking close button', async ({ comfyPage }) => {
    await runAndOpenGallery(comfyPage)

    await comfyPage.mediaLightbox.closeButton.click()
    await expect(comfyPage.mediaLightbox.root).toBeHidden()
  })
})
