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
    const minimap = comfyPage.menu.minimap

    await expect(minimap.container).toBeVisible()
    await expect(minimap.canvas).toBeVisible()
    await expect(minimap.viewport).toBeVisible()
    await expect(minimap.container).toHaveCSS('position', 'relative')

    // position and z-index validation moved to the parent container of the minimap
    await expect(minimap.mainContainer).toHaveCSS('position', 'absolute')
    await expect(minimap.mainContainer).toHaveCSS('z-index', '1000')
  })

  test('Validate minimap toggle button state', async ({ comfyPage }) => {
    const minimap = comfyPage.menu.minimap

    const toggleButton = comfyPage.page.getByTestId('toggle-minimap-button')

    await expect(toggleButton).toBeVisible()
    await expect(minimap.container).toBeVisible()
  })

  test('Validate minimap can be toggled off and on', async ({ comfyPage }) => {
    const minimap = comfyPage.menu.minimap

    // Open zoom controls dropdown first
    const zoomControlsButton = comfyPage.page.getByTestId(
      'zoom-controls-button'
    )
    await zoomControlsButton.click()

    const toggleButton = comfyPage.page.getByTestId('toggle-minimap-button')

    await expect(minimap.container).toBeVisible()

    await toggleButton.click()
    await comfyPage.nextFrame()

    await expect(minimap.container).not.toBeVisible()

    await toggleButton.click()
    await comfyPage.nextFrame()

    await expect(minimap.container).toBeVisible()

    // Open zoom controls dropdown again to verify button text
    await zoomControlsButton.click()
    await comfyPage.nextFrame()

    await expect(toggleButton).toContainText('Hide Minimap')
  })

  test('Validate minimap keyboard shortcut Alt+M', async ({ comfyPage }) => {
    const minimap = comfyPage.menu.minimap

    await expect(minimap.container).toBeVisible()

    await comfyPage.page.keyboard.press('Alt+KeyM')
    await comfyPage.nextFrame()

    await expect(minimap.container).not.toBeVisible()

    await comfyPage.page.keyboard.press('Alt+KeyM')
    await comfyPage.nextFrame()

    await expect(minimap.container).toBeVisible()
  })
})
