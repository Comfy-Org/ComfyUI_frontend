import { expect } from '@playwright/test'

import type { ComfyPage } from '../fixtures/ComfyPage'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('ResultGallery', { tag: ['@slow'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setup()
  })

  async function runAndOpenGallery(comfyPage: ComfyPage) {
    await comfyPage.workflow.loadWorkflow(
      'widgets/save_image_and_animated_webp'
    )
    await comfyPage.vueNodes.waitForNodes()
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

    // Wait for any asset card to appear (may contain img or video)
    const assetCard = comfyPage.page
      .locator('[role="button"]')
      .filter({ has: comfyPage.page.locator('img, video') })
      .first()

    await expect(assetCard).toBeVisible({ timeout: 30_000 })

    // Hover to reveal zoom button, then click it
    await assetCard.hover()
    const zoomButton = assetCard.getByLabel('Zoom in')
    await expect(zoomButton).toBeVisible()
    await zoomButton.click()

    const gallery = comfyPage.page.getByRole('dialog')
    await expect(gallery).toBeVisible()

    return { gallery }
  }

  test('opens gallery and shows dialog with close button', async ({
    comfyPage
  }) => {
    const { gallery } = await runAndOpenGallery(comfyPage)
    await expect(gallery.getByLabel('Close')).toBeVisible()
  })

  test('closes gallery on Escape key', async ({ comfyPage }) => {
    await runAndOpenGallery(comfyPage)

    await comfyPage.page.keyboard.press('Escape')
    await expect(comfyPage.page.getByRole('dialog')).not.toBeVisible()
  })

  test('closes gallery when clicking close button', async ({ comfyPage }) => {
    const { gallery } = await runAndOpenGallery(comfyPage)

    await gallery.getByLabel('Close').click()
    await expect(comfyPage.page.getByRole('dialog')).not.toBeVisible()
  })
})
