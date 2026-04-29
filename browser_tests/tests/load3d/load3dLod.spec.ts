import { expect } from '@playwright/test'

import { load3dTest as test } from '@e2e/fixtures/helpers/Load3DFixtures'

test.describe('Load3D LOD', () => {
  test(
    'canvas pixel dimensions scale with ComfyUI canvas zoom level',
    { tag: '@smoke' },
    async ({ comfyPage, load3d }) => {
      await expect(load3d.canvas).toBeVisible()

      await expect
        .poll(() => load3d.canvas.evaluate((el: HTMLCanvasElement) => el.width))
        .toBeGreaterThan(0)

      const initialWidth = await load3d.canvas.evaluate(
        (el: HTMLCanvasElement) => el.width
      )

      // Set the canvas zoom level programmatically. canvasOps.zoom() scrolls
      // at (10, 10) which lands in the topbar when the new menu is active, so
      // wheel events never reach the LiteGraph canvas. Setting ds.scale directly
      // and marking the canvas dirty forces the render loop to call
      // computeVisibleArea() → ds.onChanged() → appScalePercentage update →
      // useLoad3d watch → handleResize() → renderer.setPixelRatio(scale).
      await comfyPage.page.evaluate(() => {
        window.app!.canvas.ds.scale = 2.0
        window.app!.canvas.setDirty(true, true)
      })
      await comfyPage.nextFrame()

      // canvas.width = Math.floor(clientWidth × ds.scale) — must exceed initial
      await expect
        .poll(() => load3d.canvas.evaluate((el: HTMLCanvasElement) => el.width))
        .toBeGreaterThan(initialWidth)
    }
  )
})
