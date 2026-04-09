import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Group Copy Paste', { tag: ['@canvas'] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('Pasted group is offset from original position', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('groups/single_group_only')

    const titlePos = await comfyPage.page.evaluate(() => {
      const app = window.app!
      const group = app.graph.groups[0]
      const clientPos = app.canvasPosToClientPos([
        group.pos[0] + 50,
        group.pos[1] + 15
      ])
      return { x: clientPos[0], y: clientPos[1] }
    })
    await comfyPage.canvas.click({ position: titlePos })
    await comfyPage.nextFrame()

    await comfyPage.clipboard.copy()
    await comfyPage.clipboard.paste()
    await comfyPage.nextFrame()

    const getGroupPositions = () =>
      comfyPage.page.evaluate(() =>
        window.app!.graph.groups.map((g: { pos: number[] }) => ({
          x: g.pos[0],
          y: g.pos[1]
        }))
      )

    await expect.poll(getGroupPositions).toHaveLength(2)

    await expect
      .poll(async () => {
        const positions = await getGroupPositions()
        return Math.abs(positions[0].x - positions[1].x)
      })
      .toBeCloseTo(50, 0)

    await expect
      .poll(async () => {
        const positions = await getGroupPositions()
        return Math.abs(positions[0].y - positions[1].y)
      })
      .toBeCloseTo(15, 0)
  })
})
