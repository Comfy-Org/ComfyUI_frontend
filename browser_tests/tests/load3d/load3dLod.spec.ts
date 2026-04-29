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

      // Simulate a canvas zoom change: set ds.scale to 2×, then invoke
      // node.onResize() which calls load3d.handleResize() directly.
      // handleResize() reads getZoomScaleCallback() → app.canvas.ds.scale = 2.0
      // and sets renderer.setPixelRatio(2.0), so canvas.width = clientWidth × 2.
      // This path is independent of the appScalePercentage watch chain and
      // exercises the core LOD fix in handleResize().
      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph!.nodes[0]
        window.app!.canvas.ds.scale = 2.0
        node.onResize?.(node.size)
      })
      await comfyPage.nextFrame()

      // canvas.width = Math.floor(clientWidth × ds.scale) — must exceed initial
      await expect
        .poll(() => load3d.canvas.evaluate((el: HTMLCanvasElement) => el.width))
        .toBeGreaterThan(initialWidth)
    }
  )
})
