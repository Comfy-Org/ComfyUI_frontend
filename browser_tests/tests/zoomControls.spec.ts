import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { TestIds } from '../fixtures/selectors'

test.describe('Zoom Controls', { tag: '@canvas' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Graph.CanvasMenu', true)
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.page.waitForFunction(() => window.app && window.app.canvas)
  })

  test('Default zoom is 100% and node has a size', async ({ comfyPage }) => {
    const nodeSize = await comfyPage.page.evaluate(
      () => window.app!.graph.nodes[0].size
    )
    expect(nodeSize[0]).toBeGreaterThan(0)
    expect(nodeSize[1]).toBeGreaterThan(0)

    const zoomButton = comfyPage.page.getByTestId(
      TestIds.canvas.zoomControlsButton
    )
    await expect(zoomButton).toContainText('100%')

    const scale = await comfyPage.canvasOps.getScale()
    expect(scale).toBeCloseTo(1.0, 1)
  })

  test('Zoom to fit reduces percentage', async ({ comfyPage }) => {
    const zoomButton = comfyPage.page.getByTestId(
      TestIds.canvas.zoomControlsButton
    )
    await zoomButton.click()
    await comfyPage.nextFrame()

    const zoomToFit = comfyPage.page.getByTestId(TestIds.canvas.zoomToFitAction)
    await expect(zoomToFit).toBeVisible()
    await zoomToFit.click()

    await expect
      .poll(() => comfyPage.canvasOps.getScale(), { timeout: 2000 })
      .toBeLessThan(1.0)

    await expect(zoomButton).not.toContainText('100%')
  })

  test('Zoom out reduces percentage', async ({ comfyPage }) => {
    const initialScale = await comfyPage.canvasOps.getScale()

    const zoomButton = comfyPage.page.getByTestId(
      TestIds.canvas.zoomControlsButton
    )
    await zoomButton.click()
    await comfyPage.nextFrame()

    const zoomOut = comfyPage.page.getByTestId(TestIds.canvas.zoomOutAction)
    await zoomOut.click()
    await comfyPage.nextFrame()

    const newScale = await comfyPage.canvasOps.getScale()
    expect(newScale).toBeLessThan(initialScale)
  })

  test('Zoom out clamps at 10% minimum', async ({ comfyPage }) => {
    const zoomButton = comfyPage.page.getByTestId(
      TestIds.canvas.zoomControlsButton
    )
    await zoomButton.click()
    await comfyPage.nextFrame()

    const zoomOut = comfyPage.page.getByTestId(TestIds.canvas.zoomOutAction)
    for (let i = 0; i < 30; i++) {
      await zoomOut.click()
    }
    await comfyPage.nextFrame()

    await expect
      .poll(() => comfyPage.canvasOps.getScale(), { timeout: 2000 })
      .toBeCloseTo(0.1, 1)

    await expect(zoomButton).toContainText('10%')
  })

  test('Manual percentage entry allows zoom in and zoom out', async ({
    comfyPage
  }) => {
    const zoomButton = comfyPage.page.getByTestId(
      TestIds.canvas.zoomControlsButton
    )
    await zoomButton.click()
    await comfyPage.nextFrame()

    const input = comfyPage.page
      .getByTestId(TestIds.canvas.zoomPercentageInput)
      .locator('input')
    await input.focus()
    await comfyPage.page.keyboard.press('Control+a')
    await input.pressSequentially('100')
    await input.press('Enter')
    await comfyPage.nextFrame()

    await expect
      .poll(() => comfyPage.canvasOps.getScale(), { timeout: 5000 })
      .toBeCloseTo(1.0, 1)

    const zoomIn = comfyPage.page.getByTestId(TestIds.canvas.zoomInAction)
    await zoomIn.click()
    await comfyPage.nextFrame()

    const scaleAfterZoomIn = await comfyPage.canvasOps.getScale()
    expect(scaleAfterZoomIn).toBeGreaterThan(1.0)

    const zoomOut = comfyPage.page.getByTestId(TestIds.canvas.zoomOutAction)
    await zoomOut.click()
    await comfyPage.nextFrame()

    const scaleAfterZoomOut = await comfyPage.canvasOps.getScale()
    expect(scaleAfterZoomOut).toBeLessThan(scaleAfterZoomIn)
  })

  test('Clicking zoom button toggles zoom controls visibility', async ({
    comfyPage
  }) => {
    const zoomButton = comfyPage.page.getByTestId(
      TestIds.canvas.zoomControlsButton
    )
    await zoomButton.click()
    await comfyPage.nextFrame()

    const zoomToFit = comfyPage.page.getByTestId(TestIds.canvas.zoomToFitAction)
    await expect(zoomToFit).toBeVisible()

    await zoomButton.click()
    await comfyPage.nextFrame()

    await expect(zoomToFit).not.toBeVisible()
  })
})
