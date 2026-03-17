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
    const assetsTabButton = comfyPage.page.locator('.assets-tab-button')
    await assetsTabButton.click()

    // Wait for at least one image asset card to appear
    const assetCard = comfyPage.page
      .locator('[role="button"]')
      .filter({ has: comfyPage.page.locator('img') })
      .first()
    await expect(assetCard).toBeVisible({ timeout: 30_000 })

    return { assetCard }
  }

  test('opens gallery when clicking zoom on asset card', async ({
    comfyPage
  }) => {
    const { assetCard } = await runWorkflowAndOpenAssets(comfyPage)

    // Hover to reveal zoom button
    await assetCard.hover()
    const zoomButton = comfyPage.page.getByLabel('Zoom in').first()
    await expect(zoomButton).toBeVisible()
    await zoomButton.click()

    // Gallery dialog should be visible
    const gallery = comfyPage.page.getByRole('dialog')
    await expect(gallery).toBeVisible()

    // Close button should be visible
    await expect(comfyPage.page.getByLabel('Close').first()).toBeVisible()
  })

  test('closes gallery on Escape key', async ({ comfyPage }) => {
    const { assetCard } = await runWorkflowAndOpenAssets(comfyPage)

    await assetCard.hover()
    await comfyPage.page.getByLabel('Zoom in').first().click()
    await expect(comfyPage.page.getByRole('dialog')).toBeVisible()

    // Press Escape to close
    await comfyPage.page.keyboard.press('Escape')
    await expect(comfyPage.page.getByRole('dialog')).not.toBeVisible()
  })

  test('closes gallery when clicking close button', async ({ comfyPage }) => {
    const { assetCard } = await runWorkflowAndOpenAssets(comfyPage)

    await assetCard.hover()
    await comfyPage.page.getByLabel('Zoom in').first().click()
    await expect(comfyPage.page.getByRole('dialog')).toBeVisible()

    // Click close button
    await comfyPage.page.getByLabel('Close').first().click()
    await expect(comfyPage.page.getByRole('dialog')).not.toBeVisible()
  })
})
