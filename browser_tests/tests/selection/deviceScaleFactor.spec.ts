import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.use({ deviceScaleFactor: 1.5 })

test.describe(
  'Marquee selection at emulated display scaling',
  { tag: '@canvas' },
  () => {
    for (const renderer of [
      { name: 'legacy', vueNodes: false },
      { name: 'Vue', vueNodes: true }
    ] as const) {
      test(`tracks the cursor and selects the exact intersected nodes at 150 percent in the ${renderer.name} renderer`, async ({
        comfyPage
      }) => {
        test.slow()
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          renderer.vueNodes
        )
        await comfyPage.workflow.loadWorkflow('default')
        await comfyPage.settings.setSetting(
          'Comfy.Canvas.LeftMouseClickBehavior',
          'select'
        )
        expect(
          await comfyPage.page.evaluate(() => window.devicePixelRatio)
        ).toBe(1.5)

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
        const start = clientPosition(bounds.start)
        const end = clientPosition(bounds.end)

        await test.step('track the marquee in client coordinates', async () => {
          await comfyPage.page.mouse.move(start.x, start.y)
          await comfyPage.page.mouse.down()
          await comfyPage.page.mouse.move(end.x, end.y, { steps: 10 })
          await comfyPage.nextFrame()
          const rectangle = await comfyPage.page.evaluate(() => {
            const rectangle = window.app!.canvas.dragging_rectangle
            if (!rectangle) return null
            const start = window.app!.canvasPosToClientPos([
              rectangle[0],
              rectangle[1]
            ])
            const end = window.app!.canvasPosToClientPos([
              rectangle[0] + rectangle[2],
              rectangle[1] + rectangle[3]
            ])
            return { start, end }
          })

          await comfyPage.page.mouse.up()
          expect(rectangle).toEqual({
            start: [expect.closeTo(start.x, 0), expect.closeTo(start.y, 0)],
            end: [expect.closeTo(end.x, 0), expect.closeTo(end.y, 0)]
          })
        })

        await test.step('select exactly the intersected nodes', async () => {
          await expect
            .poll(() =>
              comfyPage.page.evaluate(() =>
                Object.keys(window.app!.canvas.selected_nodes).sort()
              )
            )
            .toEqual(['6', '7'])
        })
      })
    }
  }
)
