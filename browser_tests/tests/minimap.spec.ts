import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Minimap', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test('Validate minimap is visible by default', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('default')

    await comfyPage.page.waitForFunction(
      () => window['app'] && window['app'].canvas
    )

    const minimapContainer = comfyPage.page.locator('.litegraph-minimap')

    await expect(minimapContainer).toBeVisible()

    const minimapCanvas = minimapContainer.locator('.minimap-canvas')
    await expect(minimapCanvas).toBeVisible()

    const minimapViewport = minimapContainer.locator('.minimap-viewport')
    await expect(minimapViewport).toBeVisible()

    await expect(minimapContainer).toHaveCSS('position', 'absolute')
    await expect(minimapContainer).toHaveCSS('z-index', '1000')
  })

  test('Validate minimap toggle button state', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('default')

    await comfyPage.page.waitForFunction(
      () => window['app'] && window['app'].canvas
    )

    await comfyPage.setSetting('Comfy.Graph.CanvasMenu', true)

    const toggleButton = comfyPage.page.getByTestId('toggle-minimap-button')

    await expect(toggleButton).toBeVisible()

    await expect(toggleButton).toHaveClass(/minimap-active/)

    const minimapContainer = comfyPage.page.locator('.litegraph-minimap')
    await expect(minimapContainer).toBeVisible()
  })

  test('Validate minimap can be toggled off and on', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('default')

    await comfyPage.page.waitForFunction(
      () => window['app'] && window['app'].canvas
    )

    const minimapContainer = comfyPage.page.locator('.litegraph-minimap')
    await comfyPage.setSetting('Comfy.Graph.CanvasMenu', true)
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

  test('Validate minimap position and size', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('default')

    await comfyPage.page.waitForFunction(
      () => window['app'] && window['app'].canvas
    )

    const minimapContainer = comfyPage.page.locator('.litegraph-minimap')
    await expect(minimapContainer).toBeVisible()

    const boundingBox = await minimapContainer.boundingBox()
    expect(boundingBox).not.toBeNull()

    if (boundingBox) {
      expect(boundingBox.width).toBeGreaterThan(0)
      expect(boundingBox.height).toBeGreaterThan(0)

      const viewportSize = comfyPage.page.viewportSize()!
      expect(boundingBox.x + boundingBox.width).toBeCloseTo(
        viewportSize.width - 90,
        50
      )
      expect(boundingBox.y + boundingBox.height).toBeCloseTo(
        viewportSize.height - 20,
        50
      )
    }
  })

  test('Validate minimap canvas dimensions', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('default')

    await comfyPage.page.waitForFunction(
      () => window['app'] && window['app'].canvas
    )

    const minimapCanvas = comfyPage.page.locator(
      '.litegraph-minimap .minimap-canvas'
    )
    await expect(minimapCanvas).toBeVisible()

    const width = await minimapCanvas.getAttribute('width')
    const height = await minimapCanvas.getAttribute('height')

    expect(parseInt(width || '0')).toBeGreaterThan(0)
    expect(parseInt(height || '0')).toBeGreaterThan(0)
  })

  test('Validate minimap keyboard shortcut Alt+M', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('default')

    await comfyPage.page.waitForFunction(
      () => window['app'] && window['app'].canvas
    )

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
