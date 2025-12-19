import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Properties panel position', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.actionbar.propertiesButton.click()
  })

  test('positions on the right when sidebar is on the left', async ({
    comfyPage
  }) => {
    await comfyPage.setSetting('Comfy.Sidebar.Location', 'left')
    await comfyPage.nextFrame()

    const propertiesPanel = comfyPage.page.getByTestId('properties-panel')
    const sidebar = comfyPage.page.locator('.side-bar-panel')

    const propsBoundingBox = await propertiesPanel.boundingBox()
    const sidebarBoundingBox = await sidebar.boundingBox()

    expect(propsBoundingBox).not.toBeNull()
    expect(sidebarBoundingBox).not.toBeNull()

    // Properties panel should be to the right of the sidebar
    expect(propsBoundingBox!.x).toBeGreaterThan(
      sidebarBoundingBox!.x + sidebarBoundingBox!.width
    )
  })

  test('positions on the left when sidebar is on the right', async ({
    comfyPage
  }) => {
    await comfyPage.setSetting('Comfy.Sidebar.Location', 'right')
    await comfyPage.nextFrame()

    const propertiesPanel = comfyPage.page.getByTestId('properties-panel')
    const sidebar = comfyPage.page.locator('.side-bar-panel')

    const propsBoundingBox = await propertiesPanel.boundingBox()
    const sidebarBoundingBox = await sidebar.boundingBox()

    expect(propsBoundingBox).not.toBeNull()
    expect(sidebarBoundingBox).not.toBeNull()

    // Properties panel should be to the left of the sidebar
    expect(propsBoundingBox!.x + propsBoundingBox!.width).toBeLessThan(
      sidebarBoundingBox!.x
    )
  })

  test('close button icon updates based on sidebar location', async ({
    comfyPage
  }) => {
    const propertiesPanel = comfyPage.page.getByTestId('properties-panel')

    // When sidebar is on the left, panel is on the right
    await comfyPage.setSetting('Comfy.Sidebar.Location', 'left')
    await comfyPage.nextFrame()

    const closeButtonLeft = propertiesPanel
      .locator('button[aria-label*="toggle"]')
      .locator('i')
    await expect(closeButtonLeft).toHaveClass(/panel-right/)

    // When sidebar is on the right, panel is on the left
    await comfyPage.setSetting('Comfy.Sidebar.Location', 'right')
    await comfyPage.nextFrame()

    const closeButtonRight = propertiesPanel
      .locator('button[aria-label*="toggle"]')
      .locator('i')
    await expect(closeButtonRight).toHaveClass(/panel-left/)
  })
})
