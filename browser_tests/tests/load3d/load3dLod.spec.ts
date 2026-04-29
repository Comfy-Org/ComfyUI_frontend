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

      // Zoom in — ds.scale increases, triggering appScalePercentage to update,
      // which fires the watch in useLoad3d that calls handleResize with the
      // new zoom-based pixel ratio.
      await comfyPage.canvasOps.zoom(-120, 5)

      // Physical pixel count must grow: canvas.width = clientWidth × ds.scale
      await expect
        .poll(() => load3d.canvas.evaluate((el: HTMLCanvasElement) => el.width))
        .toBeGreaterThan(initialWidth)
    }
  )
})
