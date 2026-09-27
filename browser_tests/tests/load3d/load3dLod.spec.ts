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

      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph!.nodes[0]
        window.app!.canvas.ds.scale = 2.0
        node.onResize?.(node.size)
      })
      await comfyPage.nextFrame()

      await expect
        .poll(() => load3d.canvas.evaluate((el: HTMLCanvasElement) => el.width))
        .toBeGreaterThan(initialWidth)
    }
  )
})
