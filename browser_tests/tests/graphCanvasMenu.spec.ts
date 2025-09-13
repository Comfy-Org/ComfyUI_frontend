import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Graph Canvas Menu', () => {
  test.beforeEach(async ({ comfyPage }) => {
    // Set link render mode to spline to make sure it's not affected by other tests'
    // side effects.
    await comfyPage.setSetting('Comfy.LinkRenderMode', 2)
    // Enable canvas menu for all tests
    await comfyPage.setSetting('Comfy.Graph.CanvasMenu', true)
  })

  test('Can toggle link visibility', async ({ comfyPage }) => {
    const button = comfyPage.page.getByTestId('toggle-link-visibility-button')
    await button.click()
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'canvas-with-hidden-links.png'
    )
    const hiddenLinkRenderMode = await comfyPage.page.evaluate(() => {
      return (window as any)['LiteGraph'].HIDDEN_LINK
    })
    expect(await comfyPage.getSetting('Comfy.LinkRenderMode')).toBe(
      hiddenLinkRenderMode
    )

    await button.click()
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'canvas-with-visible-links.png'
    )
    expect(await comfyPage.getSetting('Comfy.LinkRenderMode')).not.toBe(
      hiddenLinkRenderMode
    )
  })

  test('Focus mode button is clickable and has correct test id', async ({
    comfyPage
  }) => {
    const focusButton = comfyPage.page.getByTestId('focus-mode-button')
    await expect(focusButton).toBeVisible()
    await expect(focusButton).toBeEnabled()

    // Test that the button can be clicked without error
    await focusButton.click()
    await comfyPage.nextFrame()
  })

  test('Zoom controls popup opens and closes', async ({ comfyPage }) => {
    // Find the zoom button by its percentage text content
    const zoomButton = comfyPage.page.locator('button').filter({
      hasText: '%'
    })
    await expect(zoomButton).toBeVisible()

    // Click to open zoom controls
    await zoomButton.click()
    await comfyPage.nextFrame()

    // Zoom controls modal should be visible
    const zoomModal = comfyPage.page
      .locator('div')
      .filter({
        hasText: 'Zoom To Fit'
      })
      .first()
    await expect(zoomModal).toBeVisible()

    // Click backdrop to close
    const backdrop = comfyPage.page.locator('.fixed.inset-0').first()
    await backdrop.click()
    await comfyPage.nextFrame()

    // Modal should be hidden
    await expect(zoomModal).not.toBeVisible()
  })
})
