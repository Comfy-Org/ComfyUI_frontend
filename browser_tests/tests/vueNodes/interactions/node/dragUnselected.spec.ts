import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Position } from '@e2e/fixtures/types'

test.describe(
  'Vue Node drag-from-unselected (FE-558)',
  { tag: '@vue-nodes' },
  () => {
    const getHeaderPos = async (comfyPage: ComfyPage, title: string) => {
      const box = await comfyPage.vueNodes
        .getNodeByTitle(title)
        .getByTestId('node-title')
        .first()
        .boundingBox()
      if (!box) throw new Error(`${title} header not found`)
      return box
    }

    const deltaBetween = (before: Position, after: Position) => ({
      x: after.x - before.x,
      y: after.y - before.y
    })

    test('drags an unselected node in a single gesture without first selecting it', async ({
      comfyPage
    }) => {
      await comfyPage.canvasOps.moveMouseToEmptyArea()
      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(0)

      const before = await getHeaderPos(comfyPage, 'Load Checkpoint')

      await comfyPage.canvasOps.dragAndDrop(before, {
        x: before.x + 180,
        y: before.y + 120
      })

      const after = await getHeaderPos(comfyPage, 'Load Checkpoint')
      const delta = deltaBetween(before, after)

      expect(Math.abs(delta.x)).toBeGreaterThan(50)
      expect(Math.abs(delta.y)).toBeGreaterThan(50)

      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(1)
    })

    test('unselected and already-selected drags produce the same translation', async ({
      comfyPage
    }) => {
      const node = comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')

      // Unselected drag from current position.
      await comfyPage.canvasOps.moveMouseToEmptyArea()
      await expect(comfyPage.vueNodes.selectedNodes).toHaveCount(0)

      const before1 = await getHeaderPos(comfyPage, 'Load Checkpoint')
      await comfyPage.canvasOps.dragAndDrop(before1, {
        x: before1.x + 120,
        y: before1.y + 80
      })
      const after1 = await getHeaderPos(comfyPage, 'Load Checkpoint')
      const unselectedDelta = deltaBetween(before1, after1)

      // Now the node is selected from the previous drag — drag it again
      // and compare deltas. The fix must not regress already-selected drags.
      await expect(node).toBeVisible()
      const before2 = await getHeaderPos(comfyPage, 'Load Checkpoint')
      await comfyPage.canvasOps.dragAndDrop(before2, {
        x: before2.x + 120,
        y: before2.y + 80
      })
      const after2 = await getHeaderPos(comfyPage, 'Load Checkpoint')
      const selectedDelta = deltaBetween(before2, after2)

      // Both deltas should be ≈ (120, 80). Tolerance covers integer rounding
      // and any minor canvas easing.
      expect(Math.abs(unselectedDelta.x - selectedDelta.x)).toBeLessThanOrEqual(
        4
      )
      expect(Math.abs(unselectedDelta.y - selectedDelta.y)).toBeLessThanOrEqual(
        4
      )
    })
  }
)
