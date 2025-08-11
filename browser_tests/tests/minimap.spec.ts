import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Minimap', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setSetting('Comfy.Minimap.Visible', true)
    await comfyPage.setSetting('Comfy.Graph.CanvasMenu', true)
    await comfyPage.loadWorkflow('default')
    await comfyPage.page.waitForFunction(
      () => window['app'] && window['app'].canvas
    )
  })

  test('Validate minimap is visible by default', async ({ comfyPage }) => {
    const minimapContainer = comfyPage.page.locator('.litegraph-minimap')

    await expect(minimapContainer).toBeVisible()

    const minimapCanvas = minimapContainer.locator('.minimap-canvas')
    await expect(minimapCanvas).toBeVisible()

    const minimapViewport = minimapContainer.locator('.minimap-viewport')
    await expect(minimapViewport).toBeVisible()

    await expect(minimapContainer).toHaveCSS('position', 'relative')

    // position and z-index validation moved to the parent container of the minimap
    const minimapMainContainer = comfyPage.page.locator(
      '.minimap-main-container'
    )
    await expect(minimapMainContainer).toHaveCSS('position', 'absolute')
    await expect(minimapMainContainer).toHaveCSS('z-index', '1000')
  })

  test('Validate minimap toggle button state', async ({ comfyPage }) => {
    const toggleButton = comfyPage.page.getByTestId('toggle-minimap-button')

    await expect(toggleButton).toBeVisible()

    await expect(toggleButton).toHaveClass(/minimap-active/)

    const minimapContainer = comfyPage.page.locator('.litegraph-minimap')
    await expect(minimapContainer).toBeVisible()
  })

  test('Validate minimap can be toggled off and on', async ({ comfyPage }) => {
    const minimapContainer = comfyPage.page.locator('.litegraph-minimap')
    const toggleButton = comfyPage.page.getByTestId('toggle-minimap-button')

    await expect(minimapContainer).toBeVisible()
    await expect(toggleButton).toHaveClass(/minimap-active/)

    await toggleButton.click()
    await comfyPage.nextFrame()

    await expect(minimapContainer).not.toBeVisible()
    await expect(toggleButton).not.toHaveClass(/minimap-active/)

    await toggleButton.click()
    await comfyPage.nextFrame()

    await expect(minimapContainer).toBeVisible()
    await expect(toggleButton).toHaveClass(/minimap-active/)
  })

  test('Validate minimap keyboard shortcut Alt+M', async ({ comfyPage }) => {
    const minimapContainer = comfyPage.page.locator('.litegraph-minimap')

    await expect(minimapContainer).toBeVisible()

    await comfyPage.page.keyboard.press('Alt+KeyM')
    await comfyPage.nextFrame()

    await expect(minimapContainer).not.toBeVisible()

    await comfyPage.page.keyboard.press('Alt+KeyM')
    await comfyPage.nextFrame()

    await expect(minimapContainer).toBeVisible()
  })
})
