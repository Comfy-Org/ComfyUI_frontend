import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Graph Canvas Menu', () => {
  test.beforeEach(async ({ comfyPage }) => {
    // Set link render mode to spline to make sure it's not affected by other tests'
    // side effects.
    await comfyPage.setSetting('Comfy.LinkRenderMode', 2)
  })

  test('Can toggle link visibility', async ({ comfyPage }) => {
    // Note: `Comfy.Graph.CanvasMenu` is disabled in comfyPage setup.
    // so no cleanup is needed.
    await comfyPage.setSetting('Comfy.Graph.CanvasMenu', true)

    const button = comfyPage.page.getByTestId('toggle-link-visibility-button')
    await button.click()
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'canvas-with-hidden-links.png'
    )
    const hiddenLinkRenderMode = await comfyPage.page.evaluate(() => {
      return window['LiteGraph'].HIDDEN_LINK
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
})
