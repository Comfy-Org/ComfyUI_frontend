import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Mobile viewport', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test('@mobile App UI is not hidden under mobile browser UI', async ({
    comfyPage
  }) => {
    const viewportSize = await comfyPage.page.viewportSize()

    // Top menu is visible
    const topMenu = comfyPage.page.locator('.comfyui-menu')
    await expect(topMenu).toBeVisible()

    // Top menu is not cut off from the top
    const topMenuBox = await topMenu.boundingBox()
    expect(topMenuBox?.y).toBeGreaterThanOrEqual(0)

    // Graph is visible
    const graphView = comfyPage.page.locator('.lgraphcanvas')
    await expect(graphView).toBeVisible()

    // Graph is not cut off from the bottom
    const graphViewBox = await graphView.boundingBox()
    expect(graphViewBox).not.toBeNull()
    expect(viewportSize).not.toBeNull()
    expect(graphViewBox!.y + graphViewBox!.height).toBeLessThanOrEqual(
      viewportSize!.height
    )
  })
})
