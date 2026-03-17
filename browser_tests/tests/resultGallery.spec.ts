import { expect } from '@playwright/test'

import type { ComfyPage } from '../fixtures/ComfyPage'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('ResultGallery', { tag: ['@smoke'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setup()
  })

  async function runWorkflowAndOpenAssets(comfyPage: ComfyPage) {
    // Run default workflow to generate an output image
    await comfyPage.runButton.click()

    // Dismiss any dialog overlays that appear after execution
    const dialogMask = comfyPage.page.locator('.p-dialog-mask')
    if (await dialogMask.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await comfyPage.page.keyboard.press('Escape')
      await dialogMask.waitFor({ state: 'hidden', timeout: 5_000 })
    }

    // Open Assets sidebar tab
    await comfyPage.page.locator('.assets-tab-button').click()

    // Wait for at least one image asset card to appear
    const assetCard = comfyPage.page
      .locator('[role="button"]')
      .filter({ has: comfyPage.page.locator('img') })
      .first()
    await expect(assetCard).toBeVisible({ timeout: 30_000 })

    return { assetCard }
  }

  async function openGallery(comfyPage: ComfyPage) {
    const { assetCard } = await runWorkflowAndOpenAssets(comfyPage)

    // Hover to reveal zoom button, then click it
    await assetCard.hover()
    const zoomButton = assetCard.getByLabel('Zoom in')
    await expect(zoomButton).toBeVisible()
    await zoomButton.click()

    const gallery = comfyPage.page.getByRole('dialog')
    await expect(gallery).toBeVisible()

    return { gallery }
  }

  test('opens gallery when clicking zoom on asset card', async ({
    comfyPage
  }) => {
    const { gallery } = await openGallery(comfyPage)

    // Close button should be visible within the gallery
    await expect(gallery.getByLabel('Close')).toBeVisible()
  })

  test('closes gallery on Escape key', async ({ comfyPage }) => {
    await openGallery(comfyPage)

    await comfyPage.page.keyboard.press('Escape')
    await expect(comfyPage.page.getByRole('dialog')).not.toBeVisible()
  })

  test('closes gallery when clicking close button', async ({ comfyPage }) => {
    const { gallery } = await openGallery(comfyPage)

    await gallery.getByLabel('Close').click()
    await expect(comfyPage.page.getByRole('dialog')).not.toBeVisible()
  })
})
