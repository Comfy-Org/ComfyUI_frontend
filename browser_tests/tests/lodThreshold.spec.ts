import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('LOD Threshold', { tag: ['@screenshot', '@canvas'] }, () => {
  test('Should switch to low quality mode at correct zoom threshold', async ({
    comfyPage
  }) => {
    // Load a workflow with some nodes to render
    await comfyPage.workflow.loadWorkflow('default')

    // Get initial LOD state and settings
    const initialState = await comfyPage.page.evaluate(() => {
      const canvas = window.app!.canvas
      return {
        lowQuality: canvas.low_quality,
        scale: canvas.ds.scale,
        minFontSize: canvas.min_font_size_for_lod
      }
    })

    // Should start at normal zoom (not low quality)
    expect(initialState.lowQuality).toBe(false)
    expect(initialState.scale).toBeCloseTo(1, 1)

    // Calculate expected threshold (8px / 14px ≈ 0.571)
    const expectedThreshold = initialState.minFontSize / 14

    // Zoom out just above threshold (should still be high quality)
    await comfyPage.canvasOps.zoom(120, 5) // Zoom out 5 steps
    await comfyPage.nextFrame()

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => {
          const canvas = window.app!.canvas
          return { lowQuality: canvas.low_quality, scale: canvas.ds.scale }
        })
      )
      .toMatchObject({ lowQuality: false })

    const aboveThresholdState = await comfyPage.page.evaluate(() => {
      const canvas = window.app!.canvas
      return { scale: canvas.ds.scale }
    })

    // If we zoomed past the threshold already, skip the high-quality assertion
    if (aboveThresholdState.scale <= expectedThreshold) {
      // Already past threshold — will be verified below
    }

    // Zoom out more to trigger LOD (below threshold)
    await comfyPage.canvasOps.zoom(120, 5) // Zoom out 5 more steps
    await comfyPage.nextFrame()

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => {
          const canvas = window.app!.canvas
          return { lowQuality: canvas.low_quality, scale: canvas.ds.scale }
        })
      )
      .toMatchObject({ lowQuality: true })

    await expect
      .poll(() => comfyPage.page.evaluate(() => window.app!.canvas.ds.scale))
      .toBeLessThan(expectedThreshold)

    // Zoom back in to disable LOD (above threshold)
    await comfyPage.canvasOps.zoom(-120, 15) // Zoom in 15 steps
    await comfyPage.nextFrame()

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => {
          const canvas = window.app!.canvas
          return { lowQuality: canvas.low_quality, scale: canvas.ds.scale }
        })
      )
      .toMatchObject({ lowQuality: false })

    await expect
      .poll(() => comfyPage.page.evaluate(() => window.app!.canvas.ds.scale))
      .toBeGreaterThan(expectedThreshold)
  })

  test('Should update threshold when font size setting changes', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')

    // Change the font size setting to 14px (more aggressive LOD)
    await comfyPage.settings.setSetting(
      'LiteGraph.Canvas.MinFontSizeForLOD',
      14
    )

    // Check that font size updated
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => window.app!.canvas.min_font_size_for_lod)
      )
      .toBe(14)

    // At default zoom, LOD should still be inactive (scale is exactly 1.0, not less than)
    await expect
      .poll(() => comfyPage.page.evaluate(() => window.app!.canvas.low_quality))
      .toBe(false)

    // Zoom out slightly to trigger LOD
    await comfyPage.canvasOps.zoom(120, 1) // Zoom out 1 step
    await comfyPage.nextFrame()

    await expect
      .poll(() => comfyPage.page.evaluate(() => window.app!.canvas.low_quality))
      .toBe(true)

    await expect
      .poll(() => comfyPage.page.evaluate(() => window.app!.canvas.ds.scale))
      .toBeLessThan(1.0)
  })

  test('Should disable LOD when font size is set to 0', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('default')

    // Disable LOD by setting font size to 0
    await comfyPage.settings.setSetting('LiteGraph.Canvas.MinFontSizeForLOD', 0)

    // Zoom out significantly
    await comfyPage.canvasOps.zoom(120, 20) // Zoom out 20 steps
    await comfyPage.nextFrame()

    // LOD should remain disabled even at very low zoom
    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => window.app!.canvas.min_font_size_for_lod)
      )
      .toBe(0)

    await expect
      .poll(() => comfyPage.page.evaluate(() => window.app!.canvas.low_quality))
      .toBe(false)

    await expect
      .poll(() => comfyPage.page.evaluate(() => window.app!.canvas.ds.scale))
      .toBeLessThan(0.2) // Very zoomed out
  })

  test(
    'Should show visual difference between LOD on and off',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      // Load a workflow with text-heavy nodes for clear visual difference
      await comfyPage.workflow.loadWorkflow('default')

      // Set zoom level clearly below the threshold to ensure LOD activates
      const targetZoom = 0.4 // Well below default threshold of ~0.571

      // Zoom to target level
      await comfyPage.page.evaluate((zoom) => {
        window.app!.canvas.ds.scale = zoom
        window.app!.canvas.setDirty(true, true)
      }, targetZoom)
      await comfyPage.nextFrame()

      // Wait for LOD to activate before taking screenshot
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => window.app!.canvas.low_quality)
        )
        .toBe(true)

      // Take snapshot with LOD active (default 8px setting)
      await expect(comfyPage.canvas).toHaveScreenshot(
        'lod-comparison-low-quality.png'
      )

      // Disable LOD to see high quality at same zoom
      await comfyPage.settings.setSetting(
        'LiteGraph.Canvas.MinFontSizeForLOD',
        0
      )

      // Wait for LOD to deactivate after setting change
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => window.app!.canvas.low_quality)
        )
        .toBe(false)

      // Take snapshot with LOD disabled (full quality at same zoom)
      await expect(comfyPage.canvas).toHaveScreenshot(
        'lod-comparison-high-quality.png'
      )

      await expect
        .poll(() => comfyPage.page.evaluate(() => window.app!.canvas.ds.scale))
        .toBeCloseTo(targetZoom, 2)
    }
  )
})
