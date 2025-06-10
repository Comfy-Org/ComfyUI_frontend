import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { PerformanceMonitor } from '../helpers/performanceMonitor'

test.describe('Graph Canvas Menu', () => {
  test.beforeEach(async ({ comfyPage }) => {
    // Set link render mode to spline to make sure it's not affected by other tests'
    // side effects.
    await comfyPage.setSetting('Comfy.LinkRenderMode', 2)
  })

  test('@perf Can toggle link visibility', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'toggle-link-visibility'

    await perfMonitor.startMonitoring(testName)

    // Note: `Comfy.Graph.CanvasMenu` is disabled in comfyPage setup.
    // so no cleanup is needed.
    await perfMonitor.measureOperation('enable-canvas-menu', async () => {
      await comfyPage.setSetting('Comfy.Graph.CanvasMenu', true)
    })

    const button = comfyPage.page.getByTestId('toggle-link-visibility-button')

    await perfMonitor.markEvent('before-hide-links')
    await perfMonitor.measureOperation('hide-links', async () => {
      await button.click()
      await comfyPage.nextFrame()
    })
    await perfMonitor.markEvent('after-hide-links')

    // Screenshot assertions and validations stay outside performance monitoring
    await expect(comfyPage.canvas).toHaveScreenshot(
      'canvas-with-hidden-links.png'
    )
    const hiddenLinkRenderMode = await comfyPage.page.evaluate(() => {
      return window['LiteGraph'].HIDDEN_LINK
    })
    expect(await comfyPage.getSetting('Comfy.LinkRenderMode')).toBe(
      hiddenLinkRenderMode
    )

    await perfMonitor.markEvent('before-show-links')
    await perfMonitor.measureOperation('show-links', async () => {
      await button.click()
      await comfyPage.nextFrame()
    })
    await perfMonitor.markEvent('after-show-links')

    // Screenshot assertions and validations stay outside performance monitoring
    await expect(comfyPage.canvas).toHaveScreenshot(
      'canvas-with-visible-links.png'
    )
    expect(await comfyPage.getSetting('Comfy.LinkRenderMode')).not.toBe(
      hiddenLinkRenderMode
    )

    await perfMonitor.finishMonitoring(testName)
  })
})
