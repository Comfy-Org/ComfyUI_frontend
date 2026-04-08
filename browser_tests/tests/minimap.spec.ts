import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Minimap', { tag: '@canvas' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', true)
    await comfyPage.settings.setSetting('Comfy.Graph.CanvasMenu', true)
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.page.waitForFunction(() => window.app && window.app.canvas)
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
    const toggleButton = comfyPage.page.getByTestId(
      TestIds.canvas.toggleMinimapButton
    )

    await expect(toggleButton).toBeVisible()

    const minimapContainer = comfyPage.page.locator('.litegraph-minimap')
    await expect(minimapContainer).toBeVisible()
  })

  test('Validate minimap can be toggled off and on', async ({ comfyPage }) => {
    const minimapContainer = comfyPage.page.locator('.litegraph-minimap')
    const toggleButton = comfyPage.page.getByTestId(
      TestIds.canvas.toggleMinimapButton
    )

    await expect(minimapContainer).toBeVisible()

    await toggleButton.click()
    await expect(minimapContainer).not.toBeVisible()

    await toggleButton.click()
    await expect(minimapContainer).toBeVisible()
  })

  test('Validate minimap keyboard shortcut Alt+M', async ({ comfyPage }) => {
    const minimapContainer = comfyPage.page.locator('.litegraph-minimap')

    await expect(minimapContainer).toBeVisible()

    await comfyPage.page.keyboard.press('Alt+KeyM')
    await expect(minimapContainer).not.toBeVisible()

    await comfyPage.page.keyboard.press('Alt+KeyM')
    await expect(minimapContainer).toBeVisible()
  })

  test('Close button hides minimap', async ({ comfyPage }) => {
    const minimap = comfyPage.page.locator('.litegraph-minimap')
    await expect(minimap).toBeVisible()

    await comfyPage.page.getByTestId(TestIds.canvas.closeMinimapButton).click()
    await expect(minimap).not.toBeVisible()

    const toggleButton = comfyPage.page.getByTestId(
      TestIds.canvas.toggleMinimapButton
    )
    await expect(toggleButton).toBeVisible()
  })

  test(
    'Panning canvas moves minimap viewport',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const minimap = comfyPage.page.locator('.litegraph-minimap')
      await expect(minimap).toBeVisible()

      await expect(minimap).toHaveScreenshot('minimap-before-pan.png')

      await comfyPage.page.evaluate(() => {
        const canvas = window.app!.canvas
        canvas.ds.scale = 3
        canvas.ds.offset[0] = -800
        canvas.ds.offset[1] = -600
        canvas.setDirty(true, true)
      })
      await expect(minimap).toHaveScreenshot('minimap-after-pan.png')
    }
  )

  test(
    'Viewport rectangle is visible and positioned within minimap',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const minimap = comfyPage.page.locator('.litegraph-minimap')
      await expect(minimap).toBeVisible()

      const viewport = minimap.locator('.minimap-viewport')
      await expect(viewport).toBeVisible()

      const minimapBox = await minimap.boundingBox()
      const viewportBox = await viewport.boundingBox()

      expect(minimapBox).toBeTruthy()
      expect(viewportBox).toBeTruthy()
      expect(viewportBox!.width).toBeGreaterThan(0)
      expect(viewportBox!.height).toBeGreaterThan(0)

      expect(viewportBox!.x + viewportBox!.width).toBeGreaterThan(minimapBox!.x)
      expect(viewportBox!.y + viewportBox!.height).toBeGreaterThan(
        minimapBox!.y
      )
      expect(viewportBox!.x).toBeLessThan(minimapBox!.x + minimapBox!.width)
      expect(viewportBox!.y).toBeLessThan(minimapBox!.y + minimapBox!.height)

      await expect(minimap).toHaveScreenshot('minimap-with-viewport.png')
    }
  )
})
