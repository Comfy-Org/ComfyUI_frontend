import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.use({
  deviceScaleFactor: 1.5,
  initialSettings: { 'Comfy.Canvas.LeftMouseClickBehavior': 'select' }
})

test.describe('Marquee selection at emulated display scaling', () => {
  test(
    'tracks the cursor and selects the exact intersected nodes at 150 percent in the legacy renderer',
    { tag: '@canvas' },
    async ({ comfyPage }) => {
      test.slow()
      await expectExactMarqueeSelection(comfyPage)
    }
  )

  test(
    'tracks the cursor and selects the exact intersected nodes at 150 percent in the Vue renderer',
    { tag: ['@canvas', '@vue-nodes'] },
    async ({ comfyPage }) => {
      test.slow()
      await expectExactMarqueeSelection(comfyPage)
    }
  )
})

async function expectExactMarqueeSelection(comfyPage: ComfyPage) {
  await comfyPage.workflow.loadWorkflow('default')
  expect(await comfyPage.page.evaluate(() => window.devicePixelRatio)).toBe(1.5)

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
      .poll(async () =>
        (await comfyPage.nodeOps.getSelectedNodeIds()).map(String).sort()
      )
      .toEqual(['6', '7'])
  })
}
