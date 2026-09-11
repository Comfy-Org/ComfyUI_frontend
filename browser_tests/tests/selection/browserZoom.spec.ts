import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Marquee selection at browser zoom', { tag: '@canvas' }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      document.body.style.zoom = ''
    })
  })

  test('selects the exact enclosed nodes at 150 percent', async ({
    comfyPage
  }) => {
    test.slow()
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.page.evaluate(() => {
      document.body.style.zoom = '1.5'
    })
    await comfyPage.nextFrame()

    const bounds = await comfyPage.page.evaluate(() => {
      const nodes = window.app!.graph.nodes.filter((node) =>
        ['6', '7'].includes(String(node.id))
      )
      const boxes = nodes.map((node) => node.getBounding())
      return {
        start: window.app!.canvasPosToClientPos([
          Math.min(...boxes.map(([x]) => x)) - 20,
          Math.min(...boxes.map(([, y]) => y)) - 20
        ]),
        end: window.app!.canvasPosToClientPos([
          Math.max(...boxes.map(([x, , width]) => x + width)) + 20,
          Math.max(...boxes.map(([, y, , height]) => y + height)) + 20
        ])
      }
    })
    const scaled = ([x, y]: number[]) => ({ x: x * 1.5, y: y * 1.5 })
    await comfyPage.canvasOps.dragAndDrop(
      scaled(bounds.start),
      scaled(bounds.end)
    )

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() =>
          Object.keys(window.app!.canvas.selected_nodes).sort()
        )
      )
      .toEqual(['6', '7'])
  })
})
