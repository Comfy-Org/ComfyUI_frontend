import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Viewport', { tag: ['@screenshot', '@smoke', '@canvas'] }, () => {
  test('Fits view to nodes when saved viewport position is offscreen', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'viewport/default-viewport-saved-offscreen'
    )

    // Wait until all nodes are within the visible canvas area
    await expect
      .poll(
        () =>
          comfyPage.page.evaluate(() => {
            const app = window.app!
            const canvas = app.canvas
            canvas.ds.computeVisibleArea(canvas.viewport)
            const [vx, vy, vw, vh] = canvas.ds.visible_area
            const nodes = app.graph.nodes
            return (
              nodes.length > 0 &&
              nodes.every(
                (n: { pos: number[]; size: number[] }) =>
                  n.pos[0] + n.size[0] > vx &&
                  n.pos[0] < vx + vw &&
                  n.pos[1] + n.size[1] > vy &&
                  n.pos[1] < vy + vh
              )
            )
          }),
        { message: 'All nodes should be within the visible viewport' }
      )
      .toBe(true)
    await comfyPage.expectScreenshot(
      comfyPage.canvas,
      'viewport-fits-when-saved-offscreen.png'
    )
  })
})
