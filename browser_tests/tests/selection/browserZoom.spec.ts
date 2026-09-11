import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.use({ deviceScaleFactor: 1.5 })

test.describe(
  'Marquee selection at emulated display scaling',
  { tag: '@canvas' },
  () => {
    test('selects the exact intersected nodes at 150 percent', async ({
      comfyPage
    }) => {
      test.slow()
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.settings.setSetting(
        'Comfy.Canvas.LeftMouseClickBehavior',
        'select'
      )
      expect(await comfyPage.page.evaluate(() => window.devicePixelRatio)).toBe(
        1.5
      )

      const bounds = await comfyPage.page.evaluate(() => {
        const nodes = window.app!.graph.nodes.filter((node) =>
          ['6', '7'].includes(String(node.id))
        )
        const positions = nodes.map((node) => node.pos)
        return {
          start: window.app!.canvasPosToClientPos([
            Math.min(...positions.map(([x]) => x)) - 64,
            Math.min(...positions.map(([, y]) => y)) - 64
          ]),
          end: window.app!.canvasPosToClientPos([
            Math.max(...positions.map(([x]) => x)) + 64,
            Math.max(...positions.map(([, y]) => y)) + 64
          ])
        }
      })
      const clientPosition = ([x, y]: number[]) => ({ x, y })
      await comfyPage.canvasOps.dragAndDrop(
        clientPosition(bounds.start),
        clientPosition(bounds.end)
      )

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() =>
            Object.keys(window.app!.canvas.selected_nodes).sort()
          )
        )
        .toEqual(['6', '7'])
    })
  }
)
