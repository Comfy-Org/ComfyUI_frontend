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

    // Get the initial link render mode and HIDDEN_LINK constant
    const { initialMode, hiddenLinkMode } = await comfyPage.page.evaluate(
      () => {
        return {
          initialMode: window['app']?.canvas?.links_render_mode,
          hiddenLinkMode: window['LiteGraph'].HIDDEN_LINK
        }
      }
    )

    // First click - hide links
    await button.click()

    // Wait for the setting to actually change to hidden
    await comfyPage.page.waitForFunction(
      (expectedMode) => {
        const canvas = window['app']?.canvas
        return canvas && canvas.links_render_mode === expectedMode
      },
      hiddenLinkMode,
      { timeout: 5000 }
    )

    // Wait for canvas to complete rendering by monitoring the frame counter
    // The canvas increments its frame counter after each draw cycle
    const frameBeforeRender = await comfyPage.page.evaluate(() => {
      return window['app']?.canvas?.frame || 0
    })

    await comfyPage.page.waitForFunction(
      (initialFrame) => {
        const canvas = window['app']?.canvas
        // Wait for at least one frame to be rendered after the change
        return canvas && canvas.frame > initialFrame
      },
      frameBeforeRender,
      { timeout: 5000 }
    )

    await expect(comfyPage.canvas).toHaveScreenshot(
      'canvas-with-hidden-links.png'
    )
    expect(await comfyPage.getSetting('Comfy.LinkRenderMode')).toBe(
      hiddenLinkMode
    )

    // Second click - show links again
    await button.click()

    // Wait for the setting to change back to the initial mode
    await comfyPage.page.waitForFunction(
      ({ hiddenMode, initial }) => {
        const canvas = window['app']?.canvas
        // Check that it's not hidden and matches the expected visible mode
        return (
          canvas &&
          canvas.links_render_mode !== hiddenMode &&
          (initial === undefined || canvas.links_render_mode === initial)
        )
      },
      { hiddenMode: hiddenLinkMode, initial: initialMode },
      { timeout: 5000 }
    )

    // Wait for canvas to complete rendering by monitoring the frame counter
    const frameBeforeSecondRender = await comfyPage.page.evaluate(() => {
      return window['app']?.canvas?.frame || 0
    })

    await comfyPage.page.waitForFunction(
      (initialFrame) => {
        const canvas = window['app']?.canvas
        // Wait for at least one frame to be rendered after the change
        return canvas && canvas.frame > initialFrame
      },
      frameBeforeSecondRender,
      { timeout: 5000 }
    )

    await expect(comfyPage.canvas).toHaveScreenshot(
      'canvas-with-visible-links.png'
    )
    expect(await comfyPage.getSetting('Comfy.LinkRenderMode')).not.toBe(
      hiddenLinkMode
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
