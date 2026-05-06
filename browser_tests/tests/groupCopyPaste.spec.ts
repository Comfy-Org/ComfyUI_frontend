import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { getGroupTitlePosition } from '@e2e/fixtures/utils/groupHelpers'

test.describe('Group Copy Paste', { tag: ['@canvas'] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('Pasted group is offset from original position', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('groups/single_group_only')

    const titlePos = await getGroupTitlePosition(comfyPage, 'Group')
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

    await expect(async () => {
      const positions = await getGroupPositions()
      expect(Math.abs(positions[0].x - positions[1].x)).toBeCloseTo(50, 0)
      expect(Math.abs(positions[0].y - positions[1].y)).toBeCloseTo(15, 0)
    }).toPass({ timeout: 5000 })
  })
})
